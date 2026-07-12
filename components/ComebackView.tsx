import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  UserProfile, GradeLevel, Language, Translations, Exercise,
  SkillAttemptEvent, QuestionType, ErrorQuest,
} from '../types';
import { generateComebackQuestions } from '../services/aiService';
import {
  selectComebackSkills, buildComebackSummary, ComebackOutcome, ComebackReason,
} from '../services/comebackEngine';
import { recordAttempt } from '../services/masteryEngine';
import { findQuestCandidates, buildQuest, MAX_ACTIVE_QUESTS } from '../services/questEngine';
import { checkAnswer } from '../services/mathEngine';
import {
  ArrowLeft, Clock, Brain, Sparkles, CheckCircle, XCircle, ChevronRight,
  RotateCcw, Trophy, TrendingUp, CalendarClock, Wrench, Leaf, Zap,
} from 'lucide-react';
import Logo from './Logo';
import MathText from './MathText';
import Confetti from './Confetti';

interface Props {
  user: UserProfile;
  grade: GradeLevel;
  language: Language;
  translations: Translations;
  /** Record each answered question into the Mastery Map immediately. */
  onSkillEvent: (ev: SkillAttemptEvent) => void;
  /** Skip for today (still counts as "offered", so it won't nag again today). */
  onSkip: () => void;
  /** Finished: award XP + store the asked questions so they aren't repeated. */
  onFinish: (xpEarned: number, askedQuestions: string[]) => void;
  /** Jump straight into a repair quest the comeback surfaced. */
  onStartQuest?: (quest: ErrorQuest) => void;
  onBack: () => void;
}

const TARGET_SECONDS = 120;
const XP_PER_CORRECT = 6;
const XP_COMPLETION_BONUS = 10;

type CLang = 'en' | 'ru' | 'he' | 'ar';
const clang = (l: string): CLang => (['en', 'ru', 'he', 'ar'].includes(l) ? l as CLang : 'en');

const COPY: Record<CLang, {
  title: string; tagline: string; why: string; start: string; skip: string;
  building: string; couldNot: string; retry: string;
  questionOf: (a: number, b: number) => string; noRush: string;
  check: string; next: string; finish: string; correct: string; notQuite: string;
  yourAnswer: string;
  doneTitle: string; doneSub: (n: number, total: number) => string;
  remembered: string; stronger: string; nextReview: string; questMade: string;
  startQuest: string; backHome: string; nothing: string; keepsMemory: string;
  reasons: Record<ComebackReason, string>;
  reviewWhen: (rel: string) => string; inDays: (n: number) => string; tomorrow: string; today: string;
}> = {
  en: {
    title: 'Two-Minute Comeback', tagline: 'A quick warm-up to keep what you learned from slipping away.',
    why: 'A couple of minutes of recall now is one of the strongest things you can do for long-term memory. Totally optional — but it really helps things stick.',
    start: 'Start comeback', skip: 'Maybe later',
    building: 'Picking your review questions', couldNot: 'Could not build your comeback right now.', retry: 'Try again',
    questionOf: (a, b) => `Question ${a} of ${b}`, noRush: 'No rush 🌿',
    check: 'Check', next: 'Next', finish: 'See summary', correct: 'Remembered it!', notQuite: 'Not quite — now you know',
    yourAnswer: 'Type your answer',
    doneTitle: 'Comeback complete', doneSub: (n, total) => `You recalled ${n} of ${total} — but here's what actually moved:`,
    remembered: 'Remembered successfully', stronger: 'Getting stronger', nextReview: 'Coming back for you', questMade: 'A repair quest is ready',
    startQuest: 'Open repair quest', backHome: 'Back to dashboard', nothing: 'Nothing to review yet — do a few exercises first!',
    keepsMemory: 'Completing this helps long-term memory',
    reasons: { review: 'Spaced review', struggled: 'Worth another look', recent: 'Recently learned', week: 'From last week', older: 'From a while back', mastered: 'Keeping it sharp' },
    reviewWhen: (rel) => `We'll bring this one back ${rel} to make sure it stuck.`, inDays: (n) => `in ${n} days`, tomorrow: 'tomorrow', today: 'soon',
  },
  ru: {
    title: 'Двухминутное возвращение', tagline: 'Быстрая разминка, чтобы выученное не забылось.',
    why: 'Пара минут припоминания сейчас — одно из лучших вложений в долгую память. Совсем не обязательно, но очень помогает закрепить.',
    start: 'Начать', skip: 'Позже',
    building: 'Подбираем вопросы для повторения', couldNot: 'Не удалось собрать возвращение сейчас.', retry: 'Ещё раз',
    questionOf: (a, b) => `Вопрос ${a} из ${b}`, noRush: 'Не спеши 🌿',
    check: 'Проверить', next: 'Дальше', finish: 'Итог', correct: 'Вспомнил(а)!', notQuite: 'Почти — теперь знаешь',
    yourAnswer: 'Введите ответ',
    doneTitle: 'Возвращение завершено', doneSub: (n, total) => `Вспомнил(а) ${n} из ${total} — но вот что реально изменилось:`,
    remembered: 'Успешно вспомнил(а)', stronger: 'Становится крепче', nextReview: 'Вернём для тебя', questMade: 'Готова миссия по починке',
    startQuest: 'Открыть миссию', backHome: 'На главную', nothing: 'Пока нечего повторять — сначала выполни несколько заданий!',
    keepsMemory: 'Это помогает долговременной памяти',
    reasons: { review: 'Интервальное повторение', struggled: 'Стоит взглянуть ещё раз', recent: 'Недавно выучено', week: 'С прошлой недели', older: 'Давнее', mastered: 'Держим в форме' },
    reviewWhen: (rel) => `Вернём это ${rel}, чтобы проверить, что закрепилось.`, inDays: (n) => `через ${n} дн.`, tomorrow: 'завтра', today: 'скоро',
  },
  he: {
    title: 'קאמבק של שתי דקות', tagline: 'חימום קצר כדי שמה שלמדת לא ייעלם.',
    why: 'כמה דקות של היזכרות עכשיו הן מהדברים החזקים ביותר לזיכרון לטווח ארוך. לגמרי אופציונלי — אבל זה ממש עוזר להטמיע.',
    start: 'להתחיל', skip: 'אולי אחר כך',
    building: 'בוחרים לך שאלות חזרה', couldNot: 'לא הצלחנו לבנות את הקאמבק כרגע.', retry: 'לנסות שוב',
    questionOf: (a, b) => `שאלה ${a} מתוך ${b}`, noRush: 'בלי לחץ 🌿',
    check: 'בדיקה', next: 'הבא', finish: 'לסיכום', correct: 'נזכרת!', notQuite: 'כמעט — עכשיו אתה יודע',
    yourAnswer: 'כתוב את התשובה',
    doneTitle: 'הקאמבק הושלם', doneSub: (n, total) => `נזכרת ב-${n} מתוך ${total} — אבל הנה מה שבאמת התקדם:`,
    remembered: 'נזכרת בהצלחה', stronger: 'מתחזק', nextReview: 'נחזיר עבורך', questMade: 'משימת תיקון מוכנה',
    startQuest: 'לפתוח משימה', backHome: 'חזרה ללוח', nothing: 'עוד אין מה לחזור עליו — פתור כמה תרגילים קודם!',
    keepsMemory: 'השלמת הקאמבק עוזרת לזיכרון לטווח ארוך',
    reasons: { review: 'חזרה מרווחת', struggled: 'שווה מבט נוסף', recent: 'נלמד לאחרונה', week: 'מהשבוע שעבר', older: 'מלפני זמן מה', mastered: 'שומרים על חדות' },
    reviewWhen: (rel) => `נחזיר את זה ${rel} כדי לוודא שנקלט.`, inDays: (n) => `בעוד ${n} ימים`, tomorrow: 'מחר', today: 'בקרוב',
  },
  ar: {
    title: 'عودة في دقيقتين', tagline: 'إحماء سريع كي لا يتلاشى ما تعلمته.',
    why: 'دقيقتان من الاستذكار الآن من أقوى ما تفعله لذاكرتك بعيدة المدى. اختياري تماماً — لكنه يساعد كثيراً على الترسيخ.',
    start: 'ابدأ', skip: 'ربما لاحقاً',
    building: 'نختار لك أسئلة المراجعة', couldNot: 'تعذر بناء العودة الآن.', retry: 'حاول ثانية',
    questionOf: (a, b) => `السؤال ${a} من ${b}`, noRush: 'على مهلك 🌿',
    check: 'تحقق', next: 'التالي', finish: 'الملخص', correct: 'تذكرتها!', notQuite: 'تقريباً — الآن عرفت',
    yourAnswer: 'اكتب إجابتك',
    doneTitle: 'اكتملت العودة', doneSub: (n, total) => `تذكرت ${n} من ${total} — لكن إليك ما تقدم فعلاً:`,
    remembered: 'تذكرتها بنجاح', stronger: 'يزداد قوة', nextReview: 'سنعيدها لك', questMade: 'مهمة إصلاح جاهزة',
    startQuest: 'افتح المهمة', backHome: 'إلى اللوحة', nothing: 'لا شيء للمراجعة بعد — حل بعض التمارين أولاً!',
    keepsMemory: 'إكمالها يساعد الذاكرة بعيدة المدى',
    reasons: { review: 'مراجعة متباعدة', struggled: 'تستحق نظرة أخرى', recent: 'تعلمتها حديثاً', week: 'من الأسبوع الماضي', older: 'من فترة', mastered: 'نحافظ على حدتها' },
    reviewWhen: (rel) => `سنعيدها ${rel} للتأكد من رسوخها.`, inDays: (n) => `خلال ${n} أيام`, tomorrow: 'غداً', today: 'قريباً',
  },
};

const REASON_STYLE: Record<ComebackReason, string> = {
  review: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  struggled: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  recent: 'bg-moss-100 text-moss-700 dark:bg-moss-light/30 dark:text-moss-300',
  week: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  older: 'bg-clay-100 text-clay-700 dark:bg-clay-900/30 dark:text-clay-300',
  mastered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

const fmtTime = (s: number): string => {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

type Phase = 'intro' | 'loading' | 'playing' | 'summary' | 'error' | 'empty';

const ComebackView: React.FC<Props> = ({
  user, grade, language, translations, onSkillEvent, onSkip, onFinish, onStartQuest, onBack,
}) => {
  const c = COPY[clang(language)];

  // Snapshot the map + selections once so the summary can diff before/after.
  const beforeMap = useMemo(() => user.skillMap ?? {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const selections = useMemo(() => selectComebackSkills(beforeMap), [beforeMap]);
  const reasonBySkill = useMemo(() => {
    const m = new Map<string, ComebackReason>();
    selections.forEach(s => m.set(s.skillTag.trim().toLowerCase(), s.reason));
    return m;
  }, [selections]);

  const [phase, setPhase] = useState<Phase>(selections.length ? 'intro' : 'empty');
  const [questions, setQuestions] = useState<Exercise[]>([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null); // option id
  const [typed, setTyped] = useState('');
  const [answered, setAnswered] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const outcomesRef = useRef<ComebackOutcome[]>([]);
  const afterMapRef = useRef(beforeMap);
  const qStartRef = useRef(Date.now());
  const finishedRef = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  // Gentle timer — counts up while playing; never blocks or ends the activity.
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    qStartRef.current = Date.now();
  }, [idx, phase]);

  const begin = async () => {
    setPhase('loading');
    for (let attempt = 0; attempt < 2; attempt++) {
      const qs = await generateComebackQuestions(selections, grade, language, user.comebackHistory ?? []);
      if (qs.length) {
        setQuestions(qs);
        setPhase('playing');
        setElapsed(0);
        return;
      }
    }
    setPhase('error');
  };

  const q = questions[idx];
  const total = questions.length;
  const remaining = Math.max(0, TARGET_SECONDS - elapsed);

  const submit = () => {
    if (!q || answered) return;
    let correct = false;
    if (q.questionType === QuestionType.NUMERIC) {
      if (!typed.trim()) return;
      const expected = q.answerExpression || q.sampleAnswer || '';
      correct = checkAnswer(typed, expected, q.acceptableAnswers ?? [], {
        unitRequired: q.unitRequired, tolerance: q.tolerance, roundTo: q.roundTo,
      }).correct;
    } else {
      if (!chosen) return;
      correct = chosen === q.correctOptionId;
    }
    setWasCorrect(correct);
    setAnswered(true);
    if (correct) setConfetti(n => n + 1);

    const ev: SkillAttemptEvent = {
      skillTag: q.skillTag || 'general',
      topicId: q.topicId ?? null,
      correct,
      questionType: q.questionType,
      difficulty: q.difficulty,
      timeMs: Math.max(0, Date.now() - qStartRef.current),
      hintsUsed: 0,
      mistakeKind: correct ? undefined : 'recall',
      // An open numeric answer typed correctly is genuine recall (produced, not recognized).
      explainEvidence: correct && q.questionType === QuestionType.NUMERIC,
    };
    onSkillEvent(ev);                                   // persist to the real Mastery Map
    afterMapRef.current = recordAttempt(afterMapRef.current, ev); // local mirror for the summary
    outcomesRef.current.push({
      selection: {
        skillTag: q.skillTag || 'general',
        topicId: q.topicId ?? null,
        record: afterMapRef.current[(q.skillTag || 'general').toLowerCase()],
        reason: reasonBySkill.get((q.skillTag || 'general').trim().toLowerCase()) ?? 'review',
      },
      correct,
    });
  };

  const next = () => {
    if (idx + 1 >= total) {
      finish();
    } else {
      setIdx(i => i + 1);
      setChosen(null);
      setTyped('');
      setAnswered(false);
      setWasCorrect(false);
    }
  };

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setConfetti(n => n + 1);
    const correctCount = outcomesRef.current.filter(o => o.correct).length;
    const xp = correctCount * XP_PER_CORRECT + XP_COMPLETION_BONUS;
    onFinish(xp, questions.map(qq => qq.question));
    setPhase('summary');
  };

  // ── Summary data (diff before vs after) ──────────────────────────────────────
  const summary = useMemo(
    () => phase === 'summary' ? buildComebackSummary(outcomesRef.current, beforeMap, afterMapRef.current) : null,
    [phase, beforeMap],
  );

  // A recurring mistake made during the comeback may have surfaced a repair quest.
  const newQuest = useMemo(() => {
    if (phase !== 'summary') return null;
    const active = (user.activeQuests ?? []).filter(qq => !qq.completedAt);
    if (active.length >= MAX_ACTIVE_QUESTS) return null;
    const beforeKeys = new Set(
      findQuestCandidates(beforeMap, active, user.completedQuests ?? []).map(x => `${x.skillTag}::${x.mistakeKind}`)
    );
    const fresh = findQuestCandidates(afterMapRef.current, active, user.completedQuests ?? [])
      .find(x => !beforeKeys.has(`${x.skillTag}::${x.mistakeKind}`));
    return fresh ? buildQuest(fresh, language) : null;
  }, [phase, beforeMap, language]); // eslint-disable-line react-hooks/exhaustive-deps

  const relReview = (iso: string): string => {
    const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
    if (days <= 0) return c.today;
    if (days === 1) return c.tomorrow;
    return c.inDays(days);
  };

  // ── Intro ────────────────────────────────────────────────────────────────────
  if (phase === 'intro' || phase === 'empty') {
    return (
      <div className="max-w-xl mx-auto px-4 md:px-6 py-10 view-enter" ref={topRef}>
        <div className="paper-card p-7 md:p-9 bg-white dark:bg-ink-800 border-ink-100 dark:border-ink-700 text-center">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-sky-400 to-moss-500 text-white flex items-center justify-center shadow-moss mb-5 animate-pop">
            <Brain size={30} />
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-ink-700 dark:text-ink-100">{c.title}</h1>
          {phase === 'empty' ? (
            <p className="mt-3 text-ink-400">{c.nothing}</p>
          ) : (
            <>
              <p className="mt-2 text-ink-500 dark:text-ink-300">{c.tagline}</p>
              <div className="mt-5 flex items-center justify-center gap-4 text-sm text-ink-400">
                <span className="inline-flex items-center gap-1.5"><Clock size={15} /> ~2 min</span>
                <span className="inline-flex items-center gap-1.5"><Sparkles size={15} className="text-moss-500" /> {total || selections.length} {translations.questions.toLowerCase()}</span>
              </div>
              <div className="mt-5 p-4 rounded-xl bg-moss-50 dark:bg-moss-light/15 border border-moss-100 dark:border-moss-light/30 text-sm text-ink-600 dark:text-ink-300 text-start flex gap-3">
                <Leaf size={18} className="text-moss-500 shrink-0 mt-0.5" />
                <span>{c.why}</span>
              </div>
            </>
          )}
          <div className="mt-6 space-y-2.5">
            {phase === 'intro' && (
              <button
                onClick={begin}
                className="w-full py-4 bg-moss-500 hover:bg-moss-600 text-white rounded-2xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 min-h-[52px]"
              >
                <Zap size={18} /> {c.start}
              </button>
            )}
            <button
              onClick={phase === 'empty' ? onBack : onSkip}
              className="w-full py-3 text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 font-semibold transition-colors min-h-[44px]"
            >
              {phase === 'empty' ? c.backHome : c.skip}
            </button>
            {phase === 'intro' && (
              <p className="text-xs text-ink-300 dark:text-ink-500">{c.keepsMemory}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 px-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Logo size={26} showText={false} />
            <span className="text-base font-bold text-ink-500 dark:text-ink-400">{c.building}</span>
          </div>
          <div className="w-full h-2.5 bg-cream-100 dark:bg-ink-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-shimmer animate-progress" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="max-w-md mx-auto p-8 text-center space-y-5 view-enter">
        <p className="text-ink-500 dark:text-ink-300 font-semibold">{c.couldNot}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={begin} className="px-5 py-3 bg-moss-500 text-white rounded-xl font-bold inline-flex items-center gap-2 min-h-[48px]">
            <RotateCcw size={16} /> {c.retry}
          </button>
          <button onClick={onSkip} className="px-5 py-3 bg-cream-100 dark:bg-ink-800 rounded-xl font-bold min-h-[48px]">{c.skip}</button>
        </div>
      </div>
    );
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  if (phase === 'summary' && summary) {
    const chips = (items: string[], style: string) => (
      <div className="flex flex-wrap gap-2">
        {items.map((s, i) => (
          <span key={i} className={`text-sm font-medium px-3 py-1.5 rounded-full capitalize ${style}`}>{s}</span>
        ))}
      </div>
    );
    return (
      <div className="max-w-xl mx-auto px-4 md:px-6 py-10 view-enter" ref={topRef}>
        <Confetti trigger={confetti} count={90} />
        <div className="text-center mb-7">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-moss-400 to-moss-600 text-white flex items-center justify-center shadow-moss mb-4 animate-pop">
            <CheckCircle size={38} />
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink-700 dark:text-ink-100">{c.doneTitle}</h1>
          <p className="mt-2 text-ink-400 max-w-md mx-auto">{c.doneSub(summary.correctCount, summary.total)}</p>
        </div>

        <div className="space-y-4">
          {summary.remembered.length > 0 && (
            <div className="paper-card p-5 bg-white dark:bg-ink-800 border-ink-100 dark:border-ink-700">
              <div className="flex items-center gap-2 mb-3 text-green-600 dark:text-green-400 font-semibold">
                <CheckCircle size={18} /> {c.remembered}
              </div>
              {chips(summary.remembered, 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300')}
            </div>
          )}

          {summary.gettingStronger.length > 0 && (
            <div className="paper-card p-5 bg-white dark:bg-ink-800 border-ink-100 dark:border-ink-700">
              <div className="flex items-center gap-2 mb-3 text-moss-600 dark:text-moss-400 font-semibold">
                <TrendingUp size={18} /> {c.stronger}
              </div>
              {chips(summary.gettingStronger, 'bg-moss-100 text-moss-700 dark:bg-moss-light/30 dark:text-moss-300')}
            </div>
          )}

          {summary.nextReview && (
            <div className="paper-card p-5 bg-sky-50 dark:bg-sky-900/15 border-sky-100 dark:border-sky-900/30">
              <div className="flex items-center gap-2 mb-2 text-sky-700 dark:text-sky-300 font-semibold">
                <CalendarClock size={18} /> {c.nextReview}
              </div>
              <p className="text-sm text-ink-600 dark:text-ink-300">
                <span className="font-semibold capitalize">{summary.nextReview.skillTag}</span> — {c.reviewWhen(relReview(summary.nextReview.reviewDue))}
              </p>
            </div>
          )}

          {newQuest && (
            <div className="paper-card p-5 bg-amber-50 dark:bg-amber-900/15 border-amber-100 dark:border-amber-900/30">
              <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-300 font-semibold">
                <Wrench size={18} /> {c.questMade}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{newQuest.badgeReward}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink-700 dark:text-ink-100 truncate">{newQuest.title}</div>
                  <div className="text-xs text-ink-400 capitalize">{newQuest.skillTag}</div>
                </div>
                {onStartQuest && (
                  <button
                    onClick={() => onStartQuest(newQuest)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 shrink-0 min-h-[44px]"
                  >
                    {c.startQuest} <ChevronRight size={15} className="rtl:rotate-180" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onBack}
          className="mt-7 w-full py-4 bg-moss-500 hover:bg-moss-600 text-white rounded-2xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] min-h-[52px]"
        >
          {c.backHome}
        </button>
      </div>
    );
  }

  // ── Player ───────────────────────────────────────────────────────────────────
  if (!q) return null;
  const reason = reasonBySkill.get((q.skillTag || 'general').trim().toLowerCase()) ?? 'review';
  const canSubmit = q.questionType === QuestionType.NUMERIC ? typed.trim().length > 0 : chosen !== null;

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8 view-enter" ref={topRef}>
      <Confetti trigger={confetti} count={40} />

      <div className="flex items-center justify-between gap-3 mb-4">
        <button onClick={onSkip} className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 transition-colors min-h-[44px]">
          <ArrowLeft size={16} className="rtl:rotate-180" />
          <span className="hidden sm:inline">{c.skip}</span>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-ink-400 tabular-nums whitespace-nowrap">{c.questionOf(idx + 1, total)}</span>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums px-2.5 py-1 rounded-full ${remaining > 0 ? 'bg-cream-100 dark:bg-ink-800 text-ink-500 dark:text-ink-300' : 'bg-moss-50 dark:bg-moss-light/20 text-moss-600 dark:text-moss-300'}`}>
            <Clock size={12} /> {remaining > 0 ? fmtTime(remaining) : c.noRush}
          </span>
        </div>
      </div>

      <div className="h-2 bg-cream-100 dark:bg-ink-800 rounded-full overflow-hidden mb-5">
        <div className="h-full bg-moss-500 rounded-full transition-all duration-500" style={{ width: `${((idx + (answered ? 1 : 0)) / Math.max(total, 1)) * 100}%` }} />
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 mb-5">
        {questions.map((_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i < idx ? 'w-2 bg-moss-500' : i === idx ? 'w-6 bg-moss-500' : 'w-2 bg-ink-200 dark:bg-ink-700'
            }`}
          />
        ))}
      </div>

      <div key={idx} className="paper-card p-5 md:p-7 bg-white dark:bg-ink-800 border-ink-100 dark:border-ink-700 animate-slide-up">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full inline-block mb-3 ${REASON_STYLE[reason]}`}>
          {c.reasons[reason]}
        </span>
        <h2 className="text-lg md:text-xl font-bold text-ink-700 dark:text-ink-100 mb-4 break-words">
          <MathText>{q.question}</MathText>
        </h2>

        {q.questionType === QuestionType.NUMERIC ? (
          <input
            type="text"
            inputMode="decimal"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !answered && canSubmit) submit(); }}
            disabled={answered}
            placeholder={c.yourAnswer}
            className={`w-full px-4 py-3.5 rounded-xl border-2 text-base font-medium bg-cream-50 dark:bg-ink-900/40 outline-none transition-colors min-h-[52px] ${
              answered
                ? wasCorrect ? 'border-green-500 text-green-700 dark:text-green-300' : 'border-red-400 text-red-600 dark:text-red-300'
                : 'border-ink-200 dark:border-ink-600 focus:border-moss-400 text-ink-700 dark:text-ink-100'
            }`}
          />
        ) : (
          <div className="space-y-2.5">
            {q.options.map(opt => {
              const isChosen = chosen === opt.id;
              const isRight = opt.id === q.correctOptionId;
              let style = 'border-ink-200 dark:border-ink-600 hover:border-moss-400 hover:bg-moss-50/50 dark:hover:bg-moss-light/10';
              if (answered) {
                if (isRight) style = 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300';
                else if (isChosen) style = 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300';
                else style = 'border-ink-100 dark:border-ink-700 opacity-60';
              } else if (isChosen) {
                style = 'border-moss-500 bg-moss-50 dark:bg-moss-light/15';
              }
              return (
                <button
                  key={opt.id}
                  onClick={() => !answered && setChosen(opt.id)}
                  disabled={answered}
                  className={`w-full text-start px-4 py-3.5 rounded-xl border-2 font-medium text-sm md:text-base transition-all duration-150 min-h-[48px] flex items-center gap-3 ${style} ${answered ? '' : 'active:scale-[0.99]'}`}
                >
                  {answered && isRight && <CheckCircle size={18} className="shrink-0 text-green-600 dark:text-green-400" />}
                  {answered && isChosen && !isRight && <XCircle size={18} className="shrink-0 text-red-500" />}
                  <MathText>{opt.text}</MathText>
                </button>
              );
            })}
          </div>
        )}

        {answered && (
          <div className={`mt-4 p-4 rounded-xl text-sm animate-slide-up ${
            wasCorrect ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
          }`}>
            <p className="font-bold mb-1">{wasCorrect ? c.correct : c.notQuite}</p>
            {q.explanation && <MathText className="leading-relaxed">{q.explanation}</MathText>}
          </div>
        )}
      </div>

      <button
        onClick={answered ? next : submit}
        disabled={!answered && !canSubmit}
        className="mt-5 w-full py-4 bg-moss-500 hover:bg-moss-600 text-white rounded-2xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed min-h-[52px]"
      >
        {!answered ? c.check : idx + 1 >= total ? (<><Trophy size={18} /> {c.finish}</>) : (<>{c.next} <ChevronRight size={20} className="rtl:rotate-180" /></>)}
      </button>
    </div>
  );
};

export default ComebackView;
