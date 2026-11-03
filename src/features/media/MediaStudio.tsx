import { useEffect, useState, type ComponentType } from 'react';
import { Link, useNavigate } from 'react-router';
import { Sparkles, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { callAi } from '@/lib/api';
import { useAiError } from '@/lib/useAiError';
import { cn } from '@/lib/cn';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Textarea } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { Spinner } from '@/ui/Spinner';
import { LENGTHS, type MediaKind, type MediaLength } from '@shared/media';
import { mediaRepo, type Media } from './repo';
import { useMediaSource } from './useMediaSource';

export interface StudioStrings {
  title: string; subtitle: string; createTitle: string; promptLabel: string; promptPlaceholder: string;
  from: string; length: string; lengths: Record<MediaLength, string>; create: string; writing: string;
  saved: string; none: string; suggestions: string[]; loadingSource: string;
}

interface Props {
  kind: MediaKind;
  /** AI operation that writes the script; its result must have a `title`. */
  op: 'videoScript' | 'podcastScript';
  strings: StudioStrings;
  icon: ComponentType<{ className?: string }>;
  tint: string;
}

/** Shared "make a video / podcast" page: pick a source, make it, list saved ones. */
export const MediaStudio = ({ kind, op, strings: s, icon: Icon, tint }: Props) => {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toMessage = useAiError();
  const { resolved, loading: sourceLoading, clear } = useMediaSource();
  const [prompt, setPrompt] = useState('');
  const [length, setLength] = useState<MediaLength>('short');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Omit<Media, 'script'>[] | null>(null);
  const base = kind === 'video' ? '/videos' : '/podcasts';

  useEffect(() => { mediaRepo.list(kind).then(setSaved).catch(() => setSaved([])); }, [kind]);

  const create = async (text = prompt) => {
    const source = resolved?.source ?? (text.trim().length >= 3 ? { prompt: text.trim() } : null);
    if (!source) return;
    setWorking(true);
    setError('');
    try {
      const script = await callAi<{ title: string }>(op, { source, length });
      const origin = resolved?.origin ?? { type: 'prompt' as const, label: text.trim() };
      const media = await mediaRepo.create({ kind, title: script.title.slice(0, 200), origin, locale, script });
      navigate(`${base}/${media.id}`);
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
      setWorking(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{s.title}</h1>
        <p className="text-muted">{s.subtitle}</p>
      </header>

      <Card className="space-y-5 p-6">
        <h2 className="text-lg font-semibold">{s.createTitle}</h2>
        {sourceLoading ? <p className="flex items-center gap-2 text-muted"><Spinner className="size-4" />{s.loadingSource}</p>
          : resolved ? (
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">{s.from}:</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200" dir="auto">
                {resolved.origin.label}
                <button type="button" aria-label={t.tutor.remove} onClick={clear} className="rounded-full p-0.5 hover:bg-brand-100 dark:hover:bg-brand-800"><X className="size-3.5" aria-hidden="true" /></button>
              </span>
            </p>
          ) : (
            <div className="space-y-2">
              <label htmlFor="media-prompt" className="text-sm font-medium">{s.promptLabel}</label>
              <Textarea id="media-prompt" rows={2} maxLength={500} dir="auto" value={prompt} placeholder={s.promptPlaceholder}
                onChange={(e) => setPrompt(e.target.value)} disabled={working} />
              <div className="flex flex-wrap gap-2">
                {s.suggestions.map((sug) => (
                  <button key={sug} type="button" disabled={working} onClick={() => { setPrompt(sug); void create(sug); }}
                    className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50">{sug}</button>
                ))}
              </div>
            </div>
          )}
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{s.length}</p>
          <Segmented label={s.length} value={length} onChange={setLength} options={LENGTHS.map((l) => ({ value: l, label: s.lengths[l] }))} />
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <Button size="lg" icon={<Sparkles className="size-5" />} loading={working} disabled={!resolved && prompt.trim().length < 3}
          onClick={() => create()}>{working ? s.writing : s.create}</Button>
      </Card>

      <section className="space-y-3" aria-labelledby="saved-media">
        <h2 id="saved-media" className="text-lg font-semibold">{s.saved}</h2>
        {saved === null ? <Spinner className="size-5 text-muted" />
          : saved.length === 0 ? <p className="text-muted">{s.none}</p>
          : (
            <div className="grid gap-3 sm:grid-cols-2">
              {saved.map((m) => (
                <Link key={m.id} to={`${base}/${m.id}`} className="rounded-[var(--radius-card)]">
                  <Card className="flex items-center gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-lift)]">
                    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white', tint)}>
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium" dir="auto">{m.title}</p>
                      <p className="truncate text-sm text-muted" dir="auto">{m.origin.label}</p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
      </section>
    </div>
  );
};
