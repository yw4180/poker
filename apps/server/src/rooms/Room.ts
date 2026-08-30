/**
 * 一个房间：座位、旁观、引擎状态、计时驱动（发牌/亮主窗口/机器人）。
 * 通过 RoomSink 与外界解耦，便于测试。
 */
import {
  type Action,
  type GameEvent,
  type GameState,
  type PlayerInfo,
  IllegalAction,
  botAction,
  createGame,
  currentActor,
  makeDeck,
  reduce,
  shuffle,
  viewFor,
} from '@poker/engine';
import {
  type ChatMessage,
  type PlayerAction,
  type RoomOptions,
  type RoomView,
  type SeatView,
  type UndoRequestView,
  DEFAULT_ROOM_OPTIONS,
} from '@poker/protocol';
import { randomInt } from 'node:crypto';
import { botAvatarUrl, botLine, randomBotName } from '../names.js';

/** 客户端提交的选项补丁（zod partial 会带 undefined） */
export type RoomOptionsPatch = { [K in keyof RoomOptions]?: RoomOptions[K] | undefined };
function mergeOptions(base: RoomOptions, patch: RoomOptionsPatch): RoomOptions {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch))
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

export interface Seat {
  userId: string;
  name: string;
  avatar: string | null;
  ready: boolean;
  connected: boolean;
  bot: boolean;
}

export interface RoomSink {
  roomState(room: Room, view: RoomView): void;
  gameState(
    room: Room,
    userId: string,
    state: GameState,
    seat: number,
    deadlineAt: number | null,
  ): void;
  gameEvent(room: Room, event: GameEvent): void;
  chat(room: Room, msg: ChatMessage): void;
  gameFinished(room: Room, state: GameState): void;
}

export interface RoomTimings {
  dealCardMs: number;
  declareWindowMs: number;
  botDelayMs: number;
  trickPauseMs: number;
}
export const DEFAULT_TIMINGS: RoomTimings = {
  dealCardMs: 260,
  declareWindowMs: 4000,
  botDelayMs: 700,
  trickPauseMs: 1200,
};

const secureRandom = () => randomInt(0, 2 ** 31) / 2 ** 31;

export class Room {
  status: 'lobby' | 'playing' = 'lobby';
  seats: [Seat | null, Seat | null, Seat | null, Seat | null] = [null, null, null, null];
  spectators = new Map<string, { name: string; avatar: string | null }>();
  /** 本局结束后已点“下一局”的座位 */
  readyNext = new Set<number>();
  game: GameState | null = null;
  private timer: NodeJS.Timeout | null = null;
  private turnTimer: NodeJS.Timeout | null = null;
  private undoTimer: NodeJS.Timeout | null = null;
  options: RoomOptions;
  /** 每次 PLAY 前的快照，用于悔牌 */
  private history: { seat: number; state: GameState }[] = [];
  undoRequest: UndoRequestView | null = null;
  /** 当前阶段截止时间（亮主窗口） */
  deadlineAt: number | null = null;
  lastActivity = Date.now();

  constructor(
    public readonly id: string,
    public name: string,
    public hostId: string,
    public hostName: string,
    private readonly sink: RoomSink,
    private readonly timings: RoomTimings = DEFAULT_TIMINGS,
    options: RoomOptionsPatch = {},
  ) {
    this.options = mergeOptions(DEFAULT_ROOM_OPTIONS, options);
    // 未显式指定亮主时长时，沿用 timings（便于测试用极短窗口）
    this.declareWindowOverride =
      options.declareWindowSec === undefined && timings !== DEFAULT_TIMINGS
        ? timings.declareWindowMs
        : undefined;
  }

  private readonly declareWindowOverride: number | undefined;
  private get declareWindowMs() {
    return this.declareWindowOverride ?? this.options.declareWindowSec * 1000;
  }

  // ---------- 视图 ----------
  view(): RoomView {
    return {
      id: this.id,
      name: this.name,
      hostId: this.hostId,
      hostName: this.hostName,
      status: this.status,
      options: this.options,
      undoRequest: this.undoRequest,
      readyNext: [...this.readyNext],
      seats: this.seats.map((s) => (s ? ({ ...s } as SeatView) : null)) as RoomView['seats'],
      spectators: [...this.spectators].map(([userId, v]) => ({ userId, ...v })),
    };
  }

  seatOf(userId: string): number {
    return this.seats.findIndex((s) => s?.userId === userId);
  }

  humans(): Seat[] {
    return this.seats.filter((s): s is Seat => !!s && !s.bot);
  }

  isEmpty(): boolean {
    return this.humans().length === 0 && this.spectators.size === 0;
  }

  private touch() {
    this.lastActivity = Date.now();
  }

  private broadcastRoom() {
    this.sink.roomState(this, this.view());
  }

  private broadcastGame() {
    if (!this.game) return;
    for (let seat = 0; seat < 4; seat++) {
      const s = this.seats[seat];
      if (s && !s.userId.startsWith('bot:'))
        this.sink.gameState(this, s.userId, this.game, seat, this.deadlineAt);
    }
    // 旁观者用座位 0 视角但不看手牌：简单起见发座位 -1 视角（hand 为空）
    for (const userId of this.spectators.keys()) {
      this.sink.gameState(this, userId, this.game, -1, this.deadlineAt);
    }
  }

  /** 玩家进入（或重连）：补发状态 */
  enter(userId: string, name: string, avatar: string | null = null) {
    this.touch();
    const seat = this.seatOf(userId);
    if (seat >= 0) {
      const s = this.seats[seat]!;
      s.connected = true;
      s.name = name;
      s.avatar = avatar;
      // 对局中离开被托管的玩家回来：收回座位
      if (s.bot && !s.userId.startsWith('bot:')) s.bot = false;
    } else {
      this.spectators.set(userId, { name, avatar });
    }
    this.broadcastRoom();
    if (this.game) {
      this.sink.gameState(this, userId, this.game, seat, this.deadlineAt);
    }
  }

  disconnect(userId: string) {
    const seat = this.seatOf(userId);
    if (seat >= 0) this.seats[seat]!.connected = false;
    else this.spectators.delete(userId);
    this.broadcastRoom();
  }

  leave(userId: string) {
    this.touch();
    const seat = this.seatOf(userId);
    if (seat >= 0) {
      if (this.status === 'playing') {
        // 对局中离开：座位交给机器人接管
        this.seats[seat] = {
          ...this.seats[seat]!,
          bot: true,
          connected: false,
          name: `${this.seats[seat]!.name}(托管)`,
        };
        this.scheduleBots();
      } else {
        this.seats[seat] = null;
      }
    }
    this.spectators.delete(userId);
    if (this.hostId === userId) {
      const next = this.humans()[0] ?? null;
      if (next) {
        this.hostId = next.userId;
        this.hostName = next.name;
      }
    }
    this.broadcastRoom();
  }

  sit(userId: string, seat: number) {
    this.touch();
    if (this.status !== 'lobby') {
      this.takeOverBot(userId, seat);
      return;
    }
    if (this.seats[seat]) throw new Error('该座位已有人');
    const old = this.seatOf(userId);
    const spec = this.spectators.get(userId);
    const name = spec?.name ?? this.seats[old]?.name ?? '玩家';
    const avatar = spec?.avatar ?? this.seats[old]?.avatar ?? null;
    if (old >= 0) this.seats[old] = null;
    this.spectators.delete(userId);
    this.seats[seat] = { userId, name, avatar, ready: false, connected: true, bot: false };
    this.broadcastRoom();
  }

  stand(userId: string) {
    this.touch();
    const seat = this.seatOf(userId);
    if (seat < 0) return;
    if (this.status !== 'lobby') {
      // 对局中离座：座位交给正式机器人，本人转为旁观
      const { name, avatar } = this.seats[seat]!;
      this.convertSeatToBot(seat);
      this.spectators.set(userId, { name, avatar });
      this.systemMessage(`${name} 离座，由 ${this.seats[seat]!.name} 接替`);
      this.broadcastRoom();
      this.broadcastGame();
      this.scheduleBots();
      return;
    }
    const { name, avatar } = this.seats[seat]!;
    this.seats[seat] = null;
    this.spectators.set(userId, { name, avatar });
    this.broadcastRoom();
  }

  /** 把某个座位换成正式机器人（对局中用） */
  private convertSeatToBot(seat: number) {
    const name = randomBotName(this.seats.filter((x): x is Seat => !!x).map((x) => x.name));
    this.seats[seat] = {
      userId: `bot:${this.id}:${seat}:${Date.now()}`,
      name,
      avatar: botAvatarUrl(name),
      ready: true,
      connected: true,
      bot: true,
    };
    this.syncPlayer(seat);
  }

  /** 旁观者对局中接管纯机器人座位 */
  private takeOverBot(userId: string, seat: number) {
    if (this.seatOf(userId) >= 0) throw new Error('你已经在座位上');
    const target = this.seats[seat];
    if (!target || !target.userId.startsWith('bot:')) throw new Error('只能接管机器人座位');
    const spec = this.spectators.get(userId);
    if (!spec) throw new Error('请先进入房间');
    this.spectators.delete(userId);
    this.seats[seat] = {
      userId,
      name: spec.name,
      avatar: spec.avatar,
      ready: true,
      connected: true,
      bot: false,
    };
    this.syncPlayer(seat);
    this.systemMessage(`${spec.name} 接管了 ${target.name} 的座位`);
    this.broadcastRoom();
    this.broadcastGame();
    this.armTurnTimer();
  }

  /** 房主把托管/掉线的座位换成正式机器人（原玩家转为旁观） */
  fillBot(byUserId: string, seat: number) {
    this.requireHost(byUserId);
    if (this.status !== 'playing') throw new Error('对局未开始');
    const target = this.seats[seat];
    if (!target) throw new Error('座位为空');
    if (target.userId.startsWith('bot:')) throw new Error('该座位已是机器人');
    if (target.connected && !target.bot) throw new Error('该玩家在线且未托管，不能替换');
    this.convertSeatToBot(seat);
    this.spectators.set(target.userId, { name: target.name, avatar: target.avatar });
    this.systemMessage(`${target.name} 的座位由 ${this.seats[seat]!.name} 接替`);
    this.broadcastRoom();
    this.broadcastGame();
    this.scheduleBots();
  }

  /** 座位人员变化后同步到引擎的 players 信息 */
  private syncPlayer(seat: number) {
    if (!this.game) return;
    const s = this.seats[seat]!;
    const players = this.game.players.slice() as GameState['players'];
    players[seat] = { id: s.userId, name: s.name, avatar: s.avatar };
    this.game = { ...this.game, players };
  }

  addBot(byUserId: string, seat: number) {
    this.requireHost(byUserId);
    if (this.status !== 'lobby') throw new Error('对局进行中不能添加机器人');
    if (this.seats[seat]) throw new Error('该座位已有人');
    const name = randomBotName(this.seats.filter((s): s is Seat => !!s).map((s) => s.name));
    this.seats[seat] = {
      userId: `bot:${this.id}:${seat}`,
      name,
      avatar: botAvatarUrl(name),
      ready: true,
      connected: true,
      bot: true,
    };
    this.broadcastRoom();
  }

  removeBot(byUserId: string, seat: number) {
    this.requireHost(byUserId);
    if (this.status !== 'lobby') throw new Error('对局进行中不能移除机器人');
    if (!this.seats[seat]?.bot) throw new Error('该座位不是机器人');
    this.seats[seat] = null;
    this.broadcastRoom();
  }

  setOptions(byUserId: string, patch: RoomOptionsPatch) {
    this.requireHost(byUserId);
    if (this.status !== 'lobby') throw new Error('对局进行中不能修改选项');
    this.options = mergeOptions(this.options, patch);
    this.broadcastRoom();
  }

  private requireHost(userId: string) {
    if (userId !== this.hostId) throw new Error('只有房主可以进行此操作');
  }

  /** 玩家自行开关托管（对局中有效） */
  setAutoplay(userId: string, on: boolean) {
    this.touch();
    const seat = this.seatOf(userId);
    if (seat < 0) throw new Error('你不在座位上');
    if (on && this.status !== 'playing') throw new Error('对局未开始');
    if (!on && this.seats[seat]!.userId.startsWith('bot:')) throw new Error('该座位是机器人');
    this.seats[seat]!.bot = on;
    this.broadcastRoom();
    if (on) this.scheduleBots();
    else this.sink.gameState(this, userId, this.game!, seat, this.deadlineAt);
  }

  chat(userId: string, text: string) {
    const seat = this.seatOf(userId);
    const name = seat >= 0 ? this.seats[seat]!.name : (this.spectators.get(userId)?.name ?? '?');
    this.sink.chat(this, { userId, name, text, at: Date.now() });
  }

  // ---------- 对局驱动 ----------
  start(byUserId: string) {
    this.requireHost(byUserId);
    if (this.status !== 'lobby') throw new Error('对局已经开始');
    if (this.seats.some((s) => !s)) throw new Error('需要 4 名玩家');
    const players = this.seats.map((s) => ({
      id: s!.userId,
      name: s!.name,
      avatar: s!.avatar,
    })) as [PlayerInfo, PlayerInfo, PlayerInfo, PlayerInfo];
    this.game = createGame(players, {
      kittyBonus: this.options.kittyBonus,
      startLevel: this.options.startLevel as 2,
    });
    this.status = 'playing';
    this.broadcastRoom();
    this.beginRound();
  }

  /** 任意入座玩家点“下一局”即为准备；机器人自动准备；全员准备后开始 */
  nextRound(byUserId: string) {
    const seat = this.seatOf(byUserId);
    if (seat < 0) throw new Error('你不在座位上');
    if (!this.game || this.game.phase !== 'roundEnd') throw new Error('本局尚未结束');
    this.readyNext.add(seat);
    for (let s = 0; s < 4; s++) if (this.seats[s]?.bot) this.readyNext.add(s);
    if (this.readyNext.size === 4) {
      this.beginRound();
    } else {
      this.broadcastRoom();
    }
  }

  private beginRound() {
    this.readyNext.clear();
    // 新一局自动取消托管（离线玩家保持托管，避免卡住）
    for (const s of this.seats) {
      if (s && s.bot && !s.userId.startsWith('bot:') && s.connected) s.bot = false;
    }
    this.history = [];
    this.cancelUndo();
    this.broadcastRoom();
    this.apply({ type: 'START_ROUND', deck: shuffle(makeDeck(), secureRandom) });
    this.startDealLoop();
  }

  private startDealLoop() {
    this.clearTimer();
    this.timer = setInterval(() => {
      if (!this.game || this.game.phase !== 'dealing') {
        this.clearTimer();
        this.scheduleBots();
        return;
      }
      this.apply({ type: 'DEAL_CARD' });
      this.runBots();
    }, this.timings.dealCardMs);
  }

  /** 玩家操作入口 */
  playerAction(userId: string, action: PlayerAction) {
    this.touch();
    const seat = this.seatOf(userId);
    if (seat < 0) throw new Error('你不在座位上');
    if (!this.game) throw new Error('对局未开始');
    if (action.type === 'PLAY') this.pushHistory(seat);
    this.apply({ ...action, seat });
    this.scheduleBots();
  }

  private apply(action: Action) {
    if (!this.game) return;
    let result;
    try {
      result = reduce(this.game, action);
    } catch (e) {
      if (e instanceof IllegalAction) throw new Error(e.message);
      throw e;
    }
    this.game = result.state;
    this.armTurnTimer();
    this.broadcastGame();
    for (const ev of result.events) {
      this.sink.gameEvent(this, ev);
      this.botChatter(ev);
    }
    if (this.game.phase === 'finished') {
      this.status = 'lobby';
      for (const s of this.seats) if (s && !s.bot) s.ready = false;
      this.clearTimer();
      this.sink.gameFinished(this, this.game);
      this.broadcastRoom();
    }
  }

  /** 若轮到机器人则延迟执行其动作 */
  private scheduleBots() {
    if (!this.game || !['kitty', 'playing', 'declaring'].includes(this.game.phase)) return;
    const delay =
      this.game.phase === 'playing' && this.game.trick?.plays.length === 0
        ? this.timings.trickPauseMs
        : this.timings.botDelayMs;
    this.clearTimer();
    this.timer = setTimeout(() => this.runBots(), delay);
  }

  private runBots() {
    if (!this.game) return;
    for (let seat = 0; seat < 4; seat++) {
      const s = this.seats[seat];
      if (!s?.bot) continue;
      const a = botAction(this.game, seat, secureRandom);
      if (a) {
        this.apply(a);
        this.scheduleBots();
        return;
      }
    }
  }

  private clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  // ---------- 持久化 ----------
  /** 序列化为可存盘的快照（不含计时器/悔牌请求/观战者） */
  snapshot() {
    return {
      id: this.id,
      name: this.name,
      hostId: this.hostId,
      hostName: this.hostName,
      options: this.options,
      status: this.status,
      seats: this.seats,
      game: this.game,
      readyNext: [...this.readyNext],
      lastActivity: this.lastActivity,
    };
  }

  static restore(data: ReturnType<Room['snapshot']>, sink: RoomSink, timings: RoomTimings): Room {
    const room = new Room(
      data.id,
      data.name,
      data.hostId,
      data.hostName,
      sink,
      timings,
      data.options,
    );
    room.status = data.status;
    room.seats = data.seats;
    // 重启后所有人都处于未连接状态，等待重连
    for (const s of room.seats) if (s) s.connected = s.bot && s.userId.startsWith('bot:');
    room.game = data.game;
    room.readyNext = new Set(data.readyNext);
    room.lastActivity = data.lastActivity;
    return room;
  }

  /** 重启恢复后重新武装计时器与机器人 */
  resume() {
    if (!this.game) return;
    if (this.game.phase === 'dealing') {
      this.startDealLoop();
    } else {
      this.armTurnTimer();
      this.scheduleBots();
    }
  }

  dispose() {
    this.clearTimer();
    if (this.turnTimer) clearTimeout(this.turnTimer);
    if (this.undoTimer) clearTimeout(this.undoTimer);
  }

  // ---------- 出牌倒计时（超时由机器人代打一手） ----------
  private armTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    const g = this.game;
    if (!g) return;
    const actor = currentActor(g);
    const seat = actor !== null ? this.seats[actor] : null;
    const declaring = g.phase === 'declaring';
    const windowMs = declaring ? this.declareWindowMs : this.options.turnTimeoutSec * 1000;
    if (actor === null || !seat || seat.bot || windowMs === 0) {
      this.deadlineAt = null;
      return;
    }
    const ms = windowMs;
    this.deadlineAt = Date.now() + ms;
    const expectedRound = g.roundNo;
    const expectedTricks = g.tricks.length;
    const expectedPlays = g.trick?.plays.length ?? -1;
    this.turnTimer = setTimeout(() => {
      const now = this.game;
      if (!now || now.roundNo !== expectedRound || now.tricks.length !== expectedTricks) return;
      if ((now.trick?.plays.length ?? -1) !== expectedPlays || currentActor(now) !== actor) return;
      if (now.phase === 'declaring') {
        this.systemMessage(`${this.seats[actor]!.name} 超时，自动过`);
        this.apply({ type: 'PASS_DECLARE', seat: actor });
        this.scheduleBots();
        return;
      }
      const a = botAction(now, actor, secureRandom);
      if (a) {
        this.systemMessage(`${this.seats[actor]!.name} 超时，由机器人代打`);
        this.apply(a);
        this.scheduleBots();
      }
    }, ms);
  }

  /** 亮主阶段选择“过”（引擎校验是否轮到该座位） */
  passDeclare(userId: string) {
    const seat = this.seatOf(userId);
    if (seat < 0) throw new Error('你不在座位上');
    this.apply({ type: 'PASS_DECLARE', seat });
    this.scheduleBots();
  }

  // ---------- 悔牌 ----------
  private pushHistory(seat: number) {
    if (!this.game) return;
    this.history.push({ seat, state: this.game });
  }

  /** 机器人偶尔说两句，增加点人气 */
  private botChatter(ev: GameEvent) {
    const say = (seat: number, text: string) => {
      const s = this.seats[seat];
      if (!s?.bot || !s.userId.startsWith('bot:')) return;
      setTimeout(
        () => this.sink.chat(this, { userId: s.userId, name: s.name, text, at: Date.now() }),
        400 + Math.random() * 800,
      );
    };
    if (ev.type === 'trickWon' && ev.points >= 20 && Math.random() < 0.35)
      say(ev.winner, botLine('bigTrick'));
    if (ev.type === 'roundEnded') {
      const r = ev.result;
      const winners = [0, 1, 2, 3].filter((s) => s % 2 === r.winningTeam);
      const losers = [0, 1, 2, 3].filter((s) => s % 2 !== r.winningTeam);
      const attackersKilledKitty = r.kittyMultiplier > 1 && r.kittyPoints > 0;
      const w = winners[Math.floor(Math.random() * 2)]!;
      const l = losers[Math.floor(Math.random() * 2)]!;
      if (Math.random() < 0.7)
        say(
          w,
          attackersKilledKitty && r.winningTeam !== this.game!.dealer! % 2
            ? botLine('killKitty')
            : botLine('roundWin'),
        );
      if (Math.random() < 0.5) say(l, botLine('roundLose'));
    }
  }

  private systemMessage(text: string) {
    this.sink.chat(this, { userId: 'system', name: '系统', text, at: Date.now() });
  }

  requestUndo(userId: string) {
    if (!this.options.undo) throw new Error('本房间未开启悔牌');
    const seat = this.seatOf(userId);
    if (seat < 0) throw new Error('你不在座位上');
    if (!this.game || this.game.phase !== 'playing') throw new Error('现在不能悔牌');
    if (this.undoRequest) throw new Error('已有悔牌请求进行中');
    const idx = this.history.map((h) => h.seat).lastIndexOf(seat);
    if (idx < 0) throw new Error('本局你还没有出过牌');
    const required = [0, 1, 2, 3].filter((s) => s % 2 !== seat % 2);
    const approved = required.filter((s) => this.seats[s]?.bot);
    this.undoRequest = {
      seat,
      name: this.seats[seat]!.name,
      expiresAt: Date.now() + 30_000,
      approved,
      required,
    };
    this.systemMessage(`${this.seats[seat]!.name} 请求悔牌`);
    this.undoTimer = setTimeout(() => {
      if (this.undoRequest) {
        this.systemMessage('30 秒内无人响应，悔牌自动拒绝');
        this.cancelUndo();
        this.broadcastRoom();
      }
    }, 30_000);
    this.settleUndo();
    this.broadcastRoom();
  }

  voteUndo(userId: string, approve: boolean) {
    const seat = this.seatOf(userId);
    const req = this.undoRequest;
    if (!req) throw new Error('没有待处理的悔牌请求');
    if (!req.required.includes(seat)) throw new Error('你不需要投票');
    if (!approve) {
      this.systemMessage(`${this.seats[seat]!.name} 拒绝了悔牌`);
      this.cancelUndo();
      this.broadcastRoom();
      return;
    }
    if (!req.approved.includes(seat)) req.approved.push(seat);
    this.settleUndo();
    this.broadcastRoom();
  }

  private settleUndo() {
    const req = this.undoRequest;
    if (!req) return;
    if (req.required.every((s) => req.approved.includes(s))) {
      const idx = this.history.map((h) => h.seat).lastIndexOf(req.seat);
      const last = idx >= 0 ? this.history[idx] : undefined;
      if (last && this.game) {
        this.history.splice(idx); // 该次出牌及其后的快照全部丢弃
        this.game = last.state;
        this.systemMessage(`${req.name} 悔牌成功`);
        this.cancelUndo();
        this.armTurnTimer();
        this.broadcastGame();
        this.scheduleBots();
      }
    }
  }

  private cancelUndo() {
    this.undoRequest = null;
    if (this.undoTimer) {
      clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
  }

  playerView(userId: string) {
    if (!this.game) return null;
    return viewFor(this.game, this.seatOf(userId));
  }
}
