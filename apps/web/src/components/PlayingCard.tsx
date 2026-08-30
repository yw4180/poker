'use client';
import type { Card } from '@poker/engine';
import { CardBackSvg, CardSvg } from './CardSvg';

const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANK_TEXT: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function cardLabel(c: Card): string {
  if (c.suit === 'J') return c.rank === 16 ? '大王' : '小王';
  return `${SUIT_SYMBOL[c.suit]}${RANK_TEXT[c.rank] ?? c.rank}`;
}

/** 牌尺寸：宽高比 2:3 */
export const CARD_SIZE = {
  sm: 'w-9 sm:w-10',
  /** 桌面出牌区：手机小、电脑接近手牌大小 */
  table: 'w-10 sm:w-[3.4rem]',
  md: 'w-14 sm:w-[4.25rem]',
} as const;
export type CardSize = keyof typeof CARD_SIZE;

export function PlayingCard({
  card,
  selected = false,
  highlight = false,
  onClick,
  small = false,
  size: sizeProp,
  trump = false,
}: {
  card: Card;
  selected?: boolean;
  highlight?: boolean;
  onClick?: () => void;
  small?: boolean;
  size?: CardSize;
  /** 主牌：金色内圈提示 */
  trump?: boolean;
}) {
  const size = CARD_SIZE[sizeProp ?? (small ? 'sm' : 'md')];
  return (
    <button
      type="button"
      data-card-id={card.id}
      aria-label={cardLabel(card)}
      onClick={onClick}
      className={`${size} relative aspect-[2/3] shrink-0 select-none overflow-hidden rounded-[7%] shadow-[0_1px_3px_rgba(0,0,0,.45)] transition-[transform,box-shadow] duration-150
        ${selected ? '-translate-y-3 shadow-[0_0_0_2px_var(--accent),0_10px_18px_-8px_rgba(0,0,0,.7)]' : ''}
        ${highlight ? 'shadow-[0_0_0_2px_#60a5fa]' : ''}
        ${onClick ? 'cursor-pointer hover:-translate-y-1.5' : 'cursor-default'}`}
    >
      <CardSvg card={card} className="block h-full w-full" />
      {trump && (
        <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_2px_rgba(245,158,11,0.75)]" />
      )}
    </button>
  );
}

export function CardBack({ small = false }: { small?: boolean }) {
  const size = small ? CARD_SIZE.sm : CARD_SIZE.md;
  return (
    <div
      className={`${size} aspect-[2/3] shrink-0 overflow-hidden rounded-[7%] shadow-[0_1px_3px_rgba(0,0,0,.45)]`}
    >
      <CardBackSvg className="block h-full w-full" />
    </div>
  );
}
