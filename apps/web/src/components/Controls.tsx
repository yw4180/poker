'use client';
import { type Card, classify, legalDeclareOptions, validateFollow } from '@poker/engine';
import type { GameView, RoomView } from '@poker/protocol';
import { Countdown } from './Countdown';
import { Button } from './ui';
import { suggest } from '@/lib/engine-view';
import { request } from '@/lib/socket';
import { trumpText, useStore } from '@/lib/store';

const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

/** 亮主阶段：各花色/王/级牌张数实时统计 */
function SuitCounts({ game }: { game: GameView }) {
  const counts: Record<string, number> = { S: 0, H: 0, C: 0, D: 0 };
  let jokers = 0;
  let levels = 0;
  for (const c of game.hand) {
    if (c.suit === 'J') jokers++;
    else if (c.rank === game.level) levels++;
    else counts[c.suit] = (counts[c.suit] ?? 0) + 1;
  }
  const chip = (label: string, n: number, red = false) => (
    <span
      key={label}
      className={`rounded border border-white/15 bg-white/[0.06] px-1.5 font-mono text-xs leading-5 ${red ? 'text-red-300' : ''}`}
    >
      {label}
      {n}
    </span>
  );
  return (
    <span className="flex items-center gap-1">
      {chip('♠', counts.S ?? 0)}
      {chip('♥', counts.H ?? 0, true)}
      {chip('♣', counts.C ?? 0)}
      {chip('♦', counts.D ?? 0, true)}
      {chip('级', levels)}
      {chip('王', jokers)}
    </span>
  );
}

export function Controls({ game, room }: { game: GameView; room: RoomView; userId: string }) {
  const selected = useStore((s) => s.selected);
  const setSelected = useStore((s) => s.setSelected);
  const clear = useStore((s) => s.clearSelect);
  const notify = useStore((s) => s.notify);
  const showLast = useStore((s) => s.showLastTrick);
  const showKitty = useStore((s) => s.showKitty);
  const setShowKitty = useStore((s) => s.setShowKitty);
  const setShowLast = useStore((s) => s.setShowLastTrick);
  const setRoundEndDismissed = useStore((s) => s.setRoundEndDismissed);
  const me = game.seat;
  const myTurn = game.actor === me;
  const opts = room.options;
  const selectedCards: Card[] = selected
    .map((id) => game.hand.find((c) => c.id === id)!)
    .filter(Boolean);
  const mySeat = me >= 0 ? room.seats[me] : null;
  const autoplay = !!mySeat?.bot;

  const send = async (action: Parameters<typeof request<'game:action'>>[1]) => {
    const r = await request('game:action', action);
    if (!r.ok) notify(r.error ?? '操作失败');
    else clear();
  };
  const toggleAutoplay = async () => {
    const r = await request('room:autoplay', { on: !autoplay });
    if (!r.ok) notify(r.error ?? '操作失败');
  };
  const requestUndo = async () => {
    const r = await request('game:undoRequest', {});
    if (!r.ok) notify(r.error ?? '不能悔牌');
  };
  const autoplayButton = (
    <Button size="sm" variant={autoplay ? 'danger' : 'ghost'} onClick={toggleAutoplay}>
      {autoplay ? '取消托管' : '托管'}
    </Button>
  );
  const turnCountdown =
    myTurn && game.deadlineAt && opts.turnTimeoutSec > 0 ? (
      <Countdown deadlineAt={game.deadlineAt} totalMs={opts.turnTimeoutSec * 1000} label="出牌" />
    ) : null;

  const Bar = ({ children }: { children: React.ReactNode }) => (
    <div className="flex min-h-11 flex-wrap items-center justify-center gap-2 text-sm">
      {children}
    </div>
  );

  if (me < 0)
    return (
      <Bar>
        <span className="text-muted">旁观中</span>
      </Bar>
    );

  // ---- 亮主 / 反主 ----
  if (game.phase === 'dealing' || game.phase === 'declaring') {
    const options = legalDeclareOptions(game.hand, game.level, game.declaration, me);
    const myTurnToAsk = game.phase === 'declaring' && game.ask?.seat === me;
    const canJumpIn = game.phase === 'dealing';
    // 亮主者随时可加固（同花色第二张升级为一对）
    const canReinforce =
      game.phase === 'declaring' &&
      game.declaration?.seat === me &&
      !myTurnToAsk &&
      options.length > 0;
    return (
      <Bar>
        {game.phase === 'declaring' && game.postKitty && (
          <span className="text-amber-300">扣底后反主机会</span>
        )}
        {(canJumpIn || myTurnToAsk || canReinforce) &&
          options.map((o) => (
            <Button
              key={o.cardIds.join(',')}
              variant="primary"
              onClick={() => send({ type: 'DECLARE', cardIds: o.cardIds })}
            >
              {game.declaration?.seat === me ? '加固' : game.declaration ? '反' : '亮'}{' '}
              {o.suit === 'NT'
                ? o.strength === 4
                  ? '大王对 · 无主'
                  : '小王对 · 无主'
                : `${SUIT_SYMBOL[o.suit]}${o.strength === 2 ? ' 一对' : ''}`}
            </Button>
          ))}
        {myTurnToAsk && (
          <Button
            variant={options.length ? 'ghost' : 'primary'}
            onClick={() => send({ type: 'PASS_DECLARE' })}
          >
            过
          </Button>
        )}
        {game.phase === 'declaring' && !myTurnToAsk && (
          <span className="text-muted">
            等待 {game.players[game.ask?.seat ?? 0]?.name} 决定是否
            {game.declaration ? '反主' : '亮主'}
            {game.ask ? `（已过 ${game.ask.passes.length}/${game.declaration ? 3 : 4}）` : ''}
          </span>
        )}
        {canJumpIn && options.length === 0 && <span className="text-muted">暂无可亮的主</span>}
        {game.declaration && (
          <span className="text-muted">
            当前：{game.players[game.declaration.seat]?.name} 亮{' '}
            {trumpText(game.declaration.trump.suit)}
          </span>
        )}
        {game.phase === 'dealing' && (
          <span className="text-faint">
            发牌中 · 剩 <span className="font-mono">{Math.max(0, game.deckCount - 8)}</span> 张
          </span>
        )}
        {myTurnToAsk && opts.declareWindowSec > 0 && game.deadlineAt && (
          <Countdown
            deadlineAt={game.deadlineAt}
            totalMs={opts.declareWindowSec * 1000}
            label="表态"
          />
        )}
        <SuitCounts game={game} />
        {autoplayButton}
      </Bar>
    );
  }

  // ---- 扣底 ----
  if (game.phase === 'kitty') {
    if (!myTurn)
      return (
        <Bar>
          <span className="text-muted">等待庄家扣底…</span>
        </Bar>
      );
    return (
      <Bar>
        <span className="text-muted">
          选 8 张扣底 <span className="font-mono text-fg">{selected.length}/8</span>
        </span>
        <Button
          variant="primary"
          disabled={selected.length !== 8}
          onClick={() => send({ type: 'BURY', cardIds: selected })}
        >
          扣底
        </Button>
        {opts.hint && (
          <Button
            onClick={() => {
              const a = suggest(game);
              if (a?.type === 'BURY') setSelected(a.cardIds);
            }}
          >
            提示
          </Button>
        )}
        <Button variant="ghost" disabled={selected.length === 0} onClick={clear}>
          清空
        </Button>
        {autoplayButton}
        {turnCountdown}
      </Bar>
    );
  }

  // ---- 出牌 ----
  if (game.phase === 'playing') {
    let hint = '';
    let illegal = false;
    if (myTurn && selectedCards.length > 0 && game.trump) {
      const lead = game.trick?.lead;
      if (lead) {
        const r = validateFollow(lead, selectedCards, game.hand, game.trump);
        if (!r.ok) {
          hint = r.reason;
          illegal = true;
        }
      } else {
        const combo = classify(selectedCards, game.trump);
        if (!combo) {
          hint = '领出必须是同一花色';
          illegal = true;
        } else
          hint = {
            single: '单张',
            pair: '对子',
            tractor: `${combo.components[0]!.pairs} 连拖拉机`,
            throw: '甩牌',
          }[combo.type];
      }
    }
    return (
      <Bar>
        {autoplay ? (
          <span className="text-amber-300">托管中，机器人代打</span>
        ) : myTurn ? (
          <span className={illegal ? 'text-red-300' : 'text-accent'}>
            轮到你{hint && <span className="text-muted"> · {hint}</span>}
          </span>
        ) : (
          <span className="text-muted">等待 {game.players[game.actor ?? 0]?.name}</span>
        )}
        <Button
          variant="primary"
          disabled={!myTurn || selected.length === 0 || illegal}
          onClick={() => send({ type: 'PLAY', cardIds: selected })}
        >
          出牌
        </Button>
        {opts.hint && (
          <Button
            disabled={!myTurn}
            onClick={() => {
              const a = suggest(game);
              if (a?.type === 'PLAY') setSelected(a.cardIds);
            }}
          >
            提示
          </Button>
        )}
        <Button variant="ghost" disabled={selected.length === 0} onClick={clear}>
          清空
        </Button>
        <Button
          variant="ghost"
          disabled={game.tricks.length === 0}
          onClick={() => setShowLast(!showLast)}
        >
          {showLast ? '关闭' : '上一墩'}
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            const r = await request('room:stand', {});
            if (!r.ok) notify(r.error ?? '操作失败');
          }}
        >
          离座
        </Button>
        {game.kitty && (
          <Button variant="ghost" onClick={() => setShowKitty(!showKitty)}>
            {showKitty ? '收起底牌' : '看底牌'}
          </Button>
        )}
        {opts.undo && (
          <Button variant="ghost" disabled={!!room.undoRequest} onClick={requestUndo}>
            悔牌
          </Button>
        )}
        {autoplayButton}
        {turnCountdown}
      </Bar>
    );
  }
  if (game.phase === 'roundEnd' || game.phase === 'finished') {
    return (
      <Bar>
        <span className="text-muted">本局已结束</span>
        <Button variant="primary" onClick={() => setRoundEndDismissed(false)}>
          查看结算
        </Button>
        <Button
          variant="ghost"
          disabled={game.tricks.length === 0}
          onClick={() => setShowLast(!showLast)}
        >
          {showLast ? '关闭' : '上一墩'}
        </Button>
      </Bar>
    );
  }
  return null;
}
