import { type PlaySuit, sumPoints } from '../cards.js';
import type { Component } from '../combos.js';
import type { Action, GameState } from '../state.js';
import { type Memory, handBySuit, isHighestRemaining } from './memory.js';
import { W } from './weights.js';

interface Cand {
  comp: Component;
  suit: PlaySuit;
  score: number;
}

/** 领出：必赢牌优先（带分更好），其次长副牌对子/拖拉机，否则短门小单张 */
export function chooseLead(state: GameState, seat: number, mem: Memory, rng: () => number): Action {
  const t = state.trump!;
  const hand = state.hands[seat]!;
  const groups = handBySuit(hand, t);
  const cands: Cand[] = [];
  const opponentsHaveTrump = mem.unseenBySuit.T.length > 0;

  for (const [suit, g] of groups) {
    for (const comp of g.comps) {
      let score = 0;
      const pts = sumPoints(comp.cards);
      const sure = isHighestRemaining(comp, suit, mem, t);
      if (sure) {
        // 副牌必赢还要看对手是否可能将吃（缺门 + 有主）
        const risky =
          suit !== 'T' &&
          opponentsHaveTrump &&
          [0, 1, 2, 3].some((s) => s !== seat && s % 2 !== seat % 2 && mem.voids[s]!.has(suit));
        score += risky ? W.leadSureWin / 3 : W.leadSureWin;
        score += pts;
      } else {
        score -= pts * W.leadPointsLoss;
        score -= comp.strength * 0.5;
        if (suit === 'T') score -= W.leadTrumpWhenUnsafe;
        // 短门小牌更适合领出（尽快清门）
        score += Math.max(0, 5 - g.cards.length);
      }
      if (comp.kind === 'tractor') score += W.leadTractor * comp.pairs;
      else if (comp.kind === 'pair') score += W.leadPair;
      // 拖拉机/对子的未见牌更少能压
      score += rng() * 0.5; // 打破平局
      cands.push({ comp, suit, score });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const best = cands[0]!;
  return { type: 'PLAY', seat, cardIds: best.comp.cards.map((c) => c.id) };
}
