'use client';
import { type Card, type Trump, effectiveSuit, sortHand } from '@poker/engine';
import { PlayingCard } from './PlayingCard';
import { useStore } from '@/lib/store';

/** 手牌：主牌在前，按有效花色分组，组间留空；窄屏自动换行 */
export function Hand({
  cards,
  trump,
  level,
  interactive,
  highlightIds = [],
}: {
  cards: Card[];
  trump: Trump | null;
  level: Trump['level'];
  interactive: boolean;
  highlightIds?: string[];
}) {
  const selected = useStore((s) => s.selected);
  const toggle = useStore((s) => s.toggleSelect);
  // 主牌未定时按"无主"排序：级牌与王先归到一组，方便看清可亮的牌
  const order: Trump = trump ?? { suit: 'NT', level };
  const sorted = sortHand(cards, order);
  const groups: Card[][] = [];
  for (const c of sorted) {
    const suit = effectiveSuit(c, order);
    const last = groups[groups.length - 1];
    if (last && effectiveSuit(last[0]!, order) === suit) last.push(c);
    else groups.push([c]);
  }
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-3 px-2 pb-2 pt-4">
      {groups.map((g, gi) => {
        const isTrumpGroup = effectiveSuit(g[0]!, order) === 'T';
        return (
          <div
            key={gi}
            className={`flex rounded-lg px-1 pt-1 ${isTrumpGroup ? 'bg-amber-300/10' : ''}`}
          >
            {g.map((c, i) => (
              <div key={c.id} className={i === 0 ? '' : '-ml-7 sm:-ml-8'}>
                <PlayingCard
                  card={c}
                  selected={selected.includes(c.id)}
                  highlight={highlightIds.includes(c.id)}
                  onClick={interactive ? () => toggle(c.id) : undefined}
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
