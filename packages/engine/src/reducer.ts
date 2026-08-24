/**
 * 升级（拖拉机）状态机：reduce(state, action) -> { state, events }
 * 纯函数；不做任何 IO；随机性由调用方通过 START_ROUND.deck 注入。
 */
import {
  type Card,
  type Rank,
  type Trump,
  BIG_JOKER,
  SMALL_JOKER,
  cardKey,
  sortHand,
  sumPoints,
} from './cards.js';
import { validateFollow, validateLead } from './follow.js';
import {
  type Action,
  type Declaration,
  type GameConfig,
  type GameEvent,
  type GameState,
  type PlayerInfo,
  type RoundResult,
  DEFAULT_CONFIG,
  IllegalAction,
} from './state.js';
import { kittyMultiplier, trickPoints, trickWinner } from './trick.js';

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
}

export function createGame(
  players: [PlayerInfo, PlayerInfo, PlayerInfo, PlayerInfo],
  config: Partial<GameConfig> = {},
): GameState {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  return {
    config: cfg,
    phase: 'waiting',
    players,
    levels: [cfg.startLevel, cfg.startLevel],
    roundNo: 0,
    dealer: null,
    level: cfg.startLevel,
    trump: null,
    declaration: null,
    deck: [],
    hands: [[], [], [], []],
    kitty: [],
    dealTo: 0,
    trick: null,
    tricks: [],
    attackerPoints: 0,
    lastRound: null,
    winner: null,
  };
}

export const teamOf = (seat: number): 0 | 1 => (seat % 2) as 0 | 1;
export const nextSeat = (seat: number): number => (seat + 1) % 4;
export const partnerOf = (seat: number): number => (seat + 2) % 4;

export function reduce(state: GameState, action: Action): ReduceResult {
  switch (action.type) {
    case 'START_ROUND':
      return startRound(state, action.deck);
    case 'DEAL_CARD':
      return dealCard(state);
    case 'DEAL_ALL':
      return dealAll(state);
    case 'DECLARE':
      return declare(state, action.seat, action.cardIds);
    case 'END_DECLARING':
      return endDeclaring(state);
    case 'BURY':
      return bury(state, action.seat, action.cardIds);
    case 'PLAY':
      return play(state, action.seat, action.cardIds);
  }
}

function expectPhase(state: GameState, ...phases: GameState['phase'][]): void {
  if (!phases.includes(state.phase)) {
    throw new IllegalAction(`当前阶段 ${state.phase} 不允许此操作`, 'WRONG_PHASE');
  }
}

function startRound(state: GameState, deck: Card[]): ReduceResult {
  expectPhase(state, 'waiting', 'roundEnd');
  const total = state.config.handSize * 4 + state.config.kittySize;
  if (deck.length !== total) throw new IllegalAction(`牌数必须为 ${total}`, 'BAD_DECK');
  const level = state.dealer === null ? state.levels[0] : state.levels[teamOf(state.dealer)];
  return {
    state: {
      ...state,
      phase: 'dealing',
      roundNo: state.roundNo + 1,
      level,
      trump: null,
      declaration: null,
      deck: deck.slice(),
      hands: [[], [], [], []],
      kitty: [],
      dealTo: state.dealer ?? 0,
      trick: null,
      tricks: [],
      attackerPoints: 0,
    },
    events: [],
  };
}

function dealOne(state: GameState): GameState {
  const [card, ...rest] = state.deck;
  const hands = state.hands.map((h) => h.slice()) as GameState['hands'];
  hands[state.dealTo]!.push(card!);
  return { ...state, deck: rest, hands, dealTo: nextSeat(state.dealTo) };
}

function dealCard(state: GameState): ReduceResult {
  expectPhase(state, 'dealing');
  const seat = state.dealTo;
  let next = dealOne(state);
  if (next.deck.length === state.config.kittySize) {
    next = { ...next, phase: 'declaring' };
  }
  return { state: next, events: [{ type: 'dealt', seat }] };
}

function dealAll(state: GameState): ReduceResult {
  expectPhase(state, 'dealing');
  let s = state;
  while (s.deck.length > state.config.kittySize) s = dealOne(s);
  return { state: { ...s, phase: 'declaring' }, events: [] };
}

/** 亮主强度：1 单张级牌, 2 一对级牌, 3 一对小王(无主), 4 一对大王(无主) */
function declarationOf(cards: Card[], level: Rank): Omit<Declaration, 'seat'> | null {
  if (cards.length === 1) {
    const c = cards[0]!;
    if (c.rank !== level || c.suit === 'J') return null;
    return { cards, trump: { suit: c.suit, level }, strength: 1 };
  }
  if (cards.length === 2 && cardKey(cards[0]!) === cardKey(cards[1]!)) {
    const c = cards[0]!;
    if (c.rank === BIG_JOKER) return { cards, trump: { suit: 'NT', level }, strength: 4 };
    if (c.rank === SMALL_JOKER) return { cards, trump: { suit: 'NT', level }, strength: 3 };
    if (c.rank === level && c.suit !== 'J')
      return { cards, trump: { suit: c.suit, level }, strength: 2 };
  }
  return null;
}

function pickCards(hand: readonly Card[], ids: readonly string[]): Card[] {
  const out: Card[] = [];
  for (const id of ids) {
    const c = hand.find((x) => x.id === id);
    if (!c) throw new IllegalAction(`牌 ${id} 不在手中`, 'NOT_IN_HAND');
    if (out.includes(c)) throw new IllegalAction(`重复的牌 ${id}`, 'DUPLICATE');
    out.push(c);
  }
  return out;
}

function declare(state: GameState, seat: number, cardIds: string[]): ReduceResult {
  expectPhase(state, 'dealing', 'declaring');
  const cards = pickCards(state.hands[seat]!, cardIds);
  const decl = declarationOf(cards, state.level);
  if (!decl) throw new IllegalAction('这些牌不能用来亮主', 'BAD_DECLARE');
  const cur = state.declaration;
  if (cur) {
    if (decl.strength <= cur.strength)
      throw new IllegalAction('必须比当前亮主更大', 'WEAK_DECLARE');
    if (cur.seat === seat && decl.strength === 2 && cur.trump.suit !== decl.trump.suit) {
      throw new IllegalAction('加固只能用同花色的一对', 'BAD_REINFORCE');
    }
  }
  const declaration: Declaration = { seat, ...decl };
  return { state: { ...state, declaration }, events: [{ type: 'declared', declaration }] };
}

function endDeclaring(state: GameState): ReduceResult {
  expectPhase(state, 'declaring');
  let trump: Trump;
  let dealer: number;
  let fromKitty = false;
  const kitty = state.deck;
  if (state.declaration) {
    trump = state.declaration.trump;
    dealer = state.dealer ?? state.declaration.seat;
  } else {
    // 无人亮主：翻底牌，取第一张非王牌的花色为主；全是王则无主
    fromKitty = true;
    const first = kitty.find((c) => c.suit !== 'J');
    trump = { suit: first ? (first.suit as Trump['suit']) : 'NT', level: state.level };
    dealer = state.dealer ?? 0;
  }
  const hands = state.hands.map((h) => h.slice()) as GameState['hands'];
  hands[dealer] = sortHand([...hands[dealer]!, ...kitty], trump);
  return {
    state: { ...state, phase: 'kitty', trump, dealer, deck: [], hands, kitty: [] },
    events: [{ type: 'trumpSet', trump, dealer, fromKitty }],
  };
}

function bury(state: GameState, seat: number, cardIds: string[]): ReduceResult {
  expectPhase(state, 'kitty');
  if (seat !== state.dealer) throw new IllegalAction('只有庄家可以扣底', 'NOT_DEALER');
  if (cardIds.length !== state.config.kittySize) {
    throw new IllegalAction(`必须扣 ${state.config.kittySize} 张`, 'BAD_KITTY_SIZE');
  }
  const cards = pickCards(state.hands[seat]!, cardIds);
  const ids = new Set(cardIds);
  const hands = state.hands.map((h) => h.slice()) as GameState['hands'];
  hands[seat] = hands[seat]!.filter((c) => !ids.has(c.id));
  return {
    state: {
      ...state,
      phase: 'playing',
      hands,
      kitty: cards,
      trick: { leader: seat, lead: null, plays: [] },
    },
    events: [{ type: 'kittyBuried', seat }],
  };
}

function play(state: GameState, seat: number, cardIds: string[]): ReduceResult {
  expectPhase(state, 'playing');
  const trick = state.trick!;
  const trump = state.trump!;
  const turn = (trick.leader + trick.plays.length) % 4;
  if (seat !== turn) throw new IllegalAction('还没轮到你出牌', 'NOT_YOUR_TURN');
  const hand = state.hands[seat]!;
  let cards = pickCards(hand, cardIds);
  const events: GameEvent[] = [];
  let lead = trick.lead;
  let forced = null;

  if (trick.plays.length === 0) {
    const others = state.hands.filter((_, i) => i !== seat);
    const r = validateLead(cards, hand, others, trump);
    if (!r.ok) throw new IllegalAction(r.reason, 'BAD_LEAD');
    lead = r.combo;
    if (r.forced) {
      forced = r.forced;
      cards = r.forced.cards;
    }
  } else {
    const r = validateFollow(lead!, cards, hand, trump);
    if (!r.ok) throw new IllegalAction(r.reason, 'BAD_FOLLOW');
  }
  events.push({ type: 'played', seat, cards, forced });

  const playedIds = new Set(cards.map((c) => c.id));
  const hands = state.hands.map((h) => h.slice()) as GameState['hands'];
  hands[seat] = hand.filter((c) => !playedIds.has(c.id));
  const plays = [...trick.plays, { seat, cards }];
  let next: GameState = { ...state, hands, trick: { ...trick, lead, plays } };

  if (plays.length < 4) return { state: next, events };

  // 一墩结束
  const winner = trickWinner(plays, trump);
  const points = trickPoints(plays);
  const dealerTeam = teamOf(next.dealer!);
  const attackerPoints =
    teamOf(winner) !== dealerTeam ? next.attackerPoints + points : next.attackerPoints;
  next = {
    ...next,
    tricks: [...next.tricks, { plays, winner, points }],
    attackerPoints,
    trick: { leader: winner, lead: null, plays: [] },
  };
  events.push({ type: 'trickWon', winner, points, plays });

  if (hands.every((h) => h.length === 0)) {
    const winningPlay = plays.find((p) => p.seat === winner)!;
    return finishRound(next, winner, winningPlay.cards, events);
  }
  return { state: next, events };
}

function finishRound(
  state: GameState,
  lastWinner: number,
  lastWinningCards: Card[],
  events: GameEvent[],
): ReduceResult {
  const dealer = state.dealer!;
  const dealerTeam = teamOf(dealer);
  const kittyPoints = sumPoints(state.kitty);
  const attackersWonLast = teamOf(lastWinner) !== dealerTeam;
  const multiplier = attackersWonLast ? kittyMultiplier(lastWinningCards, state.trump!) : 1;
  const attackerPoints = state.attackerPoints + (attackersWonLast ? kittyPoints * multiplier : 0);

  let winningTeam: 0 | 1;
  let gained: number;
  let nextDealer: number;
  if (attackerPoints < 80) {
    winningTeam = dealerTeam;
    gained = attackerPoints === 0 ? 3 : attackerPoints < 40 ? 2 : 1;
    nextDealer = partnerOf(dealer);
  } else {
    winningTeam = (1 - dealerTeam) as 0 | 1;
    gained = Math.floor((attackerPoints - 80) / 40);
    nextDealer = nextSeat(dealer);
  }

  const levels: [Rank, Rank] = [state.levels[0], state.levels[1]];
  const newLevel = levels[winningTeam] + gained;
  let winner: 0 | 1 | null = null;
  if (newLevel > 14) winner = winningTeam;
  levels[winningTeam] = Math.min(newLevel, 14) as Rank;

  const result: RoundResult = {
    attackerPoints,
    kittyPoints,
    kittyMultiplier: multiplier,
    winningTeam,
    levelsGained: gained,
    nextDealer,
  };
  events.push({ type: 'roundEnded', result });
  if (winner !== null) events.push({ type: 'gameOver', winner });
  return {
    state: {
      ...state,
      phase: winner === null ? 'roundEnd' : 'finished',
      levels,
      dealer: nextDealer,
      trick: null,
      lastRound: result,
      winner,
    },
    events,
  };
}

/** 当前轮到谁操作（用于 UI/服务器计时）；null 表示无需等待某个人 */
export function currentActor(state: GameState): number | null {
  switch (state.phase) {
    case 'kitty':
      return state.dealer;
    case 'playing':
      return state.trick ? (state.trick.leader + state.trick.plays.length) % 4 : null;
    default:
      return null;
  }
}
