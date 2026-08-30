import { type GameState, viewFor } from '@poker/engine';
import {
  type ClientEventName,
  type ClientToServerEvents,
  type RoomView,
  type ServerToClientEvents,
  ClientEvents,
} from '@poker/protocol';
import { randomUUID } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { AuthUser } from './auth.js';
import type { Room, RoomSink } from './rooms/Room.js';
import { RoomManager } from './rooms/RoomManager.js';
import type { RoomTimings } from './rooms/Room.js';

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type Sock = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface SocketDeps {
  authenticate(headers: Headers): Promise<AuthUser | null>;
  onGameFinished?(room: Room, state: GameState): Promise<void> | void;
  timings?: RoomTimings;
  corsOrigin: string;
}

export function attachSocket(http: HttpServer, deps: SocketDeps): { io: IO; rooms: RoomManager } {
  const io: IO = new Server(http, {
    cors: { origin: deps.corsOrigin, credentials: true },
  });

  const userRoom = (userId: string) => `user:${userId}`;

  const sink: RoomSink = {
    roomState(room, view: RoomView) {
      io.to(`room:${room.id}`).emit('room:state', view);
    },
    gameState(room, userId, state, seat, deadlineAt) {
      io.to(userRoom(userId)).emit('game:state', {
        ...viewFor(state, seat),
        roomId: room.id,
        deadlineAt,
      });
    },
    gameEvent(room, event) {
      io.to(`room:${room.id}`).emit('game:event', event);
    },
    chat(room, msg) {
      io.to(`room:${room.id}`).emit('chat:message', msg);
    },
    gameFinished(room, state) {
      void deps.onGameFinished?.(room, state);
    },
  };
  const rooms = new RoomManager(sink, deps.timings);
  setInterval(() => rooms.sweep(), 60_000).unref();

  io.use(async (socket, next) => {
    try {
      const headers = new Headers();
      for (const [k, v] of Object.entries(socket.handshake.headers)) {
        if (typeof v === 'string') headers.set(k, v);
      }
      const user = await deps.authenticate(headers);
      if (!user) return next(new Error('未登录'));
      socket.data.user = user;
      next();
    } catch (e) {
      next(e as Error);
    }
  });

  const bootId = randomUUID();

  io.on('connection', (socket: Sock) => {
    const user = socket.data.user as AuthUser;
    socket.emit('server:info', { bootId });
    void socket.join(userRoom(user.id));

    /** 统一封装：zod 校验 + 错误转 ack */
    const on = <E extends ClientEventName>(
      event: E,
      handler: (payload: Parameters<ClientToServerEvents[E]>[0]) => unknown,
    ) => {
      socket.on(event, ((payload: unknown, ack?: (r: unknown) => void) => {
        const reply = (r: unknown) => typeof ack === 'function' && ack(r);
        const parsed = ClientEvents[event].safeParse(payload ?? {});
        if (!parsed.success) return reply({ ok: false, error: '参数错误' });
        try {
          const data = handler(parsed.data as Parameters<ClientToServerEvents[E]>[0]);
          reply({ ok: true, data });
        } catch (e) {
          reply({ ok: false, error: (e as Error).message });
        }
      }) as never);
    };

    const leaveRoomChannels = () => {
      for (const r of socket.rooms) if (r.startsWith('room:')) void socket.leave(r);
    };
    const joinRoom = (roomId: string) => {
      const target = rooms.get(roomId);
      if (!target) throw new Error('房间不存在');
      // 退出旧房间频道，避免旧房间的广播覆盖当前房间状态
      leaveRoomChannels();
      // 先加入频道再进房间，确保能收到进房时的广播
      void socket.join(`room:${target.id}`);
      return rooms.join(user.id, user.name, target.id, user.avatar);
    };
    const current = () => {
      const room = rooms.roomOf(user.id);
      if (!room) throw new Error('你不在任何房间');
      return room;
    };

    on('room:create', (p) => {
      const room = rooms.create(user.id, user.name, p.name, p.options ?? {});
      joinRoom(room.id);
      return { roomId: room.id };
    });
    on('room:join', (p) => {
      joinRoom(p.roomId);
    });
    on('room:leave', () => {
      leaveRoomChannels();
      rooms.leave(user.id);
    });
    on('room:sit', (p) => current().sit(user.id, p.seat));
    on('room:stand', () => current().stand(user.id));
    on('room:addBot', (p) => current().addBot(user.id, p.seat));
    on('room:removeBot', (p) => current().removeBot(user.id, p.seat));
    on('room:fillBot', (p) => current().fillBot(user.id, p.seat));
    on('room:start', () => current().start(user.id));
    on('room:nextRound', () => current().nextRound(user.id));
    on('room:autoplay', (p) => current().setAutoplay(user.id, p.on));
    on('room:setOptions', (p) => current().setOptions(user.id, p.options));
    on('game:undoRequest', () => current().requestUndo(user.id));
    on('game:undoVote', (p) => current().voteUndo(user.id, p.approve));
    on('game:action', (p) => current().playerAction(user.id, p));
    on('chat:send', (p) => current().chat(user.id, p.text));

    socket.on('disconnect', async () => {
      // 同一用户可能有多个连接（多标签页），全部断开才算离线
      const remaining = await io.in(userRoom(user.id)).fetchSockets();
      if (remaining.length === 0) rooms.disconnect(user.id);
    });
  });

  return { io, rooms };
}
