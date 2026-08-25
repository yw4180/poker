'use client';
import type { Card } from '@poker/engine';

const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANK_TEXT: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function cardLabel(c: Card): string {
  if (c.suit === 'J') return c.rank === 16 ? '大王' : '小王';
  return `${SUIT_SYMBOL[c.suit]}${RANK_TEXT[c.rank] ?? c.rank}`;
}

/** 牌面：白底、双角标、中央大花色；王牌用渐变底 + 竖排 JOKER */
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
  const isJoker = card.suit === 'J';
  const big = isJoker && card.rank === 16;
  const red = card.suit === 'H' || card.suit === 'D' || big;
  const size = small ? 'h-12 w-9 sm:h-14 sm:w-10' : 'h-20 w-14 sm:h-24 sm:w-[4.25rem]';
  const rank = isJoker ? '' : (RANK_TEXT[card.rank] ?? String(card.rank));
  const suit = isJoker ? '' : SUIT_SYMBOL[card.suit]!;
  const face = isJoker
    ? `bg-gradient-to-br ${big ? 'from-rose-100 via-amber-50 to-rose-200' : 'from-slate-100 via-white to-slate-300'}`
    : 'bg-[linear-gradient(160deg,#ffffff_0%,#f7f7f4_100%)]';

  return (
    <button
      type="button"
      data-card-id={card.id}
      aria-label={cardLabel(card)}
      onClick={onClick}
      className={`${size} ${face} relative shrink-0 select-none overflow-hidden rounded-md border border-neutral-300 shadow-[0_1px_2px_rgba(0,0,0,.35),inset_0_0_0_1px_rgba(255,255,255,.6)] transition-transform
        ${red ? 'text-red-600' : 'text-neutral-900'}
        ${selected ? '-translate-y-3 ring-2 ring-amber-400' : ''}
        ${highlight ? 'ring-2 ring-sky-400' : ''}
        ${onClick ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'}`}
    >
      {isJoker ? (
        <>
          <span
            className={`absolute left-0.5 top-0.5 font-black leading-none tracking-tight ${small ? 'text-[9px]' : 'text-[11px] sm:text-xs'}`}
            style={{ writingMode: 'vertical-rl' }}
          >
            JOKER
          </span>
          <span
            className={`absolute inset-0 flex items-center justify-center ${small ? 'text-lg' : 'text-3xl sm:text-4xl'}`}
          >
            {big ? '🃏' : '🎭'}
          </span>
          <span
            className={`absolute bottom-0.5 right-0.5 rounded px-0.5 font-bold ${small ? 'text-[9px]' : 'text-[11px]'} ${big ? 'bg-red-600 text-white' : 'bg-neutral-800 text-white'}`}
          >
            {big ? '大' : '小'}
          </span>
        </>
      ) : (
        <>
          <span
            className={`absolute left-1 top-0.5 flex flex-col items-center font-bold leading-none ${small ? 'text-[10px] sm:text-[11px]' : 'text-sm sm:text-base'}`}
          >
            <span>{rank}</span>
            <span className={small ? 'text-[9px]' : 'text-xs'}>{suit}</span>
          </span>
          <span
            className={`absolute inset-0 flex items-center justify-center pt-2 ${small ? 'text-lg' : 'text-3xl sm:text-4xl'} opacity-90`}
          >
            {suit}
          </span>
          <span
            className={`absolute bottom-0.5 right-1 rotate-180 flex flex-col items-center font-bold leading-none ${small ? 'hidden' : 'text-xs'}`}
          >
            <span>{rank}</span>
            <span className="text-[10px]">{suit}</span>
          </span>
        </>
      )}
    </button>
  );
}

export function CardBack({ small = false }: { small?: boolean }) {
  const size = small ? 'h-12 w-9 sm:h-14 sm:w-10' : 'h-20 w-14 sm:h-24 sm:w-[4.25rem]';
  return (
    <div className={`${size} shrink-0 rounded-md border border-blue-200 p-1 shadow`}>
      <div className="h-full w-full rounded-sm border border-white/40 bg-blue-700 bg-[repeating-linear-gradient(45deg,#1d4ed8_0_4px,#2563eb_4px_8px)]" />
    </div>
  );
}
