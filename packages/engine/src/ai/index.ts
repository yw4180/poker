import type { Action, GameState } from '../state.js';
import { chooseBury } from './bury.js';
import { chooseDeclare } from './declare.js';
import { chooseFollowSmart } from './follow.js';
import { chooseLead } from './lead.js';
import { buildMemory } from './memory.js';

/** 启发式 AI：给出当前座位的动作；无需行动时返回 null */
export function smartAction(
  state: GameState,
  seat: number,
  rng: () => number = Math.random,
): Action | null {
  switch (state.phase) {
    case 'dealing':
    case 'declaring':
      return chooseDeclare(state, seat);
    case 'kitty':
      return seat === state.dealer ? chooseBury(state, seat) : null;
    case 'playing': {
      const trick = state.trick!;
      if ((trick.leader + trick.plays.length) % 4 !== seat) return null;
      const mem = buildMemory(state, seat);
      return trick.plays.length === 0
        ? chooseLead(state, seat, mem, rng)
        : chooseFollowSmart(state, seat, mem, rng);
    }
    default:
      return null;
  }
}

export { buildMemory, isHighestRemaining } from './memory.js';
export { chooseBury } from './bury.js';
export { chooseDeclare } from './declare.js';
export { chooseLead } from './lead.js';
export { chooseFollowSmart } from './follow.js';
export { W as aiWeights } from './weights.js';
