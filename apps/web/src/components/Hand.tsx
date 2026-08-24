'use client';
import { type Card, type Trump, sortHand } from '@poker/engine';
import { PlayingCard } from './PlayingCard';
import { useStore } from '@/lib/store';

export function Hand({
  cards,
  trump,
  interactive,
}: {
  cards: Card[];
  trump: Trump | null;
  interactive: boolean;
}) {
  const selected = useStore((s) => s.selected);
  const toggle = useStore((s) => s.toggleSelect);
  const sorted = trump ? sortHand(cards, trump) : cards;
  return (
    <div className="flex max-w-full overflow-x-auto px-4 py-4">
      <div className="mx-auto flex">
        {sorted.map((c, i) => (
          <div key={c.id} className={i === 0 ? '' : '-ml-8'}>
            <PlayingCard
              card={c}
              selected={selected.includes(c.id)}
              onClick={interactive ? () => toggle(c.id) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
