'use client';
import type { Card } from '@poker/engine';

/**
 * 程序化 SVG 牌面：现代、简约、矢量。
 * viewBox 100×150，宽高比 2:3。
 */
const RED = '#e11d48';
const BLACK = '#111827';
const RANK_TEXT: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

/** 花色图形（0..100 方框内） */
function Suit({
  suit,
  x,
  y,
  size,
  color,
  rotate = false,
}: {
  suit: string;
  x: number;
  y: number;
  size: number;
  color: string;
  rotate?: boolean;
}) {
  const s = size / 100;
  const transform = `translate(${x} ${y}) ${rotate ? 'rotate(180)' : ''} scale(${s}) translate(-50 -50)`;
  let body: React.ReactNode;
  switch (suit) {
    case 'H':
      body = (
        <path d="M50 90 C22 66 6 50 6 30 A20 20 0 0 1 50 20 A20 20 0 0 1 94 30 C94 50 78 66 50 90Z" />
      );
      break;
    case 'D':
      body = (
        <path d="M50 4 C62 24 76 38 94 50 C76 62 62 76 50 96 C38 76 24 62 6 50 C24 38 38 24 50 4Z" />
      );
      break;
    case 'S':
      body = (
        <path d="M50 6 C34 30 8 44 8 64 A18 18 0 0 0 44 70 C43 80 38 88 30 94 L70 94 C62 88 57 80 56 70 A18 18 0 0 0 92 64 C92 44 66 30 50 6Z" />
      );
      break;
    default:
      body = (
        <>
          <circle cx="50" cy="28" r="19" />
          <circle cx="29" cy="60" r="19" />
          <circle cx="71" cy="60" r="19" />
          <path d="M44 58 H56 L62 94 H38Z" />
        </>
      );
  }
  return (
    <g transform={transform} fill={color}>
      {body}
    </g>
  );
}

/** 点数牌的 pip 位置（上半区；下半区镜像旋转） */
const PIPS: Record<number, [number, number, boolean][]> = {
  2: [
    [50, 34, false],
    [50, 116, true],
  ],
  3: [
    [50, 34, false],
    [50, 75, false],
    [50, 116, true],
  ],
  4: [
    [32, 34, false],
    [68, 34, false],
    [32, 116, true],
    [68, 116, true],
  ],
  5: [
    [32, 34, false],
    [68, 34, false],
    [50, 75, false],
    [32, 116, true],
    [68, 116, true],
  ],
  6: [
    [32, 34, false],
    [68, 34, false],
    [32, 75, false],
    [68, 75, false],
    [32, 116, true],
    [68, 116, true],
  ],
  7: [
    [32, 34, false],
    [68, 34, false],
    [50, 54, false],
    [32, 75, false],
    [68, 75, false],
    [32, 116, true],
    [68, 116, true],
  ],
  8: [
    [32, 34, false],
    [68, 34, false],
    [50, 54, false],
    [32, 75, false],
    [68, 75, false],
    [50, 96, true],
    [32, 116, true],
    [68, 116, true],
  ],
  9: [
    [32, 32, false],
    [68, 32, false],
    [32, 61, false],
    [68, 61, false],
    [50, 75, false],
    [32, 89, true],
    [68, 89, true],
    [32, 118, true],
    [68, 118, true],
  ],
  10: [
    [32, 32, false],
    [68, 32, false],
    [50, 47, false],
    [32, 61, false],
    [68, 61, false],
    [32, 89, true],
    [68, 89, true],
    [50, 103, true],
    [32, 118, true],
    [68, 118, true],
  ],
};

function Index({
  rank,
  suit,
  color,
  bottom = false,
}: {
  rank: string;
  suit: string;
  color: string;
  bottom?: boolean;
}) {
  return (
    <g transform={bottom ? 'rotate(180 50 75)' : undefined}>
      <text
        x="7"
        y="24"
        fontSize="21"
        fontWeight="700"
        fontFamily="Inter, ui-sans-serif, system-ui"
        fill={color}
        letterSpacing="-0.5"
      >
        {rank}
      </text>
      <Suit suit={suit} x={14} y={36} size={15} color={color} />
    </g>
  );
}

function FaceCard({ rank, suit, color }: { rank: string; suit: string; color: string }) {
  return (
    <g>
      <rect
        x="20"
        y="30"
        width="60"
        height="90"
        rx="6"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      <rect x="24" y="34" width="52" height="82" rx="4" fill={color} fillOpacity="0.06" />
      <Suit suit={suit} x={31} y={42} size={11} color={color} />
      <Suit suit={suit} x={69} y={108} size={11} color={color} rotate />
      {/* 纹章：王冠 / 后冠 / 侍卫徽 */}
      {rank === 'K' && (
        <path d="M36 62 L42 50 L50 58 L58 50 L64 62 Z M36 63 H64 V67 H36Z" fill={color} />
      )}
      {rank === 'Q' && <path d="M38 64 A12 12 0 1 1 62 64 Z M38 65 H62 V68 H38Z" fill={color} />}
      {rank === 'J' && (
        <path d="M50 48 L58 54 L58 62 L50 68 L42 62 L42 54 Z" fill={color} fillOpacity="0.9" />
      )}
      <text
        x="50"
        y="104"
        textAnchor="middle"
        fontSize="42"
        fontWeight="800"
        fontFamily="Inter, ui-sans-serif, system-ui"
        fill={color}
        letterSpacing="-1"
      >
        {rank}
      </text>
    </g>
  );
}

function Joker({ big }: { big: boolean }) {
  const id = big ? 'jk-red' : 'jk-black';
  const c1 = big ? '#be123c' : '#0f172a';
  const c2 = big ? '#fb7185' : '#475569';
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="92" height="142" rx="6" fill={`url(#${id})`} />
      <rect
        x="8"
        y="8"
        width="84"
        height="134"
        rx="4"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      <text
        x="15"
        y="16"
        fontSize="13"
        fontWeight="800"
        fontFamily="Inter, ui-sans-serif, system-ui"
        fill="#fff"
        letterSpacing="2"
        transform="rotate(90 15 16)"
      >
        JOKER
      </text>
      <text
        x="85"
        y="134"
        fontSize="13"
        fontWeight="800"
        fontFamily="Inter, ui-sans-serif, system-ui"
        fill="#fff"
        letterSpacing="2"
        transform="rotate(-90 85 134)"
      >
        JOKER
      </text>
      <path
        d="M50 40 L56 60 L77 60 L60 72 L66 92 L50 80 L34 92 L40 72 L23 60 L44 60Z"
        fill="#fff"
        fillOpacity="0.95"
      />
      <text
        x="50"
        y="118"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fontFamily="Inter, ui-sans-serif, system-ui"
        fill="#fff"
      >
        {big ? '大王' : '小王'}
      </text>
    </g>
  );
}

export function CardSvg({ card, className = '' }: { card: Card; className?: string }) {
  const isJoker = card.suit === 'J';
  const color = card.suit === 'H' || card.suit === 'D' ? RED : BLACK;
  const rank = isJoker ? '' : (RANK_TEXT[card.rank] ?? String(card.rank));
  return (
    <svg viewBox="0 0 100 150" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="0" y="0" width="100" height="150" rx="8" fill="#ffffff" />
      {isJoker ? (
        <Joker big={card.rank === 16} />
      ) : (
        <>
          <Index rank={rank} suit={card.suit} color={color} />
          <Index rank={rank} suit={card.suit} color={color} bottom />
          {card.rank === 14 && <Suit suit={card.suit} x={50} y={75} size={52} color={color} />}
          {card.rank >= 11 && card.rank <= 13 && (
            <FaceCard rank={rank} suit={card.suit} color={color} />
          )}
          {card.rank <= 10 &&
            PIPS[card.rank]?.map(([x, y, rot], i) => (
              <Suit key={i} suit={card.suit} x={x} y={y} size={20} color={color} rotate={rot} />
            ))}
        </>
      )}
      <rect
        x="0.5"
        y="0.5"
        width="99"
        height="149"
        rx="8"
        fill="none"
        stroke="#000"
        strokeOpacity="0.12"
      />
    </svg>
  );
}

export function CardBackSvg({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 150" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <pattern
          id="back-pat"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="8" height="8" fill="#1e3a8a" />
          <rect width="4" height="8" fill="#1d4ed8" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100" height="150" rx="8" fill="#fff" />
      <rect x="5" y="5" width="90" height="140" rx="5" fill="url(#back-pat)" />
      <rect
        x="9"
        y="9"
        width="82"
        height="132"
        rx="3"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.5"
      />
      <circle cx="50" cy="75" r="14" fill="#fff" fillOpacity="0.9" />
      <text
        x="50"
        y="81"
        textAnchor="middle"
        fontSize="16"
        fontWeight="800"
        fill="#1e3a8a"
        fontFamily="Inter, ui-sans-serif, system-ui"
      >
        ♠
      </text>
    </svg>
  );
}
