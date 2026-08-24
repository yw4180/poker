import { describe, expect, it } from 'vitest';
import { classify, decompose, structureKey } from '../src/index.js';
import { cs, T } from './helpers.js';

const t = T('S', 2);

describe('decompose / classify', () => {
  it('single and pair', () => {
    expect(classify(cs('H5'), t)!.type).toBe('single');
    expect(classify(cs('H5', "H5'"), t)!.type).toBe('pair');
    expect(classify(cs('H5', 'H6'), t)!.type).toBe('throw');
  });
  it('tractor of consecutive pairs', () => {
    const combo = classify(cs('H5', "H5'", 'H6', "H6'"), t)!;
    expect(combo.type).toBe('tractor');
    expect(combo.components[0]!.pairs).toBe(2);
  });
  it('tractor skips level rank', () => {
    const tt = T('S', 6);
    expect(classify(cs('H5', "H5'", 'H7', "H7'"), tt)!.type).toBe('tractor');
  });
  it('trump tractor across level cards and jokers', () => {
    const tt = T('S', 7);
    // SA SA + S7 S7 + H7 H7 + 小王小王 + 大王大王 是一条 5 连拖拉机
    const combo = classify(
      cs('SA', "SA'", 'S7', "S7'", 'H7', "H7'", 'SJ', "SJ'", 'BJ', "BJ'"),
      tt,
    )!;
    expect(combo.type).toBe('tractor');
    expect(combo.components[0]!.pairs).toBe(5);
  });
  it('two off-suit level pairs are not a tractor', () => {
    const tt = T('S', 7);
    const comps = decompose(cs('H7', "H7'", 'D7', "D7'"), tt);
    expect(comps.map((x) => x.kind)).toEqual(['pair', 'pair']);
  });
  it('mixed suits is not a combo', () => {
    expect(classify(cs('H5', 'D5'), t)).toBeNull();
  });
  it('throw decomposes into tractor + pair + singles', () => {
    const comps = decompose(cs('H3', "H3'", 'H4', "H4'", 'H9', "H9'", 'HK', 'HA'), t);
    expect(structureKey(comps)).toBe('tractor2,pair,single,single');
  });
});
