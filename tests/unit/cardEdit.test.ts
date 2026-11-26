import { describe, expect, it } from 'vitest';
import { MAX_CARDS, addCard, cleanCard, deleteCard, editCard } from '../../shared/cardEdit';

const deck = { cards: [{ front: 'A?', back: 'a' }, { front: 'B?', back: 'b' }] };

describe('editing flashcards', () => {
  it('needs both sides, trimmed', () => {
    expect(cleanCard({ front: '  Q? ', back: ' A ' })).toEqual({ front: 'Q?', back: 'A' });
    expect(cleanCard({ front: 'Q?', back: '   ' })).toBeNull();
    expect(cleanCard({ front: 'x'.repeat(600), back: 'y' })!.front).toHaveLength(500);
  });

  it('edits, deletes and adds (new cards first)', () => {
    expect(editCard(deck, 1, { front: 'C?', back: 'c' }).cards[1]).toEqual({ front: 'C?', back: 'c' });
    expect(deleteCard(deck, 0).cards).toEqual([{ front: 'B?', back: 'b' }]);
    expect(addCard(deck, { front: 'N?', back: 'n' }).cards[0]).toEqual({ front: 'N?', back: 'n' });
    expect(addCard(null, { front: 'N?', back: 'n' })).toEqual({ cards: [{ front: 'N?', back: 'n' }] });
    expect(deck.cards).toHaveLength(2); // unchanged
  });

  it('keeps at most the limit', () => {
    const full = { cards: Array.from({ length: MAX_CARDS }, (_, i) => ({ front: `${i}`, back: 'x' })) };
    expect(addCard(full, { front: 'N', back: 'n' }).cards).toHaveLength(MAX_CARDS);
  });
});
