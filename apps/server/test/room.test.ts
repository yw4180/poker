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
    const room = new Room('TEST1', 't', 'alice', 'Alice', sink, fast);
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
    const room = new Room('TEST2', 't', 'alice', 'Alice', { ...sink, gameState }, fast);
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
    const room = new Room('TEST3', 't', 'alice', 'Alice', sink, fast);
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

describe('undo', () => {
  function setup(extra: Record<string, unknown> = {}) {
    const room = new Room(
      'TEST4',
      't',
      'alice',
      'Alice',
      sink,
      { ...fast, botDelayMs: 30, trickPauseMs: 30 },
      { undo: true, ...extra },
    );
    room.enter('alice', 'Alice');
    room.sit('alice', 0);
    for (const seat of [1, 2, 3]) room.addBot('alice', seat);
    return room;
  }
  const until = async (pred: () => boolean, ms = 5000) => {
    const end = Date.now() + ms;
    while (!pred()) {
      if (Date.now() > end) throw new Error('timeout');
      await new Promise((r) => setTimeout(r, 10));
    }
  };
  it('restores the snapshot when both opponents (bots) auto-approve', async () => {
    const room = setup();
    room.start('alice');
    // 机器人会一直打到轮到 alice；若 alice 是庄家需先扣底
    await until(() => room.game?.phase === 'kitty' || room.game?.phase === 'playing');
    if (room.game!.phase === 'kitty' && room.game!.dealer === 0) {
      room.playerAction('alice', {
        type: 'BURY',
        cardIds: room.game!.hands[0]!.slice(0, 8).map((c) => c.id),
      });
    }
    await until(
      () =>
        room.game?.phase === 'playing' &&
        (room.game.trick!.leader + room.game.trick!.plays.length) % 4 === 0,
    );
    const before = room.game!;
    const trick = before.trick!;
    // 领出随便一张；跟牌用引擎给的合法牌
    const { botAction } = await import('@poker/engine');
    const a = botAction(before, 0, Math.random, 'random')!;
    expect(a.type).toBe('PLAY');
    room.playerAction('alice', a as never);
    expect(room.game!.hands[0]!.length).toBeLessThan(before.hands[0]!.length);
    // 机器人 30ms 后才会跟牌，这里同步发起悔牌
    room.requestUndo('alice');
    expect(room.undoRequest).toBeNull();
    expect(room.game!.hands[0]!.length).toBe(before.hands[0]!.length);
    expect(room.game!.trick!.plays.length).toBe(trick.plays.length);
    room.dispose();
  });
  it('rejects undo when disabled', () => {
    const room = new Room('TEST5', 't', 'alice', 'Alice', sink, fast);
    room.enter('alice', 'Alice');
    room.sit('alice', 0);
    expect(() => room.requestUndo('alice')).toThrow('未开启悔牌');
    room.dispose();
  });
  it('host can change options only in lobby', () => {
    const room = setup();
    room.setOptions('alice', { cardCounter: true, turnTimeoutSec: 20 });
    expect(room.options.cardCounter).toBe(true);
    expect(room.options.turnTimeoutSec).toBe(20);
    expect(room.options.undo).toBe(true);
    room.start('alice');
    expect(() => room.setOptions('alice', { hint: false })).toThrow('对局进行中');
    room.dispose();
  });
});

describe('persistence', () => {
  it('snapshot + restore keeps an in-progress game', async () => {
    const room = new Room('TEST9', 't', 'alice', 'Alice', sink, fast);
    room.enter('alice', 'Alice');
    room.sit('alice', 0);
    for (const seat of [1, 2, 3]) room.addBot('alice', seat);
    room.start('alice');
    await new Promise((r) => setTimeout(r, 300));
    const snap = JSON.parse(JSON.stringify(room.snapshot()));
    room.dispose();

    const restored = Room.restore(snap, sink, fast);
    expect(restored.id).toBe('TEST9');
    expect(restored.status).toBe('playing');
    expect(restored.game).not.toBeNull();
    expect(restored.seats[0]?.userId).toBe('alice');
    expect(restored.seats[0]?.connected).toBe(false); // 重启后等待重连
    expect(restored.seats[1]?.connected).toBe(true); // 机器人视为在线
    restored.resume();
    restored.dispose();
  });
});

describe('mid-game seat swap', () => {
  it('stand converts seat to a real bot; spectator can take over a bot seat; host can fill a detached seat', async () => {
    const room = new Room('TESTA', 't', 'alice', 'Alice', sink, fast);
    room.enter('alice', 'Alice');
    room.sit('alice', 0);
    room.enter('carol', 'Carol'); // 旁观者
    for (const seat of [1, 2, 3]) room.addBot('alice', seat);
    room.start('alice');

    // 旁观者接管机器人座位
    room.sit('carol', 2);
    expect(room.seats[2]?.userId).toBe('carol');
    expect(room.seats[2]?.bot).toBe(false);
    expect(room.game!.players[2]!.name).toBe('Carol');

    // 对局中离座 → 换成正式机器人，本人转旁观
    room.stand('carol');
    expect(room.seats[2]?.bot).toBe(true);
    expect(room.seats[2]?.userId.startsWith('bot:')).toBe(true);
    expect(room.spectators.has('carol')).toBe(true);
    expect(room.game!.players[2]!.id.startsWith('bot:')).toBe(true);

    // 房主把托管座位换成机器人
    room.setAutoplay('alice', true); // alice 托管
    room.fillBot('alice', 0);
    expect(room.seats[0]?.userId.startsWith('bot:')).toBe(true);
    expect(room.spectators.has('alice')).toBe(true);
    // 在线未托管的座位不能被替换
    expect(() => room.fillBot('alice', 0)).toThrow();
    room.dispose();
  });
});
