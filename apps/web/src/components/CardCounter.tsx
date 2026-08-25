'use client';
import { type Card, type PlaySuit, buildMemory, strength } from '@poker/engine';
import type { GameView } from '@poker/protocol';
import { stateFromView } from '@/lib/engine-view';

const ORDER: PlaySuit[] = ['T', 'S', 'H', 'C', 'D'];
const NAME: Record<PlaySuit, string> = { T: '主', S: '♠', H: '♥', C: '♣', D: '♦' };
const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANK_TEXT: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

function chip(c: Card, inTrump: boolean) {
  const red = c.suit === 'H' || c.suit === 'D' || (c.suit === 'J' && c.rank === 16);
  let text: string;
  if (c.suit === 'J') text = c.rank === 16 ? '大王' : '小王';
  else if (inTrump)
    text = `${SUIT_SYMBOL[c.suit]}${RANK_TEXT[c.rank] ?? c.rank}`; // 主牌里保留花色，区分各花色级牌
  else text = RANK_TEXT[c.rank] ?? String(c.rank);
  return (
    <span
      key={c.id}
      className={`rounded border px-1 font-mono text-[11px] leading-5 ${red ? 'border-red-300/40 bg-red-500/10 text-red-300' : 'border-white/20 bg-white/10 text-white/90'}`}
    >
      {text}
    </span>
  );
}

/** 记牌器：列出尚未出现（可能在别人手里或底牌里）的牌 */
export function CardCounter({ game }: { game: GameView }) {
  if (!game.trump) return <div className="text-xs text-white/50">主牌未定，暂无记牌</div>;
  const mem = buildMemory(stateFromView(game), game.seat);
  const t = game.trump;
  return (
    <div className="space-y-2 text-xs">
      {ORDER.map((s) => {
        const cards = mem.unseenBySuit[s].slice().sort((a, b) => strength(b, t) - strength(a, t));
        return (
          <div key={s} className="flex items-start gap-2">
            <span
              className={`w-6 shrink-0 pt-0.5 font-bold ${s === 'H' || s === 'D' ? 'text-red-400' : ''}`}
            >
              {NAME[s]}
            </span>
            <span className="w-5 shrink-0 pt-0.5 text-white/50">{cards.length}</span>
            <span className="flex flex-wrap gap-1">{cards.map((c) => chip(c, s === 'T'))}</span>
          </div>
        );
      })}
      <div className="text-faint">含底牌 {game.kittyCount} 张（仅庄家已知）</div>
    </div>
  );
}
