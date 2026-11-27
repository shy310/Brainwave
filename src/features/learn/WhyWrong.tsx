import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, Sparkles } from '@/ui/icons';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { streamAi } from '@/lib/api';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Field';
import { Rich } from '@/ui/Rich';
import { Shimmer } from '@/ui/Feedback';
import type { ChatTurn } from '@shared/learn';
import type { WhyWrongInput } from '@shared/whyWrong';

const MAX_FOLLOW_UPS = 5;

/**
 * "Why is my answer wrong?" under a wrong answer: the AI explains the mistake
 * in the student's own answer (from the lecture, when there is one), and they
 * can ask a few follow-up questions.
 */
export const WhyWrong = ({ facts }: { facts: Omit<WhyWrongInput, 'followUps'> }) => {
  const t = useT();
  const tw = t.quiz.whyWrong;
  const toMessage = useAiError();
  /** The conversation: the first answer, then follow-ups and answers. */
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const ask = async (history: ChatTurn[]) => {
    setError('');
    setTurns([...history, { role: 'assistant', content: '' }]);
    setStreaming(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      await streamAi('whyWrong', { ...facts, followUps: history }, (chunk) => setTurns((all) => {
        const copy = all.slice();
        copy[copy.length - 1] = { role: 'assistant', content: copy[copy.length - 1].content + chunk };
        return copy;
      }), ctrl.signal);
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
      setTurns(history.length ? history.slice(0, -1) : []); // let them try again
      if (history.length) setDraft(history[history.length - 1].content);
    } finally { setStreaming(false); }
  };

  const followUp = (e: FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (!q || streaming) return;
    setDraft('');
    void ask([...turns, { role: 'user', content: q.slice(0, 1000) }]);
  };

  const asked = turns.filter((x) => x.role === 'user').length;

  if (!turns.length) {
    return (
      <>
        {error && <Alert tone="error">{error}</Alert>}
        <Button variant="secondary" size="sm" icon={<Sparkles className="size-4" />} onClick={() => void ask([])}>{tw.ask}</Button>
      </>
    );
  }

  return (
    <section aria-label={tw.title} className="space-y-3 rounded-xl border border-brand-200 bg-brand-500/5 p-4 animate-fade-up dark:border-brand-800">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
        <Sparkles className="size-4" aria-hidden="true" />{tw.title}
      </h3>
      <div className="space-y-3" aria-live="polite" aria-busy={streaming}>
        {turns.map((turn, i) => turn.role === 'user' ? (
          <p key={i} className="ms-auto w-fit max-w-[85%] rounded-2xl bg-brand-600 px-3 py-1.5 text-sm text-white" dir="auto">{turn.content}</p>
        ) : turn.content ? (
          <div key={i} className={cn(streaming && i === turns.length - 1 && 'ai-streaming')}><Rich text={turn.content} className="text-sm leading-relaxed" /></div>
        ) : (
          <p key={i} className="text-sm text-muted"><Shimmer text={tw.thinking} /></p>
        ))}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {!streaming && asked < MAX_FOLLOW_UPS && (
        <form onSubmit={followUp} className="flex gap-2">
          <Input aria-label={tw.followUp} placeholder={tw.followUp} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} dir="auto" className="h-10" />
          <Button type="submit" size="sm" className="size-10 shrink-0 px-0" aria-label={t.tutor.send} disabled={!draft.trim()}>
            <ArrowUp className="size-5" aria-hidden="true" />
          </Button>
        </form>
      )}
    </section>
  );
};
