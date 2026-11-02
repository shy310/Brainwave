import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowUp, FileText, ImageIcon, Paperclip, Plus, Square, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProgress } from '@/features/learn/ProgressProvider';
import { weakTopics } from '@/features/learn/progress';
import { streamAi } from '@/lib/api';
import { useAiError } from '@/lib/useAiError';
import { cn } from '@/lib/cn';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Textarea } from '@/ui/Field';
import { LogoMark } from '@/ui/Logo';
import { Rich } from '@/ui/Rich';
import { Segmented } from '@/ui/Segmented';
import { findTopic } from '@shared/curriculum';
import { TUTOR_MODES, type Attachment, type ChatTurn, type TutorMode } from '@shared/learn';
import { toAttachment } from './files';

interface Message extends ChatTurn { file?: { kind: Attachment['kind']; name: string } }

const SESSION_KEY = 'bw.tutorChat';

const loadSession = (topic: string): Message[] => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as { topic: string; messages: Message[] } | null;
    return saved && saved.topic === topic ? saved.messages : [];
  } catch { return []; }
};

export default function TutorPage() {
  const { t, locale } = useI18n();
  const { profile } = useAuth();
  const { progress } = useProgress();
  const toMessage = useAiError();
  const [params, setParams] = useSearchParams();
  const topicId = params.get('topic') ?? '';
  const topic = findTopic(topicId);

  const [messages, setMessages] = useState<Message[]>(() => loadSession(topicId));
  const [mode, setMode] = useState<TutorMode>('tutor');
  const [custom, setCustom] = useState(profile?.tutor_style ?? '');
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { setMessages(loadSession(topicId)); }, [topicId]);
  useEffect(() => {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ topic: topicId, messages })); } catch { /* ignore */ }
  }, [messages, topicId]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages.length, streaming]);

  const send = async (text: string) => {
    const content = text.trim();
    if ((!content && !attachment) || streaming) return;
    setError('');
    const userTurn: Message = { role: 'user', content: content || (attachment ? attachment.name : ''), file: attachment ? { kind: attachment.kind, name: attachment.name } : undefined };
    const history = [...messages, userTurn];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setDraft('');
    const sentAttachment = attachment;
    setAttachment(null);
    setStreaming(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      await streamAi('tutor', {
        messages: history.map(({ role, content }) => ({ role, content })),
        mode,
        custom: mode === 'custom' ? custom : undefined,
        topicId: topic ? topicId : undefined,
        weakTopicIds: weakTopics(progress),
        attachment: sentAttachment ?? undefined,
      }, (chunk) => {
        setMessages((m) => {
          const copy = m.slice();
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { ...last, content: last.content + chunk };
          return copy;
        });
      }, ctrl.signal);
    } catch (err) {
      const msg = toMessage(err);
      if (msg) setError(msg);
      // Drop an empty reply bubble; keep any partial answer.
      setMessages((m) => (m[m.length - 1]?.role === 'assistant' && !m[m.length - 1].content ? m.slice(0, -1) : m));
    } finally {
      setStreaming(false);
    }
  };

  const onSubmit = (e: FormEvent) => { e.preventDefault(); void send(draft); };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(draft); }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    const result = await toAttachment(file);
    if (result === 'size') setError(t.tutor.fileTooBig);
    else if (result === 'type') setError(t.tutor.fileType);
    else { setError(''); setAttachment(result); }
  };

  const newChat = () => { abort.current?.abort(); setMessages([]); setError(''); setAttachment(null); };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.tutor.title}</h1>
          <p className="text-muted">{t.tutor.subtitle}</p>
        </div>
        {messages.length > 0 && <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={newChat}>{t.tutor.newChat}</Button>}
      </header>

      <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label={t.tutor.mode} value={mode} onChange={setMode} options={TUTOR_MODES.map((m) => ({ value: m, label: t.tutor.modes[m] }))} />
          <p className="text-sm text-muted">{t.tutor.modeHelp[mode]}</p>
        </div>
        {mode === 'custom' && (
          <Textarea aria-label={t.tutor.customLabel} placeholder={t.tutor.customPlaceholder} rows={2} maxLength={500}
            value={custom} onChange={(e) => setCustom(e.target.value)} />
        )}
        {topic && (
          <p className="flex items-center gap-2 text-sm">
            <span className="text-muted">{t.tutor.about}:</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              {topic.topic.title[locale]}
              <button type="button" aria-label={t.tutor.remove} onClick={() => setParams({})} className="rounded-full p-0.5 hover:bg-brand-100 dark:hover:bg-brand-800">
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          </p>
        )}
      </div>

      <section aria-live="polite" aria-busy={streaming} className="min-h-[40vh] space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <LogoMark className="size-12" />
            <h2 className="text-lg font-semibold">{t.tutor.emptyTitle}</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {t.tutor.starters.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)}
                  className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm hover:bg-surface-2">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[85%] rounded-2xl px-4 py-3',
              m.role === 'user' ? 'bg-brand-600 text-white' : 'border border-line bg-surface')}>
              <p className="sr-only">{m.role === 'user' ? t.tutor.you : t.tutor.name}:</p>
              {m.file && (
                <p className="mb-1 inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-xs">
                  {m.file.kind === 'pdf' ? <FileText className="size-3.5" aria-hidden="true" /> : <ImageIcon className="size-3.5" aria-hidden="true" />}{m.file.name}
                </p>
              )}
              {m.role === 'user'
                ? <p className="whitespace-pre-wrap" dir="auto">{m.content}</p>
                : m.content ? <Rich text={m.content} /> : <span className="inline-flex gap-1 py-2" aria-label={t.common.loading}>
                    {[0, 1, 2].map((d) => <span key={d} className="size-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d * 120}ms` }} />)}
                  </span>}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </section>

      {error && <Alert tone="error">{error}</Alert>}

      <form onSubmit={onSubmit} className="sticky bottom-20 z-10 space-y-2 rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-lift)] md:bottom-4">
        {attachment && (
          <p className="flex items-center gap-2 px-2 pt-1 text-sm">
            {attachment.kind === 'pdf' ? <FileText className="size-4" aria-hidden="true" /> : <ImageIcon className="size-4" aria-hidden="true" />}
            <span className="truncate">{attachment.name}</span>
            <button type="button" onClick={() => setAttachment(null)} aria-label={t.tutor.remove} className="rounded p-0.5 hover:bg-surface-2"><X className="size-4" aria-hidden="true" /></button>
          </p>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" className="hidden"
            onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
          <Button variant="ghost" size="sm" className="size-10 shrink-0 px-0" aria-label={t.tutor.attach} title={t.tutor.attach}
            onClick={() => fileInput.current?.click()} disabled={streaming}>
            <Paperclip className="size-5" aria-hidden="true" />
          </Button>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} rows={1} dir="auto"
            aria-label={t.tutor.placeholder} placeholder={t.tutor.placeholder} maxLength={8000}
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-fg placeholder:text-muted/70 focus:outline-none [field-sizing:content]" />
          {streaming ? (
            <Button type="button" variant="secondary" size="sm" className="size-10 shrink-0 px-0" aria-label={t.tutor.stop} onClick={() => abort.current?.abort()}>
              <Square className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button type="submit" size="sm" className="size-10 shrink-0 px-0" aria-label={t.tutor.send} disabled={!draft.trim() && !attachment}>
              <ArrowUp className="size-5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
