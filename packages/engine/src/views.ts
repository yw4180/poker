/**
 * 按玩家视角裁剪状态：不泄露他人手牌与底牌。
 */
import type { Card } from './cards.js';
import type { GameState } from './state.js';
import { currentActor } from './reducer.js';

export interface PlayerView extends Omit<GameState, 'deck' | 'hands' | 'kitty'> {
  seat: number;
  hand: Card[];
  handCounts: [number, number, number, number];
  /** 仅庄家在扣底阶段、或一局结束后可见 */
  kitty: Card[] | null;
  kittyCount: number;
  deckCount: number;
  actor: number | null;
}

export function viewFor(state: GameState, seat: number): PlayerView {
  const { deck, hands, kitty, ...rest } = state;
  const kittyVisible =
    (state.phase === 'kitty' && seat === state.dealer) ||
    state.phase === 'roundEnd' ||
    state.phase === 'finished';
  return {
    ...rest,
    seat,
    hand: hands[seat] ?? [], // 旁观者 seat = -1
    handCounts: hands.map((h) => h.length) as [number, number, number, number],
    kitty: kittyVisible ? kitty : null,
    kittyCount: kitty.length,
    deckCount: deck.length,
    actor: currentActor(state),
  };
}
