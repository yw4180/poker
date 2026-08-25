'use client';
import type { GameView, RoomView } from '@poker/protocol';
import { Avatar } from './Avatar';
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
  const finished = game.phase === 'finished';
  const myTeam = game.seat >= 0 ? game.seat % 2 : -1;
  const won = myTeam === r.winningTeam;
  const meReady = game.seat >= 0 && room.readyNext.includes(game.seat);
  // 每人吃到的分与墩数
  const stats = [0, 1, 2, 3].map((seat) => ({
    seat,
    tricks: game.tricks.filter((t) => t.winner === seat).length,
    points: game.tricks.filter((t) => t.winner === seat).reduce((s, t) => s + t.points, 0),
  }));
  void userId;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-5 shadow-xl">
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

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {stats.map((st) => {
            const p = game.players[st.seat]!;
            const seat = room.seats[st.seat];
            const ready = room.readyNext.includes(st.seat);
            return (
              <div
                key={st.seat}
                className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5"
              >
                <Avatar
                  name={p.name}
                  src={p.avatar}
                  size={28}
                  bot={!!seat?.bot && seat.userId.startsWith('bot:')}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    <span className={st.seat % 2 === 0 ? 'text-sky-300' : 'text-rose-300'}>●</span>{' '}
                    {p.name}
                  </div>
                  <div className="text-xs text-white/50">
                    {st.tricks} 墩 · {st.points} 分
                  </div>
                </div>
                {!finished && (
                  <span className={`text-xs ${ready ? 'text-emerald-300' : 'text-white/40'}`}>
                    {ready ? '已准备' : '未准备'}
                  </span>
                )}
              </div>
            );
          })}
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
          ) : game.seat < 0 ? (
            <span className="text-sm text-white/60">等待玩家准备下一局</span>
          ) : (
            <Button
              disabled={meReady}
              onClick={async () => {
                const r2 = await request('room:nextRound', {});
                if (!r2.ok) notify(r2.error ?? '');
              }}
            >
              {meReady ? `已准备（${room.readyNext.length}/4）` : '下一局'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
