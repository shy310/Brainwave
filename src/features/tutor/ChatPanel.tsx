import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, FileText, ImageIcon, Paperclip, Square, X } from 'lucide-react';
import { useT } from '@/i18n';
import { useProgress } from '@/features/learn/ProgressProvider';
import { weakTopics } from '@/features/learn/progress';
import { streamAi } from '@/lib/api';
import { useAiError } from '@/lib/useAiError';
import { cn } from '@/lib/cn';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { LogoMark } from '@/ui/Logo';
import { Rich } from '@/ui/Rich';
import type { Attachment, ChatTurn, TutorInput } from '@shared/learn';
import { toAttachment } from './files';

interface Message extends ChatTurn { file?: { kind: Attachment['kind']; name: string } }

const load = (key: string): Message[] => {
  try { return (JSON.parse(sessionStorage.getItem(key) ?? '[]') as Message[]) ?? []; } catch { return []; }
};

export interface ChatPanelHandle { reset: () => void; hasMessages: () => boolean }

interface Props {
  /** Where this conversation is kept for the browser session. */
  sessionKey: string;
  /** Everything the tutor needs besides the messages (mode, topic, lecture…). */
  context: () => Omit<TutorInput, 'messages' | 'attachment'>;
  emptyTitle: string;
  starters: string[];
  onMessagesChange?: (count: number) => void;
}

/** Streaming tutor chat: message list, attachments and composer. */
export const ChatPanel = forwardRef<ChatPanelHandle, Props>(({ sessionKey, context, emptyTitle, starters, onMessagesChange }, ref) => {
  const t = useT();
  const { progress } = useProgress();
  const toMessage = useAiError();
  const [messages, setMessages] = useState<Message[]>(() => load(sessionKey));
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    reset: () => { abort.current?.abort(); setMessages([]); setError(''); setAttachment(null); },
    hasMessages: () => messages.length > 0,
  }), [messages.length]);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { setMessages(load(sessionKey)); }, [sessionKey]);
  useEffect(() => {
    try { sessionStorage.setItem(sessionKey, JSON.stringify(messages)); } catch { /* ignore */ }
    onMessagesChange?.(messages.length);
  }, [messages, sessionKey, onMessagesChange]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages.length, streaming]);

  const send = async (text: string) => {
    const content = text.trim();
    if ((!content && !attachment) || streaming) return;
    setError('');
    const userTurn: Message = {
      role: 'user', content: content || attachment?.name || '',
      file: attachment ? { kind: attachment.kind, name: attachment.name } : undefined,
    };
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
        weakTopicIds: weakTopics(progress),
        ...context(),
        messages: history.map(({ role, content }) => ({ role, content })),
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

  return (
    <div className="flex flex-col gap-4">
      <section aria-live="polite" aria-busy={streaming} className="min-h-[40vh] space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <LogoMark className="size-12" />
            <h2 className="text-lg font-semibold">{emptyTitle}</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {starters.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)}
                  className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm hover:bg-surface-2">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[85%] rounded-2xl px-4 py-3', m.role === 'user' ? 'bg-brand-600 text-white' : 'border border-line bg-surface')}>
              <p className="sr-only">{m.role === 'user' ? t.tutor.you : t.tutor.name}:</p>
              {m.file && (
                <p className="mb-1 inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-xs">
                  {m.file.kind === 'pdf' ? <FileText className="size-3.5" aria-hidden="true" /> : <ImageIcon className="size-3.5" aria-hidden="true" />}{m.file.name}
                </p>
              )}
              {m.role === 'user'
                ? <p className="whitespace-pre-wrap" dir="auto">{m.content}</p>
                : m.content ? <Rich text={m.content} /> : (
                  <span className="inline-flex gap-1 py-2" aria-label={t.common.loading}>
                    {[0, 1, 2].map((d) => <span key={d} className="size-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d * 120}ms` }} />)}
                  </span>
                )}
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
});
ChatPanel.displayName = 'ChatPanel';
