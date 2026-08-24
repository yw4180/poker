/**
 * 牌的基本定义与主牌排序。
 * 两副牌共 108 张：4 花色 × 13 点 × 2 + 大小王各 2。
 */
export type Suit = 'S' | 'H' | 'D' | 'C';
export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];

/** 2..14（11=J,12=Q,13=K,14=A），15=小王，16=大王 */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export const SMALL_JOKER = 15;
export const BIG_JOKER = 16;

export interface Card {
  /** 唯一 id，例如 "S7a"、"S7b"、"SJa"(小王)、"BJb"(大王) */
  id: string;
  suit: Suit | 'J';
  rank: number;
}

export interface Trump {
  /** 'NT' = 无主 */
  suit: Suit | 'NT';
  level: Rank;
}

/** 出牌时的“有效花色”：主牌统一记作 'T' */
export type PlaySuit = Suit | 'T';

export function isJoker(c: Card): boolean {
  return c.suit === 'J';
}

export function isTrump(c: Card, t: Trump): boolean {
  return c.suit === 'J' || c.rank === t.level || c.suit === t.suit;
}

export function effectiveSuit(c: Card, t: Trump): PlaySuit {
  return isTrump(c, t) ? 'T' : (c.suit as Suit);
}

/** 用于判断“对子”：同花色同点数（不看 id） */
export function cardKey(c: Card): string {
  return `${c.suit}${c.rank}`;
}

function rankIndexWithoutLevel(rank: number, level: number): number {
  // 2..14 去掉级牌后压缩到 0..11
  return rank < level ? rank - 2 : rank - 3;
}

/**
 * 牌在其有效花色内的大小序号（越大越大）。
 * 副牌: 0..11；主牌: 0..11 为主花色普通牌，12 副级牌，13 主级牌，14 小王，15 大王。
 * 无主时: 12 为级牌(所有花色同级)，13 小王，14 大王。
 */
export function strength(c: Card, t: Trump): number {
  if (c.rank === BIG_JOKER) return t.suit === 'NT' ? 14 : 15;
  if (c.rank === SMALL_JOKER) return t.suit === 'NT' ? 13 : 14;
  if (c.rank === t.level) {
    if (t.suit === 'NT') return 12;
    return c.suit === t.suit ? 13 : 12;
  }
  return rankIndexWithoutLevel(c.rank, t.level);
}

/** 牌面分值：5→5, 10→10, K→10 */
export function pointValue(c: Card): number {
  if (c.rank === 5) return 5;
  if (c.rank === 10 || c.rank === 13) return 10;
  return 0;
}

export function sumPoints(cards: readonly Card[]): number {
  return cards.reduce((s, c) => s + pointValue(c), 0);
}

/** 生成两副牌（108 张），顺序固定；洗牌由调用方负责 */
export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const copy of ['a', 'b'] as const) {
    for (const suit of SUITS) {
      for (let rank = 2; rank <= 14; rank++) {
        deck.push({ id: `${suit}${rank}${copy}`, suit, rank });
      }
    }
    deck.push({ id: `SJ${copy}`, suit: 'J', rank: SMALL_JOKER });
    deck.push({ id: `BJ${copy}`, suit: 'J', rank: BIG_JOKER });
  }
  return deck;
}

/** 可注入随机源的 Fisher–Yates 洗牌（纯函数，返回新数组） */
export function shuffle<T>(arr: readonly T[], random: () => number = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** 手牌排序：主牌在前（从大到小），随后各副牌花色，便于 UI 展示 */
export function sortHand(cards: readonly Card[], t: Trump): Card[] {
  const suitOrder: Record<PlaySuit, number> = { T: 0, S: 1, H: 2, C: 3, D: 4 };
  return cards.slice().sort((a, b) => {
    const sa = effectiveSuit(a, t);
    const sb = effectiveSuit(b, t);
    if (sa !== sb) return suitOrder[sa] - suitOrder[sb];
    const d = strength(b, t) - strength(a, t);
    if (d !== 0) return d;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** 简单的可复现随机数（mulberry32），测试与回放用 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
