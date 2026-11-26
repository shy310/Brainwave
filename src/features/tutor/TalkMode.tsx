import { useCallback, useEffect, useRef, useState } from 'react';
import { Mascot, type Mood } from '@/ui/Mascot';
import { createPortal } from 'react-dom';
import { Mic, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { streamAi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAiError } from '@/lib/useAiError';
import { Button } from '@/ui/Button';
import { useDictation } from '@/features/media/useDictation';
import { speak, splitSentences, useVoices, type Voice } from '@/features/media/speech';
import { primeAudio, useCloudVoices } from '@/features/media/cloudVoice';
import { VOICE_PAIRS } from '@shared/tts';
import type { ChatTurn, TutorInput } from '@shared/learn';

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';
const MOOD: Record<Phase, Mood> = { idle: 'waving', listening: 'curious', thinking: 'thinking', speaking: 'excited' };

/** Turn spoken-style text into what a voice should read (no Markdown or LaTeX symbols). */
const speakable = (s: string) => s.replace(/\$+/g, '').replace(/\*\*?|__|`|#+\s/g, '').replace(/\\[a-zA-Z]+/g, '').trim();

/**
 * Talk mode: a hands-free spoken conversation with the tutor. You talk; it
 * answers out loud, sentence by sentence as the answer streams in; then it
 * listens again. Tap the orb to interrupt or to talk.
 */
export const TalkMode = ({ open, onClose, context, title }: {
  open: boolean;
  onClose: () => void;
  /** The tutor's context, e.g. the lecture. */
  context: () => Omit<TutorInput, 'messages' | 'attachment'>;
  title: string;
}) => {
  const { t, locale } = useI18n();
  const tt = t.tutor.talk;
  const toMessage = useAiError();
  const mic = useDictation(locale);
  const cloud = useCloudVoices();
  const voices = useVoices(locale);
  const voice: Voice = cloud ? { cloud: VOICE_PAIRS[locale][0] } : voices[0] ?? null;

  const [phase, setPhase] = useState<Phase>('idle');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [error, setError] = useState('');
  const alive = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const stopVoice = useRef<(() => void) | null>(null);
  const queue = useRef<string[]>([]);
  const streamDone = useRef(false);
  const history = useRef<ChatTurn[]>([]);
  const listenRef = useRef<() => void>(() => {});

  const hush = () => {
    abort.current?.abort();
    stopVoice.current?.();
    stopVoice.current = null;
    queue.current = [];
  };

  // Say the queued sentences one after another; when the answer is over, listen again.
  const sayNext = useCallback(() => {
    if (!alive.current) return;
    const next = queue.current.shift();
    if (next === undefined) {
      stopVoice.current = null;
      if (streamDone.current) listenRef.current();
      return;
    }
    setPhase('speaking');
    stopVoice.current = speak(next, { voice, rate: 1 }, () => { stopVoice.current = null; sayNext(); });
  }, [voice]);

  const ask = useCallback(async (words: string) => {
    const question = words.trim();
    if (!question || !alive.current) return;
    hush();
    setError('');
    const asked: ChatTurn[] = [...history.current, { role: 'user', content: question }];
    history.current = [...asked, { role: 'assistant', content: '' }];
    setTurns(history.current);
    setPhase('thinking');
    streamDone.current = false;
    let queued = 0; // sentences already sent to the voice
    let text = '';
    const ctrl = new AbortController();
    abort.current = ctrl;
    const queueComplete = (final: boolean) => {
      const sentences = splitSentences(text);
      const upTo = final ? sentences.length : sentences.length - 1; // the last one may still be growing
      for (; queued < upTo; queued++) { const clean = speakable(sentences[queued]); if (clean) queue.current.push(clean); }
      if (!stopVoice.current && queue.current.length) sayNext();
    };
    try {
      await streamAi('tutor', { ...context(), spoken: true, messages: asked.slice(-20) }, (chunk) => {
        text += chunk;
        history.current = [...asked, { role: 'assistant', content: text }];
        setTurns(history.current);
        queueComplete(false);
      }, ctrl.signal);
      streamDone.current = true;
      queueComplete(true);
      if (!stopVoice.current && !queue.current.length) listenRef.current();
    } catch (err) {
      if (ctrl.signal.aborted) return;
      history.current = asked.slice(0, -1);
      setTurns(history.current);
      setError(toMessage(err) || t.auth.errors.generic);
      setPhase('idle');
    }
  }, [context, sayNext, toMessage, t]);

  const listen = useCallback(() => {
    if (!alive.current) return;
    if (!mic.supported) { setPhase('idle'); return; }
    setPhase('listening');
    mic.start((words) => void ask(words));
  }, [mic, ask]);
  listenRef.current = listen;

  // When listening ends with nothing heard, wait for a tap.
  useEffect(() => { if (phase === 'listening' && !mic.listening && !mic.text) { const id = setTimeout(() => setPhase((p) => (p === 'listening' ? 'idle' : p)), 300); return () => clearTimeout(id); } }, [phase, mic.listening, mic.text]);

  // Opening starts listening at once; closing stops everything.
  useEffect(() => {
    if (!open) return;
    alive.current = true;
    primeAudio();
    listenRef.current();
    // Escape ends talk mode only (not the panel underneath).
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => {
      alive.current = false;
      document.removeEventListener('keydown', onKey, true);
      hush();
      mic.stop();
      setPhase('idle');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The orb: tap to talk, to send now, or to interrupt.
  const tap = () => {
    primeAudio();
    if (phase === 'listening') { mic.stop(); return; }
    if (phase === 'speaking' || phase === 'thinking') { hush(); listen(); return; }
    listen();
  };

  if (!open) return null;
  const status = phase === 'listening' ? (mic.text || tt.listening) : phase === 'thinking' ? tt.thinking : phase === 'speaking' ? tt.speaking : mic.supported ? tt.tap : tt.noMic;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={tt.title} className="fixed inset-0 z-[70] flex flex-col bg-bg/95 backdrop-blur-xl animate-pop-in print:hidden">
      <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{tt.title}</h2>
          <p className="truncate text-sm text-muted" dir="auto">{title}</p>
        </div>
        <Button variant="ghost" size="sm" className="size-10 px-0" aria-label={tt.end} onClick={onClose}><X className="size-5" aria-hidden="true" /></Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-6">
        {/* Wave follows the conversation: listening, thinking, answering. */}
        <Mascot mood={MOOD[phase]} size={88} className="-mb-4" />
        <button type="button" onClick={tap} aria-label={phase === 'listening' ? tt.send : phase === 'speaking' || phase === 'thinking' ? tt.interrupt : tt.tap}
          className={cn('talk-orb relative flex size-44 items-center justify-center rounded-full text-white sm:size-52', `talk-orb-${phase}`)}>
          <span className="talk-orb-glow absolute inset-0 rounded-full" aria-hidden="true" />
          <Mic className={cn('relative size-12 transition-opacity', phase === 'idle' || phase === 'listening' ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
        </button>
        <p className="min-h-6 max-w-md text-center text-lg font-medium" aria-live="polite" dir="auto">{status}</p>
        {error && <p className="max-w-md text-center text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </div>

      {/* What was said, so you can read along. */}
      <div className="max-h-[32vh] overflow-y-auto border-t border-line px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <ol className="mx-auto max-w-xl space-y-2 text-sm">
          {turns.map((x, i) => x.content && (
            <li key={i} className={cn('rounded-2xl px-3 py-2', x.role === 'user' ? 'ms-auto w-fit max-w-[85%] bg-brand-600 text-white' : 'bg-surface-2')} dir="auto">
              <span className="sr-only">{x.role === 'user' ? t.tutor.you : t.tutor.name}: </span>{x.role === 'user' ? x.content : speakable(x.content)}
            </li>
          ))}
          {!turns.length && <li className="text-center text-muted">{tt.hint}</li>}
        </ol>
      </div>
    </div>,
    document.body,
  );
};
