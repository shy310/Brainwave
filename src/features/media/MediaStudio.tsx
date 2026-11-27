import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Sparkles, X, type LucideIcon } from 'lucide-react';
import { useI18n } from '@/i18n';
import { callAi } from '@/lib/api';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Textarea } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { LENGTHS, type MediaKind, type MediaLength } from '@shared/media';
import { LOCALES, NATIVE_NAME, type Locale } from '@shared/locales';
import { mediaRepo, type Media } from './repo';
import { useMediaSource } from './useMediaSource';
import { ToolHero } from '@/ui/PageHeader';
import { TOOL_META } from '@/ui/tools';
import { WaveLoader } from '@/ui/Wave';
import { Mascot } from '@/ui/Mascot';
import { cn } from '@/lib/cn';
import { Cover } from './Cover';

export interface StudioStrings {
  title: string; subtitle: string; createTitle: string; promptLabel: string; promptPlaceholder: string;
  from: string; language: string; length: string; lengths: Record<MediaLength, string>; create: string; writing: string;
  saved: string; none: string; suggestions: string[]; loadingSource: string;
}

interface Props {
  kind: MediaKind;
  /** AI operation that writes the script; its result must have a `title`. */
  op: 'videoScript' | 'podcastScript';
  strings: StudioStrings;
  icon: LucideIcon;
  /** Unused: the tool's colours come from TOOL_META. */
  tint?: string;
}

const LANGUAGE_KEY = 'bw.mediaLanguage';
/** Each language in its own name, so it is recognisable whatever the app language. */
const LANGUAGE_NAMES: Record<Locale, string> = NATIVE_NAME;

/** Shared "make a video / podcast" page: pick a source, make it, list saved ones. */
export const MediaStudio = ({ kind, op, strings: s, icon: Icon }: Props) => {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toMessage = useAiError();
  const { resolved, loading: sourceLoading, clear } = useMediaSource();
  const [prompt, setPrompt] = useState('');
  const [length, setLength] = useState<MediaLength>('short');
  // The language of the video or podcast: the app's language unless the student picked another last time.
  const [language, setLanguage] = useState<Locale>(() => {
    try { const v = localStorage.getItem(LANGUAGE_KEY); if (LOCALES.includes(v as Locale)) return v as Locale; } catch { /* storage blocked */ }
    return locale;
  });
  const pickLanguage = (l: Locale) => {
    setLanguage(l);
    try { localStorage.setItem(LANGUAGE_KEY, l); } catch { /* storage blocked */ }
  };
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
      const script = await callAi<{ title: string }>(op, { source, length }, undefined, { locale: language });
      const origin = resolved?.origin ?? { type: 'prompt' as const, label: text.trim() };
      const media = await mediaRepo.create({ kind, title: script.title.slice(0, 200), origin, locale: language, script });
      navigate(`${base}/${media.id}`);
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
      setWorking(false);
    }
  };

  const tool = kind === 'video' ? 'videos' : 'podcasts';
  const meta = TOOL_META[tool];

  return (
    <div className="space-y-8">
      <ToolHero tool={tool} title={s.title} subtitle={s.subtitle} />

      {/* The composer: what it's about (or the source it came from), then language and length. */}
      <section aria-labelledby="media-create" className="mx-auto max-w-3xl">
        <Card className="overflow-hidden">
          <div className="space-y-4 p-5 sm:p-6">
            <h2 id="media-create" className="sr-only">{s.createTitle}</h2>
            {sourceLoading ? <p className="flex items-center gap-2 text-muted"><WaveLoader />{s.loadingSource}</p>
              : resolved ? (
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted">{s.from}:</span>
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold', meta.soft)} dir="auto">
                    <Icon className="size-4" aria-hidden="true" />{resolved.origin.label}
                    <button type="button" aria-label={t.tutor.remove} onClick={clear} className="-me-1 rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"><X className="size-3.5" aria-hidden="true" /></button>
                  </span>
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Prompt first: the question is the heading, the box is big. */}
                  <label htmlFor="media-prompt" className="block font-display text-2xl font-bold leading-tight sm:text-3xl">{s.promptLabel}</label>
                  <Textarea id="media-prompt" rows={3} maxLength={500} dir="auto" value={prompt} placeholder={s.promptPlaceholder}
                    onChange={(e) => setPrompt(e.target.value)} disabled={working} className="border-2 text-lg leading-relaxed" />
                  <div className="flex flex-wrap gap-2">
                    {s.suggestions.map((sug) => (
                      <button key={sug} type="button" disabled={working} onClick={() => { setPrompt(sug); void create(sug); }}
                        className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium hover:border-brand-200 hover:bg-surface-2 disabled:opacity-50 dark:hover:border-brand-800">
                        <Sparkles className="size-3.5 text-accent-600 dark:text-accent-300" aria-hidden="true" />{sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>
          <div className="grid gap-4 border-t border-line bg-surface-2/60 p-5 sm:grid-cols-[auto_1fr] sm:gap-x-6 sm:p-6">
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">{s.language}</p>
              <Segmented<Locale> label={s.language} value={language} onChange={pickLanguage}
                options={LOCALES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))} />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">{s.length}</p>
              <Segmented label={s.length} value={length} onChange={setLength} options={LENGTHS.map((l) => ({ value: l, label: s.lengths[l] }))} />
            </div>
            {error && <Alert tone="error" className="sm:col-span-2">{error}</Alert>}
            <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
              <Button size="lg" icon={<Sparkles className="size-5" />} loading={working} disabled={!resolved && prompt.trim().length < 3}
                onClick={() => create()}>{working ? s.writing : s.create}</Button>
              {/* While the AI writes, Wave thinks beside the button. */}
              {working && <Mascot mood="thinking" size={56} className="-my-3" />}
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-4" aria-labelledby="saved-media">
        <h2 id="saved-media" className="font-display text-xl font-bold">{s.saved}</h2>
        {saved === null ? <WaveLoader label={t.common.loading} />
          : saved.length === 0 ? (
            <div className="flex items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-line p-5">
              <Mascot mood="curious" size={56} className="shrink-0" />
              <p className="text-muted">{s.none}</p>
            </div>
          ) : (
            <ul className={cn('grid gap-x-4 gap-y-6', kind === 'video' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4')}>
              {saved.map((m) => (
                <li key={m.id} className="min-w-0">
                  <Link to={`${base}/${m.id}`} className="group block rounded-[var(--radius-card)] focus-visible:outline-offset-4">
                    <Cover kind={kind} seed={m.id} className="rounded-[var(--radius-card)] shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-200 ease-[var(--ease-out)] group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-lift)] group-active:translate-y-0 group-active:scale-[0.99] motion-reduce:transform-none" />
                    <p className="mt-2.5 line-clamp-2 font-semibold leading-snug group-hover:text-brand-700 dark:group-hover:text-brand-300" dir="auto">{m.title}</p>
                    <p className="mt-0.5 truncate text-sm text-muted" dir="auto">{m.origin.label}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
};
