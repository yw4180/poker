/**
 * 领出与跟牌的合法性校验。
 */
import { type Card, type Trump, effectiveSuit } from './cards.js';
import { type Combo, type Component, classify, decompose } from './combos.js';

export interface LeadResult {
  ok: true;
  combo: Combo;
  /** 甩牌失败时被强制改出的牌（原甩牌中最小的一部分） */
  forced?: Component;
}
export interface Rejected {
  ok: false;
  reason: string;
}

function allInHand(cards: readonly Card[], hand: readonly Card[]): boolean {
  const ids = new Set(hand.map((c) => c.id));
  const seen = new Set<string>();
  for (const c of cards) {
    if (!ids.has(c.id) || seen.has(c.id)) return false;
    seen.add(c.id);
  }
  return true;
}

/** 某一部分是否会被另一手牌中同花色的牌压住 */
export function componentBeatenBy(
  comp: Component,
  otherSuitCards: readonly Card[],
  t: Trump,
): boolean {
  const other = decompose(otherSuitCards, t);
  if (comp.kind === 'single') {
    return other.some((o) => o.strength > comp.strength);
  }
  if (comp.kind === 'pair') {
    return other.some((o) => o.pairs >= 1 && o.strength > comp.strength);
  }
  // tractor：对方任意长度 >= 本拖拉机且最大牌更大的拖拉机
  return other.some(
    (o) => o.kind === 'tractor' && o.pairs >= comp.pairs && o.strength > comp.strength,
  );
}

/**
 * 校验领出。
 * @param others 其余三家的手牌（用于甩牌校验）
 */
export function validateLead(
  cards: readonly Card[],
  hand: readonly Card[],
  others: readonly (readonly Card[])[],
  t: Trump,
): LeadResult | Rejected {
  if (cards.length === 0) return { ok: false, reason: '未选择牌' };
  if (!allInHand(cards, hand)) return { ok: false, reason: '所出的牌不在手中' };
  const combo = classify(cards, t);
  if (!combo) return { ok: false, reason: '领出的牌必须是同一花色' };
  if (combo.type !== 'throw') return { ok: true, combo };

  // 甩牌：每一部分都不能被其他人同花色的牌压住
  for (const comp of combo.components) {
    for (const otherHand of others) {
      const suitCards = otherHand.filter((c) => effectiveSuit(c, t) === combo.suit);
      if (componentBeatenBy(comp, suitCards, t)) {
        const forced = smallestComponent(combo.components);
        const forcedCombo = classify(forced.cards, t)!;
        return { ok: true, combo: forcedCombo, forced };
      }
    }
  }
  return { ok: true, combo };
}

/** 甩牌失败时强制出的“最小部分”：先比 strength，再比牌数少的优先 */
export function smallestComponent(components: readonly Component[]): Component {
  return components.reduce((min, c) => {
    if (c.strength !== min.strength) return c.strength < min.strength ? c : min;
    return c.cards.length < min.cards.length ? c : min;
  });
}

/**
 * 校验跟牌。规则：
 * 1. 牌数必须与领出相同；
 * 2. 有该花色必须先出该花色（不足则全出再垫）；
 * 3. 若该花色足够，领出的拖拉机须用拖拉机跟（若有），对子须用对子跟（若有）。
 */
export function validateFollow(
  lead: Combo,
  played: readonly Card[],
  hand: readonly Card[],
  t: Trump,
): { ok: true } | Rejected {
  if (played.length !== lead.cards.length) {
    return { ok: false, reason: `必须出 ${lead.cards.length} 张牌` };
  }
  if (!allInHand(played, hand)) return { ok: false, reason: '所出的牌不在手中' };

  const suit = lead.suit;
  const handS = hand.filter((c) => effectiveSuit(c, t) === suit);
  const playedS = played.filter((c) => effectiveSuit(c, t) === suit);
  const need = Math.min(lead.cards.length, handS.length);
  if (playedS.length !== need) {
    return { ok: false, reason: need === handS.length ? '必须先出完该花色的牌' : '必须跟该花色' };
  }
  if (need < lead.cards.length) return { ok: true }; // 该花色已全部出完，其余任意垫

  // 结构性要求：先看手牌里能满足多少
  const handComps = decompose(handS, t);
  const handTractors = handComps.filter((c) => c.kind === 'tractor').map((c) => c.pairs);
  const handPairTotal = handComps.reduce((s, c) => s + c.pairs, 0);

  const reqTractors: number[] = [];
  let reqPairs = 0;
  const leadTractors = lead.components.filter((c) => c.kind === 'tractor').map((c) => c.pairs);
  for (const L of leadTractors) {
    const idx = pickTractor(handTractors, L);
    if (idx >= 0) {
      reqTractors.push(L);
      consumeTractor(handTractors, idx, L);
    } else {
      reqPairs += L;
    }
  }
  reqPairs += lead.components.filter((c) => c.kind === 'pair').length;
  const tractorPairs = reqTractors.reduce((s, n) => s + n, 0);
  reqPairs = Math.min(reqPairs, handPairTotal - tractorPairs);

  // 检查所出的牌是否满足要求
  const playedComps = decompose(playedS, t);
  const playedTractors = playedComps.filter((c) => c.kind === 'tractor').map((c) => c.pairs);
  const playedPairTotal = playedComps.reduce((s, c) => s + c.pairs, 0);
  for (const L of reqTractors) {
    const idx = pickTractor(playedTractors, L);
    if (idx < 0) return { ok: false, reason: `必须用 ${L} 连对的拖拉机跟牌` };
    consumeTractor(playedTractors, idx, L);
  }
  if (playedPairTotal < tractorPairs + reqPairs) {
    return { ok: false, reason: '有对子必须出对子' };
  }
  return { ok: true };
}

/** 在可用拖拉机长度列表中找一个 >= L 的（取最小的满足者），返回下标 */
function pickTractor(lens: number[], L: number): number {
  let best = -1;
  lens.forEach((n, i) => {
    if (n >= L && (best < 0 || n < lens[best]!)) best = i;
  });
  return best;
}

function consumeTractor(lens: number[], idx: number, L: number): void {
  const rest = lens[idx]! - L;
  if (rest >= 2) lens[idx] = rest;
  else lens.splice(idx, 1);
}
