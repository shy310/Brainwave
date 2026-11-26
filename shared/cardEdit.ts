// Editing a lecture's flashcards by hand: fix a card, delete it or add your
// own. Review progress is keyed by the card's front (see cardKey in srs.ts),
// so a card whose front changes takes its progress with it.
import type { Flashcards } from './lectures.js';

export const MAX_FRONT = 500;
export const MAX_BACK = 1500;
export const MAX_CARDS = 100;

export type Card = Flashcards['cards'][number];

/** Trimmed and within limits, or null if a side is empty. */
export const cleanCard = (c: Card): Card | null => {
  const front = c.front.trim().slice(0, MAX_FRONT), back = c.back.trim().slice(0, MAX_BACK);
  return front && back ? { front, back } : null;
};

export const editCard = (deck: Flashcards, i: number, c: Card): Flashcards =>
  ({ ...deck, cards: deck.cards.map((x, j) => (j === i ? c : x)) });

export const deleteCard = (deck: Flashcards, i: number): Flashcards =>
  ({ ...deck, cards: deck.cards.filter((_, j) => j !== i) });

/** New cards go first, so you see the one you just added. */
export const addCard = (deck: Flashcards | null, c: Card): Flashcards =>
  ({ ...(deck ?? {}), cards: [c, ...(deck?.cards ?? [])].slice(0, MAX_CARDS) });
