import { describe, expect, it } from 'vitest';
import { kittyMultiplier, trickPoints, trickWinner } from '../src/index.js';
import { cs, T } from './helpers.js';

const t = T('S', 2);
const plays = (...p: string[][]) => p.map((cards, seat) => ({ seat, cards: cs(...cards) }));

describe('trickWinner', () => {
  it('highest of led suit wins', () => {
    expect(trickWinner(plays(['H5'], ['HK'], ['H9'], ['D3']), t)).toBe(1);
  });
  it('trump beats led suit', () => {
    expect(trickWinner(plays(['HK'], ['S3'], ['HA'], ['H4']), t)).toBe(1);
  });
  it('higher trump beats lower trump', () => {
    expect(trickWinner(plays(['HK'], ['S3'], ['BJ'], ['H4']), t)).toBe(2);
  });
  it('level card of trump suit beats off-suit level card', () => {
    expect(trickWinner(plays(['S5'], ['H2'], ['S2'], ['D2']), t)).toBe(2);
  });
  it('pair must be matched by pair to win', () => {
    expect(trickWinner(plays(['H5', "H5'"], ['HK', 'HA'], ['H9', "H9'"], ['D3', 'D4']), t)).toBe(2);
  });
  it('trump singles do not beat a led pair', () => {
    expect(trickWinner(plays(['H5', "H5'"], ['S3', 'S4'], ['H3', 'H4'], ['D3', 'D4']), t)).toBe(0);
  });
  it('trump tractor beats suit tractor; tractor length must match', () => {
    const p = plays(
      ['H5', "H5'", 'H6', "H6'"],
      ['S3', "S3'", 'S4', "S4'"],
      ['H9', "H9'", 'H10', "H10'"],
      ['C3', 'C4', 'C5', 'C6'],
    );
    expect(trickWinner(p, t)).toBe(1);
  });
  it('points and kitty multiplier', () => {
    const p = plays(['H5'], ['HK'], ['H10'], ['D3']);
    expect(trickPoints(p)).toBe(25);
    expect(kittyMultiplier(cs('HK'), t)).toBe(2);
    expect(kittyMultiplier(cs('H5', "H5'", 'H6', "H6'"), t)).toBe(4);
  });
});
