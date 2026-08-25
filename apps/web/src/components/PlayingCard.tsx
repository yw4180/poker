'use client';
import type { Card } from '@poker/engine';

const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANK_TEXT: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function cardLabel(c: Card): string {
  if (c.suit === 'J') return c.rank === 16 ? '大王' : '小王';
  return `${SUIT_SYMBOL[c.suit]}${RANK_TEXT[c.rank] ?? c.rank}`;
}

export function PlayingCard({
  card,
  selected = false,
  highlight = false,
  onClick,
  small = false,
}: {
  card: Card;
  selected?: boolean;
  highlight?: boolean;
  onClick?: () => void;
  small?: boolean;
}) {
  const red = card.suit === 'H' || card.suit === 'D' || (card.suit === 'J' && card.rank === 16);
  const size = small
    ? 'h-12 w-9 text-[11px] sm:h-14 sm:w-10 sm:text-xs'
    : 'h-20 w-14 text-sm sm:h-24 sm:w-16 sm:text-base';
  return (
    <button
      type="button"
      data-card-id={card.id}
      aria-label={cardLabel(card)}
      onClick={onClick}
      className={`${size} relative flex shrink-0 flex-col items-start justify-between rounded-md border bg-white p-1 font-bold shadow transition-transform
        ${red ? 'text-red-600' : 'text-neutral-900'}
        ${selected ? '-translate-y-3 border-amber-400 ring-2 ring-amber-400' : 'border-neutral-300'}
        ${highlight ? 'ring-2 ring-sky-400' : ''}
        ${onClick ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'}`}
    >
      {card.suit === 'J' ? (
        <span className="text-[0.75em] leading-tight">{cardLabel(card)}</span>
      ) : (
        <>
          <span>{RANK_TEXT[card.rank] ?? card.rank}</span>
          <span className={small ? 'text-sm' : 'text-xl sm:text-2xl'}>
            {SUIT_SYMBOL[card.suit]}
          </span>
        </>
      )}
    </button>
  );
}

export function CardBack({ small = false }: { small?: boolean }) {
  const size = small ? 'h-12 w-9 sm:h-14 sm:w-10' : 'h-20 w-14 sm:h-24 sm:w-16';
  return (
    <div
      className={`${size} shrink-0 rounded-md border border-blue-300 bg-blue-700 bg-[repeating-linear-gradient(45deg,#1d4ed8_0_4px,#2563eb_4px_8px)] shadow`}
    />
  );
}
