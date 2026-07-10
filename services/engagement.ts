// ─── ENGAGEMENT / RETENTION LOGIC ─────────────────────────────────────────────
// Pure, framework-free helpers for the daily habit loop, streak protection, and
// achievements. Kept side-effect free so they are easy to reason about and test.

import { UserProfile, Achievement, AchievementStats, ProgressMap } from '../types';

export const DEFAULT_DAILY_GOAL = 30;
export const DEFAULT_STREAK_FREEZES = 2;
export const MASTERY_THRESHOLD = 80; // a topic counts as "mastered" at/above this

/** Local calendar day as YYYY-MM-DD (not UTC) so day rollover matches the user. */
export const localDayKey = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Whole-day difference between two YYYY-MM-DD keys (b - a). */
const dayDiff = (a: string, b: string): number => {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
};

/**
 * Zero out today's XP counter when the stored counter belongs to a previous day.
 * Returns a patch to merge onto the user (empty if nothing changed).
 */
export const rolloverDailyXp = (
  user: UserProfile,
  today: string = localDayKey()
): Partial<UserProfile> => {
  if (user.lastXpDate === today) return {};
  return { todayXp: 0, lastXpDate: today };
};

export interface StreakResult {
  streakDays: number;
  bestStreak: number;
  streakFreezes: number;
  freezeUsed: boolean;
}

/**
 * Recalculate the streak on a new day of activity. Extends the original
 * "yesterday → +1, gap → reset" rule with a freeze: a single missed day is
 * absorbed by a streak freeze (if available) instead of resetting to 1.
 */
export const calculateStreakWithFreeze = (
  user: UserProfile,
  today: string = localDayKey()
): StreakResult => {
  const current = user.streakDays ?? 0;
  const freezes = user.streakFreezes ?? DEFAULT_STREAK_FREEZES;
  const best = user.bestStreak ?? current;

  // No prior activity → start a fresh streak.
  if (!user.lastActivityDate) {
    return { streakDays: 1, bestStreak: Math.max(best, 1), streakFreezes: freezes, freezeUsed: false };
  }

  const lastKey = localDayKey(new Date(user.lastActivityDate));
  const gap = dayDiff(lastKey, today);

  if (gap <= 0) {
    // Same day — streak unchanged.
    return { streakDays: current, bestStreak: best, streakFreezes: freezes, freezeUsed: false };
  }
  if (gap === 1) {
    const next = current + 1;
    return { streakDays: next, bestStreak: Math.max(best, next), streakFreezes: freezes, freezeUsed: false };
  }
  if (gap === 2 && freezes > 0) {
    // Exactly one missed day — spend a freeze to keep the streak going.
    const next = current + 1;
    return { streakDays: next, bestStreak: Math.max(best, next), streakFreezes: freezes - 1, freezeUsed: true };
  }
  // Longer gap (or no freeze) — reset.
  return { streakDays: 1, bestStreak: best, streakFreezes: freezes, freezeUsed: false };
};

/** Build the stats snapshot achievement predicates run against. */
export const buildStats = (user: UserProfile): AchievementStats => {
  const map: ProgressMap = user.progressMap || {};
  let topicsMastered = 0;
  let topicsStarted = 0;
  for (const tp of Object.values(map)) {
    if ((tp.attemptsTotal ?? 0) > 0) topicsStarted++;
    if ((tp.mastery ?? 0) >= MASTERY_THRESHOLD) topicsMastered++;
  }
  return {
    totalXp: user.totalXp ?? 0,
    streakDays: user.streakDays ?? 0,
    bestStreak: user.bestStreak ?? user.streakDays ?? 0,
    topicsMastered,
    topicsStarted,
    dailyGoalsMet: user.dailyGoalsMet ?? 0,
  };
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ─── ACHIEVEMENT DEFINITIONS ──────────────────────────────────────────────────
// Copy is localized inline so adding a badge never touches the giant Translations
// interface. Order matters: the dashboard "next up" nudge picks the first locked
// achievement with the highest progress.

const t = (en: string, ru: string, he: string, ar: string) => ({ en, ru, he, ar });

const xpBadge = (id: string, n: number, icon: string, reward: number, title: ReturnType<typeof t>, desc: ReturnType<typeof t>): Achievement => ({
  id, category: 'xp', icon, xpReward: reward, title, description: desc,
  predicate: s => s.totalXp >= n,
  progress: s => clamp01(s.totalXp / n),
});

const streakBadge = (id: string, n: number, icon: string, reward: number, title: ReturnType<typeof t>, desc: ReturnType<typeof t>): Achievement => ({
  id, category: 'streak', icon, xpReward: reward, title, description: desc,
  predicate: s => s.bestStreak >= n,
  progress: s => clamp01(s.bestStreak / n),
});

const masteryBadge = (id: string, n: number, icon: string, reward: number, title: ReturnType<typeof t>, desc: ReturnType<typeof t>): Achievement => ({
  id, category: 'mastery', icon, xpReward: reward, title, description: desc,
  predicate: s => s.topicsMastered >= n,
  progress: s => clamp01(s.topicsMastered / n),
});

const goalBadge = (id: string, n: number, icon: string, reward: number, title: ReturnType<typeof t>, desc: ReturnType<typeof t>): Achievement => ({
  id, category: 'goal', icon, xpReward: reward, title, description: desc,
  predicate: s => s.dailyGoalsMet >= n,
  progress: s => clamp01(s.dailyGoalsMet / n),
});

export const ACHIEVEMENTS: Achievement[] = [
  // Milestone — first steps
  {
    id: 'first_steps', category: 'milestone', icon: 'Footprints', xpReward: 10,
    title: t('First Steps', 'Первые шаги', 'צעדים ראשונים', 'الخطوات الأولى'),
    description: t('Start your first topic', 'Начни свою первую тему', 'התחל את הנושא הראשון שלך', 'ابدأ موضوعك الأول'),
    predicate: s => s.topicsStarted >= 1,
    progress: s => clamp01(s.topicsStarted / 1),
  },
  // XP ladder
  xpBadge('xp_100', 100, 'Star', 20,
    t('Getting Started', 'Хорошее начало', 'מתחילים', 'انطلاقة'),
    t('Earn 100 XP', 'Заработай 100 XP', 'צבור 100 XP', 'اكسب 100 نقطة خبرة')),
  xpBadge('xp_1000', 1000, 'Sparkles', 50,
    t('Bright Spark', 'Яркая искра', 'ניצוץ זוהר', 'شرارة لامعة'),
    t('Earn 1,000 XP', 'Заработай 1 000 XP', 'צבור 1,000 XP', 'اكسب 1,000 نقطة خبرة')),
  xpBadge('xp_5000', 5000, 'Crown', 150,
    t('Scholar', 'Эрудит', 'מלומד', 'عالِم'),
    t('Earn 5,000 XP', 'Заработай 5 000 XP', 'צבור 5,000 XP', 'اكسب 5,000 نقطة خبرة')),
  // Streak ladder
  streakBadge('streak_3', 3, 'Flame', 25,
    t('Warming Up', 'Разогрев', 'מתחממים', 'تسخين'),
    t('Reach a 3-day streak', 'Достигни серии 3 дня', 'הגע לרצף של 3 ימים', 'حقق سلسلة 3 أيام')),
  streakBadge('streak_7', 7, 'Flame', 60,
    t('On Fire', 'В огне', 'בוערים', 'مشتعل'),
    t('Reach a 7-day streak', 'Достигни серии 7 дней', 'הגע לרצף של 7 ימים', 'حقق سلسلة 7 أيام')),
  streakBadge('streak_30', 30, 'Trophy', 250,
    t('Unstoppable', 'Неудержимый', 'בלתי ניתן לעצירה', 'لا يُوقَف'),
    t('Reach a 30-day streak', 'Достигни серии 30 дней', 'הגע לרצף של 30 ימים', 'حقق سلسلة 30 يومًا')),
  // Mastery ladder
  masteryBadge('master_1', 1, 'Target', 30,
    t('First Mastery', 'Первое мастерство', 'שליטה ראשונה', 'إتقان أول'),
    t('Master your first topic', 'Освой первую тему', 'שלוט בנושא הראשון', 'أتقن موضوعك الأول')),
  masteryBadge('master_5', 5, 'Award', 80,
    t('Topic Tamer', 'Покоритель тем', 'מאלף נושאים', 'مروّض المواضيع'),
    t('Master 5 topics', 'Освой 5 тем', 'שלוט ב-5 נושאים', 'أتقن 5 مواضيع')),
  masteryBadge('master_15', 15, 'Medal', 200,
    t('Expert', 'Эксперт', 'מומחה', 'خبير'),
    t('Master 15 topics', 'Освой 15 тем', 'שלוט ב-15 נושאים', 'أتقن 15 موضوعًا')),
  // Daily-goal ladder
  goalBadge('goal_1', 1, 'CircleCheck', 15,
    t('Goal Getter', 'Цель достигнута', 'משיג מטרות', 'محقق الأهداف'),
    t('Hit your daily goal once', 'Выполни дневную цель', 'השג את היעד היומי פעם אחת', 'حقق هدفك اليومي مرة')),
  goalBadge('goal_7', 7, 'CalendarCheck', 70,
    t('Consistent', 'Стабильность', 'עקבי', 'منتظم'),
    t('Hit your daily goal 7 times', 'Выполни дневную цель 7 раз', 'השג את היעד היומי 7 פעמים', 'حقق هدفك اليومي 7 مرات')),
];

export const ACHIEVEMENTS_BY_ID: Record<string, Achievement> =
  Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

/**
 * Compare the user's earned set against all predicates and return the ids that
 * are *newly* satisfied (not already in unlockedAchievements).
 */
export const evaluateAchievements = (user: UserProfile): string[] => {
  const stats = buildStats(user);
  const already = new Set(user.unlockedAchievements ?? []);
  return ACHIEVEMENTS.filter(a => !already.has(a.id) && a.predicate(stats)).map(a => a.id);
};

export interface XpGainResult {
  user: UserProfile;
  leveledUpTo: number | null;
  goalJustMet: boolean;
  newlyUnlocked: string[];
  bonusXp: number;
}

/**
 * Apply an XP gain to a user, folding in daily-goal tracking and achievement
 * unlocks (which can themselves award bonus XP). Pure: returns a new user plus
 * the celebration-worthy events that occurred. Callers handle the UI side.
 */
export const applyXpGain = (
  user: UserProfile,
  amount: number,
  today: string = localDayKey()
): XpGainResult => {
  const goal = user.dailyXpGoal ?? DEFAULT_DAILY_GOAL;
  const baseToday = user.lastXpDate === today ? (user.todayXp ?? 0) : 0;
  const prevLevel = Math.floor((user.totalXp ?? 0) / 1000) + 1;
  const alreadyMetToday = user.lastGoalMetDate === today;

  const todayXp = baseToday + amount;
  let dailyGoalsMet = user.dailyGoalsMet ?? 0;
  let lastGoalMetDate = user.lastGoalMetDate;
  let goalJustMet = false;
  if (!alreadyMetToday && todayXp >= goal) {
    goalJustMet = true;
    dailyGoalsMet += 1;
    lastGoalMetDate = today;
  }

  let candidate: UserProfile = {
    ...user,
    totalXp: (user.totalXp ?? 0) + amount,
    todayXp,
    lastXpDate: today,
    dailyGoalsMet,
    lastGoalMetDate,
  };

  const newlyUnlocked = evaluateAchievements(candidate);
  let bonusXp = 0;
  if (newlyUnlocked.length) {
    bonusXp = newlyUnlocked.reduce((sum, id) => sum + (ACHIEVEMENTS_BY_ID[id]?.xpReward ?? 0), 0);
    candidate = {
      ...candidate,
      unlockedAchievements: [...(candidate.unlockedAchievements ?? []), ...newlyUnlocked],
      totalXp: candidate.totalXp + bonusXp,
      todayXp: candidate.todayXp + bonusXp,
    };
  }

  const newLevel = Math.floor(candidate.totalXp / 1000) + 1;
  return {
    user: candidate,
    leveledUpTo: newLevel > prevLevel ? newLevel : null,
    goalJustMet,
    newlyUnlocked,
    bonusXp,
  };
};

/** The closest locked achievement, for the dashboard "next up" nudge. */
export const nextAchievement = (
  user: UserProfile
): { achievement: Achievement; progress: number } | null => {
  const stats = buildStats(user);
  const earned = new Set(user.unlockedAchievements ?? []);
  let best: { achievement: Achievement; progress: number } | null = null;
  for (const a of ACHIEVEMENTS) {
    if (earned.has(a.id)) continue;
    const p = a.progress(stats);
    if (!best || p > best.progress) best = { achievement: a, progress: p };
  }
  return best;
};
