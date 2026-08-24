import { describe, expect, it } from 'vitest';
import { classify, validateFollow, validateLead } from '../src/index.js';
import { cs, T } from './helpers.js';

const t = T('S', 2);
const lead = (codes: string[]) => classify(cs(...codes), t)!;

describe('validateFollow', () => {
  it('must follow suit when able', () => {
    const hand = cs('H3', 'H9', 'D4');
    expect(validateFollow(lead(['H5']), cs('D4'), hand, t).ok).toBe(false);
    expect(validateFollow(lead(['H5']), cs('H3'), hand, t).ok).toBe(true);
  });
  it('may discard anything when void', () => {
    const hand = cs('D4', 'C8');
    expect(validateFollow(lead(['H5']), cs('C8'), hand, t).ok).toBe(true);
  });
  it('must play pair when following pair', () => {
    const hand = cs('H3', "H3'", 'H9', 'HK');
    expect(validateFollow(lead(['H5', "H5'"]), cs('H9', 'HK'), hand, t).ok).toBe(false);
    expect(validateFollow(lead(['H5', "H5'"]), cs('H3', "H3'"), hand, t).ok).toBe(true);
  });
  it('without pair, any two of suit is fine', () => {
    const hand = cs('H3', 'H9', 'HK', 'D4');
    expect(validateFollow(lead(['H5', "H5'"]), cs('H9', 'HK'), hand, t).ok).toBe(true);
    expect(validateFollow(lead(['H5', "H5'"]), cs('H9', 'D4'), hand, t).ok).toBe(false);
  });
  it('must play all of suit then discard when short', () => {
    const hand = cs('H3', 'D4', 'C7');
    expect(validateFollow(lead(['H5', "H5'"]), cs('H3', 'D4'), hand, t).ok).toBe(true);
    expect(validateFollow(lead(['H5', "H5'"]), cs('D4', 'C7'), hand, t).ok).toBe(false);
  });
  it('tractor must be followed by tractor when able', () => {
    const l = lead(['H5', "H5'", 'H6', "H6'"]);
    const hand = cs('H8', "H8'", 'H9', "H9'", 'HJ', "HJ'", 'HA');
    // 两个不相连的对子不行
    expect(validateFollow(l, cs('H8', "H8'", 'HJ', "HJ'"), hand, t).ok).toBe(false);
    expect(validateFollow(l, cs('H8', "H8'", 'H9', "H9'"), hand, t).ok).toBe(true);
  });
  it('tractor without tractor in hand: must play pairs', () => {
    const l = lead(['H5', "H5'", 'H6', "H6'"]);
    const hand = cs('H8', "H8'", 'HJ', 'HQ', 'HA');
    expect(validateFollow(l, cs('HJ', 'HQ', 'HA', 'H8'), hand, t).ok).toBe(false);
    expect(validateFollow(l, cs('H8', "H8'", 'HJ', 'HQ'), hand, t).ok).toBe(true);
  });
  it('longer tractor in hand may be split to follow shorter', () => {
    const l = lead(['H5', "H5'", 'H6', "H6'"]);
    const hand = cs('H8', "H8'", 'H9', "H9'", 'H10', "H10'", 'HA');
    expect(validateFollow(l, cs('H9', "H9'", 'H10', "H10'"), hand, t).ok).toBe(true);
  });
  it('trumping in is allowed when void', () => {
    const hand = cs('S3', "S3'", 'D4');
    expect(validateFollow(lead(['H5', "H5'"]), cs('S3', "S3'"), hand, t).ok).toBe(true);
  });
  it('throw lead: must cover pairs as available', () => {
    const l = lead(['H5', "H5'", 'HK', 'HA']);
    const hand = cs('H3', "H3'", 'H9', 'HJ', 'HQ');
    expect(validateFollow(l, cs('H9', 'HJ', 'HQ', 'H3'), hand, t).ok).toBe(false);
    expect(validateFollow(l, cs('H3', "H3'", 'H9', 'HJ'), hand, t).ok).toBe(true);
  });
});

describe('validateLead / 甩牌', () => {
  it('rejects mixed suits', () => {
    const r = validateLead(cs('H5', 'D5'), cs('H5', 'D5'), [[], [], []], t);
    expect(r.ok).toBe(false);
  });
  it('accepts throw when unbeatable', () => {
    const hand = cs('HA', 'HK', "HK'");
    const others = [cs('HQ', 'HJ'), cs('D3'), cs('H2')];
    const r = validateLead(hand, hand, others, t);
    expect(r.ok && r.combo.type).toBe('throw');
    expect(r.ok && r.forced).toBeUndefined();
  });
  it('forces smallest component when throw is beatable', () => {
    const hand = cs('HA', 'H3', 'H4');
    const others = [cs('HQ', 'H5'), cs('D3'), cs('C2')];
    const r = validateLead(hand, hand, others, t);
    expect(r.ok && r.forced?.cards.map((x) => x.id)).toEqual(['H3a']);
    expect(r.ok && r.combo.type).toBe('single');
  });
  it('pair in throw beaten only by a bigger pair', () => {
    const hand = cs('HA', 'H9', "H9'");
    const others = [cs('HK', 'HQ'), cs('D3'), cs('C2')]; // 对方有更大单张但无对子
    const r = validateLead(hand, hand, others, t);
    expect(r.ok && r.forced).toBeUndefined();
    const others2 = [cs('HK', "HK'"), cs('D3'), cs('C2')];
    const r2 = validateLead(hand, hand, others2, t);
    expect(r2.ok && r2.forced?.kind).toBe('pair');
  });
});
