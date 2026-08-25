'use client';
import type { GameView, RoomView } from '@poker/protocol';
import { Countdown } from './Countdown';
import { CardBack, PlayingCard } from './PlayingCard';
import { levelText, teamText, trumpText } from '@/lib/store';

/** 以自己为下方，其他人按出牌顺序排到右/上/左 */
function relative(seat: number, me: number): 'bottom' | 'right' | 'top' | 'left' {
  const d = (seat - me + 4) % 4;
  return (['bottom', 'right', 'top', 'left'] as const)[d]!;
}

export function InfoBar({ game }: { game: GameView }) {
  const dealerName = game.dealer !== null ? game.players[game.dealer]?.name : '—';
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-lg bg-neutral-800/80 px-3 py-1.5 text-xs sm:text-sm">
      <span>
        <span className="text-sky-300">1/3 队</span> 打 {levelText(game.levels[0])}
      </span>
      <span>
        <span className="text-rose-300">2/4 队</span> 打 {levelText(game.levels[1])}
      </span>
      <span className="text-white/40">|</span>
      <span>
        第 {game.roundNo} 局 · 打 {levelText(game.level)}
      </span>
      <span>主 {game.trump ? trumpText(game.trump.suit) : '未定'}</span>
      <span>庄 {dealerName}</span>
      <span className="text-white/40">|</span>
      <span>
        闲家 <b className="text-amber-300">{game.attackerPoints}</b> 分
      </span>
      <span>{game.tricks.length} 墩</span>
    </div>
  );
}

export function Table({ game, room }: { game: GameView; room: RoomView }) {
  const me = game.seat >= 0 ? game.seat : 0;
  const trick = game.trick;
  const lastTrick = game.tricks[game.tricks.length - 1];
  const showingLast = !!trick && trick.plays.length === 0 && !!lastTrick;
  const showPlays = trick && trick.plays.length > 0 ? trick.plays : (lastTrick?.plays ?? []);

  const seatBox = (seat: number) => {
    const s = room.seats[seat];
    const p = game.players[seat];
    const isActor = game.actor === seat;
    const isDealer = game.dealer === seat;
    const team = seat % 2;
    return (
      <div
        className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-xs sm:px-3 sm:text-sm ${isActor ? 'bg-amber-400/30 ring-2 ring-amber-300' : 'bg-black/30'}`}
      >
        <div className="flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${team === 0 ? 'bg-sky-400' : 'bg-rose-400'}`} />
          <span className="max-w-24 truncate font-medium">
            {p?.name ?? s?.name ?? `座位${seat + 1}`}
          </span>
          {isDealer && <span className="rounded bg-amber-500 px-1 text-[10px] text-black">庄</span>}
          {s?.bot && !s.userId.startsWith('bot:') && (
            <span className="text-[10px] text-orange-300">托管</span>
          )}
          {s && !s.connected && !s.bot && <span className="text-[10px] text-red-300">离线</span>}
        </div>
        <span className="text-[10px] text-white/60 sm:text-xs">{game.handCounts[seat]} 张</span>
      </div>
    );
  };

  const playsAt = (seat: number) => {
    const play = showPlays.find((p) => p.seat === seat);
    if (!play) return null;
    const won = showingLast && lastTrick?.winner === seat;
    return (
      <div
        className={`flex ${won ? 'rounded-md p-1 ring-2 ring-amber-300' : ''} ${showingLast ? 'opacity-80' : ''}`}
      >
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

  const center = (
    <div className="flex flex-col items-center gap-1 text-center text-xs text-white/80">
      {game.phase === 'dealing' && (
        <>
          <CardBack small />
          <span>发牌中… 剩 {Math.max(0, game.deckCount - 8)}</span>
        </>
      )}
      {game.phase === 'declaring' && game.deadlineAt && (
        <Countdown deadlineAt={game.deadlineAt} label="亮主倒计时" />
      )}
      {game.declaration && !game.trump && (
        <div className="flex items-center gap-1 rounded bg-black/40 px-2 py-1">
          <span>{game.players[game.declaration.seat]?.name} 亮</span>
          {game.declaration.cards.map((c) => (
            <PlayingCard key={c.id} card={c} small />
          ))}
        </div>
      )}
      {game.phase === 'kitty' && <span className="rounded bg-black/40 px-2 py-1">庄家扣底中…</span>}
      {game.phase === 'playing' && showPlays.length === 0 && (
        <span className="rounded bg-black/40 px-2 py-1">
          等待 {game.players[game.actor ?? 0]?.name} 领出
        </span>
      )}
    </div>
  );

  return (
    <div className="felt relative mx-auto grid h-[min(52vh,520px)] w-full max-w-4xl grid-cols-[minmax(80px,1fr)_2fr_minmax(80px,1fr)] grid-rows-[auto_1fr_auto] rounded-2xl border-4 border-amber-900/60 p-2 shadow-inner sm:p-3">
      <div className="col-start-2 row-start-1 flex justify-center">{seatBox(top)}</div>
      <div className="col-start-1 row-start-2 flex items-center justify-center">
        {seatBox(left)}
      </div>
      <div className="col-start-3 row-start-2 flex items-center justify-center">
        {seatBox(right)}
      </div>
      <div className="col-start-2 row-start-3 flex justify-center">{seatBox(bottom)}</div>
      <div className="col-start-2 row-start-2 grid grid-cols-3 grid-rows-3 place-items-center">
        <div className="col-start-2 row-start-1">{playsAt(top)}</div>
        <div className="col-start-1 row-start-2">{playsAt(left)}</div>
        <div className="col-start-3 row-start-2">{playsAt(right)}</div>
        <div className="col-start-2 row-start-3">{playsAt(bottom)}</div>
        <div className="col-start-2 row-start-2">{center}</div>
      </div>
      {showingLast && (
        <div className="absolute right-2 top-2 rounded bg-black/40 px-2 py-0.5 text-[10px] text-white/70">
          上一墩 · {game.players[lastTrick!.winner]?.name} 赢 {lastTrick!.points} 分
        </div>
      )}
    </div>
  );
}

export { teamText };
