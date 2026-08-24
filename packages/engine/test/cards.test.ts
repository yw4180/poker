import { describe, expect, it } from 'vitest';
import { effectiveSuit, isTrump, makeDeck, strength, sortHand } from '../src/index.js';
import { c, T } from './helpers.js';

describe('deck', () => {
  it('has 108 unique cards', () => {
    const d = makeDeck();
    expect(d).toHaveLength(108);
    expect(new Set(d.map((x) => x.id)).size).toBe(108);
  });
});

describe('trump & strength (spades, level 7)', () => {
  const t = T('S', 7);
  it('identifies trump cards', () => {
    expect(isTrump(c('S3'), t)).toBe(true);
    expect(isTrump(c('H7'), t)).toBe(true);
    expect(isTrump(c('BJ'), t)).toBe(true);
    expect(isTrump(c('H3'), t)).toBe(false);
    expect(effectiveSuit(c('H7'), t)).toBe('T');
    expect(effectiveSuit(c('H8'), t)).toBe('H');
  });
  it('orders trump correctly', () => {
    const order = ['S2', 'S6', 'S8', 'SA', 'H7', 'S7', 'SJ', 'BJ'].map((x) => strength(c(x), t));
    for (let i = 1; i < order.length; i++) expect(order[i]!).toBeGreaterThan(order[i - 1]!);
    // 6 与 8 在主牌里相邻（7 是级牌被跳过）
    expect(strength(c('S8'), t) - strength(c('S6'), t)).toBe(1);
    expect(strength(c('S7'), t) - strength(c('H7'), t)).toBe(1);
    expect(strength(c('D7'), t)).toBe(strength(c('H7'), t));
  });
  it('orders off-suit correctly with level skipped', () => {
    expect(strength(c('H8'), t) - strength(c('H6'), t)).toBe(1);
    expect(strength(c('HA'), t)).toBe(11);
  });
});

describe('no trump', () => {
  const t = T('NT', 10);
  it('level cards are all equal and below jokers', () => {
    expect(strength(c('S10'), t)).toBe(strength(c('H10'), t));
    expect(strength(c('SJ'), t)).toBeGreaterThan(strength(c('S10'), t));
    expect(strength(c('BJ'), t)).toBeGreaterThan(strength(c('SJ'), t));
    expect(isTrump(c('SA'), t)).toBe(false);
  });
});

describe('sortHand', () => {
  it('puts trump first, descending', () => {
    const t = T('H', 2);
    const sorted = sortHand([c('S3'), c('H5'), c('BJ'), c('D2'), c('SA')], t);
    expect(sorted.map((x) => x.id)).toEqual(['BJa', 'D2a', 'H5a', 'S14a', 'S3a']);
  });
});
