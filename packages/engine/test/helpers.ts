import { type Card, type Trump, BIG_JOKER, SMALL_JOKER, makeDeck } from '../src/index.js';

const deck = makeDeck();
/** 用简写取牌："S7" → S7a, "S7'" → S7b, "SJ" 小王, "BJ" 大王 */
export function c(code: string): Card {
  const copy = code.endsWith("'") ? 'b' : 'a';
  const base = code.replace("'", '');
  let id: string;
  if (base === 'SJ' || base === 'BJ') id = `${base}${copy}`;
  else {
    const suit = base[0]!;
    const r = base.slice(1);
    const rank = r === 'A' ? 14 : r === 'K' ? 13 : r === 'Q' ? 12 : r === 'J' ? 11 : Number(r);
    id = `${suit}${rank}${copy}`;
  }
  const card = deck.find((x) => x.id === id);
  if (!card) throw new Error(`bad card code ${code}`);
  return card;
}
export const cs = (...codes: string[]): Card[] => codes.map(c);
export const T = (suit: Trump['suit'], level: Trump['level'] = 2): Trump => ({ suit, level });
export { BIG_JOKER, SMALL_JOKER };
