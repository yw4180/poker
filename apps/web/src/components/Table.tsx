'use client';
import type { PlayerView, RoomView } from '@poker/protocol';
import { CardBack, PlayingCard } from './PlayingCard';
import { trumpText } from '@/lib/store';

const LEVEL_TEXT: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const levelText = (n: number) => LEVEL_TEXT[n] ?? String(n);

/** 以自己为下方，其他人按逆时针（出牌顺序）排到右/上/左 */
function relative(seat: number, me: number): 'bottom' | 'right' | 'top' | 'left' {
  const d = (seat - me + 4) % 4;
  return (['bottom', 'right', 'top', 'left'] as const)[d]!;
}

export function Table({ game, room }: { game: PlayerView; room: RoomView }) {
  const me = game.seat >= 0 ? game.seat : 0;
  const trick = game.trick;
  const lastTrick = game.tricks[game.tricks.length - 1];
  const showPlays = trick && trick.plays.length > 0 ? trick.plays : (lastTrick?.plays ?? []);

  const seatBox = (seat: number) => {
    const s = room.seats[seat];
    const p = game.players[seat];
    const isActor = game.actor === seat;
    const isDealer = game.dealer === seat;
    const team = seat % 2;
    return (
      <div
        className={`flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-sm ${isActor ? 'bg-amber-400/30 ring-2 ring-amber-300' : 'bg-black/30'}`}
      >
        <div className="flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${team === 0 ? 'bg-sky-400' : 'bg-rose-400'}`} />
          <span className="font-medium">{p?.name ?? s?.name ?? `座位${seat + 1}`}</span>
          {isDealer && <span className="rounded bg-amber-500 px-1 text-xs text-black">庄</span>}
          {s && !s.connected && !s.bot && <span className="text-xs text-red-300">离线</span>}
        </div>
        <span className="text-xs text-white/60">{game.handCounts[seat]} 张</span>
      </div>
    );
  };

  const playsAt = (seat: number) => {
    const play = showPlays.find((p) => p.seat === seat);
    if (!play) return null;
    const won = trick && trick.plays.length === 0 && lastTrick?.winner === seat;
    return (
      <div className={`flex ${won ? 'rounded-md ring-2 ring-amber-300 p-1' : ''}`}>
        {play.cards.map((c, i) => (
          <div key={c.id} className={i === 0 ? '' : '-ml-5'}>
            <PlayingCard card={c} small />
          </div>
        ))}
      </div>
    );
  };

  const pos = (dir: ReturnType<typeof relative>) =>
    [0, 1, 2, 3].find((s) => relative(s, me) === dir)!;
  const top = pos('top');
  const left = pos('left');
  const right = pos('right');
  const bottom = pos('bottom');

  return (
    <div className="felt relative mx-auto grid aspect-[4/3] w-full max-w-4xl grid-cols-[1fr_2fr_1fr] grid-rows-[auto_1fr_auto] rounded-2xl border-4 border-amber-900/60 p-3 shadow-inner">
      {/* 顶部 */}
      <div className="col-start-2 row-start-1 flex justify-center">{seatBox(top)}</div>
      {/* 左右 */}
      <div className="col-start-1 row-start-2 flex items-center justify-center">
        {seatBox(left)}
      </div>
      <div className="col-start-3 row-start-2 flex items-center justify-center">
        {seatBox(right)}
      </div>
      {/* 底部 */}
      <div className="col-start-2 row-start-3 flex justify-center">{seatBox(bottom)}</div>

      {/* 中央出牌区 */}
      <div className="col-start-2 row-start-2 grid grid-cols-3 grid-rows-3 place-items-center">
        <div className="col-start-2 row-start-1">{playsAt(top)}</div>
        <div className="col-start-1 row-start-2">{playsAt(left)}</div>
        <div className="col-start-3 row-start-2">{playsAt(right)}</div>
        <div className="col-start-2 row-start-3">{playsAt(bottom)}</div>
        <div className="col-start-2 row-start-2 text-center text-xs text-white/70">
          {game.phase === 'dealing' && (
            <div className="flex flex-col items-center gap-1">
              <CardBack small />
              <span>发牌中… 剩 {game.deckCount - 8}</span>
            </div>
          )}
          {game.phase === 'declaring' && <span>亮主时间</span>}
          {game.trump && (
            <div className="mt-1 rounded bg-black/40 px-2 py-1">
              主 {trumpText(game.trump.suit)} · 打 {levelText(game.level)}
            </div>
          )}
          {game.declaration && !game.trump && (
            <div className="mt-1 rounded bg-black/40 px-2 py-1">
              {game.players[game.declaration.seat]?.name} 亮{' '}
              {trumpText(game.declaration.trump.suit)}
            </div>
          )}
        </div>
      </div>

      {/* 记分 */}
      <div className="absolute left-3 top-3 rounded bg-black/40 px-2 py-1 text-xs">
        <div>
          <span className="text-sky-300">1/3 队</span> 打 {levelText(game.levels[0])}
        </div>
        <div>
          <span className="text-rose-300">2/4 队</span> 打 {levelText(game.levels[1])}
        </div>
        <div className="mt-1">
          闲家得分 <b className="text-amber-300">{game.attackerPoints}</b>
        </div>
      </div>
    </div>
  );
}
