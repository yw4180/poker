import { type Card, effectiveSuit, pointValue, strength } from '../cards.js';
import type { Action, GameState } from '../state.js';
import { handBySuit } from './memory.js';
import { W } from './weights.js';

/** 扣底：优先扣短门副牌、低单张；不扣分牌/对子/主牌 */
export function chooseBury(state: GameState, seat: number): Action {
  const t = state.trump!;
  const hand = state.hands[seat]!;
  const groups = handBySuit(hand, t);
  const pairKeys = new Set<string>();
  for (const g of groups.values()) {
    for (const comp of g.comps) if (comp.pairs >= 1) for (const c of comp.cards) pairKeys.add(c.id);
  }
  const score = (c: Card): number => {
    const s = effectiveSuit(c, t);
    let v = strength(c, t);
    if (s === 'T') v += W.buryTrump;
    const pts = pointValue(c);
    if (pts) v += pts === 5 ? W.buryPoint : W.buryPoint + W.buryTen;
    if (pairKeys.has(c.id)) v += W.buryPair;
    // 短门优先扣（扣完可以将吃）
    const len = groups.get(s)!.cards.length;
    v -= Math.max(0, 6 - len) * W.buryShortSuitBonus;
    return v;
  };
  const sorted = hand.slice().sort((a, b) => score(a) - score(b));
  return { type: 'BURY', seat, cardIds: sorted.slice(0, state.config.kittySize).map((c) => c.id) };
}
