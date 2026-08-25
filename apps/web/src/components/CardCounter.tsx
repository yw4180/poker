'use client';
import { type PlaySuit, buildMemory, strength } from '@poker/engine';
import type { GameView } from '@poker/protocol';
import { stateFromView } from '@/lib/engine-view';
import { cardLabel } from './PlayingCard';

const ORDER: PlaySuit[] = ['T', 'S', 'H', 'C', 'D'];
const NAME: Record<PlaySuit, string> = { T: '主', S: '♠', H: '♥', C: '♣', D: '♦' };

/** 记牌器：列出尚未出现（可能在别人手里或底牌里）的牌 */
export function CardCounter({ game }: { game: GameView }) {
  if (!game.trump) return <div className="text-xs text-white/50">主牌未定，暂无记牌</div>;
  const mem = buildMemory(stateFromView(game), game.seat);
  const t = game.trump;
  return (
    <div className="space-y-1 text-xs">
      {ORDER.map((s) => {
        const cards = mem.unseenBySuit[s].slice().sort((a, b) => strength(b, t) - strength(a, t));
        return (
          <div key={s} className="flex gap-2">
            <span
              className={`w-6 shrink-0 font-bold ${s === 'H' || s === 'D' ? 'text-red-400' : ''}`}
            >
              {NAME[s]}
            </span>
            <span className="text-white/50">{cards.length}</span>
            <span className="flex flex-wrap gap-x-1 font-mono">
              {cards.map((c) => (
                <span key={c.id} className={c.suit === 'H' || c.suit === 'D' ? 'text-red-300' : ''}>
                  {cardLabel(c).replace(/^[♠♥♦♣]/, '')}
                </span>
              ))}
            </span>
          </div>
        );
      })}
      <div className="text-white/40">未出现的牌包含底牌 {game.kittyCount} 张（庄家可见）</div>
    </div>
  );
}
