import { type GameState, botAction, createGame } from '@poker/engine';
import type { Ack, PlayerView, RoomView } from '@poker/protocol';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { attachSocket } from '../src/socket.js';

let url = '';
let httpServer: ReturnType<typeof createServer>;

beforeAll(async () => {
  httpServer = createServer();
  attachSocket(httpServer, {
    corsOrigin: '*',
    // 测试用鉴权：cookie "uid=xxx" 直接当作用户
    authenticate: async (headers) => {
      const m = /uid=([\w-]+)/.exec(headers.get('cookie') ?? '');
      return m ? { id: m[1]!, name: `用户${m[1]}` } : null;
    },
    timings: { dealCardMs: 1, declareWindowMs: 20, botDelayMs: 1, trickPauseMs: 1 },
  });
  await new Promise<void>((r) => httpServer.listen(0, r));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});
afterAll(() => httpServer.close());

function client(uid: string): Socket {
  return connect(url, { extraHeaders: { cookie: `uid=${uid}` }, forceNew: true });
}
function emit<T = undefined>(s: Socket, ev: string, payload: unknown): Promise<Ack<T>> {
  return new Promise((r) => s.emit(ev, payload, r));
}
function waitFor<T>(s: Socket, ev: string, pred: (x: T) => boolean, ms = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting ${ev}`)), ms);
    const h = (x: T) => {
      if (pred(x)) {
        clearTimeout(t);
        s.off(ev, h);
        resolve(x);
      }
    };
    s.on(ev, h);
  });
}

/** 用玩家视角拼一个假的完整状态，让 botAction 替人类出牌 */
function stateFromView(v: PlayerView): GameState {
  const base = createGame(v.players);
  const hands: GameState['hands'] = [[], [], [], []];
  hands[v.seat] = v.hand;
  const {
    hand: _h,
    handCounts: _c,
    kittyCount: _k,
    deckCount: _d,
    actor: _a,
    seat: _s,
    kitty: _kk,
    ...rest
  } = v;
  return { ...base, ...rest, hands, kitty: [], deck: [] };
}

describe('socket server', () => {
  it('rejects unauthenticated connections', async () => {
    const s = connect(url, { forceNew: true });
    const err = await new Promise<Error>((r) => s.on('connect_error', r));
    expect(err.message).toBe('未登录');
    s.close();
  });

  it('plays a full round with one human and three bots, then reconnects', async () => {
    const s = client('alice');
    await new Promise<void>((r) => s.on('connect', () => r()));
    const created = await emit<{ roomId: string }>(s, 'room:create', { name: '测试房' });
    expect(created.ok).toBe(true);
    const roomId = created.data!.roomId;

    expect((await emit(s, 'room:sit', { seat: 0 })).ok).toBe(true);
    expect((await emit(s, 'room:start', {})).ok).toBe(false); // 人数不够
    for (const seat of [1, 2, 3]) expect((await emit(s, 'room:addBot', { seat })).ok).toBe(true);

    // 人类玩家：每次收到状态，若轮到自己就用 botAction 出牌
    let latest: PlayerView | null = null;
    s.on('game:state', (v: PlayerView) => {
      latest = v;
      const a = botAction(stateFromView(v), v.seat);
      if (a && (v.phase === 'kitty' || v.phase === 'playing')) {
        const { seat: _seat, ...action } = a;
        s.emit('game:action', action, (r: Ack) => {
          if (!r.ok) throw new Error(`illegal: ${r.error}`);
        });
      }
    });

    const roundEnded = waitFor<{ type: string }>(
      s,
      'game:event',
      (e) => e.type === 'roundEnded',
      20000,
    );
    expect((await emit(s, 'room:start', {})).ok).toBe(true);
    await roundEnded;
    expect(latest!.phase === 'roundEnd' || latest!.phase === 'finished').toBe(true);
    expect(latest!.handCounts).toEqual([0, 0, 0, 0]);
    expect(latest!.kitty).toHaveLength(8);

    // 断线重连：重新 join 后应收到房间与对局状态
    s.close();
    const s2 = client('alice');
    await new Promise<void>((r) => s2.on('connect', () => r()));
    const roomState = waitFor<RoomView>(s2, 'room:state', (r) => r.id === roomId);
    const gameState = waitFor<PlayerView>(s2, 'game:state', () => true);
    expect((await emit(s2, 'room:join', { roomId })).ok).toBe(true);
    const rs = await roomState;
    expect(rs.seats[0]?.userId).toBe('alice');
    expect(rs.seats[0]?.connected).toBe(true);
    const gs = await gameState;
    expect(gs.seat).toBe(0);
    expect(gs.lastRound).not.toBeNull();
    s2.close();
  }, 30000);
});
