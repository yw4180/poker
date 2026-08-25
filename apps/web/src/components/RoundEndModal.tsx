'use client';
import type { GameView, RoomView } from '@poker/protocol';
import { PlayingCard } from './PlayingCard';
import { Button } from './ui';
import { request } from '@/lib/socket';
import { levelText, teamText, useStore } from '@/lib/store';

export function RoundEndModal({
  game,
  room,
  userId,
}: {
  game: GameView;
  room: RoomView;
  userId: string;
}) {
  const notify = useStore((s) => s.notify);
  const r = game.lastRound;
  if (!r) return null;
  const isHost = room.hostId === userId;
  const finished = game.phase === 'finished';
  const myTeam = game.seat >= 0 ? game.seat % 2 : -1;
  const won = myTeam === r.winningTeam;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-5 shadow-xl">
        <h2 className="mb-3 text-center text-xl font-bold">
          {finished
            ? `游戏结束 · ${teamText(game.winner ?? 0)} 获胜`
            : myTeam >= 0
              ? won
                ? '本局胜利 🎉'
                : '本局失利'
              : '本局结束'}
        </h2>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-white/60">闲家得分</span>
            <b className="text-amber-300">{r.attackerPoints}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">底牌分 × 倍数</span>
            <span>
              {r.kittyPoints} × {r.kittyMultiplier}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">结果</span>
            <span>
              {teamText(r.winningTeam)} 升 {r.levelsGained} 级
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sky-300">1/3 队</span>
            <span>打 {levelText(game.levels[0])}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-rose-300">2/4 队</span>
            <span>打 {levelText(game.levels[1])}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">下局庄家</span>
            <span>{game.players[r.nextDealer]?.name}</span>
          </div>
        </div>
        {game.kitty && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-white/60">底牌：</div>
            <div className="flex flex-wrap gap-1">
              {game.kitty.map((c) => (
                <PlayingCard key={c.id} card={c} small />
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-center">
          {finished ? (
            <span className="text-sm text-white/60">回到房间可再开一局</span>
          ) : isHost ? (
            <Button
              onClick={async () => {
                const r2 = await request('room:nextRound', {});
                if (!r2.ok) notify(r2.error ?? '');
              }}
            >
              下一局
            </Button>
          ) : (
            <span className="text-sm text-white/60">等待房主开始下一局</span>
          )}
        </div>
      </div>
    </div>
  );
}
