'use client';
import type { GameView, RoomView } from '@poker/protocol';
import { Avatar } from './Avatar';
import { PlayingCard } from './PlayingCard';
import { Tag } from './ui';
import { levelText, trumpText } from '@/lib/store';

function relative(seat: number, me: number): 'bottom' | 'right' | 'top' | 'left' {
  const d = (seat - me + 4) % 4;
  return (['bottom', 'right', 'top', 'left'] as const)[d]!;
}

/** 顶部信息栏：级别 / 主牌 / 庄家 / 分数 */
export function InfoBar({ game }: { game: GameView }) {
  const dealerName = game.dealer !== null ? game.players[game.dealer]?.name : '—';
  const Item = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-faint">{k}</span>
      <span className="text-sm font-medium">{v}</span>
    </div>
  );
  return (
    <div className="panel flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2">
      <Item
        k="级别"
        v={
          <>
            <span className="text-team-a">{levelText(game.levels[0])}</span>
            <span className="mx-1 text-faint">/</span>
            <span className="text-team-b">{levelText(game.levels[1])}</span>
          </>
        }
      />
      <Item k="本局" v={`第 ${game.roundNo} 局 · 打 ${levelText(game.level)}`} />
      <Item k="主" v={game.trump ? trumpText(game.trump.suit) : '未定'} />
      <Item k="庄" v={dealerName} />
      <div className="ml-auto flex items-center gap-4">
        <Item
          k="闲家"
          v={<span className="font-mono text-base text-amber-300">{game.attackerPoints}</span>}
        />
        <Item k="墩" v={<span className="font-mono">{game.tricks.length}</span>} />
      </div>
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
    const isBot = !!s?.bot && s.userId.startsWith('bot:');
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 backdrop-blur-sm transition-colors ${
          isActor
            ? 'border-accent/60 bg-accent/15 shadow-[0_0_0_3px_rgba(16,185,129,.15)]'
            : 'border-white/10 bg-black/35'
        }`}
      >
        <Avatar name={p?.name ?? '?'} src={p?.avatar} size={30} bot={isBot} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${team === 0 ? 'bg-team-a' : 'bg-team-b'}`}
            />
            <span className="max-w-24 truncate text-[13px] font-medium leading-4">
              {p?.name ?? s?.name ?? `座位${seat + 1}`}
            </span>
            {isDealer && <Tag tone="warn">庄</Tag>}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="font-mono">{game.handCounts[seat]}</span> 张
            {s?.bot && !isBot && <span className="text-amber-300">托管</span>}
            {s && !s.connected && !s.bot && <span className="text-red-300">离线</span>}
          </div>
        </div>
      </div>
    );
  };

  const playsAt = (seat: number) => {
    const play = showPlays.find((p) => p.seat === seat);
    if (!play) return null;
    const won = showingLast && lastTrick?.winner === seat;
    return (
      <div
        className={`flex rounded-lg p-1 transition-opacity ${won ? 'ring-2 ring-amber-300/80' : ''} ${showingLast && !won ? 'opacity-60' : ''}`}
      >
        {play.cards.map((c, i) => (
          <div key={c.id} className={i === 0 ? '' : '-ml-5 sm:-ml-7'}>
            <PlayingCard card={c} size="table" />
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

  const centerNote = (text: string) => (
    <span className="rounded-md bg-black/40 px-2.5 py-1 text-xs text-white/80 backdrop-blur-sm">
      {text}
    </span>
  );
  const center = (
    <div className="flex flex-col items-center gap-1.5 text-center">
      {game.declaration && !game.trump && (
        <div className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs backdrop-blur-sm">
          <span className="whitespace-nowrap">{game.players[game.declaration.seat]?.name} 亮</span>
          {game.declaration.cards.map((c) => (
            <PlayingCard key={c.id} card={c} small />
          ))}
        </div>
      )}
      {(game.phase === 'dealing' || game.phase === 'declaring') &&
        !game.declaration &&
        centerNote(game.phase === 'dealing' ? '发牌中…' : '等待亮主')}
      {game.phase === 'kitty' && centerNote('庄家扣底中…')}
      {game.phase === 'playing' &&
        showPlays.length === 0 &&
        centerNote(`等待 ${game.players[game.actor ?? 0]?.name} 领出`)}
    </div>
  );

  return (
    <div className="felt relative mx-auto grid h-[min(56vh,600px)] w-full lg:h-auto lg:min-h-0 lg:flex-1 grid-cols-[minmax(84px,1fr)_2fr_minmax(84px,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl p-3">
      <div className="col-start-2 row-start-1 flex justify-center">{seatBox(top)}</div>
      <div className="col-start-1 row-start-2 flex items-center justify-center">
        {seatBox(left)}
      </div>
      <div className="col-start-3 row-start-2 flex items-center justify-center">
        {seatBox(right)}
      </div>
      <div className="col-start-2 row-start-3 flex justify-center">{seatBox(bottom)}</div>
      <div className="col-start-2 row-start-2 grid min-h-0 grid-cols-3 grid-rows-3 place-items-center">
        <div className="col-start-2 row-start-1">{playsAt(top)}</div>
        <div className="col-start-1 row-start-2">{playsAt(left)}</div>
        <div className="col-start-3 row-start-2">{playsAt(right)}</div>
        <div className="col-start-2 row-start-3">{playsAt(bottom)}</div>
        <div className="col-start-2 row-start-2">{center}</div>
      </div>
      {showingLast && (
        <div className="absolute right-3 top-3 rounded-md bg-black/40 px-2 py-0.5 text-[11px] text-white/70">
          上一墩 · {game.players[lastTrick!.winner]?.name} +{lastTrick!.points}
        </div>
      )}
    </div>
  );
}
