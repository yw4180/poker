import { describe, expect, it, vi } from 'vitest';
import { Room, type RoomSink } from '../src/rooms/Room.js';

const sink: RoomSink = {
  roomState: vi.fn(),
  gameState: vi.fn(),
  gameEvent: vi.fn(),
  chat: vi.fn(),
  gameFinished: vi.fn(),
};
const fast = { dealCardMs: 1, declareWindowMs: 5, botDelayMs: 1, trickPauseMs: 1 };

describe('Room', () => {
  it('hands a leaving player to a bot during play and gives the seat back on return', async () => {
    const room = new Room('TEST1', 't', 'alice', sink, fast);
    room.enter('alice', 'Alice');
    room.sit('alice', 0);
    for (const seat of [1, 2, 3]) room.addBot('alice', seat);
    room.start('alice');
    expect(room.status).toBe('playing');

    room.leave('alice');
    expect(room.seats[0]?.bot).toBe(true);
    expect(room.seats[0]?.userId).toBe('alice');

    room.enter('alice', 'Alice');
    expect(room.seats[0]?.bot).toBe(false);
    expect(room.seats[0]?.connected).toBe(true);
    room.dispose();
  });

  it('broadcasts a declare deadline once dealing finishes', async () => {
    const gameState = vi.fn();
    const room = new Room('TEST2', 't', 'alice', { ...sink, gameState }, fast);
    room.enter('alice', 'Alice');
    room.sit('alice', 0);
    for (const seat of [1, 2, 3]) room.addBot('alice', seat);
    room.start('alice');
    await new Promise((r) => setTimeout(r, 400));
    const deadlines = gameState.mock.calls.map((c) => c[4]).filter((d) => typeof d === 'number');
    expect(deadlines.length).toBeGreaterThan(0);
    room.dispose();
  });
});

describe('autoplay toggle', () => {
  it('lets a seated player hand over to the bot and take it back', () => {
    const room = new Room('TEST3', 't', 'alice', sink, fast);
    room.enter('alice', 'Alice');
    room.sit('alice', 0);
    for (const seat of [1, 2, 3]) room.addBot('alice', seat);
    expect(() => room.setAutoplay('alice', true)).toThrow('对局未开始');
    room.start('alice');
    room.setAutoplay('alice', true);
    expect(room.seats[0]?.bot).toBe(true);
    room.setAutoplay('alice', false);
    expect(room.seats[0]?.bot).toBe(false);
    room.dispose();
  });
});
