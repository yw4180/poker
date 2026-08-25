'use client';
import { type Card, classify, legalDeclareOptions, validateFollow } from '@poker/engine';
import type { GameView, RoomView } from '@poker/protocol';
import { Countdown } from './Countdown';
import { Button } from './ui';
import { suggest } from '@/lib/engine-view';
import { request } from '@/lib/socket';
import { trumpText, useStore } from '@/lib/store';

const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

export function Controls({ game, room }: { game: GameView; room: RoomView; userId: string }) {
  const selected = useStore((s) => s.selected);
  const setSelected = useStore((s) => s.setSelected);
  const clear = useStore((s) => s.clearSelect);
  const notify = useStore((s) => s.notify);
  const showLast = useStore((s) => s.showLastTrick);
  const setShowLast = useStore((s) => s.setShowLastTrick);
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

  // ---- 亮主 ----
  if (game.phase === 'dealing' || game.phase === 'declaring') {
    const options = legalDeclareOptions(game.hand, game.level, game.declaration, me);
    return (
      <Bar>
        {options.length === 0 ? (
          <span className="text-muted">{game.declaration ? '无法反主' : '暂无可亮的主'}</span>
        ) : (
          options.map((o) => (
            <Button
              key={o.cardIds.join(',')}
              variant="primary"
              onClick={() => send({ type: 'DECLARE', cardIds: o.cardIds })}
            >
              亮{' '}
              {o.suit === 'NT'
                ? o.strength === 4
                  ? '大王对 · 无主'
                  : '小王对 · 无主'
                : `${SUIT_SYMBOL[o.suit]}${o.strength === 2 ? ' 一对' : ''}`}
            </Button>
          ))
        )}
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
        {game.phase === 'declaring' && game.deadlineAt && (
          <Countdown
            deadlineAt={game.deadlineAt}
            totalMs={opts.declareWindowSec * 1000}
            label="亮主"
          />
        )}
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
  return null;
}
