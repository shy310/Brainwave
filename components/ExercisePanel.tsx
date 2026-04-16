
import React, { useState, useEffect, useRef } from 'react';
import { Exercise, QuestionType, LearningSession, GradeLevel, Language, Translations, AnswerEvaluation } from '../types';
import {
  CheckCircle, XCircle, Lightbulb, RefreshCw, ChevronRight, BookOpen,
  Zap, Trophy, ArrowRight, Send, Eye, AlertTriangle, HelpCircle
} from 'lucide-react';
import { generateQuiz, evaluateAnswer } from '../services/aiService';
import Logo from './Logo';
import MathText from './MathText';

const MAX_ATTEMPTS = 3;

// Module-level cache — persists across ALL remounts and re-renders.
// Keyed by "subject::topicId::grade::language"
const _quizCache = new Map<string, Exercise[]>();
// Prevents concurrent generateQuiz calls for the same key.
const _loadingKeys = new Set<string>();

// localStorage key for persisting the quiz cache across HMR and page reloads.
const LS_QUIZ_KEY = 'brainwave_quiz_cache_v2';

// Hydrate in-memory cache from localStorage on module load.
try {
  const saved = JSON.parse(localStorage.getItem(LS_QUIZ_KEY) || '{}');
  for (const [k, v] of Object.entries(saved)) {
    if (Array.isArray(v) && v.length > 0) _quizCache.set(k, v as Exercise[]);
  }
} catch { /* ignore malformed data */ }

function saveQuizCache() {
  try {
    const toSave: Record<string, Exercise[]> = {};
    _quizCache.forEach((v, k) => { toSave[k] = v; });
    localStorage.setItem(LS_QUIZ_KEY, JSON.stringify(toSave));
  } catch { /* ignore quota errors */ }
}

interface Props {
  session: LearningSession;
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  onComplete: (xpEarned: number, attemptsTotal: number, attemptsCorrect: number, topicId?: string | null, skillTag?: string) => void;
  onBack: () => void;
  onContextUpdate: (ctx: string) => void;
  onGoToLesson?: () => void;
  onQuizGenerated?: (quiz: Exercise[]) => void;
}

const ExercisePanel: React.FC<Props> = ({
  session, userGrade, language, translations,
  onComplete, onBack, onContextUpdate, onGoToLesson, onQuizGenerated
}) => {
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

  // Multiple Choice state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Open answer state (SHORT_ANSWER, MULTI_STEP, FILL_IN_BLANK)
  const [openAnswer, setOpenAnswer] = useState('');
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const [showHint, setShowHint] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [attempts, setAttempts] = useState(0); // attempts on current question
  const [score, setScore] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [attemptsTotal, setAttemptsTotal] = useState(0);
  const [attemptsCorrect, setAttemptsCorrect] = useState(0);

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

    const subjectName = session.subject;
    const topicName = session.topicTitle;
    onContextUpdate(`Quiz: ${subjectName} — ${topicName} (${userGrade})`);

    const contextStr = session.studyContext.length > 0
      ? `Based on uploaded files: ${session.studyContext.map(a => a.name).join(', ')}`
      : undefined;

    const questionTypes = [QuestionType.MULTIPLE_CHOICE, QuestionType.SHORT_ANSWER, QuestionType.FILL_IN_BLANK];

    const newQuiz = await generateQuiz(
      subjectName,
      userGrade,
      topicName,
      language,
      contextStr,
      session.studyContext,
      questionTypes,
      10
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
    setOpenAnswer('');
    setEvaluation(null);
    setShowHint(false);
    setIsSubmitted(false);
    setAttempts(0);
    setEvaluating(false);
  };

  const currentExercise = quiz[currentIndex];
  const isMultipleChoice = currentExercise?.questionType === QuestionType.MULTIPLE_CHOICE || !currentExercise?.questionType;
  const isOpenType = !isMultipleChoice;
  const solutionRevealed = isOpenType && attempts >= MAX_ATTEMPTS;

  // ── MULTIPLE CHOICE SUBMIT ─────────────────────────────────────────────────
  const handleMCSubmit = () => {
    if (!selectedOption || !currentExercise) return;
    const correct = selectedOption === currentExercise.correctOptionId;
    setIsSubmitted(true);
    setAttempts(a => a + 1);
    setAttemptsTotal(t => t + 1);
    if (correct) {
      setScore(s => s + 1);
      setAttemptsCorrect(c => c + 1);
      setTotalXp(x => x + (currentExercise.xpValue || 50));
    }
  };

  // ── OPEN ANSWER SUBMIT ────────────────────────────────────────────────────
  const handleOpenSubmit = async () => {
    if (!openAnswer.trim() || !currentExercise || evaluating) return;
    setEvaluating(true);
    const attemptNum = attempts + 1;
    setAttempts(attemptNum);
    setAttemptsTotal(t => t + 1);

    const result = await evaluateAnswer(
      currentExercise.question,
      openAnswer,
      currentExercise.sampleAnswer || currentExercise.explanation,
      userGrade,
      language,
      attemptNum
    );

    setEvaluation(result);
    setEvaluating(false);

    if (result.isCorrect || result.score >= 80) {
      setIsSubmitted(true);
      setScore(s => s + 1);
      setAttemptsCorrect(c => c + 1);
      setTotalXp(x => x + (currentExercise.xpValue || 50));
    } else if (attemptNum >= MAX_ATTEMPTS) {
      setIsSubmitted(true);
    }
  };

  const handleRevealSolution = () => {
    setIsSubmitted(true);
  };

  const handleNext = () => {
    if (currentIndex < quiz.length - 1) {
      setCurrentIndex(i => i + 1);
      resetQuestionState();
    } else {
      setQuizFinished(true);
      onComplete(totalXp, attemptsTotal, attemptsCorrect, session.topicId, currentExercise?.skillTag);
    }
  };

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-10">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Logo size={28} showText={false} />
            <span className="text-base font-bold text-zinc-700 dark:text-zinc-200">{translations.loading}</span>
          </div>
          <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-shimmer animate-progress"></div>
          </div>
          <p className="text-xs text-zinc-400 font-medium">{translations.preparingExercises}</p>
        </div>
      </div>
    );
  }

  // ── FINISHED SCREEN ────────────────────────────────────────────────────────
  if (quizFinished) {
    const percent = quiz.length > 0 ? Math.round((score / quiz.length) * 100) : 0;
    return (
      <div className="max-w-2xl mx-auto p-12 text-center space-y-8 animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded-full flex items-center justify-center mx-auto shadow-brand">
          <Trophy size={48} />
        </div>
        <div>
          <h2 className="text-4xl font-bold dark:text-white mb-2">{translations.courseCompleted}</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg">
            {translations.scoredOutOf
              .replace('{score}', score.toString())
              .replace('{total}', quiz.length.toString())}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-3">
          <div className="text-5xl font-bold text-brand-600 mb-2">{percent}%</div>
          <div className="text-sm font-bold text-zinc-400 uppercase tracking-widest">{translations.mastery}</div>
          <div className="flex items-center justify-center gap-2 text-amber-500 font-bold">
            <Zap size={18} fill="currentColor" /> +{totalXp} XP
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={() => loadNewQuiz(true)} className="flex-1 py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-semibold shadow-brand transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2">
            <RefreshCw size={20} /> {translations.tryNewSet}
          </button>
          {onGoToLesson && (
            <button onClick={onGoToLesson} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-2xl font-bold hover:bg-zinc-200 transition-all duration-150 flex items-center justify-center gap-2">
              <BookOpen size={18} /> {translations.continueLesson}
            </button>
          )}
          <button onClick={onBack} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-2xl font-bold hover:bg-zinc-200 transition-all duration-150">
            {translations.backToDashboard}
          </button>
        </div>
      </div>
    );
  }

  if (!currentExercise) return (
    <div className="max-w-4xl mx-auto p-12 text-center space-y-6">
      <h2 className="text-2xl font-bold dark:text-white">{translations.exploreLibrary}</h2>
      <button onClick={onBack} className="px-8 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold shadow-brand transition-all duration-150">{translations.backToDashboard}</button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 view-enter">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-6 transition-colors"
      >
        <ChevronRight size={16} className="rotate-180 rtl:rotate-0" />
        {translations.backToDashboard}
      </button>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-zinc-500">
          {translations.questions} {currentIndex + 1} / {quiz.length}
        </span>
        <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / quiz.length) * 100}%` }}
          ></div>
        </div>
        {currentExercise.skillTag && (
          <span className="px-3 py-1 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-full text-xs font-bold">
            {currentExercise.skillTag}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Question */}
        <div className="lg:col-span-8 space-y-4">
          {/* Question card */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 p-8 shadow-sm">
            {/* Question type badge */}
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block mb-4 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              {currentExercise.questionType === QuestionType.MULTIPLE_CHOICE ? 'Multiple Choice' :
                currentExercise.questionType === QuestionType.SHORT_ANSWER ? 'Short Answer' :
                currentExercise.questionType === QuestionType.MULTI_STEP ? 'Multi-Step' :
                currentExercise.questionType === QuestionType.FILL_IN_BLANK ? 'Fill in the Blank' : 'Question'}
            </span>

            {/* XP badge */}
            <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-full text-xs font-bold float-right">
              +{currentExercise.xpValue || 50} XP
            </span>

            {/* Difficulty indicator */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-xs font-bold mb-4 ml-2">
              <Zap size={12} fill="currentColor" />
              {translations.difficulty}: {currentExercise.difficulty}/5
            </div>

            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6 leading-relaxed">
              <MathText>{currentExercise.question}</MathText>
            </h2>

            {/* Multi-step scaffolding */}
            {currentExercise.questionType === QuestionType.MULTI_STEP && currentExercise.steps && currentExercise.steps.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{translations.stepByStep}</p>
                {currentExercise.steps.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                    <span className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                    <MathText className="text-sm text-zinc-600 dark:text-zinc-400">{step}</MathText>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── MULTIPLE CHOICE OPTIONS ─────────────────────────────── */}
          {isMultipleChoice && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {currentExercise.options.map((option) => {
                let stateStyle = "border-zinc-100 dark:border-zinc-800 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/10";
                if (isSubmitted) {
                  if (option.id === currentExercise.correctOptionId) stateStyle = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300";
                  else if (option.id === selectedOption) stateStyle = "border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300";
                  else stateStyle = "opacity-40 border-zinc-100 dark:border-zinc-800";
                } else if (selectedOption === option.id) {
                  stateStyle = "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300";
                }
                return (
                  <button
                    key={option.id}
                    onClick={() => !isSubmitted && setSelectedOption(option.id)}
                    disabled={isSubmitted}
                    className={`w-full text-left px-5 py-4 rounded-xl border-2 font-medium text-zinc-700 dark:text-zinc-300 transition-all duration-150 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/10 mb-2 flex items-center gap-4 ${stateStyle}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold border-2 transition-colors ${
                      isSubmitted && option.id === currentExercise.correctOptionId ? 'bg-green-500 text-white border-green-500' :
                      isSubmitted && option.id === selectedOption ? 'bg-red-400 text-white border-red-400' :
                      selectedOption === option.id ? 'bg-brand-500 text-white border-brand-500' : 'text-zinc-400 dark:text-zinc-500 border-zinc-100 dark:border-zinc-700'
                    }`}>
                      {String.fromCharCode(65 + currentExercise.options.indexOf(option))}
                    </div>
                    <MathText className="font-medium dark:text-zinc-200">{option.text}</MathText>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── OPEN ANSWER INPUT ──────────────────────────────────── */}
          {isOpenType && !isSubmitted && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-6 space-y-4">
              <textarea
                ref={textAreaRef}
                value={openAnswer}
                onChange={e => setOpenAnswer(e.target.value)}
                placeholder={translations.typeYourAnswer}
                rows={4}
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-zinc-800 dark:text-zinc-200 resize-none"
              />
              {/* Evaluation feedback (before full submission) */}
              {evaluation && !isSubmitted && (
                <div className={`p-5 rounded-2xl text-sm animate-in fade-in ${
                  evaluation.isCorrect || evaluation.score >= 80
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                }`}>
                  <p className="font-semibold text-sm mb-2">{evaluation.score >= 80 ? translations.correct : translations.partiallyCorrect}</p>
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
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-6 space-y-4 animate-in fade-in slide-in-from-top-4">
              {/* Result badge */}
              <div className={`p-4 rounded-2xl text-center font-bold text-lg flex items-center justify-center gap-3 ${
                (isMultipleChoice ? selectedOption === currentExercise.correctOptionId : (evaluation?.isCorrect || (evaluation?.score ?? 0) >= 80))
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : solutionRevealed
                    ? 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                {(isMultipleChoice ? selectedOption === currentExercise.correctOptionId : (evaluation?.isCorrect || (evaluation?.score ?? 0) >= 80))
                  ? <><CheckCircle size={22} className="text-green-600 dark:text-green-400" /> <span className="text-green-700 dark:text-green-300">{translations.correct}</span></>
                  : solutionRevealed
                    ? <><Eye size={22} className="text-zinc-500" /> <span className="text-zinc-600 dark:text-zinc-400">{translations.revealSolution}</span></>
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

              {/* Full solution (open types, max attempts reached) */}
              {isOpenType && (evaluation?.fullSolution || solutionRevealed) && (
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
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-6">
            {!isSubmitted ? (
              <div className="space-y-4">
                <h3 className="font-bold dark:text-white uppercase tracking-widest text-sm flex items-center gap-2">
                  <BookOpen size={18} className="text-brand-600" /> {translations.tools}
                </h3>

                {/* MC submit */}
                {isMultipleChoice && (
                  <button
                    onClick={handleMCSubmit}
                    disabled={!selectedOption}
                    className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold shadow-brand transition-all duration-150 active:scale-[0.98] mt-4 disabled:opacity-30"
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
                      className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold shadow-brand transition-all duration-150 active:scale-[0.98] mt-4 disabled:opacity-30 flex items-center justify-center gap-2"
                    >
                      {evaluating ? (
                        <><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{animationDelay:'0ms'}}></span><span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{animationDelay:'150ms'}}></span><span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{animationDelay:'300ms'}}></span></span> {translations.thinking}</>
                      ) : (
                        <><Send size={18} /> {translations.checkAnswer}</>
                      )}
                    </button>
                    {attempts > 0 && attempts < MAX_ATTEMPTS && (
                      <p className="text-center text-xs text-zinc-400 font-bold">
                        {translations.tryAgain} ({MAX_ATTEMPTS - attempts} left)
                      </p>
                    )}
                    {attempts >= MAX_ATTEMPTS && !isSubmitted && (
                      <button
                        onClick={handleRevealSolution}
                        className="w-full py-3 text-zinc-500 dark:text-zinc-400 font-bold hover:text-brand-600 flex items-center justify-center gap-2 transition-colors border border-zinc-200 dark:border-zinc-700 rounded-xl"
                      >
                        <Eye size={18} /> {translations.revealSolution}
                      </button>
                    )}
                  </>
                )}

                {/* Hint */}
                <button onClick={() => setShowHint(true)} className="w-full py-3 text-zinc-500 dark:text-zinc-400 font-bold hover:text-brand-600 flex items-center justify-center gap-2 transition-colors duration-150">
                  <Lightbulb size={18} /> {translations.hint}
                </button>
                {showHint && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm font-medium text-amber-800 dark:text-amber-200 animate-in slide-in-from-top-2">
                    <MathText>{currentExercise.hint}</MathText>
                  </div>
                )}

                {/* Attempts indicator for open questions */}
                {isOpenType && attempts > 0 && (
                  <div className="flex items-center gap-1 justify-center">
                    {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i < attempts ? 'bg-amber-400' : 'bg-zinc-200 dark:bg-zinc-700'}`}></div>
                    ))}
                    <span className="text-xs text-zinc-400 ms-2">{attempts}/{MAX_ATTEMPTS} attempts</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                <button onClick={handleNext} className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold shadow-brand transition-all duration-150 active:scale-[0.98] mt-4 flex items-center justify-center gap-2">
                  {currentIndex < quiz.length - 1 ? translations.next : translations.courseCompleted}
                  <ArrowRight size={20} className="rtl:rotate-180" />
                </button>
                {onGoToLesson && (
                  <button onClick={onGoToLesson} className="w-full py-3 text-zinc-500 dark:text-zinc-400 font-bold hover:text-brand-600 flex items-center justify-center gap-2 transition-colors duration-150">
                    <BookOpen size={16} /> {translations.backToLesson}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Score tracker */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{translations.xp}</span>
              <span className="text-brand-600 font-bold">+{totalXp}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{translations.mastery}</span>
              <span className="font-bold text-zinc-700 dark:text-zinc-300">{score}/{quiz.length > 0 ? quiz.length : '?'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExercisePanel;
