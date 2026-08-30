/**
 * 前后端共享的 Socket.IO 事件协议。
 * 所有客户端→服务器的载荷都用 zod 校验。
 */
import { z } from 'zod';
import type { GameEvent, PlayerView } from '@poker/engine';

export const RoomIdSchema = z.string().regex(/^[A-Z0-9]{4,8}$/);

/** 创建房间时的可选规则/辅助功能 */
export const RoomOptionsSchema = z.object({
  /** 记牌器：可查看尚未出现的牌 */
  cardCounter: z.boolean(),
  /** 悔牌：需对方两人同意（机器人自动同意） */
  undo: z.boolean(),
  /** 是否允许"提示"按钮 */
  hint: z.boolean(),
  /** 出牌倒计时（秒），0 = 不限时；超时由机器人代打一手 */
  turnTimeoutSec: z.union([z.literal(0), z.literal(20), z.literal(40), z.literal(60)]),
  /** 亮主/反主窗口（秒），0 = 无限制（全员点"过"才继续） */
  declareWindowSec: z.union([
    z.literal(0),
    z.literal(3),
    z.literal(6),
    z.literal(10),
    z.literal(15),
    z.literal(30),
    z.literal(60),
  ]),
  /** 底牌翻倍：double 固定×2；exp 拖拉机 2^n */
  kittyBonus: z.enum(['double', 'exp']),
  /** 起打级别（升到 A 获胜） */
  startLevel: z.number().int().min(2).max(13),
});
export type RoomOptions = z.infer<typeof RoomOptionsSchema>;
export const DEFAULT_ROOM_OPTIONS: RoomOptions = {
  cardCounter: false,
  undo: false,
  hint: true,
  turnTimeoutSec: 0,
  declareWindowSec: 6,
  kittyBonus: 'exp',
  startLevel: 2,
};

/** 玩家可主动发起的引擎动作（发牌/结束亮主等由服务器驱动） */
export const PlayerActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('DECLARE'), cardIds: z.array(z.string()).min(1).max(2) }),
  z.object({ type: z.literal('BURY'), cardIds: z.array(z.string()).length(8) }),
  z.object({ type: z.literal('PLAY'), cardIds: z.array(z.string()).min(1).max(25) }),
  z.object({ type: z.literal('PASS_DECLARE') }),
]);
export type PlayerAction = z.infer<typeof PlayerActionSchema>;

export const ClientEvents = {
  'room:create': z.object({
    name: z.string().trim().min(1).max(30).optional(),
    options: RoomOptionsSchema.partial().optional(),
  }),
  'room:setOptions': z.object({ options: RoomOptionsSchema.partial() }),
  'room:join': z.object({ roomId: RoomIdSchema }),
  'room:leave': z.object({}),
  'room:sit': z.object({ seat: z.number().int().min(0).max(3) }),
  'room:stand': z.object({}),
  'room:addBot': z.object({ seat: z.number().int().min(0).max(3) }),
  'room:removeBot': z.object({ seat: z.number().int().min(0).max(3) }),
  'room:fillBot': z.object({ seat: z.number().int().min(0).max(3) }),
  'room:start': z.object({}),
  'room:nextRound': z.object({}),
  'room:autoplay': z.object({ on: z.boolean() }),
  'game:undoRequest': z.object({}),
  'game:undoVote': z.object({ approve: z.boolean() }),
  'game:action': PlayerActionSchema,
  'chat:send': z.object({ text: z.string().trim().min(1).max(200) }),
} as const;
export type ClientEventName = keyof typeof ClientEvents;
export type ClientPayload<E extends ClientEventName> = z.infer<(typeof ClientEvents)[E]>;

export interface SeatView {
  userId: string;
  name: string;
  avatar: string | null;
  ready: boolean;
  connected: boolean;
  bot: boolean;
}

export interface UndoRequestView {
  seat: number;
  name: string;
  expiresAt: number;
  /** 已同意的座位 */
  approved: number[];
  /** 需要同意的座位 */
  required: number[];
}

export interface RoomView {
  id: string;
  name: string;
  hostId: string;
  /** 房主昵称，用于“xx的房间 · 名称” */
  hostName: string;
  status: 'lobby' | 'playing';
  options: RoomOptions;
  undoRequest: UndoRequestView | null;
  /** 已点击“下一局”的座位 */
  readyNext: number[];
  seats: [SeatView | null, SeatView | null, SeatView | null, SeatView | null];
  spectators: { userId: string; name: string; avatar: string | null }[];
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
  'room:fillBot': (p: ClientPayload<'room:fillBot'>, ack: (r: Ack) => void) => void;
  'room:start': (p: ClientPayload<'room:start'>, ack: (r: Ack) => void) => void;
  'room:nextRound': (p: ClientPayload<'room:nextRound'>, ack: (r: Ack) => void) => void;
  'room:autoplay': (p: ClientPayload<'room:autoplay'>, ack: (r: Ack) => void) => void;
  'room:setOptions': (p: ClientPayload<'room:setOptions'>, ack: (r: Ack) => void) => void;
  'game:undoRequest': (p: ClientPayload<'game:undoRequest'>, ack: (r: Ack) => void) => void;
  'game:undoVote': (p: ClientPayload<'game:undoVote'>, ack: (r: Ack) => void) => void;
  'game:action': (p: ClientPayload<'game:action'>, ack: (r: Ack) => void) => void;
  'chat:send': (p: ClientPayload<'chat:send'>, ack: (r: Ack) => void) => void;
}

export type { GameEvent, PlayerView };
