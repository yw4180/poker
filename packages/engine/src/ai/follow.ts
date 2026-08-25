import { type Card, effectiveSuit, pointValue, strength, sumPoints } from '../cards.js';
import { type Combo, classify, decompose } from '../combos.js';
import { validateFollow } from '../follow.js';
import type { Action, GameState } from '../state.js';
import { type Play, trickWinner } from '../trick.js';
import { chooseFollow } from '../bot.js';
import { type Memory, isHighestRemaining } from './memory.js';
import { W } from './weights.js';

type Rng = () => number;

/** 生成若干合法候选（数量有限，避免组合爆炸） */
function candidates(lead: Combo, hand: readonly Card[], state: GameState, rng: Rng): Card[][] {
  const t = state.trump!;
  const n = lead.cards.length;
  const handS = hand.filter((c) => effectiveSuit(c, t) === lead.suit);
  const others = hand.filter((c) => effectiveSuit(c, t) !== lead.suit);
  const out: Card[][] = [];
  const push = (cards: Card[]) => {
    if (cards.length !== n) return;
    const key = cards
      .map((c) => c.id)
      .sort()
      .join(',');
    if (
      out.some(
        (x) =>
          x
            .map((c) => c.id)
            .sort()
            .join(',') === key,
      )
    )
      return;
    if (validateFollow(lead, cards, hand, t).ok) out.push(cards);
  };

  if (handS.length >= n) {
    if (lead.type === 'single') {
      for (const c of handS) push([c]);
    } else if (lead.type === 'pair') {
      const comps = decompose(handS, t);
      const pairs = comps.filter((c) => c.pairs >= 1);
      if (pairs.length) {
        for (const p of pairs) {
          const sorted = p.cards.slice().sort((a, b) => strength(a, t) - strength(b, t));
          for (let i = 0; i + 1 < sorted.length; i += 2) push([sorted[i]!, sorted[i + 1]!]);
        }
      } else {
        const sorted = handS.slice().sort((a, b) => strength(a, t) - strength(b, t));
        push([sorted[0]!, sorted[1]!]);
        push([sorted[sorted.length - 2]!, sorted[sorted.length - 1]!]);
        // 垫分 / 不垫分的组合
        const nonPts = sorted.filter((c) => !pointValue(c));
        if (nonPts.length >= 2) push([nonPts[0]!, nonPts[1]!]);
      }
    } else {
      // 拖拉机/甩牌：最小合法 + 最大合法两种
      push(chooseFollow(lead, hand, state, rng));
      const reversed = hand.slice().sort((a, b) => strength(b, t) - strength(a, t));
      const hi = chooseFollowFrom(lead, reversed, state, rng);
      if (hi) push(hi);
    }
  } else {
    // 该花色不够：全出 + 垫牌（垫牌有多种选择：最小无分 / 分牌 / 将牌）
    const fill = n - handS.length;
    const othersSorted = others.slice().sort((a, b) => discardRank(a, t) - discardRank(b, t));
    push([...handS, ...othersSorted.slice(0, fill)]);
    const pts = others.filter((c) => pointValue(c) && effectiveSuit(c, t) !== 'T');
    if (pts.length >= fill) push([...handS, ...pts.slice(0, fill)]);
    if (handS.length === 0 && lead.suit !== 'T') {
      // 将吃候选：结构匹配的主牌
      const trumps = hand.filter((c) => effectiveSuit(c, t) === 'T');
      const comps = decompose(trumps, t);
      if (lead.type === 'single') for (const c of trumps) push([c]);
      if (lead.type === 'pair') {
        for (const p of comps.filter((c) => c.pairs >= 1)) {
          const s = p.cards.slice().sort((a, b) => strength(a, t) - strength(b, t));
          push([s[0]!, s[1]!]);
        }
      }
      if (lead.type === 'tractor') {
        for (const tr of comps.filter(
          (c) => c.kind === 'tractor' && c.pairs >= lead.components[0]!.pairs,
        )) {
          const s = tr.cards.slice().sort((a, b) => strength(a, t) - strength(b, t));
          push(s.slice(0, n));
          push(s.slice(s.length - n));
        }
      }
    }
  }
  if (out.length === 0) push(chooseFollow(lead, hand, state, rng));
  return out;
}

/** 垫牌优先级：无分小副牌 < 有分副牌 < 主牌 */
function discardRank(c: Card, t: GameState['trump'] & object): number {
  const s = effectiveSuit(c, t);
  return (s === 'T' ? 100 : 0) + pointValue(c) * 3 + strength(c, t);
}

/** 与 chooseFollow 相同逻辑，但传入的手牌顺序决定取大还是取小 */
function chooseFollowFrom(
  lead: Combo,
  handOrdered: Card[],
  state: GameState,
  rng: Rng,
): Card[] | null {
  try {
    // chooseFollow 内部按 strength 升序取；这里通过反转 strength 的技巧不可行，退化为：取同结构的最大组合
    const t = state.trump!;
    const n = lead.cards.length;
    const handS = handOrdered.filter((c) => effectiveSuit(c, t) === lead.suit);
    if (handS.length < n) return null;
    const comps = decompose(handS, t);
    const chosen: Card[] = [];
    const used = new Set<string>();
    const take = (cards: Card[]) => cards.forEach((c) => (chosen.push(c), used.add(c.id)));
    for (const L of lead.components.filter((c) => c.kind === 'tractor').map((c) => c.pairs)) {
      const tr = comps
        .filter((c) => c.kind === 'tractor' && c.pairs >= L && !c.cards.some((x) => used.has(x.id)))
        .sort((a, b) => b.strength - a.strength)[0];
      if (tr)
        take(
          tr.cards
            .slice()
            .sort((a, b) => strength(b, t) - strength(a, t))
            .slice(0, 2 * L),
        );
    }
    const pairsNeeded =
      lead.components.filter((c) => c.kind === 'pair').length +
      lead.components.filter((c) => c.kind === 'tractor').reduce((s, c) => s + c.pairs, 0) -
      chosen.length / 2;
    let need = pairsNeeded;
    for (const p of comps
      .filter((c) => c.pairs >= 1 && !c.cards.some((x) => used.has(x.id)))
      .sort((a, b) => b.strength - a.strength)) {
      if (need <= 0) break;
      const s = p.cards.slice().sort((a, b) => strength(b, t) - strength(a, t));
      const k = Math.min(p.pairs, need);
      take(s.slice(0, 2 * k));
      need -= k;
    }
    for (const c of handS
      .filter((x) => !used.has(x.id))
      .sort((a, b) => strength(b, t) - strength(a, t))) {
      if (chosen.length >= n) break;
      take([c]);
    }
    void rng;
    return chosen.length === n ? chosen : null;
  } catch {
    return null;
  }
}

/** 评估一个候选出牌 */
export function evaluate(cands: Card[], state: GameState, seat: number, mem: Memory): number {
  const t = state.trump!;
  const trick = state.trick!;
  const plays: Play[] = [...trick.plays, { seat, cards: cands }];
  const winnerNow = trickWinner(plays, t);
  const myTeam = seat % 2;
  const weWin = winnerNow % 2 === myTeam;
  const trickPts = plays.reduce((s, p) => s + sumPoints(p.cards), 0);
  const myPts = sumPoints(cands);
  const isLast = plays.length === 4;
  const combo = classify(cands, t);
  const usesTrump = cands.some((c) => effectiveSuit(c, t) === 'T') && trick.lead!.suit !== 'T';
  const myStrength = cands.reduce((s, c) => s + strength(c, t), 0) / cands.length;

  let score = 0;
  if (weWin) {
    // 后面还有人出牌时，赢面打折，除非我们的牌已无人能压
    let safe = isLast;
    if (!safe && combo && winnerNow === seat) {
      const key = combo.components[0]!;
      safe =
        isHighestRemaining(key, combo.suit, mem, t) &&
        (combo.suit === 'T' ||
          mem.unseenBySuit.T.length === 0 ||
          !opponentsAfterMeVoid(state, seat, combo.suit, mem));
    }
    if (!safe && winnerNow !== seat) safe = false;
    const othersPts = trickPts - myPts;
    score += safe ? W.followWinBonus : W.followWinBonus * W.followUnsafeWinDiscount;
    if (safe) {
      score += trickPts * W.followPointsWon;
    } else {
      // 不稳时：桌上的分按概率算，自己垫上去的分还要扣送分风险
      const d = W.followUnsafeWinDiscount;
      score += othersPts * W.followPointsWon * d;
      score += myPts * (d * W.followPointsWon - (1 - d) * W.followPointsGiven);
    }
    // 队友已经赢且稳：不要浪费大牌压过队友
    if (winnerNow !== seat) score -= myStrength * W.followStrengthCost * 0.5;
    else score -= myStrength * W.followStrengthCost;
  } else {
    score -= myPts * W.followPointsGiven;
    score -= myStrength * W.followStrengthCost;
  }
  if (usesTrump) score -= myStrength * W.followTrumpCost + (weWin ? 0 : 5);
  return score;
}

function opponentsAfterMeVoid(state: GameState, seat: number, suit: string, mem: Memory): boolean {
  const trick = state.trick!;
  const remaining = 4 - trick.plays.length - 1;
  for (let i = 1; i <= remaining; i++) {
    const s = (seat + i) % 4;
    if (s % 2 !== seat % 2 && mem.voids[s]!.has(suit as never)) return true;
  }
  return false;
}

export function chooseFollowSmart(state: GameState, seat: number, mem: Memory, rng: Rng): Action {
  const hand = state.hands[seat]!;
  const lead = state.trick!.lead!;
  const cands = candidates(lead, hand, state, rng);
  let best = cands[0]!;
  let bestScore = -Infinity;
  for (const c of cands) {
    const s = evaluate(c, state, seat, mem) + rng() * 0.01;
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return { type: 'PLAY', seat, cardIds: best.map((c) => c.id) };
}
