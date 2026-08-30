/**
 * 记牌：只使用某个座位"看得到"的信息（自己手牌 + 桌面上出过的牌 + 庄家自己的底牌）。
 */
import { type Card, type PlaySuit, type Trump, effectiveSuit, makeDeck } from '../cards.js';
import { type Component, decompose } from '../combos.js';
import { componentBeatenBy } from '../follow.js';
import type { GameState } from '../state.js';

export interface Memory {
  /** 尚未见过的牌（可能在其他三家手里，或在底牌里） */
  unseen: Card[];
  /** 各座位已确认缺门的有效花色 */
  voids: Set<PlaySuit>[];
  /** 各有效花色未见到的张数 */
  unseenBySuit: Record<PlaySuit, Card[]>;
}

export function buildMemory(state: GameState, seat: number): Memory {
  const t = state.trump;
  const seen = new Set<string>();
  // 旁观者视角 seat 为 -1，此时没有自己的手牌
  for (const c of state.hands[seat] ?? []) seen.add(c.id);
  if (seat === (state.kittyOwner ?? state.dealer)) for (const c of state.kitty) seen.add(c.id);
  const allPlays = [...state.tricks.flatMap((tr) => tr.plays), ...(state.trick?.plays ?? [])];
  for (const p of allPlays) for (const c of p.cards) seen.add(c.id);
  const unseen = makeDeck().filter((c) => !seen.has(c.id));

  const voids: Set<PlaySuit>[] = [new Set(), new Set(), new Set(), new Set()];
  const unseenBySuit: Record<PlaySuit, Card[]> = { T: [], S: [], H: [], D: [], C: [] };
  if (t) {
    for (const c of unseen) unseenBySuit[effectiveSuit(c, t)].push(c);
    const tricks = [...state.tricks.map((tr) => tr.plays), state.trick?.plays ?? []];
    for (const plays of tricks) {
      const lead = plays[0];
      if (!lead) continue;
      const leadSuit = effectiveSuit(lead.cards[0]!, t);
      for (const p of plays.slice(1)) {
        if (p.cards.some((c) => effectiveSuit(c, t) !== leadSuit)) voids[p.seat]!.add(leadSuit);
      }
    }
  }
  return { unseen, voids, unseenBySuit };
}

/** 该牌型在其花色内是否已无更大的未见牌（保守：未见牌可能在队友手里） */
export function isHighestRemaining(
  comp: Component,
  suit: PlaySuit,
  mem: Memory,
  t: Trump,
): boolean {
  return !componentBeatenBy(comp, mem.unseenBySuit[suit], t);
}

/** 手牌按有效花色分组并分解 */
export function handBySuit(
  hand: readonly Card[],
  t: Trump,
): Map<PlaySuit, { cards: Card[]; comps: Component[] }> {
  const map = new Map<PlaySuit, { cards: Card[]; comps: Component[] }>();
  for (const c of hand) {
    const s = effectiveSuit(c, t);
    const e = map.get(s) ?? { cards: [], comps: [] };
    e.cards.push(c);
    map.set(s, e);
  }
  for (const e of map.values()) e.comps = decompose(e.cards, t);
  return map;
}
