
import React, { useState, useEffect, useRef } from 'react';
import { Exercise, QuestionType, LearningSession, GradeLevel, Language, Translations, AnswerEvaluation, SkillAttemptEvent, ConfidenceLevel, MistakeKind } from '../types';
import {
  CheckCircle, XCircle, Lightbulb, RefreshCw, ChevronRight, BookOpen,
  Zap, Trophy, ArrowRight, Send, Eye, AlertTriangle, HelpCircle, SkipForward
} from 'lucide-react';
import { generateQuiz, evaluateAnswer, QuizPerformance } from '../services/aiService';
import { checkAnswer, looksNumeric } from '../services/mathEngine';
import { classifyMistake } from '../services/masteryEngine';
import Logo from './Logo';
import MathText from './MathText';
import Confetti from './Confetti';
import StepReveal from './StepReveal';

const MAX_ATTEMPTS = 3;

type ExLangKey = 'en' | 'ru' | 'he' | 'ar';
const EX_COPY: Record<ExLangKey, {
  multipleChoice: string; shortAnswer: string; multiStep: string; fillInBlank: string; questionLabel: string;
  trueFalse: string; numeric: string; multiSelect: string; skip: string; skipped: string; selectAllApply: string;
  howSure: string; guessing: string; thinkSo: string; sure: string;
  attemptsLeft: (n: number) => string; attemptsCount: (a: number, m: number) => string;
}> = {
  en: {
    multipleChoice: 'Multiple Choice', shortAnswer: 'Short Answer', multiStep: 'Multi-Step',
    fillInBlank: 'Fill in the Blank', questionLabel: 'Question',
    trueFalse: 'True or False', numeric: 'Numeric', multiSelect: 'Select All', skip: 'Skip', skipped: 'Skipped',
    selectAllApply: 'Select every correct option, then submit.',
    howSure: 'How sure are you?', guessing: 'Guessing', thinkSo: 'Think so', sure: 'Sure',
    attemptsLeft: (n) => `${n} left`,
    attemptsCount: (a, m) => `${a}/${m} attempts`,
  },
  ru: {
    multipleChoice: 'Выбор ответа', shortAnswer: 'Короткий ответ', multiStep: 'По шагам',
    fillInBlank: 'Заполни пропуск', questionLabel: 'Вопрос',
    trueFalse: 'Верно или нет', numeric: 'Числовой', multiSelect: 'Несколько ответов', skip: 'Пропустить', skipped: 'Пропущено',
    selectAllApply: 'Отметь все верные варианты и отправь.',
    howSure: 'Насколько уверен?', guessing: 'Наугад', thinkSo: 'Кажется', sure: 'Уверен',
    attemptsLeft: (n) => `осталось ${n}`,
    attemptsCount: (a, m) => `${a}/${m} попыток`,
  },
  he: {
    multipleChoice: 'בחירה מרובה', shortAnswer: 'תשובה קצרה', multiStep: 'רב-שלבי',
    fillInBlank: 'מלא את החסר', questionLabel: 'שאלה',
    trueFalse: 'נכון או לא', numeric: 'מספרי', multiSelect: 'בחר הכל', skip: 'דלג', skipped: 'דולג',
    selectAllApply: 'סמן את כל התשובות הנכונות ושלח.',
    howSure: 'עד כמה אתה בטוח?', guessing: 'ניחוש', thinkSo: 'נראה לי', sure: 'בטוח',
    attemptsLeft: (n) => `נותרו ${n}`,
    attemptsCount: (a, m) => `${a}/${m} ניסיונות`,
  },
  ar: {
    multipleChoice: 'اختيار من متعدد', shortAnswer: 'إجابة قصيرة', multiStep: 'متعدد الخطوات',
    fillInBlank: 'املأ الفراغ', questionLabel: 'سؤال',
    trueFalse: 'صح أم خطأ', numeric: 'رقمي', multiSelect: 'اختر الكل', skip: 'تخطى', skipped: 'تم التخطي',
    selectAllApply: 'حدد كل الخيارات الصحيحة ثم أرسل.',
    howSure: 'ما مدى ثقتك؟', guessing: 'تخمين', thinkSo: 'أظن ذلك', sure: 'متأكد',
    attemptsLeft: (n) => `${n} متبقية`,
    attemptsCount: (a, m) => `${a}/${m} محاولات`,
  },
};

// Module-level cache — session-only, NOT persisted to localStorage.
// This ensures students get fresh questions each time they restart the app.
const _quizCache = new Map<string, Exercise[]>();
const _loadingKeys = new Set<string>();

// Clear any old persisted quiz cache from previous versions
try { localStorage.removeItem('brainwave_quiz_cache_v2'); } catch {}

function saveQuizCache() { /* no-op: quiz cache is session-only now */ }

interface Props {
  session: LearningSession;
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  onComplete: (xpEarned: number, attemptsTotal: number, attemptsCorrect: number, topicId?: string | null, skillTag?: string, skillEvents?: SkillAttemptEvent[]) => void;
  onBack: () => void;
  onContextUpdate: (ctx: string) => void;
  onGoToLesson?: () => void;
  onQuizGenerated?: (quiz: Exercise[]) => void;
  /** 0–100 mastery on this topic — used to adapt generated difficulty */
  topicMastery?: number;
  /** Fires per answered question so mastery is recorded even if the quiz is abandoned */
  onSkillEvent?: (ev: SkillAttemptEvent) => void;
}

const ExercisePanel: React.FC<Props> = ({
  session, userGrade, language, translations,
  onComplete, onBack, onContextUpdate, onGoToLesson, onQuizGenerated, topicMastery, onSkillEvent
}) => {
  const ex = EX_COPY[(EX_COPY[language as ExLangKey] ? language : 'en') as ExLangKey];

  // Upload-based sessions must never use the shared cache (their key would collide with
  // general-practice quizzes for the same subject/grade).
  const isUploadSession = session.studyContext.length > 0;

  // Load from module cache immediately — runs ONCE at mount, never on re-render.
  // This means language changes, prop updates, etc. can NEVER trigger a regeneration.
  const [quiz, setQuiz] = useState<Exercise[]>(() => {
    if (isUploadSession) return session.quiz ?? [];
    const key = `${session.subject}::${session.topicId ?? ''}::${session.grade}::${language}`;
    return _quizCache.get(key) ?? session.quiz ?? [];
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  // Start spinner immediately if no cached quiz, so there's no flash of empty state.
  const [loading, setLoading] = useState(() => {
    if (isUploadSession) return (session.quiz ?? []).length === 0;
    const key = `${session.subject}::${session.topicId ?? ''}::${session.grade}::${language}`;
    return (_quizCache.get(key) ?? session.quiz ?? []).length === 0;
  });

  // Single-choice state (MULTIPLE_CHOICE / TRUE_FALSE)
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  // Multi-select state (MULTI_SELECT)
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());

  // Open answer state (SHORT_ANSWER, MULTI_STEP, FILL_IN_BLANK, NUMERIC)
  const [openAnswer, setOpenAnswer] = useState('');
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [shownHints, setShownHints] = useState<string[]>([]);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [skipped, setSkipped] = useState(false);

  const [showHint, setShowHint] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [attempts, setAttempts] = useState(0); // attempts on current question
  const [score, setScore] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [attemptsTotal, setAttemptsTotal] = useState(0);
  const [attemptsCorrect, setAttemptsCorrect] = useState(0);
  const [confettiBurst, setConfettiBurst] = useState(0);

  // Adaptive-learning telemetry for the mastery engine
  const [confidence, setConfidence] = useState<ConfidenceLevel | undefined>(undefined);
  const questionStartRef = useRef<number>(Date.now());
  const skillEventsRef = useRef<SkillAttemptEvent[]>([]);
  // First wrong try on this question — kept so a corrected answer still
  // records WHAT kind of mistake was made (and that it was fixed).
  const firstMistakeRef = useRef<MistakeKind | null>(null);

  // One event per question, recorded exactly once when the question resolves.
  // Delivered IMMEDIATELY via onSkillEvent so progress survives an abandoned
  // quiz; the ref batch is only a fallback for callers without the handler.
  const recordSkillEvent = (correct: boolean, opts: { skipped?: boolean; studentAnswer?: string } = {}) => {
    const exercise = quiz[currentIndex];
    if (!exercise) return;
    const wasRetry = attempts > 0; // attempts counted BEFORE this resolution
    const event: SkillAttemptEvent = {
      skillTag: exercise.skillTag || session.topicTitle || 'general',
      subject: session.subject,
      topicId: session.topicId,
      correct,
      questionType: exercise.questionType || QuestionType.MULTIPLE_CHOICE,
      difficulty: exercise.difficulty || 3,
      timeMs: Math.max(0, Date.now() - questionStartRef.current),
      hintsUsed: (showHint ? 1 : 0) + shownHints.length,
      skippedQuestion: opts.skipped,
      mistakeKind: correct
        ? (firstMistakeRef.current ?? undefined)
        : opts.skipped ? 'recall'
        : (firstMistakeRef.current ?? classifyMistake(exercise, opts.studentAnswer ?? '')),
      corrected: correct && wasRetry,
      confidence,
      explainEvidence: correct && !opts.skipped &&
        exercise.questionType !== QuestionType.MULTIPLE_CHOICE &&
        exercise.questionType !== QuestionType.TRUE_FALSE &&
        exercise.questionType !== QuestionType.MULTI_SELECT,
    };
    if (onSkillEvent) onSkillEvent(event);
    else skillEventsRef.current.push(event);
  };

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // quiz was loaded from cache in useState initializer.
    // Only generate if it came back empty (no cache hit).
    if (quiz.length === 0) {
      loadNewQuiz();
    } else {
      onContextUpdate(`Quiz: ${session.subject} — ${session.topicTitle} (${userGrade})`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNewQuiz = async (isExplicitNewSet = false) => {
    // Upload sessions get a unique key so they never collide with topic-based quiz cache
    const cacheKey = isUploadSession
      ? `upload::${session.studyContext.map(a => a.name).join(',')}`
      : `${session.subject}::${session.topicId ?? ''}::${session.grade}::${language}`;
    // Prevent concurrent loads for the same key (e.g. from double-effect invocations).
    if (!isExplicitNewSet && _loadingKeys.has(cacheKey)) return;
    _loadingKeys.add(cacheKey);

    setLoading(true);
    setQuiz([]);
    resetQuestionState();
    setCurrentIndex(0);
    setScore(0);
    setTotalXp(0);
    setQuizFinished(false);
    setAttemptsTotal(0);
    setAttemptsCorrect(0);
    skillEventsRef.current = [];

    const subjectName = session.subject;
    const topicName = session.topicTitle;
    onContextUpdate(`Quiz: ${subjectName} — ${topicName} (${userGrade})`);

    // Give the AI everything it needs to stay ON-TOPIC: the lesson's key
    // points (when the student came from a lesson) and any uploaded material.
    const contextParts: string[] = [];
    if (session.lesson?.keyPoints?.length) {
      contextParts.push(`The student just completed a lesson on "${session.lesson.topicTitle}". Test THESE key points:\n- ${session.lesson.keyPoints.join('\n- ')}`);
    }
    if (session.studyContext.length > 0) {
      contextParts.push(`Based on uploaded files: ${session.studyContext.map(a => a.name).join(', ')}`);
    }
    const contextStr = contextParts.length ? contextParts.join('\n\n') : undefined;

    const questionTypes = [
      QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE, QuestionType.NUMERIC,
      QuestionType.MULTI_SELECT, QuestionType.SHORT_ANSWER, QuestionType.FILL_IN_BLANK,
    ];

    // Adapt difficulty to demonstrated performance on this topic
    const performance: QuizPerformance | undefined = topicMastery !== undefined
      ? { mastery: topicMastery, recentCorrect: attemptsCorrect, recentTotal: attemptsTotal }
      : undefined;

    const newQuiz = await generateQuiz(
      subjectName,
      userGrade,
      topicName,
      language,
      contextStr,
      session.studyContext,
      questionTypes,
      10,
      performance
    );

    _loadingKeys.delete(cacheKey);
    if (newQuiz && newQuiz.length > 0) {
      // Don't persist upload-based quizzes — they're tied to specific uploaded files
      if (!isUploadSession) {
        _quizCache.set(cacheKey, newQuiz);
        saveQuizCache();
      }
      setQuiz(newQuiz);
      onQuizGenerated?.(newQuiz);
    }
    setLoading(false);
  };

  const resetQuestionState = () => {
    setSelectedOption(null);
    setMultiSelected(new Set());
    setOpenAnswer('');
    setEvaluation(null);
    setShowHint(false);
    setIsSubmitted(false);
    setAttempts(0);
    setEvaluating(false);
    setShownHints([]);
    setWasCorrect(null);
    setSkipped(false);
    setConfidence(undefined);
    firstMistakeRef.current = null;
    questionStartRef.current = Date.now();
  };

  const currentExercise = quiz[currentIndex];
  const qType = currentExercise?.questionType || QuestionType.MULTIPLE_CHOICE;
  const isChoiceType = qType === QuestionType.MULTIPLE_CHOICE || qType === QuestionType.TRUE_FALSE;
  const isMultiSelect = qType === QuestionType.MULTI_SELECT;
  const isOpenType = !isChoiceType && !isMultiSelect;
  const solutionRevealed = isOpenType && attempts >= MAX_ATTEMPTS;

  const markCorrect = () => {
    setScore(s => s + 1);
    setAttemptsCorrect(c => c + 1);
    setTotalXp(x => x + (currentExercise?.xpValue || 50));
    setConfettiBurst(n => n + 1);
    setWasCorrect(true);
  };

  // ── SINGLE-CHOICE SUBMIT (MULTIPLE_CHOICE / TRUE_FALSE) ───────────────────
  const handleMCSubmit = () => {
    if (!selectedOption || !currentExercise) return;
    const correct = selectedOption === currentExercise.correctOptionId;
    setIsSubmitted(true);
    setAttempts(a => a + 1);
    setAttemptsTotal(t => t + 1);
    if (correct) markCorrect();
    else setWasCorrect(false);
    recordSkillEvent(correct, {
      studentAnswer: currentExercise.options.find(o => o.id === selectedOption)?.text ?? '',
    });
  };

  // ── MULTI-SELECT SUBMIT ────────────────────────────────────────────────────
  const handleMultiSelectSubmit = () => {
    if (multiSelected.size === 0 || !currentExercise) return;
    const expected = new Set(currentExercise.correctOptionIds ?? []);
    const correct = expected.size === multiSelected.size && [...expected].every(id => multiSelected.has(id));
    setIsSubmitted(true);
    setAttempts(a => a + 1);
    setAttemptsTotal(t => t + 1);
    if (correct) markCorrect();
    else setWasCorrect(false);
    recordSkillEvent(correct);
  };

  // ── OPEN ANSWER SUBMIT (engine-first, AI for feedback only) ───────────────
  const handleOpenSubmit = async () => {
    if (!openAnswer.trim() || !currentExercise || evaluating) return;
    setEvaluating(true);
    const attemptNum = attempts + 1;
    setAttempts(attemptNum);
    setAttemptsTotal(t => t + 1);

    // 1) Deterministic verdict from the math engine whenever the stored
    //    answer is machine-checkable. The AI never judges math.
    const expected = currentExercise.answerExpression || currentExercise.sampleAnswer || '';
    let verified: boolean | undefined = undefined;
    if (expected && (qType === QuestionType.NUMERIC || looksNumeric(expected))) {
      const verdict = checkAnswer(openAnswer, expected, currentExercise.acceptableAnswers ?? [], {
        tolerance: currentExercise.tolerance,
        roundTo: currentExercise.roundTo,
        unitRequired: currentExercise.unitRequired,
      });
      if (verdict.method === 'math' || verdict.correct) verified = verdict.correct;
    } else if (expected && (currentExercise.acceptableAnswers?.length || qType === QuestionType.FILL_IN_BLANK)) {
      // Exact/alternate text matches are definitive-correct without an AI roundtrip
      const verdict = checkAnswer(openAnswer, expected, currentExercise.acceptableAnswers ?? []);
      if (verdict.correct) verified = true;
    }

    // 2) Fast path: engine says correct → no AI needed for the verdict.
    let result: AnswerEvaluation;
    if (verified === true) {
      result = { isCorrect: true, score: 100, feedback: '' };
    } else {
      // AI writes feedback (and judges ONLY when the engine had no verdict)
      result = await evaluateAnswer(
        currentExercise.question,
        openAnswer,
        currentExercise.sampleAnswer || currentExercise.explanation,
        userGrade,
        language,
        attemptNum,
        {
          verifiedCorrect: verified,
          topic: session.topicTitle,
          previousHints: shownHints,
        }
      );
    }

    setEvaluation(result);
    if (result.hint) setShownHints(h => [...h, result.hint!]);
    setEvaluating(false);

    if (!result.isCorrect && firstMistakeRef.current === null) {
      firstMistakeRef.current = classifyMistake(currentExercise, openAnswer);
    }

    if (result.isCorrect) {
      setIsSubmitted(true);
      markCorrect();
      recordSkillEvent(true, { studentAnswer: openAnswer });
    } else if (attemptNum >= MAX_ATTEMPTS) {
      setIsSubmitted(true);
      setWasCorrect(false);
      recordSkillEvent(false, { studentAnswer: openAnswer });
    }
  };

  const handleRevealSolution = () => {
    setWasCorrect(false);
    setIsSubmitted(true);
  };

  // ── SKIP ───────────────────────────────────────────────────────────────────
  const handleSkip = () => {
    if (!currentExercise || isSubmitted) return;
    setSkipped(true);
    setWasCorrect(false);
    setAttemptsTotal(t => t + 1);
    setIsSubmitted(true);
    recordSkillEvent(false, { skipped: true });
  };

  const handleNext = () => {
    if (currentIndex < quiz.length - 1) {
      setCurrentIndex(i => i + 1);
      resetQuestionState();
    } else {
      setQuizFinished(true);
      onComplete(totalXp, attemptsTotal, attemptsCorrect, session.topicId, currentExercise?.skillTag, skillEventsRef.current);
      skillEventsRef.current = [];
    }
  };

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-10">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Logo size={28} showText={false} />
            <span className="text-base font-bold text-ink-500 dark:text-ink-400">{translations.loading}</span>
          </div>
          <div className="w-full h-2.5 bg-cream-100 dark:bg-ink-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-shimmer animate-progress"></div>
          </div>
          <p className="text-xs text-ink-400 font-medium">{translations.preparingExercises}</p>
        </div>
      </div>
    );
  }

  // ── FINISHED SCREEN ────────────────────────────────────────────────────────
  if (quizFinished) {
    const percent = quiz.length > 0 ? Math.round((score / quiz.length) * 100) : 0;
    return (
      <div className="max-w-2xl mx-auto p-12 text-center space-y-8 animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded-full flex items-center justify-center mx-auto shadow-moss">
          <Trophy size={48} />
        </div>
        <div>
          <h2 className="text-4xl font-bold dark:text-white mb-2">{translations.courseCompleted}</h2>
          <p className="text-ink-400 dark:text-ink-400 text-lg">
            {translations.scoredOutOf
              .replace('{score}', score.toString())
              .replace('{total}', quiz.length.toString())}
          </p>
        </div>
        <div className="bg-white dark:bg-ink-800 p-8 rounded-3xl border border-ink-100 dark:border-ink-700 shadow-sm space-y-3">
          <div className="text-5xl font-bold text-moss-600 mb-2">{percent}%</div>
          <div className="text-sm font-bold text-ink-400 uppercase tracking-widest">{translations.mastery}</div>
          <div className="flex items-center justify-center gap-2 text-amber-500 font-bold">
            <Zap size={18} fill="currentColor" /> +{totalXp} XP
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={() => loadNewQuiz(true)} className="flex-1 py-4 bg-moss-500 hover:bg-moss-600 text-white rounded-2xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2">
            <RefreshCw size={20} /> {translations.tryNewSet}
          </button>
          {onGoToLesson && (
            <button onClick={onGoToLesson} className="flex-1 py-4 bg-cream-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 rounded-2xl font-bold hover:bg-cream-200 transition-all duration-150 flex items-center justify-center gap-2">
              <BookOpen size={18} /> {translations.continueLesson}
            </button>
          )}
          <button onClick={onBack} className="flex-1 py-4 bg-cream-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 rounded-2xl font-bold hover:bg-cream-200 transition-all duration-150">
            {translations.backToDashboard}
          </button>
        </div>
      </div>
    );
  }

  if (!currentExercise) return (
    <div className="max-w-4xl mx-auto p-12 text-center space-y-6">
      <h2 className="text-2xl font-bold dark:text-white">{translations.exploreLibrary}</h2>
      <button onClick={onBack} className="px-8 py-3 bg-moss-500 hover:bg-moss-600 text-white rounded-xl font-bold shadow-moss transition-all duration-150">{translations.backToDashboard}</button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 view-enter">
      <Confetti trigger={confettiBurst} count={50} />
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 mb-6 transition-colors"
      >
        <ChevronRight size={16} className="rotate-180 rtl:rotate-0" />
        {translations.backToDashboard}
      </button>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-ink-400">
          {translations.questions} {currentIndex + 1} / {quiz.length}
        </span>
        <div className="flex-1 h-1.5 bg-cream-100 dark:bg-ink-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-moss-500 rounded-full transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / quiz.length) * 100}%` }}
          ></div>
        </div>
        {currentExercise.skillTag && (
          <span className="px-3 py-1 bg-moss-50 dark:bg-moss-light/20 text-moss-600 dark:text-moss-400 rounded-full text-xs font-bold">
            {currentExercise.skillTag}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Question */}
        <div className="lg:col-span-8 space-y-4">
          {/* Question card */}
          <div className="bg-white dark:bg-ink-800 rounded-3xl border border-ink-100 dark:border-ink-700 p-8 shadow-sm">
            {/* Question type badge */}
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block mb-4 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              {qType === QuestionType.MULTIPLE_CHOICE ? ex.multipleChoice :
                qType === QuestionType.TRUE_FALSE ? ex.trueFalse :
                qType === QuestionType.NUMERIC ? ex.numeric :
                qType === QuestionType.MULTI_SELECT ? ex.multiSelect :
                qType === QuestionType.SHORT_ANSWER ? ex.shortAnswer :
                qType === QuestionType.MULTI_STEP ? ex.multiStep :
                qType === QuestionType.FILL_IN_BLANK ? ex.fillInBlank : ex.questionLabel}
            </span>

            {/* XP badge */}
            <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-full text-xs font-bold float-right">
              +{currentExercise.xpValue || 50} XP
            </span>

            {/* Difficulty indicator */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-moss-50 dark:bg-moss-light/30 text-moss-700 dark:text-moss-400 text-xs font-bold mb-4 ml-2">
              <Zap size={12} fill="currentColor" />
              {translations.difficulty}: {currentExercise.difficulty}/5
            </div>

            <h2 className="text-lg font-semibold text-ink-700 dark:text-ink-100 mb-6 leading-relaxed">
              <MathText>{currentExercise.question}</MathText>
            </h2>

            {/* Multi-step scaffolding */}
            {currentExercise.questionType === QuestionType.MULTI_STEP && currentExercise.steps && currentExercise.steps.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-bold text-ink-400 uppercase tracking-widest">{translations.stepByStep}</p>
                {currentExercise.steps.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 bg-cream-50 dark:bg-ink-800 rounded-xl">
                    <span className="w-6 h-6 rounded-full bg-moss-100 dark:bg-moss-light/30 text-moss-600 dark:text-moss-400 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                    <MathText className="text-sm text-ink-500 dark:text-ink-400">{step}</MathText>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── SINGLE-CHOICE OPTIONS (MC / TRUE-FALSE) ─────────────── */}
          {isChoiceType && (
            <div className={`grid grid-cols-1 ${qType === QuestionType.TRUE_FALSE ? 'sm:grid-cols-2' : 'md:grid-cols-2'} gap-2`}>
              {currentExercise.options.map((option) => {
                let stateStyle = "border-ink-100 dark:border-ink-700 hover:border-moss-300 hover:bg-moss-50 dark:hover:bg-moss-light/10";
                if (isSubmitted) {
                  if (option.id === currentExercise.correctOptionId) stateStyle = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300";
                  else if (option.id === selectedOption) stateStyle = "border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300";
                  else stateStyle = "opacity-40 border-ink-100 dark:border-ink-700";
                } else if (selectedOption === option.id) {
                  stateStyle = "border-moss-500 bg-moss-50 dark:bg-moss-light/20 text-moss-700 dark:text-moss-300";
                }
                return (
                  <button
                    key={option.id}
                    onClick={() => !isSubmitted && setSelectedOption(option.id)}
                    disabled={isSubmitted}
                    className={`w-full text-left px-5 py-4 rounded-xl border-2 font-medium text-ink-500 dark:text-ink-400 transition-all duration-150 hover:border-moss-300 hover:bg-moss-50 dark:hover:bg-moss-light/10 mb-2 flex items-center gap-4 ${stateStyle}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold border-2 transition-colors ${
                      isSubmitted && option.id === currentExercise.correctOptionId ? 'bg-green-500 text-white border-green-500' :
                      isSubmitted && option.id === selectedOption ? 'bg-red-400 text-white border-red-400' :
                      selectedOption === option.id ? 'bg-moss-500 text-white border-moss-500' : 'text-ink-400 dark:text-ink-400 border-ink-100 dark:border-ink-700'
                    }`}>
                      {String.fromCharCode(65 + currentExercise.options.indexOf(option))}
                    </div>
                    <MathText className="font-medium dark:text-ink-400">{option.text}</MathText>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── MULTI-SELECT OPTIONS (checkboxes) ───────────────────── */}
          {isMultiSelect && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-ink-400">{ex.selectAllApply}</p>
              {currentExercise.options.map((option) => {
                const checked = multiSelected.has(option.id);
                const isRight = (currentExercise.correctOptionIds ?? []).includes(option.id);
                let stateStyle = 'border-ink-100 dark:border-ink-700 hover:border-moss-300 hover:bg-moss-50 dark:hover:bg-moss-light/10';
                if (isSubmitted) {
                  if (isRight) stateStyle = 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300';
                  else if (checked) stateStyle = 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300';
                  else stateStyle = 'opacity-40 border-ink-100 dark:border-ink-700';
                } else if (checked) {
                  stateStyle = 'border-moss-500 bg-moss-50 dark:bg-moss-light/20 text-moss-700 dark:text-moss-300';
                }
                return (
                  <button
                    key={option.id}
                    onClick={() => {
                      if (isSubmitted) return;
                      setMultiSelected(prev => {
                        const next = new Set(prev);
                        if (next.has(option.id)) next.delete(option.id);
                        else next.add(option.id);
                        return next;
                      });
                    }}
                    disabled={isSubmitted}
                    className={`w-full text-start px-5 py-4 rounded-xl border-2 font-medium text-ink-500 dark:text-ink-400 transition-all duration-150 flex items-center gap-4 min-h-[52px] ${stateStyle}`}
                  >
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSubmitted && isRight ? 'bg-green-500 border-green-500 text-white' :
                      checked ? 'bg-moss-500 border-moss-500 text-white' : 'border-ink-200 dark:border-ink-600'
                    }`}>
                      {(checked || (isSubmitted && isRight)) && <CheckCircle size={14} />}
                    </div>
                    <MathText className="font-medium dark:text-ink-400">{option.text}</MathText>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── OPEN ANSWER INPUT ──────────────────────────────────── */}
          {isOpenType && !isSubmitted && (
            <div className="bg-white dark:bg-ink-800 rounded-2xl border border-ink-100 dark:border-ink-700 shadow-sm p-6 space-y-4">
              {qType === QuestionType.NUMERIC ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={openAnswer}
                  onChange={e => setOpenAnswer(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleOpenSubmit(); }}
                  placeholder={translations.typeYourAnswer}
                  className="w-full px-4 py-3.5 bg-cream-50 dark:bg-ink-800 border border-ink-100 dark:border-ink-700 rounded-xl text-base font-mono outline-none focus:border-moss-500 focus:ring-2 focus:ring-moss-500/20 transition-all text-ink-600 dark:text-ink-200"
                />
              ) : (
                <textarea
                  ref={textAreaRef}
                  value={openAnswer}
                  onChange={e => setOpenAnswer(e.target.value)}
                  placeholder={translations.typeYourAnswer}
                  rows={4}
                  className="w-full px-4 py-3 bg-cream-50 dark:bg-ink-800 border border-ink-100 dark:border-ink-700 rounded-xl text-sm outline-none focus:border-moss-500 focus:ring-2 focus:ring-moss-500/20 transition-all text-ink-600 dark:text-ink-400 resize-none"
                />
              )}
              {/* Evaluation feedback (before full submission) */}
              {evaluation && !isSubmitted && (
                <div className={`p-5 rounded-2xl text-sm animate-in fade-in ${
                  evaluation.isCorrect
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                }`}>
                  <p className="font-semibold text-sm mb-2">{evaluation.isCorrect ? translations.correct : translations.partiallyCorrect}</p>
                  <MathText className="text-sm leading-relaxed">{evaluation.feedback}</MathText>
                  {evaluation.followUp && <p className="mt-2 font-semibold text-sm"><MathText>{evaluation.followUp}</MathText></p>}
                  {evaluation.hint && <p className="mt-2 italic text-xs opacity-80">{translations.hint}: <MathText>{evaluation.hint}</MathText></p>}
                  <p className="mt-2 text-xs opacity-60">{translations.maxAttemptsReached.replace('3', MAX_ATTEMPTS.toString())}</p>
                </div>
              )}
            </div>
          )}

          {/* ── POST-SUBMISSION FEEDBACK ───────────────────────────── */}
          {isSubmitted && (
            <div className="bg-white dark:bg-ink-800 rounded-2xl border border-ink-100 dark:border-ink-700 shadow-sm p-6 space-y-4 animate-in fade-in slide-in-from-top-4">
              {/* Result badge — driven by the single verified verdict */}
              <div className={`p-4 rounded-2xl text-center font-bold text-lg flex items-center justify-center gap-3 ${
                wasCorrect
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : skipped || solutionRevealed
                    ? 'bg-cream-100 dark:bg-ink-800 border border-ink-100 dark:border-ink-700'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                {wasCorrect
                  ? <><CheckCircle size={22} className="text-green-600 dark:text-green-400" /> <span className="text-green-700 dark:text-green-300">{translations.correct}</span></>
                  : skipped
                    ? <><SkipForward size={22} className="text-ink-400" /> <span className="text-ink-500 dark:text-ink-400">{ex.skipped}</span></>
                    : solutionRevealed
                      ? <><Eye size={22} className="text-ink-400" /> <span className="text-ink-500 dark:text-ink-400">{translations.revealSolution}</span></>
                      : <><XCircle size={22} className="text-red-500" /> <span className="text-red-700 dark:text-red-400">{translations.incorrect}</span></>
                }
              </div>

              {/* AI feedback */}
              {evaluation?.feedback && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5 mt-4">
                  <h4 className="font-semibold text-sm mb-2">{translations.feedback}</h4>
                  <p className="text-sm leading-relaxed">
                    <MathText>{evaluation.feedback}</MathText>
                  </p>
                </div>
              )}

              {/* Explanation */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5 mt-4">
                <h4 className="font-semibold text-sm mb-2">{translations.explanation}</h4>
                <p className="text-sm leading-relaxed">
                  <MathText>{currentExercise.explanation}</MathText>
                </p>
              </div>

              {/* Progressive step-by-step worked solution (fetched on demand) */}
              <StepReveal
                key={currentExercise.id}
                problem={currentExercise.question}
                grade={session.grade}
                language={language}
                translations={translations}
                context={currentExercise.skillTag ? `Skill: ${currentExercise.skillTag}` : undefined}
              />

              {/* Full solution (open types: max attempts reached or skipped) */}
              {isOpenType && (evaluation?.fullSolution || solutionRevealed || skipped) && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 mt-4">
                  <h4 className="font-semibold text-sm mb-2 text-blue-600 dark:text-blue-400">{translations.revealSolution}</h4>
                  <p className="text-sm leading-relaxed">
                    <MathText>{evaluation?.fullSolution || currentExercise.sampleAnswer || ''}</MathText>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-ink-800 rounded-2xl border border-ink-100 dark:border-ink-700 shadow-sm p-6">
            {!isSubmitted ? (
              <div className="space-y-4">
                <h3 className="font-bold dark:text-white uppercase tracking-widest text-sm flex items-center gap-2">
                  <BookOpen size={18} className="text-moss-600" /> {translations.tools}
                </h3>

                {/* Optional confidence check — feeds the mastery engine */}
                <div>
                  <p className="text-[11px] font-bold text-ink-400 uppercase tracking-wider mb-1.5">{ex.howSure}</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([[1, '🎲', ex.guessing], [2, '🤔', ex.thinkSo], [3, '💪', ex.sure]] as const).map(([lvl, emoji, label]) => (
                      <button
                        key={lvl}
                        onClick={() => setConfidence(c => (c === lvl ? undefined : lvl as ConfidenceLevel))}
                        className={`px-1 py-2 rounded-lg text-[11px] font-bold border transition-colors min-h-[44px] ${
                          confidence === lvl
                            ? 'bg-moss-500 text-white border-moss-500'
                            : 'bg-cream-50 dark:bg-ink-900/40 text-ink-400 border-ink-100 dark:border-ink-700 hover:border-moss-300'
                        }`}
                      >
                        <span className="block text-sm leading-none mb-0.5">{emoji}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Single-choice submit (MC / true-false) */}
                {isChoiceType && (
                  <button
                    onClick={handleMCSubmit}
                    disabled={!selectedOption}
                    className="w-full py-3.5 bg-moss-500 hover:bg-moss-600 text-white rounded-xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] mt-4 disabled:opacity-30"
                  >
                    {translations.submit}
                  </button>
                )}

                {/* Multi-select submit */}
                {isMultiSelect && (
                  <button
                    onClick={handleMultiSelectSubmit}
                    disabled={multiSelected.size === 0}
                    className="w-full py-3.5 bg-moss-500 hover:bg-moss-600 text-white rounded-xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] mt-4 disabled:opacity-30"
                  >
                    {translations.submit}
                  </button>
                )}

                {/* Open submit */}
                {isOpenType && (
                  <>
                    <button
                      onClick={handleOpenSubmit}
                      disabled={!openAnswer.trim() || evaluating}
                      className="w-full py-3.5 bg-moss-500 hover:bg-moss-600 text-white rounded-xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] mt-4 disabled:opacity-30 flex items-center justify-center gap-2"
                    >
                      {evaluating ? (
                        <><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{animationDelay:'0ms'}}></span><span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{animationDelay:'150ms'}}></span><span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{animationDelay:'300ms'}}></span></span> {translations.thinking}</>
                      ) : (
                        <><Send size={18} /> {translations.checkAnswer}</>
                      )}
                    </button>
                    {attempts > 0 && attempts < MAX_ATTEMPTS && (
                      <p className="text-center text-xs text-ink-400 font-bold">
                        {translations.tryAgain} ({ex.attemptsLeft(MAX_ATTEMPTS - attempts)})
                      </p>
                    )}
                    {attempts >= MAX_ATTEMPTS && !isSubmitted && (
                      <button
                        onClick={handleRevealSolution}
                        className="w-full py-3 text-ink-400 dark:text-ink-400 font-bold hover:text-moss-600 flex items-center justify-center gap-2 transition-colors border border-ink-100 dark:border-ink-700 rounded-xl"
                      >
                        <Eye size={18} /> {translations.revealSolution}
                      </button>
                    )}
                  </>
                )}

                {/* Hint + Skip */}
                <div className="flex gap-2">
                  <button onClick={() => setShowHint(true)} className="flex-1 py-3 text-ink-400 dark:text-ink-400 font-bold hover:text-moss-600 flex items-center justify-center gap-2 transition-colors duration-150 min-h-[44px]">
                    <Lightbulb size={18} /> {translations.hint}
                  </button>
                  <button onClick={handleSkip} className="flex-1 py-3 text-ink-400 dark:text-ink-400 font-bold hover:text-clay-500 flex items-center justify-center gap-2 transition-colors duration-150 min-h-[44px]">
                    <SkipForward size={18} /> {ex.skip}
                  </button>
                </div>
                {showHint && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm font-medium text-amber-800 dark:text-amber-200 animate-in slide-in-from-top-2">
                    <MathText>{currentExercise.hint}</MathText>
                  </div>
                )}

                {/* Attempts indicator for open questions */}
                {isOpenType && attempts > 0 && (
                  <div className="flex items-center gap-1 justify-center">
                    {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i < attempts ? 'bg-amber-400' : 'bg-cream-200 dark:bg-ink-700'}`}></div>
                    ))}
                    <span className="text-xs text-ink-400 ms-2">{ex.attemptsCount(attempts, MAX_ATTEMPTS)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                <button onClick={handleNext} className="w-full py-3.5 bg-moss-500 hover:bg-moss-600 text-white rounded-xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] mt-4 flex items-center justify-center gap-2">
                  {currentIndex < quiz.length - 1 ? translations.next : translations.courseCompleted}
                  <ArrowRight size={20} className="rtl:rotate-180" />
                </button>
                {onGoToLesson && (
                  <button onClick={onGoToLesson} className="w-full py-3 text-ink-400 dark:text-ink-400 font-bold hover:text-moss-600 flex items-center justify-center gap-2 transition-colors duration-150">
                    <BookOpen size={16} /> {translations.backToLesson}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Score tracker */}
          <div className="bg-white dark:bg-ink-800 rounded-2xl border border-ink-100 dark:border-ink-700 shadow-sm p-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-ink-400 uppercase tracking-widest">{translations.xp}</span>
              <span className="text-moss-600 font-bold">+{totalXp}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-ink-400 uppercase tracking-widest">{translations.mastery}</span>
              <span className="font-bold text-ink-500 dark:text-ink-400">{score}/{quiz.length > 0 ? quiz.length : '?'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExercisePanel;
