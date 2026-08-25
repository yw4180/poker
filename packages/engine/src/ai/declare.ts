import { type Card, BIG_JOKER, SMALL_JOKER, SUITS, type Suit, cardKey, isTrump } from '../cards.js';
import type { Action, GameState } from '../state.js';
import { W } from './weights.js';

export interface DeclareOption {
  cardIds: string[];
  strength: number;
  suit: Suit | 'NT';
  trumpCount: number;
}

/** 手牌中所有可用的亮主选项（不考虑当前已有亮主） */
export function declareOptions(hand: readonly Card[], level: number): DeclareOption[] {
  const out: DeclareOption[] = [];
  const count = (suit: Suit | 'NT') =>
    hand.filter((c) => isTrump(c, { suit, level: level as 2 })).length;
  for (const suit of SUITS) {
    const lv = hand.filter((c) => c.suit === suit && c.rank === level);
    if (lv.length >= 1)
      out.push({ cardIds: [lv[0]!.id], strength: 1, suit, trumpCount: count(suit) });
    if (lv.length >= 2)
      out.push({
        cardIds: lv.slice(0, 2).map((c) => c.id),
        strength: 2,
        suit,
        trumpCount: count(suit),
      });
  }
  const sj = hand.filter((c) => c.rank === SMALL_JOKER);
  const bj = hand.filter((c) => c.rank === BIG_JOKER);
  if (sj.length >= 2)
    out.push({
      cardIds: sj.slice(0, 2).map((c) => c.id),
      strength: 3,
      suit: 'NT',
      trumpCount: count('NT'),
    });
  if (bj.length >= 2)
    out.push({
      cardIds: bj.slice(0, 2).map((c) => c.id),
      strength: 4,
      suit: 'NT',
      trumpCount: count('NT'),
    });
  return out;
}

/** 亮主决策：主够多才亮；有对优先亮对；反主需明显更强 */
export function chooseDeclare(state: GameState, seat: number): Action | null {
  const hand = state.hands[seat]!;
  const cur = state.declaration;
  const opts = legalDeclareOptions(hand, state.level, cur, seat);
  if (opts.length === 0) return null;
  // 已经亮过就不再重复亮同样的东西
  if (cur && cur.seat === seat) {
    const better = opts.find((o) => o.suit === cur.trump.suit || o.suit === 'NT');
    if (!better) return null;
  }
  const minTrumps = cur && cur.seat !== seat ? W.declareOverrideMinTrumps : W.declareMinTrumps;
  const good = opts
    .filter((o) => o.trumpCount >= minTrumps || o.strength >= 3 || o.strength === 2)
    .sort((a, b) => b.trumpCount + b.strength * 2 - (a.trumpCount + a.strength * 2));
  const pick = good[0];
  if (!pick) return null;
  // 对子级牌明显更稳；单张级牌且主不多时不亮
  if (pick.strength === 1 && pick.trumpCount < minTrumps) return null;
  return { type: 'DECLARE', seat, cardIds: pick.cardIds };
}

/** 在已有亮主 cur 的情况下，seat 还能亮哪些 */
export function legalDeclareOptions(
  hand: readonly Card[],
  level: number,
  cur: GameState['declaration'],
  seat: number,
): DeclareOption[] {
  return declareOptions(hand, level).filter((o) => {
    if (!cur) return true;
    if (o.strength <= cur.strength) return false;
    if (cur.seat === seat && o.strength === 2 && o.suit !== cur.trump.suit) return false;
    return true;
  });
}
void cardKey;
