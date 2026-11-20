import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/features/auth/AuthProvider';
import { Button } from '@/ui/Button';
import { Textarea } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { findTopic } from '@shared/curriculum';
import { TUTOR_MODES, type TutorMode } from '@shared/learn';
import { ChatPanel, type ChatPanelHandle } from './ChatPanel';

export default function TutorPage() {
  const { t, locale } = useI18n();
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const topicId = params.get('topic') ?? '';
  const topic = findTopic(topicId);
  const [mode, setMode] = useState<TutorMode>('tutor');
  const [custom, setCustom] = useState(profile?.tutor_style ?? '');
  const [count, setCount] = useState(0);
  const chat = useRef<ChatPanelHandle>(null);

  const context = useCallback(() => ({
    mode,
    custom: mode === 'custom' ? custom : undefined,
    topicId: topic ? topicId : undefined,
  }), [mode, custom, topic, topicId]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.tutor.title}</h1>
          <p className="text-muted">{t.tutor.subtitle}</p>
        </div>
        {count > 0 && <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={() => chat.current?.reset()}>{t.tutor.newChat}</Button>}
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

      <ChatPanel ref={chat} sessionKey={`bw.tutorChat.${topicId}`} context={context}
        emptyTitle={t.tutor.emptyTitle} starters={t.tutor.starters} onMessagesChange={setCount} />
    </div>
  );
}
