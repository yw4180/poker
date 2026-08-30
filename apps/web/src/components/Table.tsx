'use client';
import { beats, classify, effectiveSuit } from '@poker/engine';
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

const SUIT_MINI: Record<string, string> = { T: '主', S: '♠', H: '♥', C: '♣', D: '♦' };

export function Table({
  game,
  room,
  voids,
  userId,
  onSeatAction,
}: {
  game: GameView;
  room: RoomView;
  userId?: string;
  /** 座位操作：接管机器人 / 换成机器人 */
  onSeatAction?: (action: 'takeover' | 'fillBot', seat: number) => void;
  /** 各座位已确认缺的花色（记牌器开启时显示） */
  voids?: string[][];
}) {
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
          {onSeatAction && userId && (
            <>
              {game.seat < 0 && isBot && (
                <button
                  type="button"
                  className="mt-0.5 rounded bg-accent/20 px-1.5 text-[11px] text-accent hover:bg-accent/30"
                  onClick={() => onSeatAction('takeover', seat)}
                >
                  接管
                </button>
              )}
              {room.hostId === userId && s && !isBot && (s.bot || !s.connected) && (
                <button
                  type="button"
                  className="mt-0.5 rounded bg-white/10 px-1.5 text-[11px] text-muted hover:bg-white/20"
                  onClick={() => onSeatAction('fillBot', seat)}
                >
                  换机器人
                </button>
              )}
            </>
          )}
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="font-mono">{game.handCounts[seat]}</span> 张
            {s?.bot && !isBot && <span className="text-amber-300">托管</span>}
            {s && !s.connected && !s.bot && <span className="text-red-300">离线</span>}
            {voids && voids[seat] && voids[seat]!.length > 0 && seat !== game.seat && (
              <span className="text-red-300/90">
                缺{voids[seat]!.map((x) => SUIT_MINI[x]).join('')}
              </span>
            )}{' '}
          </div>
        </div>
      </div>
    );
  };

  // 逐手分析：毙/盖毙标签 + 当前最大
  const trickInfo = (() => {
    const t = game.trump;
    const labels = new Map<number, string>();
    let winnerSeat: number | null = null;
    if (t && showPlays.length > 0) {
      const first = showPlays[0]!;
      const lead = classify(first.cards, t);
      if (lead) {
        let current = lead;
        winnerSeat = first.seat;
        let winningRuffs = 0;
        for (const p of showPlays.slice(1)) {
          const isRuff = lead.suit !== 'T' && p.cards.every((c) => effectiveSuit(c, t) === 'T');
          if (beats(current, p.cards, lead, t)) {
            winnerSeat = p.seat;
            current = classify(p.cards, t)!;
            // 只有真正压过当前最大时才算毙/盖毙
            if (isRuff) labels.set(p.seat, winningRuffs++ === 0 ? '毙' : '盖毙');
          }
        }
      }
    }
    return { labels, winnerSeat };
  })();
  const inProgress = !!trick && trick.plays.length > 0;

  const playsAt = (seat: number) => {
    const play = showPlays.find((p) => p.seat === seat);
    if (!play) return null;
    const won = showingLast && lastTrick?.winner === seat;
    const biggest = inProgress && trickInfo.winnerSeat === seat;
    const label = trickInfo.labels.get(seat);
    return (
      <div
        className={`relative flex rounded-lg p-1 transition-opacity ${won || biggest ? 'ring-2 ring-amber-300/80' : ''} ${showingLast && !won ? 'opacity-60' : ''}`}
      >
        {biggest && !showingLast && (
          <span className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded bg-amber-400 px-1 text-[10px] font-bold text-black">
            最大
          </span>
        )}
        {label && (
          <span className="absolute -right-1.5 -top-2 z-10 rounded bg-red-500 px-1 text-[10px] font-bold text-white">
            {label}
          </span>
        )}
        {play.cards.map((c, i) => (
          <div key={c.id} className={i === 0 ? '' : '-ml-5 sm:-ml-7'}>
            <PlayingCard
              card={c}
              size="table"
              trump={!!game.trump && effectiveSuit(c, game.trump) === 'T'}
            />
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
      {game.phase === 'playing' &&
        !showingLast &&
        trick &&
        trick.plays.length > 0 &&
        trick.lead && (
          <span className="rounded-md bg-black/50 px-2.5 py-1 text-sm font-medium backdrop-blur-sm">
            {game.players[trick!.leader]?.name} 领出 ·{' '}
            {trick.lead.suit === 'T' ? (
              <span className="text-amber-300">主牌</span>
            ) : (
              <span
                className={trick.lead.suit === 'H' || trick.lead.suit === 'D' ? 'text-red-400' : ''}
              >
                {SUIT_MINI[trick.lead.suit]}
              </span>
            )}
          </span>
        )}
    </div>
  );

  return (
    <div className="felt relative mx-auto grid h-[min(56vh,560px)] w-full lg:h-[540px] lg:shrink-0 grid-cols-[minmax(84px,1fr)_2fr_minmax(84px,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl p-3">
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
