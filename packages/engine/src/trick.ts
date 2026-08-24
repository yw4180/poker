/**
 * 一墩牌的胜负判断与分数计算。
 */
import { type Card, type Trump, effectiveSuit, sumPoints } from './cards.js';
import { type Combo, classify, keyStrength, structureKey } from './combos.js';

export interface Play {
  seat: number;
  cards: Card[];
}

/**
 * 判断 candidate 能否压过当前赢家 current（均相对于领出 lead）。
 */
export function beats(current: Combo, candidate: readonly Card[], lead: Combo, t: Trump): boolean {
  const combo = classify(candidate, t);
  if (!combo) return false; // 混花色不可能赢
  if (combo.suit !== lead.suit && combo.suit !== 'T') return false;
  if (structureKey(combo.components) !== structureKey(lead.components)) return false;
  if (combo.suit === current.suit) {
    return keyStrength(combo.components) > keyStrength(current.components);
  }
  // 花色不同：只有主牌能压副牌
  return combo.suit === 'T' && current.suit !== 'T';
}

/** 计算一墩的赢家座位 */
export function trickWinner(plays: readonly Play[], t: Trump): number {
  const leadPlay = plays[0]!;
  const lead = classify(leadPlay.cards, t)!;
  let winner = leadPlay.seat;
  let current = lead;
  for (const p of plays.slice(1)) {
    if (beats(current, p.cards, lead, t)) {
      winner = p.seat;
      current = classify(p.cards, t)!;
    }
  }
  return winner;
}

export function trickPoints(plays: readonly Play[]): number {
  return plays.reduce((s, p) => s + sumPoints(p.cards), 0);
}

/** 末墩底牌翻倍倍数：单张/对子 ×2，拖拉机 ×2^n（n 为对子数） */
export function kittyMultiplier(winningCards: readonly Card[], t: Trump): number {
  const combo = classify(winningCards, t);
  if (!combo) return 2;
  const maxPairs = Math.max(...combo.components.map((c) => c.pairs), 0);
  return maxPairs >= 2 ? 2 ** maxPairs : 2;
}

export { effectiveSuit };
