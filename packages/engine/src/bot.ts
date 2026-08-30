/**
 * 极简机器人：给出合法操作。既用于测试模拟整局，也可作为补位 AI 的基础。
 */
import { type Card, effectiveSuit, strength } from './cards.js';
import { type Combo, decompose } from './combos.js';
import { validateFollow } from './follow.js';
import type { Action, GameState } from './state.js';
import { legalDeclareOptions, smartAction } from './ai/index.js';

type Rng = () => number;

function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

/** 构造一个满足跟牌规则的出牌（尽量按“拖拉机→对子→单张”覆盖领出结构） */
export function chooseFollow(
  lead: Combo,
  hand: readonly Card[],
  state: GameState,
  rng: Rng,
): Card[] {
  const t = state.trump!;
  const n = lead.cards.length;
  const handS = hand.filter((c) => effectiveSuit(c, t) === lead.suit);
  const others = hand.filter((c) => effectiveSuit(c, t) !== lead.suit);
  if (handS.length <= n) {
    return [...handS, ...others.slice(0, n - handS.length)];
  }
  const chosen: Card[] = [];
  const used = new Set<string>();
  const take = (cards: readonly Card[]) => {
    for (const c of cards) {
      chosen.push(c);
      used.add(c.id);
    }
  };
  let comps = decompose(handS, t);
  const byStrength = (a: Card, b: Card) => strength(a, t) - strength(b, t);

  // 1. 拖拉机
  const leadTractors = lead.components.filter((c) => c.kind === 'tractor').map((c) => c.pairs);
  let unmatchedPairs = 0;
  for (const L of leadTractors) {
    const cands = comps
      .filter((c) => c.kind === 'tractor' && c.pairs >= L)
      .sort((a, b) => a.pairs - b.pairs);
    const tr = cands[0];
    if (!tr) {
      unmatchedPairs += L;
      continue;
    }
    const sorted = tr.cards.slice().sort(byStrength);
    take(sorted.slice(0, 2 * L));
    const rest = sorted.slice(2 * L);
    comps = comps.filter((c) => c !== tr).concat(decompose(rest, t));
  }
  // 2. 对子
  let pairsNeeded = unmatchedPairs + lead.components.filter((c) => c.kind === 'pair').length;
  const pairPool = comps.filter((c) => c.pairs >= 1);
  for (const comp of pairPool) {
    if (pairsNeeded <= 0) break;
    const sorted = comp.cards.slice().sort(byStrength);
    const canTake = Math.min(comp.pairs, pairsNeeded);
    take(sorted.slice(0, 2 * canTake));
    pairsNeeded -= canTake;
  }
  // 3. 补单张
  const remaining = handS.filter((c) => !used.has(c.id)).sort(byStrength);
  for (const c of remaining) {
    if (chosen.length >= n) break;
    take([c]);
  }
  if (chosen.length !== n) throw new Error('chooseFollow: internal error');
  const check = validateFollow(lead, chosen, hand, t);
  if (!check.ok) throw new Error(`chooseFollow produced illegal play: ${check.reason}`);
  void rng;
  return chosen;
}

export type BotStrategy = 'random' | 'smart';

/** 为当前应行动的座位生成一个合法动作；无需行动时返回 null */
export function botAction(
  state: GameState,
  seat: number,
  rng: Rng = Math.random,
  strategy: BotStrategy = 'smart',
): Action | null {
  if (strategy === 'smart') return smartAction(state, seat, rng);
  return randomAction(state, seat, rng);
}

/** 随机但合法的机器人（用于测试基线） */
export function randomAction(
  state: GameState,
  seat: number,
  rng: Rng = Math.random,
): Action | null {
  const hand = state.hands[seat]!;
  switch (state.phase) {
    case 'dealing': {
      if (state.declaration) return null;
      const levelCards = hand.filter((c) => c.rank === state.level && c.suit !== 'J');
      if (levelCards.length && rng() < 0.5) {
        return { type: 'DECLARE', seat, cardIds: [levelCards[0]!.id] };
      }
      return null;
    }
    case 'declaring': {
      if (state.ask?.seat !== seat) return null;
      const opts = legalDeclareOptions(hand, state.level, state.declaration, seat);
      if (opts.length && rng() < 0.35) {
        return { type: 'DECLARE', seat, cardIds: opts[0]!.cardIds };
      }
      return { type: 'PASS_DECLARE', seat };
    }
    case 'kitty': {
      if (seat !== state.dealer) return null;
      const t = state.trump!;
      // 扣掉最小的副牌
      const sorted = hand.slice().sort((a, b) => {
        const ta = effectiveSuit(a, t) === 'T' ? 1 : 0;
        const tb = effectiveSuit(b, t) === 'T' ? 1 : 0;
        if (ta !== tb) return ta - tb;
        return strength(a, t) - strength(b, t);
      });
      return {
        type: 'BURY',
        seat,
        cardIds: sorted.slice(0, state.config.kittySize).map((c) => c.id),
      };
    }
    case 'playing': {
      const trick = state.trick!;
      if ((trick.leader + trick.plays.length) % 4 !== seat) return null;
      if (trick.plays.length === 0) {
        // 领出：随机一张，或偶尔整个同花色甩出去
        const t = state.trump!;
        const card = pick(hand, rng);
        if (rng() < 0.15) {
          const suit = effectiveSuit(card, t);
          const all = hand.filter((c) => effectiveSuit(c, t) === suit);
          return { type: 'PLAY', seat, cardIds: all.map((c) => c.id) };
        }
        const comps = decompose(
          hand.filter((c) => effectiveSuit(c, t) === effectiveSuit(card, t)),
          t,
        );
        const comp = pick(comps, rng);
        return { type: 'PLAY', seat, cardIds: comp.cards.map((c) => c.id) };
      }
      const cards = chooseFollow(trick.lead!, hand, state, rng);
      return { type: 'PLAY', seat, cardIds: cards.map((c) => c.id) };
    }
    default:
      return null;
  }
}
