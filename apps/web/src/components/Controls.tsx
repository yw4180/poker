'use client';
import { type Card, classify, legalDeclareOptions, validateFollow } from '@poker/engine';
import type { GameView, RoomView } from '@poker/protocol';
import { Countdown } from './Countdown';
import { Button } from './ui';
import { suggest } from '@/lib/engine-view';
import { request } from '@/lib/socket';
import { trumpText, useStore } from '@/lib/store';

const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣', NT: '无主' };

export function Controls({
  game,
  room,
  userId,
}: {
  game: GameView;
  room: RoomView;
  userId: string;
}) {
  const selected = useStore((s) => s.selected);
  const setSelected = useStore((s) => s.setSelected);
  const clear = useStore((s) => s.clearSelect);
  const notify = useStore((s) => s.notify);
  const showLast = useStore((s) => s.showLastTrick);
  const setShowLast = useStore((s) => s.setShowLastTrick);
  const me = game.seat;
  const myTurn = game.actor === me;
  const selectedCards: Card[] = selected
    .map((id) => game.hand.find((c) => c.id === id)!)
    .filter(Boolean);
  const mySeat = me >= 0 ? room.seats[me] : null;
  const autoplay = !!mySeat?.bot;
  void userId;

  const toggleAutoplay = async () => {
    const r = await request('room:autoplay', { on: !autoplay });
    if (!r.ok) notify(r.error ?? '操作失败');
  };
  const opts = room.options;
  const requestUndo = async () => {
    const r = await request('game:undoRequest', {});
    if (!r.ok) notify(r.error ?? '不能悔牌');
  };
  const turnCountdown =
    myTurn && game.deadlineAt && opts.turnTimeoutSec > 0 ? (
      <Countdown deadlineAt={game.deadlineAt} totalMs={opts.turnTimeoutSec * 1000} label="出牌" />
    ) : null;
  const autoplayButton = (
    <Button variant={autoplay ? 'danger' : 'ghost'} onClick={toggleAutoplay}>
      {autoplay ? '取消托管' : '托管'}
    </Button>
  );

  const send = async (action: Parameters<typeof request<'game:action'>>[1]) => {
    const r = await request('game:action', action);
    if (!r.ok) notify(r.error ?? '操作失败');
    else clear();
  };

  if (me < 0) return <div className="text-center text-sm text-white/60">旁观中</div>;

  // ---- 亮主：一键按钮 ----
  if (game.phase === 'dealing' || game.phase === 'declaring') {
    const opts = legalDeclareOptions(game.hand, game.level, game.declaration, me);
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        {opts.length === 0 ? (
          <span className="text-white/60">{game.declaration ? '无法反主' : '暂无可亮的主'}</span>
        ) : (
          opts.map((o) => (
            <Button
              key={o.cardIds.join(',')}
              onClick={() => send({ type: 'DECLARE', cardIds: o.cardIds })}
            >
              亮{' '}
              {o.suit === 'NT'
                ? o.strength === 4
                  ? '大王对（无主）'
                  : '小王对（无主）'
                : `${SUIT_SYMBOL[o.suit]}${o.strength === 2 ? ' 一对' : ''}`}
            </Button>
          ))
        )}
        {game.declaration && (
          <span className="text-white/60">
            当前：{game.players[game.declaration.seat]?.name} 亮{' '}
            {trumpText(game.declaration.trump.suit)}
          </span>
        )}
        {game.phase === 'dealing' && (
          <span className="text-white/50">发牌中 · 剩 {Math.max(0, game.deckCount - 8)} 张</span>
        )}
        {game.phase === 'declaring' && game.deadlineAt && (
          <Countdown
            deadlineAt={game.deadlineAt}
            totalMs={room.options.declareWindowSec * 1000}
            label="亮主"
          />
        )}
      </div>
    );
  }

  // ---- 扣底 ----
  if (game.phase === 'kitty') {
    if (!myTurn) return <div className="text-center text-sm text-white/60">等待庄家扣底…</div>;
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="text-white/80">请选择 8 张牌扣底（已选 {selected.length}/8）</span>
        {opts.hint && (
          <Button
            variant="ghost"
            onClick={() => {
              const a = suggest(game);
              if (a?.type === 'BURY') setSelected(a.cardIds);
            }}
          >
            提示
          </Button>
        )}
        <Button
          disabled={selected.length !== 8}
          onClick={() => send({ type: 'BURY', cardIds: selected })}
        >
          扣底
        </Button>
        <Button variant="ghost" disabled={selected.length === 0} onClick={clear}>
          清空
        </Button>
        {autoplayButton}
        {turnCountdown}
      </div>
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
            tractor: `${combo.components[0]!.pairs}连拖拉机`,
            throw: '甩牌',
          }[combo.type];
      }
    }
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        {autoplay ? (
          <span className="text-orange-300">托管中，机器人代打</span>
        ) : myTurn ? (
          <span className={illegal ? 'text-red-300' : 'text-amber-300'}>
            轮到你出牌{hint && ` · ${hint}`}
          </span>
        ) : (
          <span className="text-white/60">等待 {game.players[game.actor ?? 0]?.name} 出牌</span>
        )}
        <Button
          disabled={!myTurn || selected.length === 0 || illegal}
          onClick={() => send({ type: 'PLAY', cardIds: selected })}
        >
          出牌
        </Button>
        {opts.hint && (
          <Button
            variant="ghost"
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
      </div>
    );
  }

  return null;
}
