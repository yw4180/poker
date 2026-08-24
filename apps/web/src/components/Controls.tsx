'use client';
import { type Card, classify, validateFollow } from '@poker/engine';
import type { PlayerView, RoomView } from '@poker/protocol';
import { Button } from './ui';
import { PlayingCard } from './PlayingCard';
import { request } from '@/lib/socket';
import { useStore } from '@/lib/store';

export function Controls({
  game,
  room,
  userId,
}: {
  game: PlayerView;
  room: RoomView;
  userId: string;
}) {
  const selected = useStore((s) => s.selected);
  const clear = useStore((s) => s.clearSelect);
  const notify = useStore((s) => s.notify);
  const me = game.seat;
  const isHost = room.hostId === userId;
  const myTurn = game.actor === me;
  const selectedCards: Card[] = selected
    .map((id) => game.hand.find((c) => c.id === id)!)
    .filter(Boolean);

  const send = async (action: Parameters<typeof request<'game:action'>>[1]) => {
    const r = await request('game:action', action);
    if (!r.ok) notify(r.error ?? '操作失败');
    else clear();
  };

  // 亮主：选中的牌能否亮主
  const canDeclare =
    (game.phase === 'dealing' || game.phase === 'declaring') &&
    me >= 0 &&
    selectedCards.length > 0 &&
    selectedCards.length <= 2;

  // 出牌合法性预判（跟牌可本地判断；领出交给服务器）
  let playHint = '';
  if (game.phase === 'playing' && myTurn && selectedCards.length > 0 && game.trump) {
    const lead = game.trick?.lead;
    if (lead) {
      const r = validateFollow(lead, selectedCards, game.hand, game.trump);
      if (!r.ok) playHint = r.reason;
    } else {
      const combo = classify(selectedCards, game.trump);
      if (!combo) playHint = '领出必须同花色';
      else
        playHint = { single: '单张', pair: '对子', tractor: '拖拉机', throw: '甩牌' }[combo.type];
    }
  }

  if (me < 0) return <div className="text-center text-sm text-white/60">旁观中</div>;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
      {(game.phase === 'dealing' || game.phase === 'declaring') && (
        <Button disabled={!canDeclare} onClick={() => send({ type: 'DECLARE', cardIds: selected })}>
          亮主
        </Button>
      )}
      {game.phase === 'kitty' && myTurn && (
        <>
          <span className="text-white/70">请选择 8 张牌扣底（已选 {selected.length}）</span>
          <Button
            disabled={selected.length !== 8}
            onClick={() => send({ type: 'BURY', cardIds: selected })}
          >
            扣底
          </Button>
        </>
      )}
      {game.phase === 'playing' && (
        <>
          {myTurn ? (
            <span className="text-amber-300">轮到你出牌 {playHint && `· ${playHint}`}</span>
          ) : (
            <span className="text-white/60">等待 {game.players[game.actor ?? 0]?.name} 出牌</span>
          )}
          <Button
            disabled={!myTurn || selected.length === 0 || (!!game.trick?.lead && !!playHint)}
            onClick={() => send({ type: 'PLAY', cardIds: selected })}
          >
            出牌
          </Button>
          <Button variant="ghost" disabled={selected.length === 0} onClick={clear}>
            清空
          </Button>
        </>
      )}
      {(game.phase === 'roundEnd' || game.phase === 'finished') && (
        <div className="flex flex-col items-center gap-2">
          {game.kitty && (
            <div className="flex items-center gap-2">
              <span className="text-white/70">底牌：</span>
              {game.kitty.map((c) => (
                <PlayingCard key={c.id} card={c} small />
              ))}
            </div>
          )}
          {game.phase === 'roundEnd' && isHost && (
            <Button
              onClick={async () => {
                const r = await request('room:nextRound', {});
                if (!r.ok) notify(r.error ?? '');
              }}
            >
              下一局
            </Button>
          )}
          {game.phase === 'roundEnd' && !isHost && (
            <span className="text-white/60">等待房主开始下一局</span>
          )}
        </div>
      )}
    </div>
  );
}
