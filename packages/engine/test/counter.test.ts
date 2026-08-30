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
    // 轮询中让被问到的人过或亮
    let guard = 0;
    while (s.phase === 'declaring' && !s.declaration) {
      const seat = s.ask!.seat;
      if (seat === 0) s = reduce(s, { type: 'DECLARE', seat: 0, cardIds: [zero.id] }).state;
      else s = reduce(s, { type: 'PASS_DECLARE', seat }).state;
      if (++guard > 10) break;
    }
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
    // 0 号被问到时亮 ♣ 单张
    while (s.ask!.seat !== 0) s = reduce(s, { type: 'PASS_DECLARE', seat: s.ask!.seat }).state;
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
    while (s.ask!.seat !== 0) s = reduce(s, { type: 'PASS_DECLARE', seat: s.ask!.seat }).state;
    s = reduce(s, { type: 'DECLARE', seat: 0, cardIds: ['H2a'] }).state;
    // 现在轮到别人表态，但 0 号仍可加固
    expect(s.ask!.seat).not.toBe(0);
    s = reduce(s, { type: 'DECLARE', seat: 0, cardIds: ['H2a', 'H2b'] }).state;
    expect(s.declaration!.strength).toBe(22);
    expect(s.declaration!.seat).toBe(0);
  });
});
