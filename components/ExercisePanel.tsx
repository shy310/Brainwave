
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
// Keyed by "subject::topicId::grade" — language is intentionally excluded.
const _quizCache = new Map<string, Exercise[]>();
// Prevents concurrent generateQuiz calls for the same key.
const _loadingKeys = new Set<string>();

// localStorage key for persisting the quiz cache across HMR and page reloads.
const LS_QUIZ_KEY = 'brainwave_quiz_cache_v1';

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
    const key = `${session.subject}::${session.topicId ?? ''}::${session.grade}`;
    return _quizCache.get(key) ?? session.quiz ?? [];
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  // Start spinner immediately if no cached quiz, so there's no flash of empty state.
  const [loading, setLoading] = useState(() => {
    if (isUploadSession) return (session.quiz ?? []).length === 0;
    const key = `${session.subject}::${session.topicId ?? ''}::${session.grade}`;
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
      : `${session.subject}::${session.topicId ?? ''}::${session.grade}`;
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
            <span className="text-base font-bold text-gray-700 dark:text-gray-200">{translations.loading}</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-shimmer animate-progress"></div>
          </div>
          <p className="text-xs text-gray-400 font-medium">{translations.preparingExercises}</p>
        </div>
      </div>
    );
  }

  // ── FINISHED SCREEN ────────────────────────────────────────────────────────
  if (quizFinished) {
    const percent = quiz.length > 0 ? Math.round((score / quiz.length) * 100) : 0;
    return (
      <div className="max-w-2xl mx-auto p-12 text-center space-y-8 animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded-full flex items-center justify-center mx-auto shadow-xl">
          <Trophy size={48} />
        </div>
        <div>
          <h2 className="text-4xl font-black dark:text-white mb-2">{translations.courseCompleted}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            {translations.scoredOutOf
              .replace('{score}', score.toString())
              .replace('{total}', quiz.length.toString())}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
          <div className="text-5xl font-black text-brand-600 mb-2">{percent}%</div>
          <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">{translations.mastery}</div>
          <div className="flex items-center justify-center gap-2 text-amber-500 font-bold">
            <Zap size={18} fill="currentColor" /> +{totalXp} XP
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={() => loadNewQuiz(true)} className="flex-1 py-4 bg-brand-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-brand-700 transition-all shadow-lg">
            <RefreshCw size={20} /> {translations.tryNewSet}
          </button>
          {onGoToLesson && (
            <button onClick={onGoToLesson} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-2xl font-black hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
              <BookOpen size={18} /> {translations.continueLesson}
            </button>
          )}
          <button onClick={onBack} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-2xl font-black hover:bg-gray-200 transition-all">
            {translations.backToDashboard}
          </button>
        </div>
      </div>
    );
  }

  if (!currentExercise) return (
    <div className="max-w-4xl mx-auto p-12 text-center space-y-6">
      <h2 className="text-2xl font-bold dark:text-white">{translations.exploreLibrary}</h2>
      <button onClick={onBack} className="px-8 py-3 bg-brand-600 text-white rounded-xl font-bold">{translations.backToDashboard}</button>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto p-6 md:p-12 animate-in fade-in duration-500">
      {/* Progress */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          <span>{translations.questions} {currentIndex + 1} / {quiz.length}</span>
          <div className="flex items-center gap-3">
            {currentExercise.skillTag && (
              <span className="px-3 py-1 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-full text-xs font-bold">
                {currentExercise.skillTag}
              </span>
            )}
            <span>{Math.round(((currentIndex + 1) / quiz.length) * 100)}%</span>
          </div>
        </div>
        <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 transition-all duration-500" style={{ width: `${((currentIndex + 1) / quiz.length) * 100}%` }}></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Question */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-10 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-xs font-bold uppercase tracking-widest">
                <Zap size={14} fill="currentColor" />
                {translations.difficulty}: {currentExercise.difficulty}/5
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                {currentExercise.questionType === QuestionType.MULTIPLE_CHOICE ? 'Multiple Choice' :
                  currentExercise.questionType === QuestionType.SHORT_ANSWER ? 'Short Answer' :
                  currentExercise.questionType === QuestionType.MULTI_STEP ? 'Multi-Step' :
                  currentExercise.questionType === QuestionType.FILL_IN_BLANK ? 'Fill in the Blank' : 'Question'}
              </div>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white leading-tight">
              <MathText>{currentExercise.question}</MathText>
            </h2>

            {/* Multi-step scaffolding */}
            {currentExercise.questionType === QuestionType.MULTI_STEP && currentExercise.steps && currentExercise.steps.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{translations.stepByStep}</p>
                {currentExercise.steps.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                    <span className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-black flex-shrink-0">{i + 1}</span>
                    <MathText className="text-sm text-gray-600 dark:text-gray-400">{step}</MathText>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── MULTIPLE CHOICE OPTIONS ─────────────────────────────── */}
          {isMultipleChoice && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentExercise.options.map((option) => {
                let stateStyle = "border-gray-100 dark:border-gray-800 hover:border-brand-400 dark:hover:border-gray-700 bg-white dark:bg-gray-800";
                if (isSubmitted) {
                  if (option.id === currentExercise.correctOptionId) stateStyle = "border-green-500 bg-green-50 dark:bg-green-900/20";
                  else if (option.id === selectedOption) stateStyle = "border-red-500 bg-red-50 dark:bg-red-900/20";
                  else stateStyle = "opacity-40 border-gray-100 dark:border-gray-800";
                } else if (selectedOption === option.id) {
                  stateStyle = "border-brand-600 bg-brand-50 dark:bg-brand-900/10 ring-2 ring-brand-500/20 shadow-md";
                }
                return (
                  <button
                    key={option.id}
                    onClick={() => !isSubmitted && setSelectedOption(option.id)}
                    disabled={isSubmitted}
                    className={`w-full p-6 text-left border-2 rounded-2xl transition-all flex items-center gap-4 ${stateStyle}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black border-2 transition-colors ${
                      isSubmitted && option.id === currentExercise.correctOptionId ? 'bg-green-500 text-white border-green-500' :
                      isSubmitted && option.id === selectedOption ? 'bg-red-500 text-white border-red-500' :
                      selectedOption === option.id ? 'bg-brand-600 text-white border-brand-600' : 'text-gray-400 dark:text-gray-500 border-gray-100 dark:border-gray-700'
                    }`}>
                      {String.fromCharCode(65 + currentExercise.options.indexOf(option))}
                    </div>
                    <MathText className="font-bold dark:text-gray-200">{option.text}</MathText>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── OPEN ANSWER INPUT ──────────────────────────────────── */}
          {isOpenType && !isSubmitted && (
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
              <textarea
                ref={textAreaRef}
                value={openAnswer}
                onChange={e => setOpenAnswer(e.target.value)}
                placeholder={translations.typeYourAnswer}
                rows={4}
                className="w-full p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-base"
              />
              {/* Evaluation feedback (before full submission) */}
              {evaluation && !isSubmitted && (
                <div className={`p-4 rounded-2xl text-sm font-medium animate-in fade-in ${
                  evaluation.isCorrect || evaluation.score >= 80
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-100 dark:border-green-900/30'
                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-100 dark:border-amber-900/30'
                }`}>
                  <p className="font-bold mb-1">{evaluation.score >= 80 ? translations.correct : translations.partiallyCorrect}</p>
                  <MathText>{evaluation.feedback}</MathText>
                  {evaluation.followUp && <p className="mt-2 font-bold"><MathText>{evaluation.followUp}</MathText></p>}
                  {evaluation.hint && <p className="mt-2 italic text-xs opacity-80">{translations.hint}: <MathText>{evaluation.hint}</MathText></p>}
                  <p className="mt-2 text-xs opacity-60">{translations.maxAttemptsReached.replace('3', MAX_ATTEMPTS.toString())}</p>
                </div>
              )}
            </div>
          )}

          {/* ── POST-SUBMISSION FEEDBACK ───────────────────────────── */}
          {isSubmitted && (
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 border border-gray-100 dark:border-gray-700 shadow-sm space-y-6 animate-in fade-in slide-in-from-top-4">
              {/* Result badge */}
              <div className={`p-4 rounded-2xl text-center font-black text-xl flex items-center justify-center gap-3 ${
                (isMultipleChoice ? selectedOption === currentExercise.correctOptionId : (evaluation?.isCorrect || (evaluation?.score ?? 0) >= 80))
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : solutionRevealed
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              }`}>
                {(isMultipleChoice ? selectedOption === currentExercise.correctOptionId : (evaluation?.isCorrect || (evaluation?.score ?? 0) >= 80))
                  ? <><CheckCircle size={24} /> {translations.correct}</>
                  : solutionRevealed
                    ? <><Eye size={24} /> {translations.revealSolution}</>
                    : <><XCircle size={24} /> {translations.incorrect}</>
                }
              </div>

              {/* AI feedback */}
              {evaluation?.feedback && (
                <div>
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{translations.explanation}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                    <MathText>{evaluation.feedback}</MathText>
                  </p>
                </div>
              )}

              {/* Explanation */}
              <div>
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{translations.explanation}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                  <MathText>{currentExercise.explanation}</MathText>
                </p>
              </div>

              {/* Full solution (open types, max attempts reached) */}
              {isOpenType && (evaluation?.fullSolution || solutionRevealed) && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl">
                  <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">{translations.revealSolution}</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                    <MathText>{evaluation?.fullSolution || currentExercise.sampleAnswer || ''}</MathText>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 border border-gray-100 dark:border-gray-700 shadow-sm">
            {!isSubmitted ? (
              <div className="space-y-6">
                <h3 className="font-black dark:text-white uppercase tracking-widest text-sm flex items-center gap-2">
                  <BookOpen size={18} className="text-brand-600" /> {translations.tools}
                </h3>

                {/* MC submit */}
                {isMultipleChoice && (
                  <button
                    onClick={handleMCSubmit}
                    disabled={!selectedOption}
                    className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black text-lg hover:opacity-90 disabled:opacity-30 transition-all shadow-xl"
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
                      className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black text-lg hover:opacity-90 disabled:opacity-30 transition-all shadow-xl flex items-center justify-center gap-2"
                    >
                      {evaluating ? (
                        <><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{animationDelay:'0ms'}}></span><span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{animationDelay:'150ms'}}></span><span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{animationDelay:'300ms'}}></span></span> {translations.thinking}</>
                      ) : (
                        <><Send size={18} /> {translations.checkAnswer}</>
                      )}
                    </button>
                    {attempts > 0 && attempts < MAX_ATTEMPTS && (
                      <p className="text-center text-xs text-gray-400 font-bold">
                        {translations.tryAgain} ({MAX_ATTEMPTS - attempts} left)
                      </p>
                    )}
                    {attempts >= MAX_ATTEMPTS && !isSubmitted && (
                      <button
                        onClick={handleRevealSolution}
                        className="w-full py-3 text-gray-500 dark:text-gray-400 font-bold hover:text-brand-600 flex items-center justify-center gap-2 transition-colors border border-gray-200 dark:border-gray-700 rounded-xl"
                      >
                        <Eye size={18} /> {translations.revealSolution}
                      </button>
                    )}
                  </>
                )}

                {/* Hint */}
                <button onClick={() => setShowHint(true)} className="w-full py-3 text-gray-500 dark:text-gray-400 font-bold hover:text-brand-600 flex items-center justify-center gap-2 transition-colors">
                  <Lightbulb size={18} /> {translations.hint}
                </button>
                {showHint && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl text-sm font-medium text-amber-800 dark:text-amber-200 border border-amber-100 dark:border-amber-900/30 animate-in slide-in-from-top-2">
                    <MathText>{currentExercise.hint}</MathText>
                  </div>
                )}

                {/* Attempts indicator for open questions */}
                {isOpenType && attempts > 0 && (
                  <div className="flex items-center gap-1 justify-center">
                    {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i < attempts ? 'bg-amber-400' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
                    ))}
                    <span className="text-xs text-gray-400 ms-2">{attempts}/{MAX_ATTEMPTS} attempts</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                <button onClick={handleNext} className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-brand-700 transition-all shadow-xl">
                  {currentIndex < quiz.length - 1 ? translations.next : translations.courseCompleted}
                  <ArrowRight size={20} className="rtl:rotate-180" />
                </button>
                {onGoToLesson && (
                  <button onClick={onGoToLesson} className="w-full py-3 text-gray-500 dark:text-gray-400 font-bold hover:text-brand-600 flex items-center justify-center gap-2 transition-colors">
                    <BookOpen size={16} /> {translations.backToLesson}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Score tracker */}
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{translations.xp}</span>
              <span className="text-brand-600 font-black">+{totalXp}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{translations.mastery}</span>
              <span className="font-black text-gray-700 dark:text-gray-300">{score}/{quiz.length > 0 ? quiz.length : '?'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExercisePanel;
