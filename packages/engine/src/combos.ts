/**
 * 牌型识别：单张 / 对子 / 拖拉机 / 甩牌。
 * 所有函数假定传入的牌属于同一有效花色。
 */
import { type Card, type Trump, type PlaySuit, cardKey, effectiveSuit, strength } from './cards.js';

export type ComponentKind = 'single' | 'pair' | 'tractor';

export interface Component {
  kind: ComponentKind;
  cards: Card[];
  /** 该部分中最大牌的 strength */
  strength: number;
  /** 对子数：single=0, pair=1, tractor=n(>=2) */
  pairs: number;
}

export type ComboType = ComponentKind | 'throw';

export interface Combo {
  type: ComboType;
  suit: PlaySuit;
  cards: Card[];
  /** 按 (拖拉机长度降序, 对子, 单张) 排序的组成部分 */
  components: Component[];
}

/**
 * 把同一有效花色的一组牌分解为拖拉机/对子/单张。
 * 贪心取最长连续对子序列作为拖拉机。
 */
export function decompose(cards: readonly Card[], t: Trump): Component[] {
  const byKey = new Map<string, Card[]>();
  for (const c of cards) {
    const k = cardKey(c);
    const arr = byKey.get(k);
    if (arr) arr.push(c);
    else byKey.set(k, [c]);
  }

  const singles: Card[] = [];
  // strength -> 对子列表（副级牌可能有多个不同花色的对子同 strength）
  const pairsByStrength = new Map<number, Card[][]>();
  for (const group of byKey.values()) {
    if (group.length >= 2) {
      const s = strength(group[0]!, t);
      const list = pairsByStrength.get(s) ?? [];
      list.push([group[0]!, group[1]!]);
      pairsByStrength.set(s, list);
      if (group.length > 2) singles.push(...group.slice(2));
    } else {
      singles.push(group[0]!);
    }
  }

  const components: Component[] = [];
  const strengths = [...pairsByStrength.keys()].sort((a, b) => a - b);
  let run: Card[][] = [];
  let runStrengths: number[] = [];
  const flushRun = () => {
    if (run.length >= 2) {
      components.push({
        kind: 'tractor',
        cards: run.flat(),
        strength: runStrengths[runStrengths.length - 1]!,
        pairs: run.length,
      });
    } else if (run.length === 1) {
      components.push({ kind: 'pair', cards: run[0]!, strength: runStrengths[0]!, pairs: 1 });
    }
    run = [];
    runStrengths = [];
  };
  for (const s of strengths) {
    const list = pairsByStrength.get(s)!;
    const last = runStrengths[runStrengths.length - 1];
    if (last !== undefined && s !== last + 1) flushRun();
    run.push(list[0]!);
    runStrengths.push(s);
    // 同 strength 的其他对子单独成对
    for (const extra of list.slice(1)) {
      components.push({ kind: 'pair', cards: extra, strength: s, pairs: 1 });
    }
  }
  flushRun();

  for (const c of singles) {
    components.push({ kind: 'single', cards: [c], strength: strength(c, t), pairs: 0 });
  }
  return sortComponents(components);
}

export function sortComponents(components: Component[]): Component[] {
  const kindOrder: Record<ComponentKind, number> = { tractor: 0, pair: 1, single: 2 };
  return components.slice().sort((a, b) => {
    if (a.kind !== b.kind) return kindOrder[a.kind] - kindOrder[b.kind];
    if (a.pairs !== b.pairs) return b.pairs - a.pairs;
    return b.strength - a.strength;
  });
}

/** 识别一组牌的牌型；若不属于同一有效花色返回 null */
export function classify(cards: readonly Card[], t: Trump): Combo | null {
  if (cards.length === 0) return null;
  const suit = effectiveSuit(cards[0]!, t);
  if (!cards.every((c) => effectiveSuit(c, t) === suit)) return null;
  const components = decompose(cards, t);
  const type: ComboType = components.length === 1 ? components[0]!.kind : 'throw';
  return { type, suit, cards: cards.slice(), components };
}

/** 结构签名：用于判断跟牌是否与领出牌型一致（如 "tractor2,pair,single"） */
export function structureKey(components: readonly Component[]): string {
  return sortComponents(components.slice())
    .map((c) => (c.kind === 'tractor' ? `tractor${c.pairs}` : c.kind))
    .join(',');
}

/** 一组牌型中用于比大小的关键 strength：最大那一部分的 strength */
export function keyStrength(components: readonly Component[]): number {
  const sorted = sortComponents(components.slice());
  return sorted[0]?.strength ?? -1;
}
