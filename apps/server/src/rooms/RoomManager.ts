import { customAlphabet } from 'nanoid';
import { randomRoomName } from '../names.js';
import {
  Room,
  type RoomOptionsPatch,
  type RoomSink,
  type RoomTimings,
  DEFAULT_TIMINGS,
} from './Room.js';

const genId = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

export class RoomManager {
  private rooms = new Map<string, Room>();
  /** userId -> roomId */
  private membership = new Map<string, string>();

  constructor(
    private readonly sink: RoomSink,
    private readonly timings: RoomTimings = DEFAULT_TIMINGS,
    private readonly idleTtlMs = 30 * 60 * 1000,
  ) {}

  create(
    hostId: string,
    hostName: string,
    name: string | undefined,
    options: RoomOptionsPatch = {},
  ): Room {
    let id = genId();
    while (this.rooms.has(id)) id = genId();
    const room = new Room(
      id,
      name || randomRoomName(),
      hostId,
      hostName,
      this.sink,
      this.timings,
      options,
    );
    this.rooms.set(id, room);
    return room;
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id.toUpperCase());
  }

  roomOf(userId: string): Room | undefined {
    const id = this.membership.get(userId);
    return id ? this.rooms.get(id) : undefined;
  }

  list(): Room[] {
    return [...this.rooms.values()];
  }

  join(userId: string, name: string, roomId: string, avatar: string | null = null): Room {
    const room = this.get(roomId);
    if (!room) throw new Error('房间不存在');
    const current = this.roomOf(userId);
    if (current && current !== room) current.leave(userId);
    this.membership.set(userId, room.id);
    room.enter(userId, name, avatar);
    return room;
  }

  leave(userId: string) {
    const room = this.roomOf(userId);
    if (!room) return;
    room.leave(userId);
    this.membership.delete(userId);
    if (room.isEmpty()) this.remove(room.id);
  }

  disconnect(userId: string) {
    this.roomOf(userId)?.disconnect(userId);
  }

  remove(id: string) {
    const room = this.rooms.get(id);
    if (!room) return;
    room.dispose();
    this.rooms.delete(id);
    for (const [u, r] of this.membership) if (r === id) this.membership.delete(u);
  }

  /** 全部房间的可存盘快照 */
  snapshot() {
    return this.list().map((r) => r.snapshot());
  }

  /** 从快照恢复（服务器重启时调用） */
  restore(data: ReturnType<Room['snapshot']>[]) {
    for (const d of data) {
      try {
        const room = Room.restore(d, this.sink, this.timings);
        this.rooms.set(room.id, room);
        for (const s of room.seats) {
          if (s && !s.userId.startsWith('bot:')) this.membership.set(s.userId, room.id);
        }
        room.resume();
      } catch (e) {
        console.error('恢复房间失败', d.id, e);
      }
    }
  }

  /** 清理长时间无人活动的房间 */
  sweep(now = Date.now()) {
    for (const room of this.rooms.values()) {
      const allGone = room.humans().every((s) => !s.connected) && room.spectators.size === 0;
      if (allGone && now - room.lastActivity > this.idleTtlMs) this.remove(room.id);
    }
  }
}
