import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { LifeBuoy } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Button } from '@/ui/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { audioStore, type Draft } from './audioStore';
import { recoverableDrafts } from './session';
import { dateLocale } from '@shared/locales';
import { askConfirm } from '@/ui/Confirm';

/**
 * Shown on every page when a lecture recording or upload was left unfinished
 * on this device (tab closed, crash, offline, AI limit). Recovering restores
 * the transcript so far and transcribes the rest.
 */
export const RecoveryBanner = () => {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const { pathname } = useLocation();
  const [drafts, setDrafts] = useState<(Draft & { pendingSeconds: number })[]>([]);
  const onNewLecture = pathname === '/lectures/new';

  useEffect(() => {
    if (!user || onNewLecture) return;
    let cancelled = false;
    recoverableDrafts(user.id)
      .then((d) => { if (!cancelled) setDrafts(d); })
      .catch((err) => console.warn('Could not check for unfinished recordings', err));
    return () => { cancelled = true; };
  }, [user, onNewLecture]);

  if (onNewLecture || !drafts.length) return null;

  const discard = async (id: string) => {
    if (!(await askConfirm({ message: t.lectures.confirmDiscard, action: 'delete' }))) return;
    await audioStore.deleteDraft(id).catch(() => {});
    setDrafts((d) => d.filter((x) => x.id !== id));
  };

  const when = (ms: number) => new Date(ms).toLocaleString(dateLocale(locale), {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="mb-6 space-y-3">
      {drafts.map((d) => (
        <section key={d.id} aria-label={t.lectures.recoverTitle}
          className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <LifeBuoy className="hidden size-5 shrink-0 sm:block" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t.lectures.recoverTitle}{d.title ? ` · ${d.title}` : ''}</p>
            <p>{d.pendingSeconds > 0
              ? t.lectures.recoverBody(when(d.createdAt), Math.max(1, Math.round(d.pendingSeconds / 60)))
              : t.lectures.recoverBodyDone(when(d.createdAt))}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link to={`/lectures/new?resume=${d.id}`} className="inline-flex h-9 items-center justify-center rounded-xl bg-brand-600 px-3 text-sm font-medium text-white transition-colors hover:bg-brand-700">
              {t.lectures.recover}
            </Link>
            <Button size="sm" variant="secondary" onClick={() => void discard(d.id)}>{t.lectures.discard}</Button>
          </div>
        </section>
      ))}
    </div>
  );
};
