'use client';
import { effectiveSuit } from '@poker/engine';
import type { GameView } from '@poker/protocol';
import { PlayingCard } from './PlayingCard';
import { Panel } from './ui';

/** 庄家回看自己埋的底牌 */
export function KittyPanel({ game }: { game: GameView }) {
  if (!game.kitty) return null;
  return (
    <Panel title={`底牌（只有你可见） · ${game.kitty.length} 张`}>
      <div className="flex flex-wrap gap-1.5 px-4 py-3">
        {game.kitty.map((c) => (
          <PlayingCard
            key={c.id}
            card={c}
            small
            trump={!!game.trump && effectiveSuit(c, game.trump) === 'T'}
          />
        ))}
      </div>
    </Panel>
  );
}
