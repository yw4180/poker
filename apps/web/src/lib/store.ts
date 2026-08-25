'use client';
import type { ChatMessage, GameEvent, GameView, RoomView } from '@poker/protocol';
import { create } from 'zustand';
import { getSocket } from './socket';

export type ChatLine = ChatMessage & { system?: boolean };
export interface LogLine {
  text: string;
  at: number;
}

interface State {
  connected: boolean;
  /** 页面正在浏览的房间；不属于它的状态一律丢弃 */
  currentRoomId: string | null;
  room: RoomView | null;
  game: GameView | null;
  chat: ChatLine[];
  /** 对局记录（亮主、得分、系统消息） */
  log: LogLine[];
  notices: { id: number; text: string }[];
  selected: string[];
  /** 刚拿到的底牌 id（高亮几秒） */
  kittyNewIds: string[];
  showLastTrick: boolean;
  /** 本局结算弹窗是否被用户关闭（换局自动重置） */
  roundEndDismissed: boolean;
  setRoundEndDismissed(v: boolean): void;
  toggleSelect(id: string): void;
  setSelected(ids: string[]): void;
  clearSelect(): void;
  setShowLastTrick(v: boolean): void;
  /** 进入某个房间页面：切换房间时清空旧状态 */
  enterRoom(roomId: string): void;
  bind(): () => void;
  notify(text: string): void;
}

let noticeId = 0;

export const useStore = create<State>((set, get) => ({
  connected: false,
  currentRoomId: null,
  room: null,
  game: null,
  chat: [],
  log: [],
  notices: [],
  selected: [],
  kittyNewIds: [],
  showLastTrick: false,
  roundEndDismissed: false,
  setRoundEndDismissed: (v) => set({ roundEndDismissed: v }),
  toggleSelect: (id) =>
    set((s) => ({
      selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id],
    })),
  setSelected: (ids) => set({ selected: ids }),
  clearSelect: () => set({ selected: [] }),
  setShowLastTrick: (v) => set({ showLastTrick: v }),
  enterRoom: (roomId) => {
    if (get().currentRoomId === roomId) return;
    set({
      currentRoomId: roomId,
      room: null,
      game: null,
      chat: [],
      log: [],
      selected: [],
      showLastTrick: false,
    });
  },
  notify: (text) => {
    const id = ++noticeId;
    set((s) => ({
      notices: [...s.notices, { id, text }],
      log: [...s.log.slice(-199), { text, at: Date.now() }],
    }));
    setTimeout(() => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })), 4000);
  },
  bind: () => {
    const socket = getSocket();
    const onConnect = () => set({ connected: true });
    const onDisconnect = () => set({ connected: false });
    const onRoom = (room: RoomView) => {
      if (get().currentRoomId && room.id !== get().currentRoomId) return;
      set({ room });
    };
    const onGame = (game: GameView) => {
      if (get().currentRoomId && game.roomId !== get().currentRoomId) return;
      const prev = get().game;
      const patch: Partial<State> = { game };
      if (prev && prev.hand?.length !== game.hand?.length) patch.selected = [];
      // 进入扣底阶段：标记新拿到的底牌
      if (prev && prev.phase !== 'kitty' && game.phase === 'kitty' && game.seat === game.dealer) {
        const before = new Set(prev.hand.map((c) => c.id));
        patch.kittyNewIds = game.hand.filter((c) => !before.has(c.id)).map((c) => c.id);
        setTimeout(() => set({ kittyNewIds: [] }), 4000);
      }
      if (prev && prev.roundNo !== game.roundNo) {
        patch.showLastTrick = false;
        patch.roundEndDismissed = false;
      }
      set(patch);
    };
    const onChat = (msg: ChatMessage) => {
      // 服务器的系统消息（悔牌、超时代打等）进入对局记录
      if (msg.userId === 'system') get().notify(msg.text);
      else set((s) => ({ chat: [...s.chat.slice(-149), msg] }));
    };
    const onEvent = (ev: GameEvent) => {
      const g = get().game;
      const name = (seat: number) => g?.players[seat]?.name ?? `座位${seat + 1}`;
      switch (ev.type) {
        case 'declared':
          get().notify(
            `${name(ev.declaration.seat)} 亮主 ${trumpText(ev.declaration.trump.suit)}${ev.declaration.strength >= 2 ? '（一对）' : ''}`,
          );
          break;
        case 'trumpSet':
          get().notify(
            `本局主牌：${trumpText(ev.trump.suit)}，庄家：${name(ev.dealer)}${ev.fromKitty ? '（翻底牌定主）' : ''}`,
          );
          break;
        case 'played':
          if (ev.forced) get().notify(`${name(ev.seat)} 甩牌失败，被迫出最小的部分`);
          break;
        case 'trickWon':
          if (ev.points > 0) get().notify(`${name(ev.winner)} 赢下本墩，得 ${ev.points} 分`);
          break;
        case 'roundEnded': {
          const r = ev.result;
          get().notify(
            `本局结束：闲家 ${r.attackerPoints} 分（底牌 ${r.kittyPoints}×${r.kittyMultiplier}），${r.winningTeam === 0 ? '1/3' : '2/4'} 队升 ${r.levelsGained} 级`,
          );
          break;
        }
        case 'gameOver':
          get().notify(`游戏结束！${ev.winner === 0 ? '1/3' : '2/4'} 队获胜`);
          break;
      }
    };
    const onError = (e: { message: string }) => get().notify(e.message);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoom);
    socket.on('game:state', onGame);
    socket.on('chat:message', onChat);
    socket.on('game:event', onEvent);
    socket.on('error', onError);
    if (socket.connected) set({ connected: true });
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoom);
      socket.off('game:state', onGame);
      socket.off('chat:message', onChat);
      socket.off('game:event', onEvent);
      socket.off('error', onError);
    };
  },
}));

export function trumpText(suit: string): string {
  return { S: '♠ 黑桃', H: '♥ 红桃', D: '♦ 方块', C: '♣ 梅花', NT: '无主' }[suit] ?? suit;
}

const LEVEL_TEXT: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const levelText = (n: number) => LEVEL_TEXT[n] ?? String(n);
export const teamText = (team: number) => (team === 0 ? '1/3 队' : '2/4 队');

// 开发/测试模式下把 store 挂到 window，便于 e2e 读取状态
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as { __store: typeof useStore }).__store = useStore;
  void import('@poker/engine').then((engine) => {
    (window as unknown as { __engine: typeof engine }).__engine = engine;
  });
}
