import { useState, type FormEvent } from 'react';
import { Lightbulb, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n';
import { callAi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { Shimmer } from '@/ui/Feedback';
import type { Notes } from '@shared/lectures';
import {
  MAX_INSTRUCTION, applyEdit, blockHeading, blockText, parseBlock,
  type EditAction, type EditDepth, type EditPlace, type NotesEditOutput,
} from '@shared/notesEdit';
import { notesLabels, notesLocale, notesToText } from './notesExport';

export interface NoteSelection { block: string; quote: string; offset: number }
export interface NotesEdited { notes: Notes; changed: string[]; place: EditPlace; added: number; from?: string }

const PREFS = 'bw.notesEdit';
const loadPrefs = (): { place: EditPlace; depth: EditDepth } => {
  try { return { place: 'after', depth: 'detailed', ...JSON.parse(localStorage.getItem(PREFS) ?? '{}') }; } catch { return { place: 'after', depth: 'detailed' }; }
};

const ACTIONS = [
  { value: 'expand', icon: Maximize2 },
  { value: 'simplify', icon: Minimize2 },
  { value: 'example', icon: Lightbulb },
] as const;

/**
 * "Edit with AI" for the selected part of the notes: expand it, say it more
 * simply, add an example or ask for any change; choose where the new text
 * goes and how much. The AI writes it straight into the notes.
 */
export const EditWithAi = ({ selection, notes, title, onClose, onDone }: {
  selection: NoteSelection | null; notes: Notes; title: string; onClose: () => void; onDone: (edit: NotesEdited) => void;
}) => {
  const { t, locale } = useI18n();
  const te = t.lectures.edit;
  const toMessage = useAiError();
  const [action, setAction] = useState<EditAction>('expand');
  const [instruction, setInstruction] = useState('');
  const [prefs, setPrefs] = useState(loadPrefs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ref = selection ? parseBlock(selection.block) : null;
  // A point can get new points after it; the summary and key terms grow in place.
  const places: EditPlace[] = ref?.kind === 'point' ? ['after', 'end', 'replace'] : ['after', 'replace'];
  const place = places.includes(prefs.place) ? prefs.place : 'after';
  const setPref = (p: Partial<typeof prefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    try { localStorage.setItem(PREFS, JSON.stringify(next)); } catch { /* private mode */ }
  };

  const run = async (e?: FormEvent, chosen: EditAction = instruction.trim() ? 'custom' : action) => {
    e?.preventDefault();
    if (!selection || busy) return;
    const block = blockText(notes, selection.block);
    if (block === null) { setError(te.gone); return; }
    setBusy(true);
    setError('');
    try {
      const out = await callAi<NotesEditOutput>('notesEdit', {
        action: chosen,
        instruction: chosen === 'custom' ? instruction.trim().slice(0, MAX_INSTRUCTION) : undefined,
        place, depth: prefs.depth,
        quote: selection.quote.slice(0, 1500), block: block.slice(0, 3000),
        heading: blockHeading(notes, selection.block)?.slice(0, 200),
        title: title.slice(0, 200) || undefined,
        notes: notesToText(title, notes, notesLabels(notesLocale(notes, locale))).slice(0, 20_000),
      });
      const result = applyEdit(notes, selection.block, selection.quote, place, out.points);
      if (!result) { setError(te.gone); return; }
      const appended = place !== 'replace' && ref?.kind !== 'point';
      onDone({ ...result, place, added: ref?.kind === 'point' && place !== 'replace' ? result.changed.length : 0, from: appended || place === 'replace' ? out.points[0] : undefined });
      setInstruction('');
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={!!selection} onClose={() => { if (!busy) onClose(); }} title={te.title}>
      {selection && (
        <form onSubmit={(e) => void run(e)} className="space-y-4">
          <blockquote className="line-clamp-3 rounded-xl bg-brand-50 px-3.5 py-2 text-sm text-fg dark:bg-brand-900/30" dir="auto">{selection.quote}</blockquote>
          {error && <Alert tone="error">{error}</Alert>}
          {busy ? (
            <p className="py-6 text-center text-muted" aria-live="polite"><Shimmer text={te.writing} /></p>
          ) : (
            <>
              <div role="radiogroup" aria-label={te.what} className="grid grid-cols-3 gap-2">
                {ACTIONS.map(({ value, icon: Icon }) => (
                  <button key={value} type="button" role="radio" aria-checked={action === value && !instruction.trim()}
                    onClick={() => { setAction(value); setInstruction(''); }}
                    className={cn('pressable flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-sm font-medium transition-colors',
                      action === value && !instruction.trim() ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-line hover:bg-surface-2')}>
                    <Icon className="size-5" aria-hidden="true" />{te.actions[value]}
                  </button>
                ))}
              </div>
              <Input aria-label={te.custom} placeholder={te.custom} value={instruction} maxLength={MAX_INSTRUCTION} dir="auto"
                onChange={(e) => setInstruction(e.target.value)} />
              <div className="space-y-1.5">
                <p className="text-sm font-medium">{te.where}</p>
                <Segmented fill label={te.where} value={place} onChange={(v) => setPref({ place: v })}
                  options={places.map((p) => ({ value: p, label: ref?.kind !== 'point' && p === 'after' ? te.places.append : te.places[p] }))} />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">{te.howMuch}</p>
                <Segmented fill label={te.howMuch} value={prefs.depth} onChange={(v) => setPref({ depth: v })}
                  options={(['brief', 'detailed', 'deep'] as const).map((d) => ({ value: d, label: te.depths[d] }))} />
              </div>
              <Button type="submit" size="lg" block icon={<Sparkles className="size-5" />}>{te.write}</Button>
            </>
          )}
        </form>
      )}
    </Sheet>
  );
};
