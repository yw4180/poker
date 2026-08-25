import { describe, expect, it } from 'vitest';
import {
  type GameState,
  botAction,
  createGame,
  makeDeck,
  reduce,
  seededRandom,
  shuffle,
} from '../src/index.js';

const players = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
  { id: 'd', name: 'D' },
] as const;

/** 座位 0/2 用 smart，1/3 用 random；返回本局赢的队伍 */
function playRound(state: GameState, rng: () => number): GameState {
  const strategyOf = (seat: number) => (seat % 2 === 0 ? 'smart' : 'random') as const;
  let s = reduce(state, { type: 'START_ROUND', deck: shuffle(makeDeck(), rng) }).state;
  while (s.phase === 'dealing') {
    s = reduce(s, { type: 'DEAL_CARD' }).state;
    for (let seat = 0; seat < 4; seat++) {
      const a = botAction(s, seat, rng, strategyOf(seat));
      if (a) s = reduce(s, a).state;
    }
  }
  s = reduce(s, { type: 'END_DECLARING' }).state;
  let guard = 0;
  while (s.phase === 'kitty' || s.phase === 'playing') {
    if (++guard > 2000) throw new Error('stuck');
    for (let seat = 0; seat < 4; seat++) {
      const a = botAction(s, seat, rng, strategyOf(seat));
      if (a) {
        s = reduce(s, a).state;
        break;
      }
    }
  }
  return s;
}

describe('smart AI vs random AI', () => {
  it('smart team wins most rounds', () => {
    const rng = seededRandom(2026);
    let s = createGame([...players]);
    let smartWins = 0;
    const rounds = 200;
    for (let i = 0; i < rounds; i++) {
      s = playRound(s, rng);
      if (s.lastRound!.winningTeam === 0) smartWins++;
      if (s.phase === 'finished') s = createGame([...players]);
    }
    const rate = smartWins / rounds;
    // eslint-disable-next-line no-console
    console.log(`smart win rate: ${(rate * 100).toFixed(1)}%`);
    expect(rate).toBeGreaterThanOrEqual(0.75);
  });
});
