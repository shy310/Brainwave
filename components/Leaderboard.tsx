import React, { useEffect, useState } from 'react';
import { Trophy, Flame, Loader2, Medal } from 'lucide-react';
import { UserProfile, Translations, Language } from '../types';

interface BoardEntry {
  id?: string;
  name: string;
  totalXp: number;
  streakDays: number;
  level: number;
}

interface Props {
  user: UserProfile;
  translations: Translations;
  language: Language;
  apiBase: string;
}

const rankColor = (rank: number) => {
  if (rank === 1) return 'text-amber-500';
  if (rank === 2) return 'text-slate-400';
  if (rank === 3) return 'text-orange-600';
  return 'text-ink-300 dark:text-ink-500';
};

const Leaderboard: React.FC<Props> = ({ user, translations: t, language, apiBase }) => {
  const [entries, setEntries] = useState<BoardEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/api/leaderboard`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((data: BoardEntry[]) => { if (!cancelled) setEntries(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [apiBase]);

  // Identify the current user's row (by id when available, else by name + xp).
  const isMe = (e: BoardEntry) =>
    (e.id && user.id && e.id === user.id) || (!e.id && e.name === user.name);
  const myRank = entries ? entries.findIndex(isMe) + 1 : 0;

  return (
    <div className="px-5 md:px-8 lg:px-12 py-6 md:py-10 max-w-[820px] mx-auto">
      <header className="fade-in mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-moss-100 dark:bg-moss-900/30 text-moss-700 dark:text-moss-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <Trophy size={12} />
          {t.leaderboard}
        </div>
        <h1 className="font-display text-[36px] md:text-[52px] leading-[0.95] font-medium text-ink-700 dark:text-ink-100 tracking-tight">
          {t.leaderboard}
        </h1>
        <p className="mt-3 text-base md:text-lg text-ink-400 dark:text-ink-400 max-w-2xl">{t.leaderboardDesc}</p>
        {myRank > 0 && (
          <div className="mt-4 text-sm font-semibold text-moss-600 dark:text-moss-300">{t.yourRank(myRank)}</div>
        )}
      </header>

      {entries === null && !error && (
        <div className="flex items-center justify-center gap-2 py-20 text-ink-400">
          <Loader2 size={20} className="animate-spin" /> {t.loadingBoard}
        </div>
      )}

      {error && (
        <div className="paper-card p-8 text-center text-ink-400">{t.noRankYet}</div>
      )}

      {entries && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e, i) => {
            const rank = i + 1;
            const mine = isMe(e);
            return (
              <div
                key={(e.id ?? e.name) + i}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-colors fade-in ${
                  mine
                    ? 'bg-moss-50 dark:bg-moss-900/20 border-moss-200 dark:border-moss-800 ring-1 ring-moss-300/50'
                    : 'bg-white dark:bg-ink-800 border-ink-100 dark:border-ink-700'
                }`}
              >
                <div className={`w-8 flex items-center justify-center font-bold ${rankColor(rank)}`}>
                  {rank <= 3 ? <Medal size={20} /> : <span className="text-sm">{rank}</span>}
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-moss-500 to-moss-700 flex items-center justify-center text-white font-bold shrink-0">
                  {e.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink-700 dark:text-ink-100 truncate">
                    {e.name} {mine && <span className="text-xs text-moss-600 dark:text-moss-300">· {t.you}</span>}
                  </div>
                  <div className="text-xs text-ink-400 flex items-center gap-3">
                    <span>Lv {e.level}</span>
                    {e.streakDays > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Flame size={11} className="text-clay-400" /> {e.streakDays}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right font-bold text-ink-600 dark:text-ink-200">
                  {e.totalXp.toLocaleString()} <span className="text-xs font-medium text-ink-400">XP</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {entries && entries.length === 0 && !error && (
        <div className="paper-card p-8 text-center text-ink-400">{t.noRankYet}</div>
      )}
    </div>
  );
};

export default Leaderboard;
