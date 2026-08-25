'use client';
import { type Action, type GameState, createGame, smartAction } from '@poker/engine';
import type { GameView } from '@poker/protocol';

/** 由玩家视角拼出引擎可用的状态（其他人手牌未知，置空）——供提示/机器人逻辑复用 */
export function stateFromView(v: GameView): GameState {
  const base = createGame(v.players);
  const hands: GameState['hands'] = [[], [], [], []];
  if (v.seat >= 0) hands[v.seat] = v.hand;
  const {
    hand: _h,
    handCounts: _c,
    kittyCount: _k,
    deckCount: _d,
    actor: _a,
    seat: _s,
    kitty,
    deadlineAt: _dl,
    ...rest
  } = v;
  return { ...base, ...rest, hands, kitty: kitty ?? [], deck: [] };
}

/** 用 AI 给出一个出牌/扣底建议 */
export function suggest(v: GameView): Action | null {
  if (v.seat < 0) return null;
  return smartAction(stateFromView(v), v.seat);
}
