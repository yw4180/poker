'use client';
import type { GameView } from '@poker/protocol';
import { PlayingCard } from './PlayingCard';

export function LastTrick({ game }: { game: GameView }) {
  const t = game.tricks[game.tricks.length - 1];
  if (!t) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-800/90 p-3 text-sm">
      <div className="mb-2 text-white/70">
        上一墩 · {game.players[t.winner]?.name} 赢，{t.points} 分
      </div>
      <div className="flex flex-wrap gap-4">
        {t.plays.map((p) => (
          <div key={p.seat} className="flex flex-col items-center gap-1">
            <span className={`text-xs ${p.seat === t.winner ? 'text-amber-300' : 'text-white/60'}`}>
              {game.players[p.seat]?.name}
            </span>
            <div className="flex">
              {p.cards.map((c, i) => (
                <div key={c.id} className={i === 0 ? '' : '-ml-5'}>
                  <PlayingCard card={c} small />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
