import { describe, expect, it } from 'vitest';
import {
  type GameEvent,
  type GameState,
  IllegalAction,
  botAction,
  createGame,
  makeDeck,
  reduce,
  seededRandom,
  shuffle,
  viewFor,
} from '../src/index.js';

const players = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
  { id: 'd', name: 'D' },
] as const;

function playRound(state: GameState, rng: () => number): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const step = (s: GameState, a: Parameters<typeof reduce>[1]) => {
    const r = reduce(s, a);
    events.push(...r.events);
    return r.state;
  };
  let s = step(state, { type: 'START_ROUND', deck: shuffle(makeDeck(), rng) });
  while (s.phase === 'dealing') {
    s = step(s, { type: 'DEAL_CARD' });
    for (let seat = 0; seat < 4; seat++) {
      const a = botAction(s, seat, rng);
      if (a) s = step(s, a);
    }
  }
  s = step(s, { type: 'END_DECLARING' });
  let guard = 0;
  while (s.phase === 'kitty' || s.phase === 'playing') {
    if (++guard > 1000) throw new Error('stuck');
    let acted = false;
    for (let seat = 0; seat < 4; seat++) {
      const a = botAction(s, seat, rng);
      if (a) {
        s = step(s, a);
        acted = true;
        break;
      }
    }
    if (!acted) throw new Error(`no actor in phase ${s.phase}`);
  }
  return { state: s, events };
}

describe('full game simulation', () => {
  it('plays 50 random rounds with consistent invariants', () => {
    const rng = seededRandom(42);
    let s = createGame([...players]);
    let rounds = 0;
    while (rounds < 50) {
      const before = s;
      const { state, events } = playRound(s, rng);
      rounds++;
      const ended = events.find((e) => e.type === 'roundEnded');
      expect(ended).toBeDefined();
      const cardsPlayed = state.tricks.reduce(
        (a, t) => a + t.plays.reduce((b, p) => b + p.cards.length, 0),
        0,
      );
      expect(cardsPlayed).toBe(100);
      const trickPts = state.tricks.reduce((a, t) => a + t.points, 0);
      expect(trickPts + state.lastRound!.kittyPoints).toBe(200);
      expect(state.kitty).toHaveLength(8);
      expect(state.hands.every((h) => h.length === 0)).toBe(true);
      // 级别只增不减
      expect(state.levels[0]).toBeGreaterThanOrEqual(before.levels[0]);
      expect(state.levels[1]).toBeGreaterThanOrEqual(before.levels[1]);
      if (state.phase === 'finished') {
        expect(state.winner).not.toBeNull();
        s = createGame([...players]);
      } else {
        expect(state.phase).toBe('roundEnd');
        s = state;
      }
    }
  });

  it('rejects out-of-turn and wrong-phase actions', () => {
    const rng = seededRandom(7);
    let s = createGame([...players]);
    expect(() => reduce(s, { type: 'DEAL_CARD' })).toThrow(IllegalAction);
    s = reduce(s, { type: 'START_ROUND', deck: shuffle(makeDeck(), rng) }).state;
    s = reduce(s, { type: 'DEAL_ALL' }).state;
    expect(s.phase).toBe('declaring');
    s = reduce(s, { type: 'END_DECLARING' }).state;
    expect(s.phase).toBe('kitty');
    expect(s.hands[s.dealer!]).toHaveLength(33);
    const notDealer = (s.dealer! + 1) % 4;
    expect(() => reduce(s, { type: 'BURY', seat: notDealer, cardIds: [] })).toThrow(IllegalAction);
  });

  it('player view hides other hands and kitty', () => {
    const rng = seededRandom(3);
    let s = createGame([...players]);
    s = reduce(s, { type: 'START_ROUND', deck: shuffle(makeDeck(), rng) }).state;
    s = reduce(s, { type: 'DEAL_ALL' }).state;
    const v = viewFor(s, 1);
    expect(v.hand).toHaveLength(25);
    expect(v.handCounts).toEqual([25, 25, 25, 25]);
    expect((v as unknown as { hands?: unknown }).hands).toBeUndefined();
    expect(v.kitty).toBeNull();
    expect(v.deckCount).toBe(8);
  });
});
