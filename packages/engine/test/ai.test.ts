import { describe, expect, it } from 'vitest';
import {
  type GameState,
  buildMemory,
  chooseBury,
  chooseDeclare,
  chooseFollowSmart,
  chooseLead,
  classify,
  createGame,
} from '../src/index.js';
import { c, cs, T } from './helpers.js';

const players = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
  { id: 'd', name: 'D' },
] as const;

function playingState(opts: {
  hands: [string[], string[], string[], string[]];
  trump?: ReturnType<typeof T>;
  leader?: number;
  plays?: { seat: number; cards: string[] }[];
  dealer?: number;
}): GameState {
  const base = createGame([...players]);
  const trump = opts.trump ?? T('S', 2);
  const plays = (opts.plays ?? []).map((p) => ({ seat: p.seat, cards: cs(...p.cards) }));
  const lead = plays[0] ? classify(plays[0].cards, trump) : null;
  return {
    ...base,
    phase: 'playing',
    trump,
    level: trump.level,
    dealer: opts.dealer ?? 0,
    hands: opts.hands.map((h) => cs(...h)) as GameState['hands'],
    trick: { leader: opts.leader ?? 0, lead, plays },
  };
}

describe('chooseDeclare', () => {
  it('declares with a pair of level cards', () => {
    const s = {
      ...createGame([...players]),
      phase: 'dealing' as const,
      hands: [cs('H2', "H2'", 'S5', 'D9'), [], [], []] as GameState['hands'],
    };
    const a = chooseDeclare(s, 0);
    expect(a?.type).toBe('DECLARE');
    expect(a && a.type === 'DECLARE' && a.cardIds).toEqual(['H2a', 'H2b']);
  });
  it('does not declare a single level card with few trumps', () => {
    const s = {
      ...createGame([...players]),
      phase: 'dealing' as const,
      hands: [cs('H2', 'S5', 'D9', 'C4'), [], [], []] as GameState['hands'],
    };
    expect(chooseDeclare(s, 0)).toBeNull();
  });
  it('declares a single level card when holding many of that suit', () => {
    const hand = cs('H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'HJ', 'SJ', 'C4');
    const s = {
      ...createGame([...players]),
      phase: 'dealing' as const,
      hands: [hand, [], [], []] as GameState['hands'],
    };
    expect(chooseDeclare(s, 0)?.type).toBe('DECLARE');
  });
});

describe('chooseBury', () => {
  it('buries low non-point singles from short suits, never trump or points', () => {
    const codes = [
      'S2',
      'S3',
      'SA',
      'SK',
      'BJ', // 主
      'H5',
      'H10',
      'HK',
      'H7',
      "H7'",
      'H8', // 红桃长门带分与对
      'D3', // 方块短门
      'C4',
      'C6',
      'C9',
      'CJ',
      'CQ', // 梅花
      'H3',
      'H4',
      'H6',
      'H9',
      'HJ',
      'HQ',
      'HA',
      'C3',
      'C7',
      'C8',
      'D4',
      'D6',
      'D8',
      'D10',
      'DJ',
      'DQ',
    ];
    const hand = cs(...codes);
    const s = { ...playingState({ hands: [codes, [], [], []] }), phase: 'kitty' as const };
    const a = chooseBury(s, 0);
    const ids = a.type === 'BURY' ? a.cardIds : [];
    expect(ids).toHaveLength(8);
    for (const id of ids) {
      const card = hand.find((x) => x.id === id)!;
      expect(['S', 'J']).not.toContain(card.suit);
      expect([5, 10, 13]).not.toContain(card.rank);
    }
    expect(ids).toContain('D3a'); // 短门先扣
    expect(ids).not.toContain('H7a'); // 对子不扣
  });
});

describe('chooseLead', () => {
  it('leads a sure-winning point card', () => {
    // 红桃 A 是必赢（红桃没出过，但另一张 A 在自己手里）
    const s = playingState({
      hands: [
        ['HA', "HA'", 'C3', 'D4'],
        ['H3', 'C5', 'D6', 'S3'],
        ['H4', 'C6', 'D7', 'S4'],
        ['H5', 'C7', 'D8', 'S5'],
      ],
    });
    const a = chooseLead(s, 0, buildMemory(s, 0), () => 0);
    expect(a.type === 'PLAY' && a.cardIds.sort()).toEqual(['H14a', 'H14b']);
  });
  it('avoids leading points when not winning', () => {
    const s = playingState({
      hands: [
        ['H10', 'H3', 'C4', 'D4'],
        ['HA', 'C5', 'D6', 'S3'],
        ['H4', 'C6', 'D7', 'S4'],
        ['H5', 'C7', 'D8', 'S5'],
      ],
    });
    const a = chooseLead(s, 0, buildMemory(s, 0), () => 0);
    expect(a.type === 'PLAY' && a.cardIds).not.toContain('H10a');
  });
});

describe('chooseFollowSmart', () => {
  it('dumps a point card when partner is winning safely (last to play)', () => {
    // 座位 2（队友）领出 HA，座位 3 出 H3，座位 0 出 H4，轮到 1？——改为：我是最后一家(3)，队友 1 赢
    const s = playingState({
      leader: 0,
      plays: [
        { seat: 0, cards: ['H6'] },
        { seat: 1, cards: ['HA'] },
        { seat: 2, cards: ['H7'] },
      ],
      hands: [[], [], [], ['H10', 'H3', 'C4']],
    });
    const a = chooseFollowSmart(s, 3, buildMemory(s, 3), () => 0);
    expect(a.type === 'PLAY' && a.cardIds).toEqual(['H10a']);
  });
  it('beats opponent with the smallest winning card', () => {
    const s = playingState({
      leader: 0,
      plays: [{ seat: 0, cards: ['H9'] }],
      hands: [[], ['HJ', 'HK', 'H3'], [], []],
    });
    const a = chooseFollowSmart(s, 1, buildMemory(s, 1), () => 0);
    // 对手领 9，我用 J 压而不是 K；HJ 后面还有人，但 K 更贵
    expect(a.type === 'PLAY' && a.cardIds).toEqual(['H11a']);
  });
  it('does not give points when opponent wins and cannot be beaten', () => {
    const s = playingState({
      leader: 0,
      plays: [
        { seat: 0, cards: ['HA'] },
        { seat: 1, cards: ['H3'] },
        { seat: 2, cards: ['H4'] },
      ],
      hands: [[], [], [], ['HK', 'H6', 'C4']],
    });
    const a = chooseFollowSmart(s, 3, buildMemory(s, 3), () => 0);
    expect(a.type === 'PLAY' && a.cardIds).toEqual(['H6a']);
  });
  it('trumps a point-heavy trick when void', () => {
    const s = playingState({
      leader: 0,
      plays: [
        { seat: 0, cards: ['H10'] },
        { seat: 1, cards: ['HK'] },
        { seat: 2, cards: ['H5'] },
      ],
      hands: [[], [], [], ['S3', 'C4', 'D9']],
    });
    const a = chooseFollowSmart(s, 3, buildMemory(s, 3), () => 0);
    expect(a.type === 'PLAY' && a.cardIds).toEqual(['S3a']);
  });
});

void c;
