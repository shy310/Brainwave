import { Link, useSearchParams } from 'react-router';
import { CarFront, ChevronRight, Send } from 'lucide-react';
import { useI18n } from '@/i18n';
import { storage } from '@/lib/storage';
import { Alert } from '@/ui/Alert';
import { Spinner } from '@/ui/Spinner';
import { BackLink } from '@/features/learn/CoursePage';
import { GAMES, bestKey, type GameId } from './PlayPage';
import { useDeck } from './useDeck';

const LOOK: Record<GameId, { icon: typeof Send; tile: string }> = {
  glide: { icon: Send, tile: 'from-sky-400 to-brand-600' },
  rush: { icon: CarFront, tile: 'from-rose-400 to-rose-600' },
};

/** The arcade: pick a game. Both ask questions from the student's own lectures. */
export default function GamesPage() {
  const { t } = useI18n();
  const tg = t.game;
  const [params] = useSearchParams();
  const folder = params.get('folder') ?? 'all';
  const { loading, deck } = useDeck(folder);
  const query = folder !== 'all' ? `?folder=${folder}` : '';

  return (
    <div className="stagger mx-auto max-w-2xl space-y-6">
      <BackLink to="/lectures" label={t.lectures.title} />
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{tg.title}</h1>
        <p className="text-muted">{tg.subtitle}</p>
      </header>

      {loading && <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>}
      {!loading && deck.length === 0 && <Alert>{tg.notEnough}</Alert>}

      {!loading && deck.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {GAMES.map((g) => {
              const { icon: Icon, tile } = LOOK[g];
              const best = Number(storage.get(bestKey(g))) || 0;
              return (
                <Link key={g} to={`/play/${g}${query}`}
                  className="pressable group flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-lift)]">
                  <span className={`icon-tile flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white ${tile}`}>
                    <Icon className="size-7" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold">{tg[g].name}</span>
                    <span className="block text-sm text-muted">{tg[g].body}</span>
                    {best > 0 && <span className="mt-1 block text-xs font-medium text-accent-600 dark:text-accent-300">{tg.best(best)}</span>}
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
          <ol className="space-y-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 text-sm shadow-[var(--shadow-soft)]">
            {tg.how.map((h, i) => (
              <li key={i} className="flex gap-2"><span className="font-semibold text-brand-600 dark:text-brand-300">{i + 1}.</span>{h}</li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
