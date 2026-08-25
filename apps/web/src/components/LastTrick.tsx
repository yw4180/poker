'use client';
import type { GameView } from '@poker/protocol';
import { PlayingCard } from './PlayingCard';
import { Panel } from './ui';

export function LastTrick({ game }: { game: GameView }) {
  const t = game.tricks[game.tricks.length - 1];
  if (!t) return null;
  return (
    <Panel title={`上一墩 · ${game.players[t.winner]?.name} 赢，${t.points} 分`}>
      <div className="flex flex-wrap gap-5 px-4 py-3">
        {t.plays.map((p) => (
          <div key={p.seat} className="flex flex-col items-center gap-1.5">
            <span className={`text-xs ${p.seat === t.winner ? 'text-amber-300' : 'text-muted'}`}>
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
    </Panel>
  );
}
