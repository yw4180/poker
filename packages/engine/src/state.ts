import type { Card, Rank, Trump } from './cards.js';
import type { Combo, Component } from './combos.js';
import type { Play } from './trick.js';

export type Phase =
  'waiting' | 'dealing' | 'declaring' | 'kitty' | 'playing' | 'roundEnd' | 'finished';

export interface PlayerInfo {
  id: string;
  name: string;
  avatar?: string | null;
}

export interface GameConfig {
  /** 每人手牌数（4 人 2 副固定 25） */
  handSize: number;
  kittySize: number;
  /** 起始级别 */
  startLevel: Rank;
  /** 末墩闲家赢时底牌翻倍方式：double=固定×2，exp=拖拉机 2^n */
  kittyBonus: 'double' | 'exp';
}

export const DEFAULT_CONFIG: GameConfig = {
  handSize: 25,
  kittySize: 8,
  startLevel: 2,
  kittyBonus: 'exp',
};

export interface Declaration {
  seat: number;
  cards: Card[];
  trump: Trump;
  /** 1 单张级牌, 2 一对级牌, 3 一对小王, 4 一对大王 */
  strength: number;
}

export interface Trick {
  leader: number;
  lead: Combo | null;
  plays: Play[];
}

export interface CompletedTrick {
  plays: Play[];
  winner: number;
  points: number;
}

export interface RoundResult {
  attackerPoints: number;
  kittyPoints: number;
  kittyMultiplier: number;
  /** 0/1 = 哪队升级 */
  winningTeam: 0 | 1;
  levelsGained: number;
  nextDealer: number;
}

export interface GameState {
  config: GameConfig;
  phase: Phase;
  players: [PlayerInfo, PlayerInfo, PlayerInfo, PlayerInfo];
  /** 每队级别；队 = 座位 % 2 */
  levels: [Rank, Rank];
  roundNo: number;
  dealer: number | null;
  /** 本局打的级别 */
  level: Rank;
  trump: Trump | null;
  declaration: Declaration | null;
  deck: Card[];
  hands: [Card[], Card[], Card[], Card[]];
  kitty: Card[];
  /** 发牌轮到谁 */
  dealTo: number;
  /** 亮主/反主的轮询状态：当前被询问的座位与本轮已过的座位 */
  ask: { seat: number; passes: number[] } | null;
  /** 当前 declaring 是否为扣底后的反主轮 */
  postKitty: boolean;
  trick: Trick | null;
  tricks: CompletedTrick[];
  attackerPoints: number;
  lastRound: RoundResult | null;
  winner: 0 | 1 | null;
}

export type Action =
  | { type: 'START_ROUND'; deck: Card[] }
  | { type: 'DEAL_CARD' }
  | { type: 'DEAL_ALL' }
  | { type: 'DECLARE'; seat: number; cardIds: string[] }
  | { type: 'END_DECLARING' }
  | { type: 'PASS_DECLARE'; seat: number }
  | { type: 'BURY'; seat: number; cardIds: string[] }
  | { type: 'PLAY'; seat: number; cardIds: string[] };

export type GameEvent =
  | { type: 'dealt'; seat: number }
  | { type: 'declared'; declaration: Declaration }
  | { type: 'trumpSet'; trump: Trump; dealer: number; fromKitty: boolean }
  | { type: 'kittyBuried'; seat: number }
  | { type: 'played'; seat: number; cards: Card[]; forced: Component | null }
  | { type: 'trickWon'; winner: number; points: number; plays: Play[] }
  | { type: 'roundEnded'; result: RoundResult }
  | { type: 'gameOver'; winner: 0 | 1 };

export class IllegalAction extends Error {
  constructor(
    message: string,
    public readonly code: string = 'ILLEGAL',
  ) {
    super(message);
    this.name = 'IllegalAction';
  }
}
