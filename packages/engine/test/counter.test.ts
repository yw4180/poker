import { describe, expect, it } from 'vitest';
import {
  type GameState,
  createGame,
  makeDeck,
  reduce,
  seededRandom,
  shuffle,
} from '../src/index.js';
import { cs } from './helpers.js';

const players = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
  { id: 'd', name: 'D' },
] as const;

/** 构造：0 号在发牌期亮主 → 全过 → 0 扣底 → 反主轮里 2 号用一对级牌反 */
function setup(): GameState {
  const rng = seededRandom(1);
  for (let tries = 0; tries < 200; tries++) {
    let s = createGame([...players]);
    s = reduce(s, { type: 'START_ROUND', deck: shuffle(makeDeck(), rng) }).state;
    s = reduce(s, { type: 'DEAL_ALL' }).state;
    // 0 号需有单张级牌，2 号需有一对同花色级牌
    const zero = s.hands[0]!.find((c) => c.rank === 2 && c.suit !== 'J');
    const pair = (['S', 'H', 'D', 'C'] as const)
      .map((suit) => s.hands[2]!.filter((c) => c.rank === 2 && c.suit === suit))
      .find((g) => g.length === 2);
    if (!zero || !pair) continue;
    // 开放窗口：0 号直接亮
    expect(s.ask!.seat).toBe(-1);
    s = reduce(s, { type: 'DECLARE', seat: 0, cardIds: [zero.id] }).state;
    while (s.phase === 'declaring')
      s = reduce(s, { type: 'PASS_DECLARE', seat: s.ask!.seat }).state;
    if (s.phase !== 'kitty' || s.dealer !== 0) continue;
    // 0 号扣底
    const ids = s.hands[0]!.slice(0, 8).map((c) => c.id);
    s = reduce(s, { type: 'BURY', seat: 0, cardIds: ids }).state;
    expect(s.phase).toBe('declaring');
    expect(s.postKitty).toBe(true);
    // 轮到 2 号时反主
    while (s.ask!.seat !== 2) s = reduce(s, { type: 'PASS_DECLARE', seat: s.ask!.seat }).state;
    s = reduce(s, { type: 'DECLARE', seat: 2, cardIds: pair.map((c) => c.id) }).state;
    return s;
  }
  throw new Error('构造失败');
}

describe('first-round counter after kitty', () => {
  it('counter becomes dealer and re-buries', () => {
    const s = setup();
    expect(s.phase).toBe('kitty');
    expect(s.dealer).toBe(2); // 反主者上庄
    expect(s.hands[2]).toHaveLength(33); // 拿到底牌
    expect(s.hands[0]).toHaveLength(25); // 原庄家不再持底
    expect(s.trump!.suit).not.toBe('J');
    // 新庄家重扣后进入反主轮，全过后开打，领出者为新庄家
    let t = reduce(s, {
      type: 'BURY',
      seat: 2,
      cardIds: s.hands[2]!.slice(0, 8).map((c) => c.id),
    }).state;
    while (t.phase === 'declaring')
      t = reduce(t, { type: 'PASS_DECLARE', seat: t.ask!.seat }).state;
    expect(t.phase).toBe('playing');
    expect(t.trick!.leader).toBe(2);
  });
});
void cs;

describe('declare strength with suit ranking', () => {
  it('pair beats single; only bigger-suit pair beats a pair; reinforce allowed out of turn', () => {
    const rng = seededRandom(7);
    let s = createGame([...players]);
    s = reduce(s, { type: 'START_ROUND', deck: shuffle(makeDeck(), rng) }).state;
    s = reduce(s, { type: 'DEAL_ALL' }).state;
    // 手工放牌：0 有 ♣2 与 ♣2'，1 有 ♦2 对，3 有 ♠2 单
    const take = (id: string) => makeDeck().find((c) => c.id === id)!;
    const hands = s.hands.map((h) => h.slice()) as typeof s.hands;
    hands[0] = [take('C2a'), take('C2b'), ...hands[0]!.filter((c) => c.rank !== 2).slice(0, 23)];
    hands[1] = [take('D2a'), take('D2b'), ...hands[1]!.filter((c) => c.rank !== 2).slice(0, 23)];
    hands[3] = [take('S2a'), ...hands[3]!.filter((c) => c.rank !== 2).slice(0, 24)];
    s = { ...s, hands };
    // 开放窗口：0 号先亮 ♣ 单张
    s = reduce(s, { type: 'DECLARE', seat: 0, cardIds: ['C2a'] }).state;
    expect(s.declaration!.strength).toBe(11); // 10 + ♣(1)
    // 1 号想用 ♦ 对反：对子(20+0) > 单张(11) ✓ 允许
    while (s.ask!.seat !== 1) s = reduce(s, { type: 'PASS_DECLARE', seat: s.ask!.seat }).state;
    s = reduce(s, { type: 'DECLARE', seat: 1, cardIds: ['D2a', 'D2b'] }).state;
    expect(s.declaration!.seat).toBe(1);
    expect(s.declaration!.strength).toBe(20);
    // 0 号想用 ♣ 对反 ♦ 对：21 > 20 ✓（更大花色的一对）
    while (s.ask!.seat !== 0) s = reduce(s, { type: 'PASS_DECLARE', seat: s.ask!.seat }).state;
    s = reduce(s, { type: 'DECLARE', seat: 0, cardIds: ['C2a', 'C2b'] }).state;
    expect(s.declaration!.strength).toBe(21);
    // 3 号的 ♠ 单张(13) 反不了对子
    while (s.ask!.seat !== 3) s = reduce(s, { type: 'PASS_DECLARE', seat: s.ask!.seat }).state;
    expect(() => reduce(s, { type: 'DECLARE', seat: 3, cardIds: ['S2a'] })).toThrow();
  });

  it('declarer can upgrade single to same-suit pair even when not asked', () => {
    const rng = seededRandom(11);
    let s = createGame([...players]);
    s = reduce(s, { type: 'START_ROUND', deck: shuffle(makeDeck(), rng) }).state;
    s = reduce(s, { type: 'DEAL_ALL' }).state;
    const take = (id: string) => makeDeck().find((c) => c.id === id)!;
    const hands = s.hands.map((h) => h.slice()) as typeof s.hands;
    hands[0] = [take('H2a'), take('H2b'), ...hands[0]!.filter((c) => c.rank !== 2).slice(0, 23)];
    s = { ...s, hands };
    s = reduce(s, { type: 'DECLARE', seat: 0, cardIds: ['H2a'] }).state;
    // 现在轮到别人表态，但 0 号仍可加固
    expect(s.ask!.seat).not.toBe(0);
    s = reduce(s, { type: 'DECLARE', seat: 0, cardIds: ['H2a', 'H2b'] }).state;
    expect(s.declaration!.strength).toBe(22);
    expect(s.declaration!.seat).toBe(0);
  });
});

describe('big joker pair skips asking', () => {
  it('goes straight to kitty and then straight to playing', () => {
    const rng = seededRandom(21);
    let s = createGame([...players]);
    s = reduce(s, { type: 'START_ROUND', deck: shuffle(makeDeck(), rng) }).state;
    s = reduce(s, { type: 'DEAL_ALL' }).state;
    const take = (id: string) => makeDeck().find((c) => c.id === id)!;
    const hands = s.hands.map((h) => h.slice()) as typeof s.hands;
    hands[1] = [take('BJa'), take('BJb'), ...hands[1]!.filter((c) => c.suit !== 'J').slice(0, 23)];
    s = { ...s, hands };
    // 开放窗口：1 号直接亮大王对 → 免询问，直接进入扣底
    s = reduce(s, { type: 'DECLARE', seat: 1, cardIds: ['BJa', 'BJb'] }).state;
    expect(s.phase).toBe('kitty');
    expect(s.dealer).toBe(1);
    expect(s.trump!.suit).toBe('NT');
    // 扣完底也不再询问，直接开打
    const ids = s.hands[1]!.slice(0, 8).map((c) => c.id);
    s = reduce(s, { type: 'BURY', seat: 1, cardIds: ids }).state;
    expect(s.phase).toBe('playing');
    expect(s.trick!.leader).toBe(1);
  });
});

describe('NT-over-NT counter transfers the kitty', () => {
  it('small-joker pair countered by big-joker pair: second counter re-buries', () => {
    const rng = seededRandom(33);
    let s = createGame([...players]);
    // 构造发牌顺序：小王对发给 1 号（下标 1、5），大王对发给 3 号（下标 3、7），底牌无王
    const full = shuffle(makeDeck(), rng);
    const rest = full.filter((c) => c.suit !== 'J');
    const bySeat: Record<number, string[]> = { 1: ['SJa', 'SJb'], 3: ['BJa', 'BJb'] };
    const jokerOf = (id: string) => full.find((c) => c.id === id)!;
    const deck: typeof full = [];
    let r = 0;
    for (let i = 0; i < 108; i++) {
      const seatIdx = i % 4;
      const want = bySeat[seatIdx];
      if (i < 8 && want && want.length && (i === seatIdx || i === seatIdx + 4)) {
        deck.push(jokerOf(want.shift()!));
      } else {
        deck.push(rest[r++]!);
      }
    }
    s = reduce(s, { type: 'START_ROUND', deck }).state;
    s = reduce(s, { type: 'DEAL_ALL' }).state;
    expect(s.hands[1]!.filter((c) => c.rank === 15)).toHaveLength(2);
    expect(s.hands[3]!.filter((c) => c.rank === 16)).toHaveLength(2);
    s = reduce(s, { type: 'DECLARE', seat: 1, cardIds: ['SJa', 'SJb'] }).state;
    // 小王对仍可被大王对反，因此要先问一圈
    expect(s.phase).toBe('declaring');
    while (s.phase === 'declaring')
      s = reduce(s, { type: 'PASS_DECLARE', seat: s.ask!.seat }).state;
    expect(s.phase).toBe('kitty');
    expect(s.kittyOwner).toBe(1);
    s = reduce(s, {
      type: 'BURY',
      seat: 1,
      cardIds: s.hands[1]!.slice(0, 8).map((c) => c.id),
    }).state;
    expect(s.phase).toBe('declaring');
    while (s.ask && s.ask.seat !== 3)
      s = reduce(s, { type: 'PASS_DECLARE', seat: s.ask.seat }).state;
    s = reduce(s, { type: 'DECLARE', seat: 3, cardIds: ['BJa', 'BJb'] }).state;
    expect(s.phase).toBe('kitty');
    expect(s.kittyOwner).toBe(3);
    expect(s.dealer).toBe(3);
    expect(s.hands[3]).toHaveLength(33);
    s = reduce(s, {
      type: 'BURY',
      seat: 3,
      cardIds: s.hands[3]!.slice(0, 8).map((c) => c.id),
    }).state;
    expect(s.phase).toBe('playing');
    expect(s.trick!.leader).toBe(3);
  });
});
