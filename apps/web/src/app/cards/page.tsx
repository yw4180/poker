'use client';
import { makeDeck } from '@poker/engine';
import { CardBack, PlayingCard } from '@/components/PlayingCard';

/** 牌面画廊：/cards，用于设计检查 */
export default function CardsPage() {
  const deck = makeDeck().slice(0, 54);
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">牌面画廊</h1>
      <div className="flex flex-wrap gap-3">
        {deck.map((c) => (
          <div key={c.id} className="w-[4.25rem]">
            <PlayingCard card={c} />
          </div>
        ))}
        <CardBack />
      </div>
      <h2 className="text-sm text-muted">小尺寸</h2>
      <div className="flex flex-wrap gap-1">
        {deck.slice(0, 20).map((c) => (
          <PlayingCard key={c.id} card={c} small />
        ))}
      </div>
    </div>
  );
}
