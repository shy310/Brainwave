import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { FileText, Mic, Plus, Upload } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { Alert } from '@/ui/Alert';
import { Card } from '@/ui/Card';
import { Spinner } from '@/ui/Spinner';
import { linkButton } from '@/features/learn/TopicPage';
import { lectureRepo, type LectureSummary } from './repo';

const SOURCE_ICON = { record: Mic, upload: Upload, text: FileText } as const;

export const lectureTitle = (l: Pick<LectureSummary, 'title' | 'created_at'>, untitled: string, locale: string) =>
  l.title || `${untitled} · ${new Date(l.created_at).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })}`;

export default function LecturesPage() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<LectureSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    lectureRepo.list().then(setItems).catch((err) => { console.error(err); setError(true); });
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{t.lectures.title}</h1>
          <p className="text-muted">{t.lectures.subtitle}</p>
        </div>
        <Link to="/lectures/new" className={cn(linkButton, 'bg-brand-600 text-white hover:bg-brand-700')}>
          <Plus className="size-4" aria-hidden="true" />{t.lectures.newLecture}
        </Link>
      </header>

      {error && <Alert tone="error">{t.auth.errors.generic}</Alert>}
      {!items && !error && <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>}

      {items?.length === 0 && (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white">
            <Mic className="size-7" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">{t.lectures.empty}</h2>
            <p className="mt-1 max-w-md text-muted">{t.lectures.emptyBody}</p>
          </div>
          <Link to="/lectures/new" className={cn(linkButton, 'bg-brand-600 text-white hover:bg-brand-700')}>
            <Plus className="size-4" aria-hidden="true" />{t.lectures.newLecture}
          </Link>
        </Card>
      )}

      {items && items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((l) => {
            const Icon = SOURCE_ICON[l.source];
            return (
              <Link key={l.id} to={`/lectures/${l.id}`} className="rounded-[var(--radius-card)]">
                <Card className="flex items-start gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-lift)]">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium" dir="auto">{lectureTitle(l, t.lectures.untitled, locale)}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {t.lectures.sources[l.source]}
                      {l.duration_sec > 0 && ` · ${t.lectures.minutes(Math.max(1, Math.round(l.duration_sec / 60)))}`}
                      {' · '}{new Date(l.created_at).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB')}
                    </p>
                  </div>
                  {l.status !== 'ready' && (
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                      l.status === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200')}>
                      {t.lectures.status[l.status]}
                    </span>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
