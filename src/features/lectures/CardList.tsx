import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Textarea } from '@/ui/Field';
import { Rich } from '@/ui/Rich';
import { askConfirm } from '@/ui/Confirm';
import type { Flashcards } from '@shared/lectures';
import { MAX_BACK, MAX_CARDS, MAX_FRONT, addCard, cleanCard, deleteCard, editCard, type Card } from '@shared/cardEdit';
import { masteryLevel, type CardState, type MasteryLevel } from '@shared/srs';

const DOT: Record<MasteryLevel, string> = { new: 'bg-slate-400', learning: 'bg-rose-500', almost: 'bg-amber-500', mastered: 'bg-emerald-500' };

const CardForm = ({ initial, onSave, onCancel }: { initial: Card; onSave: (c: Card) => void; onCancel: () => void }) => {
  const t = useT();
  const tc = t.lectures.cardEdit;
  const [front, setFront] = useState(initial.front);
  const [back, setBack] = useState(initial.back);
  const card = cleanCard({ front, back });
  const submit = (e: FormEvent) => { e.preventDefault(); if (card) onSave(card); };
  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl border border-brand-300 bg-brand-500/5 p-3 animate-pop-in dark:border-brand-700">
      <Textarea aria-label={tc.front} placeholder={tc.front} value={front} onChange={(e) => setFront(e.target.value)} rows={2} maxLength={MAX_FRONT} dir="auto" autoFocus />
      <Textarea aria-label={tc.back} placeholder={tc.back} value={back} onChange={(e) => setBack(e.target.value)} rows={3} maxLength={MAX_BACK} dir="auto" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{t.common.cancel}</Button>
        <Button type="submit" size="sm" disabled={!card}>{tc.save}</Button>
      </div>
    </form>
  );
};

/**
 * All of a lecture's flashcards as a list: each shows how well it's known;
 * fix one, delete it or add your own.
 */
export const CardList = ({ deck, states, keyOf, onChange, onRenamed }: {
  deck: Flashcards | null;
  /** Review progress, by card key (null while loading). */
  states: Map<string, CardState> | null;
  /** A card's review key. */
  keyOf: (front: string) => string;
  onChange: (next: Flashcards) => void;
  /** A card's front changed: carry its review progress over. */
  onRenamed: (oldFront: string, newFront: string) => void;
}) => {
  const t = useT();
  const tc = t.lectures.cardEdit;
  const tm = t.lectures.mastery;
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const cards = deck?.cards ?? [];

  const remove = async (i: number) => {
    if (!(await askConfirm({ message: tc.confirmDelete, action: 'delete' }))) return;
    onChange(deleteCard(deck!, i));
  };

  return (
    <div className="space-y-3">
      {editing === 'new' ? (
        <CardForm initial={{ front: '', back: '' }} onCancel={() => setEditing(null)}
          onSave={(c) => { onChange(addCard(deck, c)); setEditing(null); }} />
      ) : (
        <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} disabled={cards.length >= MAX_CARDS} onClick={() => setEditing('new')}>{tc.add}</Button>
      )}
      <ul className="divide-y divide-line">
        {cards.map((c, i) => editing === i ? (
          <li key={`edit-${i}`} className="py-2">
            <CardForm initial={c} onCancel={() => setEditing(null)}
              onSave={(next) => { if (next.front !== c.front) onRenamed(c.front, next.front); onChange(editCard(deck!, i, next)); setEditing(null); }} />
          </li>
        ) : (
          <li key={`${i}-${c.front}`} className="group flex items-start gap-3 py-3">
            {(() => {
              const level = masteryLevel(states?.get(keyOf(c.front)));
              return <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', states ? DOT[level] : 'bg-surface-2')} title={tm[level]} aria-label={tm[level]} role="img" />;
            })()}
            <div className="min-w-0 flex-1 space-y-0.5 [overflow-wrap:anywhere]">
              <Rich text={c.front} className="font-medium" />
              <Rich text={c.back} className="text-sm text-muted" />
            </div>
            <div className="flex shrink-0 gap-0.5">
              <button type="button" onClick={() => setEditing(i)} aria-label={tc.edit} title={tc.edit}
                className="flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg">
                <Pencil className="size-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => void remove(i)} aria-label={tc.delete} title={tc.delete}
                className="flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-600">
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
