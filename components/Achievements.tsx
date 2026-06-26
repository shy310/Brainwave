import React, { useMemo } from 'react';
import {
  Footprints, Star, Sparkles, Crown, Flame, Trophy, Target, Award, Medal,
  CircleCheck, CalendarCheck, Lock, LucideIcon
} from 'lucide-react';
import { UserProfile, Translations, Language } from '../types';
import { ACHIEVEMENTS, buildStats } from '../services/engagement';

const ICONS: Record<string, LucideIcon> = {
  Footprints, Star, Sparkles, Crown, Flame, Trophy, Target, Award, Medal,
  CircleCheck, CalendarCheck,
};

interface Props {
  user: UserProfile;
  translations: Translations;
  language: Language;
}

const Achievements: React.FC<Props> = ({ user, translations: t, language }) => {
  const stats = useMemo(() => buildStats(user), [user]);
  const earned = useMemo(() => new Set(user.unlockedAchievements ?? []), [user.unlockedAchievements]);
  const unlockedCount = ACHIEVEMENTS.filter(a => earned.has(a.id)).length;

  return (
    <div className="px-5 md:px-8 lg:px-12 py-6 md:py-10 max-w-[1100px] mx-auto">
      {/* Header */}
      <header className="fade-in mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <Award size={12} />
          {t.achievements}
        </div>
        <h1 className="font-display text-[36px] md:text-[52px] leading-[0.95] font-medium text-ink-700 dark:text-ink-100 tracking-tight">
          {t.achievements}
        </h1>
        <p className="mt-3 text-base md:text-lg text-ink-400 dark:text-ink-400 max-w-2xl">{t.achievementsDesc}</p>
        <div className="mt-4 text-sm font-semibold text-ink-500 dark:text-ink-300">
          {t.unlocked(unlockedCount, ACHIEVEMENTS.length)}
        </div>
        <div className="mt-2 h-2 max-w-sm bg-ink-100 dark:bg-ink-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-700"
            style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }}
          />
        </div>
      </header>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {ACHIEVEMENTS.map((a, i) => {
          const isUnlocked = earned.has(a.id);
          const Icon = ICONS[a.icon] ?? Trophy;
          const progress = Math.round(a.progress(stats) * 100);
          return (
            <div
              key={a.id}
              className={`paper-card p-5 flex flex-col items-center text-center fade-in stagger-${(i % 4) + 1} ${
                isUnlocked
                  ? 'bg-white dark:bg-ink-800 border-amber-200 dark:border-amber-900/40'
                  : 'bg-cream-50 dark:bg-ink-900 border-ink-100 dark:border-ink-700'
              }`}
            >
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 transition-transform ${
                  isUnlocked
                    ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-400/30 hover:scale-110'
                    : 'bg-ink-100 dark:bg-ink-700 text-ink-300 dark:text-ink-500'
                }`}
              >
                {isUnlocked ? <Icon size={30} /> : <Lock size={26} />}
              </div>
              <div className={`font-semibold text-sm ${isUnlocked ? 'text-ink-700 dark:text-ink-100' : 'text-ink-400 dark:text-ink-400'}`}>
                {a.title[language]}
              </div>
              <div className="text-xs text-ink-400 dark:text-ink-500 mt-1 leading-snug">{a.description[language]}</div>

              {isUnlocked ? (
                <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  <Sparkles size={11} /> +{a.xpReward} XP
                </div>
              ) : (
                <div className="mt-3 w-full">
                  <div className="h-1.5 bg-ink-100 dark:bg-ink-700 rounded-full overflow-hidden">
                    <div className="h-full bg-moss-400 dark:bg-moss-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="text-[10px] text-ink-300 dark:text-ink-500 mt-1 font-medium">{progress}%</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Achievements;
