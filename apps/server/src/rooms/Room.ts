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
  dealCardMs: 120,
  declareWindowMs: 4000,
  botDelayMs: 700,
  trickPauseMs: 1200,
};

const secureRandom = () => randomInt(0, 2 ** 31) / 2 ** 31;

export class Room {
  status: 'lobby' | 'playing' = 'lobby';
  seats: [Seat | null, Seat | null, Seat | null, Seat | null] = [null, null, null, null];
  spectators = new Map<string, string>(); // userId -> name
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
      status: this.status,
      options: this.options,
      undoRequest: this.undoRequest,
      seats: this.seats.map((s) => (s ? ({ ...s } as SeatView) : null)) as RoomView['seats'],
      spectators: [...this.spectators].map(([userId, name]) => ({ userId, name })),
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
      if (s && !s.bot) this.sink.gameState(this, s.userId, this.game, seat, this.deadlineAt);
    }
    // 旁观者用座位 0 视角但不看手牌：简单起见发座位 -1 视角（hand 为空）
    for (const userId of this.spectators.keys()) {
      this.sink.gameState(this, userId, this.game, -1, this.deadlineAt);
    }
  }

  /** 玩家进入（或重连）：补发状态 */
  enter(userId: string, name: string) {
    this.touch();
    const seat = this.seatOf(userId);
    if (seat >= 0) {
      const s = this.seats[seat]!;
      s.connected = true;
      s.name = name;
      // 对局中离开被托管的玩家回来：收回座位
      if (s.bot && !s.userId.startsWith('bot:')) s.bot = false;
    } else {
      this.spectators.set(userId, name);
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
      if (next) this.hostId = next.userId;
    }
    this.broadcastRoom();
  }

  sit(userId: string, seat: number) {
    this.touch();
    if (this.status !== 'lobby') throw new Error('对局进行中不能换座');
    if (this.seats[seat]) throw new Error('该座位已有人');
    const name = this.spectators.get(userId) ?? this.seats[this.seatOf(userId)]?.name ?? '玩家';
    const old = this.seatOf(userId);
    if (old >= 0) this.seats[old] = null;
    this.spectators.delete(userId);
    this.seats[seat] = { userId, name, ready: false, connected: true, bot: false };
    this.broadcastRoom();
  }

  stand(userId: string) {
    this.touch();
    if (this.status !== 'lobby') throw new Error('对局进行中不能离座');
    const seat = this.seatOf(userId);
    if (seat < 0) return;
    const name = this.seats[seat]!.name;
    this.seats[seat] = null;
    this.spectators.set(userId, name);
    this.broadcastRoom();
  }

  addBot(byUserId: string, seat: number) {
    this.requireHost(byUserId);
    if (this.status !== 'lobby') throw new Error('对局进行中不能添加机器人');
    if (this.seats[seat]) throw new Error('该座位已有人');
    this.seats[seat] = {
      userId: `bot:${this.id}:${seat}`,
      name: `机器人${seat + 1}`,
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
    if (this.status !== 'playing') throw new Error('对局未开始');
    this.seats[seat]!.bot = on;
    this.broadcastRoom();
    if (on) this.scheduleBots();
    else this.sink.gameState(this, userId, this.game!, seat, this.deadlineAt);
  }

  chat(userId: string, text: string) {
    const seat = this.seatOf(userId);
    const name = seat >= 0 ? this.seats[seat]!.name : (this.spectators.get(userId) ?? '?');
    this.sink.chat(this, { userId, name, text, at: Date.now() });
  }

  // ---------- 对局驱动 ----------
  start(byUserId: string) {
    this.requireHost(byUserId);
    if (this.status !== 'lobby') throw new Error('对局已经开始');
    if (this.seats.some((s) => !s)) throw new Error('需要 4 名玩家');
    const players = this.seats.map((s) => ({ id: s!.userId, name: s!.name })) as [
      PlayerInfo,
      PlayerInfo,
      PlayerInfo,
      PlayerInfo,
    ];
    this.game = createGame(players, { kittyBonus: this.options.kittyBonus });
    this.status = 'playing';
    this.broadcastRoom();
    this.beginRound();
  }

  nextRound(byUserId: string) {
    this.requireHost(byUserId);
    if (!this.game || this.game.phase !== 'roundEnd') throw new Error('本局尚未结束');
    this.beginRound();
  }

  private beginRound() {
    this.history = [];
    this.cancelUndo();
    this.apply({ type: 'START_ROUND', deck: shuffle(makeDeck(), secureRandom) });
    this.clearTimer();
    this.timer = setInterval(() => {
      if (!this.game || this.game.phase !== 'dealing') {
        this.clearTimer();
        this.deadlineAt = Date.now() + this.declareWindowMs;
        this.broadcastGame();
        this.timer = setTimeout(() => this.endDeclaring(), this.declareWindowMs);
        return;
      }
      this.apply({ type: 'DEAL_CARD' });
      this.runBots();
    }, this.timings.dealCardMs);
  }

  private endDeclaring() {
    if (!this.game || this.game.phase !== 'declaring') return;
    this.deadlineAt = null;
    this.apply({ type: 'END_DECLARING' });
    this.scheduleBots();
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
    for (const ev of result.events) this.sink.gameEvent(this, ev);
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
    if (!this.game || (this.game.phase !== 'kitty' && this.game.phase !== 'playing')) return;
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
    if (g.phase === 'declaring') return; // 亮主窗口的 deadline 由 beginRound 设置
    const actor = currentActor(g);
    const seat = actor !== null ? this.seats[actor] : null;
    if (actor === null || !seat || seat.bot || this.options.turnTimeoutSec === 0) {
      this.deadlineAt = null;
      return;
    }
    const ms = this.options.turnTimeoutSec * 1000;
    this.deadlineAt = Date.now() + ms;
    const expectedRound = g.roundNo;
    const expectedTricks = g.tricks.length;
    const expectedPlays = g.trick?.plays.length ?? -1;
    this.turnTimer = setTimeout(() => {
      const now = this.game;
      if (!now || now.roundNo !== expectedRound || now.tricks.length !== expectedTricks) return;
      if ((now.trick?.plays.length ?? -1) !== expectedPlays || currentActor(now) !== actor) return;
      const a = botAction(now, actor, secureRandom);
      if (a) {
        this.systemMessage(`${this.seats[actor]!.name} 超时，由机器人代打`);
        this.apply(a);
        this.scheduleBots();
      }
    }, ms);
  }

  // ---------- 悔牌 ----------
  private pushHistory(seat: number) {
    if (!this.game) return;
    this.history.push({ seat, state: this.game });
    if (this.history.length > 8) this.history.shift();
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
    const last = this.history[this.history.length - 1];
    if (!last || last.seat !== seat) throw new Error('只能撤回你刚出的牌，且中间不能有别人出牌');
    // 快照之后如果别人已经出牌，则不允许
    const playsSince = this.playsSince(last.state);
    if (playsSince !== 1) throw new Error('你出牌之后已有人跟牌，不能悔牌');
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
        this.systemMessage('悔牌请求超时');
        this.cancelUndo();
        this.broadcastRoom();
      }
    }, 30_000);
    this.settleUndo();
    this.broadcastRoom();
  }

  /** 从快照到现在多出了多少次出牌 */
  private playsSince(snapshot: GameState): number {
    const g = this.game!;
    const count = (s: GameState) =>
      s.tricks.reduce((n, t) => n + t.plays.length, 0) + (s.trick?.plays.length ?? 0);
    return count(g) - count(snapshot);
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
      const last = this.history.pop();
      if (last && this.game) {
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
