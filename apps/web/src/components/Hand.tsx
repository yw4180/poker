'use client';
import { type Card, type PlaySuit, type Trump, effectiveSuit, sortHand } from '@poker/engine';
import { PlayingCard } from './PlayingCard';
import { useStore } from '@/lib/store';

/** 副牌花色顺序：紧挨主牌之后红黑相间 */
function suitOrder(trump: Trump): PlaySuit[] {
  const trumpRed = trump.suit === 'H' || trump.suit === 'D';
  const black: PlaySuit[] = ['S', 'C'];
  const red: PlaySuit[] = ['H', 'D'];
  const rest = (list: PlaySuit[]) => list.filter((s) => s !== trump.suit);
  const first = trumpRed ? rest(black) : rest(red);
  const second = trumpRed ? rest(red) : rest(black);
  const out: PlaySuit[] = ['T'];
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    if (first[i]) out.push(first[i]!);
    if (second[i]) out.push(second[i]!);
  }
  return out;
}

/** 手牌：主牌在前（带底色），其后副牌红黑相间、彼此紧挨；窄屏自动换行 */
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
  const order: Trump = trump ?? { suit: 'NT', level };
  const rank = suitOrder(order);
  const sorted = sortHand(cards, order).sort(
    (a, b) => rank.indexOf(effectiveSuit(a, order)) - rank.indexOf(effectiveSuit(b, order)),
  );
  return (
    <div className="flex flex-wrap justify-center gap-y-4 px-2 pb-2 pt-4 lg:flex-nowrap lg:overflow-x-auto">
      {sorted.map((c, i) => {
        const isTrump = effectiveSuit(c, order) === 'T';
        return (
          <div
            key={c.id}
            className={`${i === 0 ? '' : '-ml-8 sm:-ml-9'} rounded-t-lg px-0.5 pt-1.5 ${isTrump ? 'bg-accent/15' : ''}`}
          >
            <PlayingCard
              card={c}
              trump={!!trump && isTrump}
              selected={selected.includes(c.id)}
              highlight={highlightIds.includes(c.id)}
              onClick={interactive ? () => toggle(c.id) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
