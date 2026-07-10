import React, { useMemo, useState } from 'react';
import {
  Map as MapIcon, Flame, Clock, Lightbulb, MessageCircle, ChevronRight, X,
  Sprout, BookOpen, TrendingUp, ShieldCheck, Crown, AlarmClock, Play, Sparkles
} from 'lucide-react';
import { UserProfile, Translations, Language, Subject, SkillRecord, SkillStatus, MistakeKind, SkillMap } from '../types';
import { skillsByStatus, dueForReview, dominantMistake, averageConfidence, computeStatus } from '../services/masteryEngine';

interface Props {
  user: UserProfile;
  translations: Translations;
  language: Language;
  onPractice: (subject: Subject | undefined, topicId: string | null | undefined, skillTag: string) => void;
}

type MLangKey = 'en' | 'ru' | 'he' | 'ar';
const M_COPY: Record<MLangKey, {
  subtitle: string;
  statuses: Record<SkillStatus, string>;
  statusHints: Record<SkillStatus, string>;
  mistakes: Record<MistakeKind, string>;
  dueStrip: (n: number) => string;
  reviewNow: string;
  practiceSkill: string;
  empty: string; emptyDesc: string;
  accuracy: string; streakLbl: string; hintsLbl: string; avgTime: string;
  lastPracticed: string; nextReview: string; canExplain: string; confidenceLbl: string;
  commonMistake: string; formats: string; recentLbl: string; sessionsLbl: string;
  today: string; overdue: string; daysShort: string;
}> = {
  en: {
    subtitle: 'Every skill you practice, tracked from first try to true mastery. Mastery takes correct recall across several days and question formats — one lucky answer is never enough.',
    statuses: { new: 'New', learning: 'Learning', developing: 'Developing', secure: 'Secure', mastered: 'Mastered', needs_review: 'Needs review' },
    statusHints: {
      new: 'Not practiced yet', learning: 'First steps', developing: 'Getting there',
      secure: 'Solid across sessions', mastered: 'Recalled over time, in multiple formats', needs_review: 'Fading — review to keep it',
    },
    mistakes: { sign: 'Sign slips', magnitude: 'Decimal-place slips', arithmetic: 'Calculation slips', units: 'Unit mistakes', concept: 'Concept mix-ups', incomplete: 'Incomplete answers', recall: 'Recall gaps', other: 'Other mistakes' },
    dueStrip: (n) => n === 1 ? '1 skill is due for review' : `${n} skills are due for review`,
    reviewNow: 'Review now',
    practiceSkill: 'Practice this skill',
    empty: 'Your map starts blank.',
    emptyDesc: 'Answer questions in any subject and each skill you touch will appear here with its own mastery journey.',
    accuracy: 'Accuracy', streakLbl: 'Streak', hintsLbl: 'Hints used', avgTime: 'Avg time',
    lastPracticed: 'Last practiced', nextReview: 'Next review', canExplain: 'Can explain it',
    confidenceLbl: 'Confidence', commonMistake: 'Most common mistake', formats: 'Formats mastered',
    recentLbl: 'Recent answers', sessionsLbl: 'Days with success',
    today: 'today', overdue: 'overdue', daysShort: 'd',
  },
  ru: {
    subtitle: 'Каждый навык отслеживается от первой попытки до настоящего мастерства. Для него нужны верные ответы в разные дни и в разных форматах — одного удачного ответа мало.',
    statuses: { new: 'Новый', learning: 'Изучаю', developing: 'Развиваю', secure: 'Уверенно', mastered: 'Освоено', needs_review: 'Нужно повторить' },
    statusHints: {
      new: 'Ещё не изучал', learning: 'Первые шаги', developing: 'Почти получается',
      secure: 'Стабильно в разных сессиях', mastered: 'Помнишь со временем и в разных форматах', needs_review: 'Забывается — повтори',
    },
    mistakes: { sign: 'Ошибки знака', magnitude: 'Ошибки в разрядах', arithmetic: 'Ошибки счёта', units: 'Ошибки в единицах', concept: 'Путаница понятий', incomplete: 'Неполные ответы', recall: 'Провалы памяти', other: 'Другие ошибки' },
    dueStrip: (n) => `Навыков к повторению: ${n}`,
    reviewNow: 'Повторить',
    practiceSkill: 'Тренировать навык',
    empty: 'Карта пока пуста.',
    emptyDesc: 'Отвечай на вопросы по любому предмету — каждый навык появится здесь со своей историей освоения.',
    accuracy: 'Точность', streakLbl: 'Серия', hintsLbl: 'Подсказок', avgTime: 'Ср. время',
    lastPracticed: 'Последняя практика', nextReview: 'Следующее повторение', canExplain: 'Может объяснить',
    confidenceLbl: 'Уверенность', commonMistake: 'Частая ошибка', formats: 'Форматы',
    recentLbl: 'Недавние ответы', sessionsLbl: 'Успешных дней',
    today: 'сегодня', overdue: 'просрочено', daysShort: 'д',
  },
  he: {
    subtitle: 'כל מיומנות שתתרגל נמדדת מהניסיון הראשון ועד שליטה אמיתית. שליטה דורשת היזכרות נכונה לאורך כמה ימים ובפורמטים שונים — תשובה אחת נכונה לא מספיקה.',
    statuses: { new: 'חדש', learning: 'לומד', developing: 'מתפתח', secure: 'יציב', mastered: 'נשלט', needs_review: 'דורש חזרה' },
    statusHints: {
      new: 'טרם תורגל', learning: 'צעדים ראשונים', developing: 'מתקדם יפה',
      secure: 'יציב לאורך מפגשים', mastered: 'נזכר לאורך זמן ובכמה פורמטים', needs_review: 'מתחיל להישכח — חזור עליו',
    },
    mistakes: { sign: 'שגיאות סימן', magnitude: 'שגיאות עשרוניות', arithmetic: 'שגיאות חישוב', units: 'שגיאות יחידות', concept: 'בלבול מושגים', incomplete: 'תשובות חלקיות', recall: 'פערי זיכרון', other: 'שגיאות אחרות' },
    dueStrip: (n) => `${n} מיומנויות ממתינות לחזרה`,
    reviewNow: 'חזור עכשיו',
    practiceSkill: 'תרגל מיומנות זו',
    empty: 'המפה עוד ריקה.',
    emptyDesc: 'ענה על שאלות בכל מקצוע — כל מיומנות שתיגע בה תופיע כאן עם מסע השליטה שלה.',
    accuracy: 'דיוק', streakLbl: 'רצף', hintsLbl: 'רמזים', avgTime: 'זמן ממוצע',
    lastPracticed: 'תרגול אחרון', nextReview: 'חזרה הבאה', canExplain: 'יודע להסביר',
    confidenceLbl: 'ביטחון', commonMistake: 'הטעות הנפוצה', formats: 'פורמטים',
    recentLbl: 'תשובות אחרונות', sessionsLbl: 'ימי הצלחה',
    today: 'היום', overdue: 'באיחור', daysShort: 'י',
  },
  ar: {
    subtitle: 'كل مهارة تتدرب عليها تُتتبع من أول محاولة حتى الإتقان الحقيقي. الإتقان يتطلب تذكراً صحيحاً عبر عدة أيام وصيغ أسئلة مختلفة — إجابة محظوظة واحدة لا تكفي.',
    statuses: { new: 'جديد', learning: 'أتعلم', developing: 'أتطور', secure: 'ثابت', mastered: 'مُتقن', needs_review: 'يحتاج مراجعة' },
    statusHints: {
      new: 'لم يُتدرب بعد', learning: 'خطوات أولى', developing: 'في الطريق',
      secure: 'ثابت عبر الجلسات', mastered: 'تذكرته مع الوقت وبصيغ متعددة', needs_review: 'يتلاشى — راجعه لتحافظ عليه',
    },
    mistakes: { sign: 'أخطاء الإشارة', magnitude: 'أخطاء المنازل العشرية', arithmetic: 'أخطاء حسابية', units: 'أخطاء الوحدات', concept: 'خلط المفاهيم', incomplete: 'إجابات ناقصة', recall: 'فجوات التذكر', other: 'أخطاء أخرى' },
    dueStrip: (n) => `${n} مهارات تنتظر المراجعة`,
    reviewNow: 'راجع الآن',
    practiceSkill: 'تدرب على هذه المهارة',
    empty: 'خريطتك تبدأ فارغة.',
    emptyDesc: 'أجب عن الأسئلة في أي مادة وستظهر هنا كل مهارة تلمسها مع رحلة إتقانها.',
    accuracy: 'الدقة', streakLbl: 'السلسلة', hintsLbl: 'تلميحات', avgTime: 'متوسط الوقت',
    lastPracticed: 'آخر تدريب', nextReview: 'المراجعة القادمة', canExplain: 'يستطيع الشرح',
    confidenceLbl: 'الثقة', commonMistake: 'الخطأ الأكثر شيوعاً', formats: 'الصيغ',
    recentLbl: 'إجابات حديثة', sessionsLbl: 'أيام النجاح',
    today: 'اليوم', overdue: 'متأخر', daysShort: 'ي',
  },
};

const STATUS_ORDER: SkillStatus[] = ['needs_review', 'mastered', 'secure', 'developing', 'learning', 'new'];

const STATUS_STYLE: Record<SkillStatus, { dot: string; chip: string; ring: string; icon: React.ReactNode }> = {
  new:          { dot: 'bg-ink-200 dark:bg-ink-600',   chip: 'bg-ink-50 text-ink-500 dark:bg-ink-800 dark:text-ink-300',                 ring: 'text-ink-200 dark:text-ink-600', icon: <Sprout size={13} /> },
  learning:     { dot: 'bg-sky-400',                    chip: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',              ring: 'text-sky-400',  icon: <BookOpen size={13} /> },
  developing:   { dot: 'bg-amber-400',                  chip: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',      ring: 'text-amber-400', icon: <TrendingUp size={13} /> },
  secure:       { dot: 'bg-moss-400',                   chip: 'bg-moss-50 text-moss-700 dark:bg-moss-light/30 dark:text-moss-300',        ring: 'text-moss-400',  icon: <ShieldCheck size={13} /> },
  mastered:     { dot: 'bg-gradient-to-r from-amber-400 to-orange-500', chip: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', ring: 'text-orange-400', icon: <Crown size={13} /> },
  needs_review: { dot: 'bg-clay-400',                   chip: 'bg-clay-50 text-clay-500 dark:bg-clay-light/40 dark:text-clay-300',        ring: 'text-clay-400',  icon: <AlarmClock size={13} /> },
};

const MasteryRing: React.FC<{ value: number; status: SkillStatus }> = ({ value, status }) => {
  const size = 46, stroke = 4.5, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-ink-100 dark:text-ink-700" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.min(1, value / 100))}
          className={STATUS_STYLE[status].ring}
          style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-ink-600 dark:text-ink-200 tabular-nums">
        {value}
      </div>
    </div>
  );
};

const daysAgo = (iso: string): number =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

const MasteryMap: React.FC<Props> = ({ user, translations: t, language, onPractice }) => {
  const c = M_COPY[(M_COPY[language as MLangKey] ? language : 'en') as MLangKey];
  const [selected, setSelected] = useState<SkillRecord | null>(null);

  const map: SkillMap = user.skillMap ?? {};
  const grouped = useMemo(() => skillsByStatus(map), [map]);
  const due = useMemo(() => dueForReview(map), [map]);
  const totalSkills = Object.keys(map).length;

  // Group skills by subject for the grid
  const bySubject = useMemo(() => {
    const out = new Map<string, SkillRecord[]>();
    for (const r of Object.values(map)) {
      const key = r.subject ? (t.subjectsList[r.subject] ?? String(r.subject)) : '—';
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(r);
    }
    for (const list of out.values()) {
      list.sort((a, b) => STATUS_ORDER.indexOf(computeStatus(a)) - STATUS_ORDER.indexOf(computeStatus(b)));
    }
    return [...out.entries()];
  }, [map, t]);

  return (
    <div className="px-5 md:px-8 lg:px-12 py-6 md:py-10 max-w-[1100px] mx-auto">
      {/* Header */}
      <header className="fade-in mb-7">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-moss-100 dark:bg-moss-light/30 text-moss-700 dark:text-moss-300 text-xs font-semibold uppercase tracking-wider mb-3">
          <MapIcon size={12} />
          {t.masteryMap}
        </div>
        <h1 className="font-display text-[36px] md:text-[52px] leading-[0.95] font-medium text-ink-700 dark:text-ink-100 tracking-tight">
          {t.masteryMap}
        </h1>
        <p className="mt-3 text-base md:text-lg text-ink-400 dark:text-ink-400 max-w-2xl leading-relaxed">{c.subtitle}</p>
      </header>

      {/* Status summary chips (legend + live counts) */}
      <div className="flex flex-wrap gap-2 mb-6 fade-in stagger-1">
        {STATUS_ORDER.map(st => (
          <div key={st} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${STATUS_STYLE[st].chip}`} title={c.statusHints[st]}>
            {STATUS_STYLE[st].icon}
            {c.statuses[st]}
            <span className="tabular-nums opacity-70">{grouped[st].length}</span>
          </div>
        ))}
      </div>

      {/* Due-for-review strip */}
      {due.length > 0 && (
        <div className="mb-8 paper-card p-4 md:p-5 bg-clay-50 dark:bg-clay-light/20 border-clay-100 dark:border-clay-light/40 flex flex-col sm:flex-row sm:items-center gap-3 fade-in stagger-1">
          <div className="w-10 h-10 rounded-xl bg-clay-400 text-white flex items-center justify-center shrink-0">
            <AlarmClock size={19} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-ink-700 dark:text-ink-100">{c.dueStrip(due.length)}</div>
            <div className="text-xs text-ink-400 truncate">{due.slice(0, 4).map(r => r.skillTag).join(' · ')}</div>
          </div>
          <button
            onClick={() => onPractice(due[0].subject, due[0].topicId, due[0].skillTag)}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-clay-400 hover:bg-clay-500 text-white rounded-xl font-semibold text-sm transition-colors min-h-[44px]"
          >
            <Play size={15} /> {c.reviewNow}
          </button>
        </div>
      )}

      {/* Empty state */}
      {totalSkills === 0 && (
        <div className="paper-card p-10 text-center fade-in stagger-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-moss-50 dark:bg-moss-light/20 text-moss-500 flex items-center justify-center mb-4">
            <Sparkles size={28} />
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100">{c.empty}</h2>
          <p className="mt-2 text-ink-400 max-w-md mx-auto">{c.emptyDesc}</p>
        </div>
      )}

      {/* Skill grid, grouped by subject */}
      {bySubject.map(([subjectLabel, skills], gi) => (
        <section key={subjectLabel} className={`mb-8 fade-in stagger-${(gi % 3) + 1}`}>
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-300 dark:text-ink-500 mb-3">{subjectLabel}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {skills.map(r => {
              const st = computeStatus(r);
              const mk = dominantMistake(r);
              return (
                <button
                  key={r.skillTag}
                  onClick={() => setSelected(r)}
                  className="paper-card p-4 text-start bg-white dark:bg-ink-800 border-ink-100 dark:border-ink-700 hover:border-moss-300 dark:hover:border-moss-600 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <MasteryRing value={r.masteryScore} status={st} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink-700 dark:text-ink-100 truncate capitalize">{r.skillTag}</div>
                      <div className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[st].chip}`}>
                        {STATUS_STYLE[st].icon} {c.statuses[st]}
                      </div>
                    </div>
                    <ChevronRight size={15} className="text-ink-200 dark:text-ink-600 group-hover:text-moss-400 transition-colors shrink-0 rtl:rotate-180" />
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-400 flex-wrap">
                    {r.streak > 1 && <span className="inline-flex items-center gap-1"><Flame size={11} className="text-clay-400" />{r.streak}</span>}
                    <span>{r.attemptsCorrect}/{r.attemptsTotal}</span>
                    {r.canExplain && <span className="inline-flex items-center gap-1 text-moss-500"><MessageCircle size={11} />{c.canExplain}</span>}
                    {mk && <span className="truncate">{c.mistakes[mk]}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {/* Skill detail overlay */}
      {selected && (() => {
        const r = selected;
        const st = computeStatus(r);
        const mk = dominantMistake(r);
        const conf = averageConfidence(r);
        const reviewDays = r.reviewDue ? Math.ceil((new Date(r.reviewDue).getTime() - Date.now()) / 86_400_000) : null;
        const accuracy = r.attemptsTotal > 0 ? Math.round((r.attemptsCorrect / r.attemptsTotal) * 100) : 0;
        return (
          <>
            <div className="fixed inset-0 z-40 bg-ink-900/50" onClick={() => setSelected(null)} aria-hidden="true" />
            <div className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:end-6 sm:bottom-6 sm:w-[420px] max-h-[80dvh] overflow-y-auto z-50 bg-white dark:bg-ink-800 rounded-3xl border border-ink-100 dark:border-ink-700 shadow-lift p-6 animate-slide-up">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-semibold text-ink-700 dark:text-ink-100 capitalize break-words">{r.skillTag}</h3>
                  <div className={`mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[st].chip}`}>
                    {STATUS_STYLE[st].icon} {c.statuses[st]}
                  </div>
                  <p className="mt-1.5 text-xs text-ink-400">{c.statusHints[st]}</p>
                </div>
                <button onClick={() => setSelected(null)} className="p-2 min-w-[40px] min-h-[40px] rounded-lg text-ink-400 hover:bg-cream-100 dark:hover:bg-ink-700 shrink-0" aria-label="Close">
                  <X size={18} />
                </button>
              </div>

              {/* Stat grid */}
              <div className="grid grid-cols-2 gap-2.5 text-sm">
                <div className="bg-cream-50 dark:bg-ink-900/40 rounded-xl p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{c.accuracy}</div>
                  <div className="font-bold text-ink-700 dark:text-ink-100 tabular-nums">{accuracy}% <span className="font-medium text-ink-400 text-xs">({r.attemptsCorrect}/{r.attemptsTotal})</span></div>
                </div>
                <div className="bg-cream-50 dark:bg-ink-900/40 rounded-xl p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{c.streakLbl}</div>
                  <div className="font-bold text-ink-700 dark:text-ink-100 tabular-nums inline-flex items-center gap-1">
                    <Flame size={13} className="text-clay-400" />{r.streak}
                  </div>
                </div>
                <div className="bg-cream-50 dark:bg-ink-900/40 rounded-xl p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 inline-flex items-center gap-1"><Lightbulb size={10} />{c.hintsLbl}</div>
                  <div className="font-bold text-ink-700 dark:text-ink-100 tabular-nums">{r.hintsTotal}</div>
                </div>
                <div className="bg-cream-50 dark:bg-ink-900/40 rounded-xl p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 inline-flex items-center gap-1"><Clock size={10} />{c.avgTime}</div>
                  <div className="font-bold text-ink-700 dark:text-ink-100 tabular-nums">{r.avgTimeMs ? `${Math.round(r.avgTimeMs / 1000)}s` : '—'}</div>
                </div>
                <div className="bg-cream-50 dark:bg-ink-900/40 rounded-xl p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{c.sessionsLbl}</div>
                  <div className="font-bold text-ink-700 dark:text-ink-100 tabular-nums">{r.successDays.length}</div>
                </div>
                <div className="bg-cream-50 dark:bg-ink-900/40 rounded-xl p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{c.confidenceLbl}</div>
                  <div className="font-bold text-ink-700 dark:text-ink-100">{conf === null ? '—' : ['🎲', '🤔', '💪'][Math.round(conf) - 1] ?? '—'}</div>
                </div>
              </div>

              {/* Timeline facts */}
              <div className="mt-3 space-y-1.5 text-xs text-ink-400">
                {r.lastPracticed && (
                  <div>{c.lastPracticed}: <span className="font-semibold text-ink-600 dark:text-ink-200">{daysAgo(r.lastPracticed) === 0 ? c.today : `${daysAgo(r.lastPracticed)}${c.daysShort}`}</span></div>
                )}
                {reviewDays !== null && (
                  <div>{c.nextReview}: <span className={`font-semibold ${reviewDays <= 0 ? 'text-clay-500' : 'text-ink-600 dark:text-ink-200'}`}>
                    {reviewDays <= 0 ? c.overdue : `${reviewDays}${c.daysShort}`}
                  </span></div>
                )}
                {r.canExplain && (
                  <div className="inline-flex items-center gap-1 text-moss-600 dark:text-moss-400 font-semibold"><MessageCircle size={12} /> {c.canExplain}</div>
                )}
              </div>

              {/* Mistake profile */}
              {r.mistakesTotal > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-2">{c.commonMistake}</div>
                  <div className="space-y-1.5">
                    {(Object.entries(r.mistakeCounts) as [MistakeKind, number][]).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 3).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 text-xs">
                        <div className="flex-1 h-2 bg-cream-100 dark:bg-ink-700 rounded-full overflow-hidden">
                          <div className="h-full bg-clay-300 rounded-full" style={{ width: `${((v ?? 0) / r.mistakesTotal) * 100}%` }} />
                        </div>
                        <span className="w-32 truncate text-ink-500 dark:text-ink-300">{c.mistakes[k as MistakeKind]}</span>
                        <span className="tabular-nums text-ink-400">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent answers dots */}
              {r.recent.length > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-2">{c.recentLbl}</div>
                  <div className="flex items-center gap-1.5">
                    {r.recent.map((a, i) => (
                      <div key={i} title={a.questionType} className={`w-3.5 h-3.5 rounded-full ${a.correct ? 'bg-moss-400' : 'bg-clay-300'}`} />
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => { onPractice(r.subject, r.topicId, r.skillTag); setSelected(null); }}
                className="mt-5 w-full py-3.5 bg-moss-500 hover:bg-moss-600 text-white rounded-2xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 min-h-[50px]"
              >
                <Play size={16} /> {c.practiceSkill}
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
};

export default MasteryMap;
