'use client';
import type { ChatMessage, GameEvent, PlayerView, RoomView } from '@poker/protocol';
import { create } from 'zustand';
import { getSocket } from './socket';

interface State {
  connected: boolean;
  room: RoomView | null;
  game: PlayerView | null;
  chat: ChatMessage[];
  /** 最近的事件（用于提示，如甩牌失败） */
  notices: { id: number; text: string }[];
  selected: string[];
  toggleSelect(id: string): void;
  clearSelect(): void;
  bind(): () => void;
  notify(text: string): void;
}

let noticeId = 0;

export const useStore = create<State>((set, get) => ({
  connected: false,
  room: null,
  game: null,
  chat: [],
  notices: [],
  selected: [],
  toggleSelect: (id) =>
    set((s) => ({
      selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id],
    })),
  clearSelect: () => set({ selected: [] }),
  notify: (text) => {
    const id = ++noticeId;
    set((s) => ({ notices: [...s.notices, { id, text }] }));
    setTimeout(() => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })), 4000);
  },
  bind: () => {
    const socket = getSocket();
    const onConnect = () => set({ connected: true });
    const onDisconnect = () => set({ connected: false });
    const onRoom = (room: RoomView) => set({ room });
    const onGame = (game: PlayerView) => {
      // 出牌后清空选择
      const prev = get().game;
      if (prev && prev.hand.length !== game.hand.length) set({ selected: [] });
      set({ game });
    };
    const onChat = (msg: ChatMessage) => set((s) => ({ chat: [...s.chat.slice(-99), msg] }));
    const onEvent = (ev: GameEvent) => {
      const g = get().game;
      const name = (seat: number) => g?.players[seat]?.name ?? `座位${seat + 1}`;
      switch (ev.type) {
        case 'declared':
          get().notify(`${name(ev.declaration.seat)} 亮主 ${trumpText(ev.declaration.trump.suit)}`);
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

// 开发/测试模式下把 store 挂到 window，便于 e2e 读取状态
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as { __store: typeof useStore }).__store = useStore;
  void import('@poker/engine').then((engine) => {
    (window as unknown as { __engine: typeof engine }).__engine = engine;
  });
}
