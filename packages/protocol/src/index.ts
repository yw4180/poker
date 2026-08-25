/**
 * 前后端共享的 Socket.IO 事件协议。
 * 所有客户端→服务器的载荷都用 zod 校验。
 */
import { z } from 'zod';
import type { GameEvent, PlayerView } from '@poker/engine';

export const RoomIdSchema = z.string().regex(/^[A-Z0-9]{4,8}$/);

/** 玩家可主动发起的引擎动作（发牌/结束亮主等由服务器驱动） */
export const PlayerActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('DECLARE'), cardIds: z.array(z.string()).min(1).max(2) }),
  z.object({ type: z.literal('BURY'), cardIds: z.array(z.string()).length(8) }),
  z.object({ type: z.literal('PLAY'), cardIds: z.array(z.string()).min(1).max(25) }),
]);
export type PlayerAction = z.infer<typeof PlayerActionSchema>;

export const ClientEvents = {
  'room:create': z.object({ name: z.string().trim().min(1).max(30).optional() }),
  'room:join': z.object({ roomId: RoomIdSchema }),
  'room:leave': z.object({}),
  'room:sit': z.object({ seat: z.number().int().min(0).max(3) }),
  'room:stand': z.object({}),
  'room:addBot': z.object({ seat: z.number().int().min(0).max(3) }),
  'room:removeBot': z.object({ seat: z.number().int().min(0).max(3) }),
  'room:start': z.object({}),
  'room:nextRound': z.object({}),
  'room:autoplay': z.object({ on: z.boolean() }),
  'game:action': PlayerActionSchema,
  'chat:send': z.object({ text: z.string().trim().min(1).max(200) }),
} as const;
export type ClientEventName = keyof typeof ClientEvents;
export type ClientPayload<E extends ClientEventName> = z.infer<(typeof ClientEvents)[E]>;

export interface SeatView {
  userId: string;
  name: string;
  ready: boolean;
  connected: boolean;
  bot: boolean;
}

export interface RoomView {
  id: string;
  name: string;
  hostId: string;
  status: 'lobby' | 'playing';
  seats: [SeatView | null, SeatView | null, SeatView | null, SeatView | null];
  spectators: { userId: string; name: string }[];
}

export interface ChatMessage {
  userId: string;
  name: string;
  text: string;
  at: number;
}

export interface Ack<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

/** 服务器→客户端事件的类型定义（供 socket.io 泛型使用） */
/** 下发给客户端的对局视角：引擎视角 + 服务器计时信息 */
export type GameView = PlayerView & {
  /** 所属房间，客户端据此丢弃过期状态 */
  roomId: string;
  /** 当前阶段的截止时间戳（如亮主窗口），无则 null */
  deadlineAt: number | null;
};

export interface ServerToClientEvents {
  'room:state': (room: RoomView) => void;
  'room:closed': () => void;
  'game:state': (view: GameView) => void;
  'game:event': (event: GameEvent) => void;
  'chat:message': (msg: ChatMessage) => void;
  error: (payload: { message: string; code?: string }) => void;
}

export interface ClientToServerEvents {
  'room:create': (
    p: ClientPayload<'room:create'>,
    ack: (r: Ack<{ roomId: string }>) => void,
  ) => void;
  'room:join': (p: ClientPayload<'room:join'>, ack: (r: Ack) => void) => void;
  'room:leave': (p: ClientPayload<'room:leave'>, ack: (r: Ack) => void) => void;
  'room:sit': (p: ClientPayload<'room:sit'>, ack: (r: Ack) => void) => void;
  'room:stand': (p: ClientPayload<'room:stand'>, ack: (r: Ack) => void) => void;
  'room:addBot': (p: ClientPayload<'room:addBot'>, ack: (r: Ack) => void) => void;
  'room:removeBot': (p: ClientPayload<'room:removeBot'>, ack: (r: Ack) => void) => void;
  'room:start': (p: ClientPayload<'room:start'>, ack: (r: Ack) => void) => void;
  'room:nextRound': (p: ClientPayload<'room:nextRound'>, ack: (r: Ack) => void) => void;
  'room:autoplay': (p: ClientPayload<'room:autoplay'>, ack: (r: Ack) => void) => void;
  'game:action': (p: ClientPayload<'game:action'>, ack: (r: Ack) => void) => void;
  'chat:send': (p: ClientPayload<'chat:send'>, ack: (r: Ack) => void) => void;
}

export type { GameEvent, PlayerView };
