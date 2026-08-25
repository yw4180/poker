'use client';
import type { Card } from '@poker/engine';

const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SUIT_FILE: Record<string, string> = { S: 'spade', H: 'heart', D: 'diamond', C: 'club' };
const RANK_TEXT: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const RANK_FILE: Record<number, string> = { 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };

export function cardLabel(c: Card): string {
  if (c.suit === 'J') return c.rank === 16 ? '大王' : '小王';
  return `${SUIT_SYMBOL[c.suit]}${RANK_TEXT[c.rank] ?? c.rank}`;
}

/** 素材：public/cards/*.webp（saulspatz/SVGCards，公有领域） */
export function cardImage(c: Card): string {
  if (c.suit === 'J') return c.rank === 16 ? '/cards/redJoker.webp' : '/cards/blackJoker.webp';
  return `/cards/${SUIT_FILE[c.suit]}${RANK_FILE[c.rank] ?? c.rank}.webp`;
}

/** 牌尺寸：宽高比 2:3 */
export const CARD_SIZE = {
  sm: 'w-9 sm:w-10',
  md: 'w-14 sm:w-[4.25rem]',
} as const;

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
  const size = small ? CARD_SIZE.sm : CARD_SIZE.md;
  return (
    <button
      type="button"
      data-card-id={card.id}
      aria-label={cardLabel(card)}
      onClick={onClick}
      className={`${size} relative aspect-[2/3] shrink-0 select-none overflow-hidden rounded-[6px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.4),0_0_0_1px_rgba(0,0,0,.25)] transition-[transform,box-shadow] duration-150
        ${selected ? '-translate-y-3 shadow-[0_0_0_2px_var(--accent),0_8px_16px_-6px_rgba(0,0,0,.6)]' : ''}
        ${highlight ? 'shadow-[0_0_0_2px_#60a5fa]' : ''}
        ${onClick ? 'cursor-pointer hover:-translate-y-1.5' : 'cursor-default'}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cardImage(card)}
        alt={cardLabel(card)}
        draggable={false}
        className="h-full w-full object-cover"
      />
    </button>
  );
}

export function CardBack({ small = false }: { small?: boolean }) {
  const size = small ? CARD_SIZE.sm : CARD_SIZE.md;
  return (
    <div
      className={`${size} aspect-[2/3] shrink-0 overflow-hidden rounded-[6px] shadow-[0_1px_2px_rgba(0,0,0,.4),0_0_0_1px_rgba(0,0,0,.25)]`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cards/blueBack.webp"
        alt="牌背"
        draggable={false}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
