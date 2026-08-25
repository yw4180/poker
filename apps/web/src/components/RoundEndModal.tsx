'use client';
import type { GameView, RoomView } from '@poker/protocol';
import { Avatar } from './Avatar';
import { PlayingCard } from './PlayingCard';
import { Button, Tag } from './ui';
import { request } from '@/lib/socket';
import { levelText, teamText, useStore } from '@/lib/store';

export function RoundEndModal({ game, room }: { game: GameView; room: RoomView; userId: string }) {
  const notify = useStore((s) => s.notify);
  const r = game.lastRound;
  if (!r) return null;
  const finished = game.phase === 'finished';
  const myTeam = game.seat >= 0 ? game.seat % 2 : -1;
  const won = myTeam === r.winningTeam;
  const meReady = game.seat >= 0 && room.readyNext.includes(game.seat);
  const stats = [0, 1, 2, 3].map((seat) => ({
    seat,
    tricks: game.tricks.filter((t) => t.winner === seat).length,
    points: game.tricks.filter((t) => t.winner === seat).reduce((s, t) => s + t.points, 0),
  }));
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="panel max-h-[92vh] w-full max-w-lg overflow-y-auto p-6 shadow-2xl">
        <div className="mb-4 text-center">
          <div className="text-xs uppercase tracking-widest text-faint">
            {finished ? 'Game over' : `第 ${game.roundNo} 局`}
          </div>
          <h2
            className={`mt-1 text-2xl font-semibold tracking-tight ${!finished && myTeam >= 0 ? (won ? 'text-accent' : 'text-red-300') : ''}`}
          >
            {finished
              ? `${teamText(game.winner ?? 0)} 获胜`
              : myTeam >= 0
                ? won
                  ? '本局胜利'
                  : '本局失利'
                : '本局结束'}
          </h2>
        </div>
        <div className="divide-y divide-white/[0.06]">
          <Row
            k="闲家得分"
            v={<span className="font-mono text-lg text-amber-300">{r.attackerPoints}</span>}
          />
          <Row
            k="底牌分 × 倍数"
            v={
              <span className="font-mono">
                {r.kittyPoints} × {r.kittyMultiplier}
              </span>
            }
          />
          <Row k="结果" v={`${teamText(r.winningTeam)} 升 ${r.levelsGained} 级`} />
          <Row
            k="级别"
            v={
              <>
                <span className="text-team-a">{levelText(game.levels[0])}</span>
                <span className="mx-1 text-faint">/</span>
                <span className="text-team-b">{levelText(game.levels[1])}</span>
              </>
            }
          />
          <Row k="下局庄家" v={game.players[r.nextDealer]?.name} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {stats.map((st) => {
            const p = game.players[st.seat]!;
            const seat = room.seats[st.seat];
            const ready = room.readyNext.includes(st.seat);
            return (
              <div
                key={st.seat}
                className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2"
              >
                <Avatar
                  name={p.name}
                  src={p.avatar}
                  size={28}
                  bot={!!seat?.bot && seat.userId.startsWith('bot:')}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-sm">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${st.seat % 2 === 0 ? 'bg-team-a' : 'bg-team-b'}`}
                    />
                    {p.name}
                  </div>
                  <div className="font-mono text-[11px] text-muted">
                    {st.tricks} 墩 · {st.points} 分
                  </div>
                </div>
                {!finished && (
                  <Tag tone={ready ? 'accent' : 'default'}>{ready ? '已准备' : '未准备'}</Tag>
                )}
              </div>
            );
          })}
        </div>
        {game.kitty && (
          <div className="mt-4">
            <div className="mb-1.5 text-xs text-faint">底牌：</div>
            <div className="flex flex-wrap gap-1">
              {game.kitty.map((c) => (
                <PlayingCard key={c.id} card={c} small />
              ))}
            </div>
          </div>
        )}
        <div className="mt-5 flex justify-center">
          {finished ? (
            <span className="text-sm text-muted">回到房间可再开一局</span>
          ) : game.seat < 0 ? (
            <span className="text-sm text-muted">等待玩家准备下一局</span>
          ) : (
            <Button
              variant="primary"
              size="lg"
              disabled={meReady}
              onClick={async () => {
                const r2 = await request('room:nextRound', {});
                if (!r2.ok) notify(r2.error ?? '');
              }}
            >
              {meReady ? `已准备 ${room.readyNext.length}/4` : '下一局'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
