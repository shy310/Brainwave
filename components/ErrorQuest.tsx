import React, { useState, useEffect, useRef } from 'react';
import {
  ErrorQuest as Quest, QuestStage, GradeLevel, Language, Translations,
  SkillAttemptEvent, QuestionType, QuestStageType,
} from '../types';
import { generateErrorQuest } from '../services/aiService';
import { validateQuestStages } from '../services/questEngine';
import {
  ArrowLeft, ChevronRight, Wrench, Lightbulb, Search, Compass, Target,
  Rocket, MessageCircle, CheckCircle, XCircle, Trophy, Sparkles, Zap, Clock
} from 'lucide-react';
import Logo from './Logo';
import MathText from './MathText';
import Confetti from './Confetti';

interface Props {
  quest: Quest;
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  onBack: () => void;
  /** Persist generated stages / stage progress so the quest can be resumed */
  onQuestUpdate: (quest: Quest) => void;
  /** Quest finished: award XP + badge, record events, schedule follow-up */
  onComplete: (quest: Quest, xpEarned: number, skillEvents: SkillAttemptEvent[]) => void;
}

const STAGE_META: Record<QuestStageType, { icon: React.ReactNode; badge: string }> = {
  reminder:       { icon: <Lightbulb size={15} />, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  example:        { icon: <Compass size={15} />,   badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  'spot-mistake': { icon: <Search size={15} />,    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  'guided-fix':   { icon: <Wrench size={15} />,    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
  independent:    { icon: <Target size={15} />,    badge: 'bg-moss-100 text-moss-700 dark:bg-moss-light/40 dark:text-moss-300' },
  challenge:      { icon: <Rocket size={15} />,    badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
  reflection:     { icon: <MessageCircle size={15} />, badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
};

type QLangKey = 'en' | 'ru' | 'he' | 'ar';
const Q_COPY: Record<QLangKey, {
  stageNames: Record<QuestStageType, string>;
  preparing: string; couldNot: string; stageOf: (a: number, b: number) => string;
  continueBtn: string; finishBtn: string; skipChallenge: string;
  nice: string; notQuite: string; questDone: string;
  badgeEarned: string; xpEarned: (n: number) => string; repairedLine: string;
  checkBack: string; whyQuest: string; minutes: (n: number) => string;
}> = {
  en: {
    stageNames: { reminder: 'Reminder', example: 'Worked example', 'spot-mistake': 'Spot the mistake', 'guided-fix': 'Guided fix', independent: 'On your own', challenge: 'Challenge', reflection: 'Explain it' },
    preparing: 'Building your personal mission', couldNot: 'Could not build this quest. Please try again.',
    stageOf: (a, b) => `${a} of ${b}`, continueBtn: 'Continue', finishBtn: 'Complete mission', skipChallenge: 'Skip the challenge',
    nice: 'Nice — exactly right!', notQuite: 'Not quite — look once more.',
    questDone: 'Mission complete!', badgeEarned: 'New badge for your collection',
    xpEarned: (n) => `+${n} XP earned`, repairedLine: 'Pattern repaired. It will come back in a few days to check it stuck.',
    checkBack: 'Back to dashboard', whyQuest: 'Why this mission', minutes: (n) => `~${n} min`,
  },
  ru: {
    stageNames: { reminder: 'Напоминание', example: 'Разбор примера', 'spot-mistake': 'Найди ошибку', 'guided-fix': 'Исправь с подсказкой', independent: 'Сам(а)', challenge: 'Испытание', reflection: 'Объясни' },
    preparing: 'Собираем твою личную миссию', couldNot: 'Не удалось создать квест. Попробуй ещё раз.',
    stageOf: (a, b) => `${a} из ${b}`, continueBtn: 'Дальше', finishBtn: 'Завершить миссию', skipChallenge: 'Пропустить испытание',
    nice: 'Отлично — именно так!', notQuite: 'Не совсем — взгляни ещё раз.',
    questDone: 'Миссия выполнена!', badgeEarned: 'Новый значок в коллекцию',
    xpEarned: (n) => `+${n} XP получено`, repairedLine: 'Шаблон исправлен. Навык вернётся через пару дней для проверки.',
    checkBack: 'На главную', whyQuest: 'Почему эта миссия', minutes: (n) => `~${n} мин`,
  },
  he: {
    stageNames: { reminder: 'תזכורת', example: 'דוגמה פתורה', 'spot-mistake': 'מצא את הטעות', 'guided-fix': 'תיקון מודרך', independent: 'לבד', challenge: 'אתגר', reflection: 'הסבר' },
    preparing: 'בונים את המשימה האישית שלך', couldNot: 'לא הצלחנו ליצור את המסע. נסה שוב.',
    stageOf: (a, b) => `${a} מתוך ${b}`, continueBtn: 'המשך', finishBtn: 'השלם משימה', skipChallenge: 'דלג על האתגר',
    nice: 'יפה — בדיוק כך!', notQuite: 'לא בדיוק — הבט שוב.',
    questDone: 'המשימה הושלמה!', badgeEarned: 'תג חדש לאוסף שלך',
    xpEarned: (n) => `+${n} XP הרווחת`, repairedLine: 'הדפוס תוקן. המיומנות תחזור בעוד כמה ימים לבדיקה.',
    checkBack: 'חזרה ללוח', whyQuest: 'למה המשימה הזו', minutes: (n) => `~${n} דק׳`,
  },
  ar: {
    stageNames: { reminder: 'تذكير', example: 'مثال محلول', 'spot-mistake': 'اكتشف الخطأ', 'guided-fix': 'إصلاح موجه', independent: 'بمفردك', challenge: 'تحدٍ', reflection: 'اشرحها' },
    preparing: 'نبني مهمتك الشخصية', couldNot: 'تعذر إنشاء المهمة. حاول مرة أخرى.',
    stageOf: (a, b) => `${a} من ${b}`, continueBtn: 'متابعة', finishBtn: 'أكمل المهمة', skipChallenge: 'تخطَّ التحدي',
    nice: 'رائع — بالضبط!', notQuite: 'ليس تماماً — انظر مرة أخرى.',
    questDone: 'اكتملت المهمة!', badgeEarned: 'وسام جديد لمجموعتك',
    xpEarned: (n) => `+${n} نقطة خبرة`, repairedLine: 'تم إصلاح النمط. ستعود المهارة بعد أيام للتحقق من ثباتها.',
    checkBack: 'إلى اللوحة', whyQuest: 'لماذا هذه المهمة', minutes: (n) => `~${n} د`,
  },
};

const INTERACTIVE = new Set<QuestStageType>(['spot-mistake', 'guided-fix', 'independent', 'challenge', 'reflection']);

const ErrorQuestView: React.FC<Props> = ({
  quest, userGrade, language, translations, onBack, onQuestUpdate, onComplete
}) => {
  const c = Q_COPY[(Q_COPY[language as QLangKey] ? language : 'en') as QLangKey];
  const [stages, setStages] = useState<QuestStage[]>(quest.stages ?? []);
  const [loading, setLoading] = useState((quest.stages ?? []).length === 0);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(quest.stageIndex ?? 0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState(false);
  const [confettiBurst, setConfettiBurst] = useState(0);
  const eventsRef = useRef<SkillAttemptEvent[]>([]);
  const stageStartRef = useRef(Date.now());
  const doneRef = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      if ((quest.stages ?? []).length > 0) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      // Generate + validate; one retry on invalid output.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const generated = await generateErrorQuest(quest, userGrade, language);
          if (generated) {
            const { ok, reasons } = validateQuestStages(generated);
            if (ok) {
              setStages(generated);
              onQuestUpdate({ ...quest, stages: generated });
              setLoading(false);
              return;
            }
            console.warn('Quest stages failed validation:', reasons);
          }
        } catch (e) {
          console.error('Quest generation error:', e);
        }
      }
      setError(c.couldNot);
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest.id]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    stageStartRef.current = Date.now();
  }, [idx, finished]);

  const stage = stages[idx];
  const total = stages.length;
  const isInteractive = stage ? INTERACTIVE.has(stage.type) : false;
  const answered = answers[idx] !== undefined;
  const canContinue = !isInteractive || answered || stage?.type === 'challenge';
  const isLast = idx === total - 1;

  const handleAnswer = (i: number) => {
    if (answered || !stage) return;
    setAnswers(prev => ({ ...prev, [idx]: i }));
    const correct = i === stage.correctIndex;
    if (correct) setConfettiBurst(n => n + 1);
    eventsRef.current.push({
      skillTag: quest.skillTag,
      subject: quest.subject,
      topicId: quest.topicId,
      correct,
      questionType: QuestionType.MULTIPLE_CHOICE,
      difficulty: quest.difficulty,
      timeMs: Math.max(0, Date.now() - stageStartRef.current),
      hintsUsed: stage.type === 'guided-fix' ? 1 : 0,
      mistakeKind: correct ? undefined : quest.mistakeKind,
      // Reflection = choosing the precise explanation → explain evidence
      explainEvidence: correct && stage.type === 'reflection',
    });
  };

  const advance = (next: number) => {
    setIdx(next);
    onQuestUpdate({ ...quest, stages, stageIndex: next, correctInQuest: correctCount() });
  };

  const correctCount = () =>
    stages.reduce((n, st, i) => n + (INTERACTIVE.has(st.type) && answers[i] === st.correctIndex ? 1 : 0), 0);

  const handleFinish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setConfettiBurst(n => n + 1);
    setFinished(true);
    const finishedQuest: Quest = {
      ...quest, stages, stageIndex: total, correctInQuest: correctCount(),
      completedAt: new Date().toISOString(),
    };
    onComplete(finishedQuest, quest.xpReward, eventsRef.current);
  };

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10 px-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Logo size={28} showText={false} />
            <span className="text-base font-bold text-ink-500 dark:text-ink-400">{c.preparing}</span>
          </div>
          <div className="w-full h-2.5 bg-cream-100 dark:bg-ink-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-shimmer animate-progress"></div>
          </div>
          <p className="text-xs text-ink-400 font-medium">{quest.title} · {quest.skillTag}</p>
        </div>
      </div>
    );
  }
  if (error || !stage) {
    return (
      <div className="max-w-2xl mx-auto p-8 md:p-12 text-center space-y-6">
        <p className="text-red-500 font-bold text-lg">{error ?? c.couldNot}</p>
        <button onClick={onBack} className="px-6 py-3 bg-cream-100 dark:bg-ink-800 rounded-xl font-bold">
          {translations.backToDashboard}
        </button>
      </div>
    );
  }

  // ── Completion ─────────────────────────────────────────────────────────────
  if (finished) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 view-enter" ref={topRef}>
        <Confetti trigger={confettiBurst} count={80} />
        <div className="bg-white dark:bg-ink-800 rounded-3xl border border-ink-100 dark:border-ink-700 p-8 md:p-10 text-center shadow-sm">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-moss-400 to-moss-600 text-white flex items-center justify-center shadow-moss mb-5 animate-pop">
            <Trophy size={38} />
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink-700 dark:text-ink-100">{c.questDone}</h1>
          <p className="mt-2 text-lg font-bold text-moss-600 dark:text-moss-400">{c.xpEarned(quest.xpReward)}</p>

          <div className="mt-5 inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40">
            <span className="text-3xl">{quest.badgeReward}</span>
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{c.badgeEarned}</span>
          </div>

          <p className="mt-5 text-sm text-ink-400 max-w-md mx-auto">{c.repairedLine}</p>

          <button
            onClick={onBack}
            className="mt-6 w-full py-4 bg-moss-500 hover:bg-moss-600 text-white rounded-2xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] min-h-[52px]"
          >
            {c.checkBack}
          </button>
        </div>
      </div>
    );
  }

  // ── Stage player ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8 view-enter" ref={topRef}>
      <Confetti trigger={confettiBurst} count={40} />

      <div className="flex items-center justify-between gap-3 mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 transition-colors min-h-[44px]">
          <ArrowLeft size={16} className="rtl:rotate-180" />
          <span className="hidden sm:inline">{translations.backToDashboard}</span>
        </button>
        <span className="text-xs font-bold text-ink-400 tabular-nums whitespace-nowrap">{c.stageOf(idx + 1, total)}</span>
      </div>

      <div className="h-2 bg-cream-100 dark:bg-ink-800 rounded-full overflow-hidden mb-5">
        <div className="h-full bg-moss-500 rounded-full transition-all duration-500" style={{ width: `${((idx + 1) / Math.max(total, 1)) * 100}%` }} />
      </div>

      {/* Quest identity + why */}
      <div className="mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xl leading-none">{quest.badgeReward}</span>
          <h1 className="text-xl md:text-2xl font-bold text-ink-700 dark:text-white leading-tight break-words">{quest.title}</h1>
        </div>
        <p className="mt-1 text-xs text-ink-400 capitalize">{quest.skillTag} · <Clock size={10} className="inline -mt-0.5" /> {c.minutes(quest.estimatedMinutes)} · <Zap size={10} className="inline -mt-0.5 text-amber-500" /> +{quest.xpReward} XP</p>
        {idx === 0 && (
          <div className="mt-3 p-3.5 rounded-xl bg-moss-50 dark:bg-moss-light/20 border border-moss-100 dark:border-moss-light/40 text-sm text-ink-600 dark:text-ink-300">
            <span className="font-bold text-moss-700 dark:text-moss-300 me-1.5">{c.whyQuest}:</span>
            {quest.reason}
          </div>
        )}
      </div>

      {/* Stage card */}
      <div key={idx} className="bg-white dark:bg-ink-800 rounded-2xl border border-ink-100 dark:border-ink-700 p-5 md:p-7 shadow-sm animate-slide-up">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 mb-3 ${STAGE_META[stage.type].badge}`}>
          {STAGE_META[stage.type].icon}
          {c.stageNames[stage.type]}
        </span>
        <h2 className="text-lg md:text-xl font-bold text-ink-700 dark:text-ink-100 mb-3 break-words">{stage.heading}</h2>

        {stage.body && (
          <p className="text-base text-ink-500 dark:text-ink-300 leading-relaxed">
            <MathText>{stage.body}</MathText>
          </p>
        )}

        {(stage.bullets?.length ?? 0) > 0 && (
          <ul className="mt-4 space-y-2.5">
            {stage.bullets!.map((b, i) => (
              <li key={i} className="flex items-start gap-3 bg-cream-50 dark:bg-ink-900/40 rounded-xl px-4 py-2.5">
                <Sparkles size={14} className="text-moss-500 shrink-0 mt-1" />
                <MathText className="text-sm md:text-base text-ink-600 dark:text-ink-300 leading-relaxed">{b}</MathText>
              </li>
            ))}
          </ul>
        )}

        {isInteractive && stage.question && (
          <div className="mt-4">
            <p className="font-semibold text-ink-700 dark:text-ink-100 text-base md:text-lg mb-3">
              <MathText>{stage.question}</MathText>
            </p>
            <div className="space-y-2.5">
              {(stage.options ?? []).map((opt, i) => {
                const chosen = answers[idx];
                const isChosen = chosen === i;
                const isRight = i === stage.correctIndex;
                let style = 'border-ink-200 dark:border-ink-600 hover:border-moss-400 hover:bg-moss-50/50 dark:hover:bg-moss-light/10';
                if (answered) {
                  if (isRight) style = 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300';
                  else if (isChosen) style = 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300';
                  else style = 'border-ink-100 dark:border-ink-700 opacity-60';
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    disabled={answered}
                    className={`w-full text-start px-4 py-3.5 rounded-xl border-2 font-medium text-sm md:text-base transition-all duration-150 min-h-[48px] flex items-center gap-3 ${style} ${answered ? '' : 'active:scale-[0.99]'}`}
                  >
                    {answered && isRight && <CheckCircle size={18} className="shrink-0 text-green-600 dark:text-green-400" />}
                    {answered && isChosen && !isRight && <XCircle size={18} className="shrink-0 text-red-500" />}
                    <MathText>{opt}</MathText>
                  </button>
                );
              })}
            </div>
            {answered && (
              <div className={`mt-4 p-4 rounded-xl text-sm animate-slide-up ${
                answers[idx] === stage.correctIndex
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
              }`}>
                <p className="font-bold mb-1">{answers[idx] === stage.correctIndex ? c.nice : c.notQuite}</p>
                {stage.explanation && <MathText className="leading-relaxed">{stage.explanation}</MathText>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-5">
        {idx > 0 && (
          <button
            onClick={() => advance(idx - 1)}
            className="px-5 py-4 bg-cream-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 rounded-2xl font-bold hover:bg-cream-200 dark:hover:bg-ink-700 transition-all duration-150 flex items-center justify-center min-h-[52px]"
            aria-label="Back"
          >
            <ChevronRight size={20} className="rotate-180 rtl:rotate-0" />
          </button>
        )}
        <button
          onClick={() => (isLast ? handleFinish() : advance(idx + 1))}
          disabled={!canContinue}
          className="flex-1 py-4 bg-moss-500 hover:bg-moss-600 text-white rounded-2xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed min-h-[52px]"
        >
          {isLast ? (<><Trophy size={18} /> {c.finishBtn}</>) : (
            <>
              {stage.type === 'challenge' && !answered ? c.skipChallenge : c.continueBtn}
              <ChevronRight size={20} className="rtl:rotate-180" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ErrorQuestView;
