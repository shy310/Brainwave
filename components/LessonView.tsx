
import React, { useState, useEffect, useRef } from 'react';
import { LearningSession, Lesson, LessonSection, GradeLevel, Language, Translations, Attachment, UploadAnalysis, Subject } from '../types';
import { generateLesson, analyzeUpload } from '../services/aiService';
import {
  BookOpen, ChevronRight, Lightbulb, ListChecks, FileText, Layers,
  Play, ArrowLeft, Upload, Zap, CheckCircle, Tag, GraduationCap,
  Sparkles, HelpCircle, Compass, Brain, Trophy, Eye, XCircle
} from 'lucide-react';
import Logo from './Logo';
import MathText from './MathText';
import Confetti from './Confetti';

interface Props {
  session: LearningSession;
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  onStartExercises: (studyContext: Attachment[], detectedSubject?: Subject, selectedTopics?: string[]) => void;
  onBack: () => void;
  onContextUpdate: (ctx: string) => void;
  onLessonComplete?: (xpEarned: number) => void;
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  intro: <BookOpen size={16} />,
  concept: <Lightbulb size={16} />,
  example: <ListChecks size={16} />,
  scenario: <Compass size={16} />,
  check: <HelpCircle size={16} />,
  challenge: <Brain size={16} />,
  summary: <Layers size={16} />,
};

const SECTION_BADGE: Record<string, string> = {
  intro: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  concept: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  example: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  scenario: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  check: 'bg-moss-100 text-moss-700 dark:bg-moss-light/40 dark:text-moss-300',
  challenge: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  summary: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const SECTION_LABELS: Record<string, Record<string, string>> = {
  en: { intro: 'Hook', concept: 'Concept', example: 'Example', scenario: 'Real world', check: 'Quick check', challenge: 'Challenge', summary: 'Recap' },
  ru: { intro: 'Завязка', concept: 'Идея', example: 'Пример', scenario: 'В жизни', check: 'Проверка', challenge: 'Задачка', summary: 'Итог' },
  he: { intro: 'פתיחה', concept: 'רעיון', example: 'דוגמה', scenario: 'בחיים', check: 'בדיקה מהירה', challenge: 'אתגר', summary: 'סיכום' },
  ar: { intro: 'مدخل', concept: 'فكرة', example: 'مثال', scenario: 'في الواقع', check: 'فحص سريع', challenge: 'تحدٍ', summary: 'خلاصة' },
};

const LESSON_MISC: Record<string, {
  selectAtLeastOne: string; couldNotGenerate: string; couldNotAnalyze: string;
  stepOf: (a: number, b: number) => string;
  continueBtn: string; finishLesson: string; tapAnswer: string;
  niceCorrect: string; notQuite: string; revealAnswer: string; thinkFirst: string;
  lessonDone: string; earnedXp: (n: number) => string; checksRight: (a: number, b: number) => string;
  keepMomentum: string;
}> = {
  en: {
    selectAtLeastOne: 'Select at least one topic to generate a quiz.',
    couldNotGenerate: 'Could not generate the lesson. Please try again.',
    couldNotAnalyze: 'Could not analyze the uploaded file. Please try again.',
    stepOf: (a, b) => `${a} of ${b}`,
    continueBtn: 'Continue', finishLesson: 'Finish lesson', tapAnswer: 'Tap the right answer',
    niceCorrect: 'Nice — correct!', notQuite: 'Not quite.', revealAnswer: 'Show the answer', thinkFirst: 'Think about it first, then reveal.',
    lessonDone: 'Lesson complete!', earnedXp: (n) => `+${n} XP earned`,
    checksRight: (a, b) => `${a} of ${b} quick checks right`,
    keepMomentum: 'Keep the momentum going — practice makes it stick.',
  },
  ru: {
    selectAtLeastOne: 'Выбери хотя бы одну тему, чтобы сгенерировать тест.',
    couldNotGenerate: 'Не удалось сгенерировать урок. Попробуй ещё раз.',
    couldNotAnalyze: 'Не удалось проанализировать файл. Попробуй ещё раз.',
    stepOf: (a, b) => `${a} из ${b}`,
    continueBtn: 'Дальше', finishLesson: 'Завершить урок', tapAnswer: 'Выбери правильный ответ',
    niceCorrect: 'Отлично — верно!', notQuite: 'Не совсем.', revealAnswer: 'Показать ответ', thinkFirst: 'Сначала подумай, потом открой ответ.',
    lessonDone: 'Урок пройден!', earnedXp: (n) => `+${n} XP получено`,
    checksRight: (a, b) => `${a} из ${b} проверок верно`,
    keepMomentum: 'Не сбавляй темп — практика закрепит знания.',
  },
  he: {
    selectAtLeastOne: 'בחר לפחות נושא אחד כדי ליצור חידון.',
    couldNotGenerate: 'לא הצלחנו ליצור את השיעור. נסה שוב.',
    couldNotAnalyze: 'לא הצלחנו לנתח את הקובץ. נסה שוב.',
    stepOf: (a, b) => `${a} מתוך ${b}`,
    continueBtn: 'המשך', finishLesson: 'סיים שיעור', tapAnswer: 'הקש על התשובה הנכונה',
    niceCorrect: 'יפה — נכון!', notQuite: 'לא בדיוק.', revealAnswer: 'הצג את התשובה', thinkFirst: 'חשוב קודם, ואז גלה את התשובה.',
    lessonDone: 'השיעור הושלם!', earnedXp: (n) => `+${n} XP הרווחת`,
    checksRight: (a, b) => `${a} מתוך ${b} בדיקות נכונות`,
    keepMomentum: 'שמור על הקצב — תרגול מקבע את הידע.',
  },
  ar: {
    selectAtLeastOne: 'اختر موضوعاً واحداً على الأقل لإنشاء اختبار.',
    couldNotGenerate: 'تعذر إنشاء الدرس. حاول مرة أخرى.',
    couldNotAnalyze: 'تعذر تحليل الملف. حاول مرة أخرى.',
    stepOf: (a, b) => `${a} من ${b}`,
    continueBtn: 'متابعة', finishLesson: 'إنهاء الدرس', tapAnswer: 'اختر الإجابة الصحيحة',
    niceCorrect: 'أحسنت — صحيح!', notQuite: 'ليس تماماً.', revealAnswer: 'أظهر الإجابة', thinkFirst: 'فكر أولاً ثم اكشف الإجابة.',
    lessonDone: 'اكتمل الدرس!', earnedXp: (n) => `+${n} نقطة خبرة`,
    checksRight: (a, b) => `${a} من ${b} إجابات صحيحة`,
    keepMomentum: 'حافظ على الزخم — الممارسة ترسّخ المعرفة.',
  },
};

// Renders a short body string with light markdown support (bold lines, lists, LaTeX)
const BodyText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split('\n').map((line, i) => {
      if (!line.trim()) return null;
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <p key={i} className="font-bold text-ink-700 dark:text-white text-base md:text-lg my-2">
            <MathText>{line.replace(/\*\*/g, '')}</MathText>
          </p>
        );
      }
      if (line.match(/^\d+\./)) {
        return (
          <div key={i} className="flex gap-3 my-2">
            <span className="text-moss-600 font-bold flex-shrink-0">{line.match(/^\d+/)?.[0]}.</span>
            <MathText className="text-base text-ink-500 dark:text-ink-300 leading-relaxed">{line.replace(/^\d+\./, '').trim()}</MathText>
          </div>
        );
      }
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <div key={i} className="flex gap-3 my-2">
            <span className="text-moss-600 flex-shrink-0">•</span>
            <MathText className="text-base text-ink-500 dark:text-ink-300 leading-relaxed">{line.replace(/^[-•]\s/, '')}</MathText>
          </div>
        );
      }
      return (
        <p key={i} className="text-base text-ink-500 dark:text-ink-300 leading-relaxed my-2">
          <MathText>{line}</MathText>
        </p>
      );
    })}
  </>
);

const LessonView: React.FC<Props> = ({
  session, userGrade, language, translations, onStartExercises, onBack, onContextUpdate, onLessonComplete
}) => {
  const sectionLabels = SECTION_LABELS[language] || SECTION_LABELS.en;
  const lc = LESSON_MISC[language] || LESSON_MISC.en;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [uploadAnalysis, setUploadAnalysis] = useState<UploadAnalysis | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // Interactive lesson state
  const [answers, setAnswers] = useState<Record<number, number>>({});           // sectionIndex → chosen option
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});        // sectionIndex → challenge answer shown
  const [finished, setFinished] = useState(false);
  const [confettiBurst, setConfettiBurst] = useState(0);
  const xpAwardedRef = useRef(false);
  const cardTopRef = useRef<HTMLDivElement>(null);

  const isUploadMode = session.phase === 'upload_analysis' && session.studyContext.length > 0;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setActiveSection(0);
      setAnswers({});
      setRevealed({});
      setFinished(false);
      xpAwardedRef.current = false;

      if (isUploadMode) {
        onContextUpdate(`Analyzing uploaded materials: ${session.studyContext.map(a => a.name).join(', ')}`);
        try {
          const result = await analyzeUpload(session.studyContext, userGrade, language);
          if (result) {
            setUploadAnalysis(result);
            setSelectedTopics(new Set(result.topics));
          } else {
            setError(lc.couldNotAnalyze);
          }
        } catch (e: any) {
          setError(lc.couldNotAnalyze);
          setErrorDetail(e?.message || String(e));
          console.error("analyzeUpload error:", e);
        }
      } else {
        const subjectName = session.subject;
        onContextUpdate(`Generating lesson: ${session.topicTitle} (${subjectName}, ${userGrade})`);
        try {
          const result = await generateLesson(
            subjectName,
            userGrade,
            session.topicTitle,
            session.topicTitle,
            language,
            session.studyContext
          );
          if (result) {
            setLesson(result);
          } else {
            setError(lc.couldNotGenerate);
          }
        } catch (e: any) {
          setError(lc.couldNotGenerate);
          setErrorDetail(e?.message || String(e));
          console.error("generateLesson error:", e);
        }
      }
      setLoading(false);
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.topicId, session.subject, session.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll the new card into view when the step changes
  useEffect(() => {
    cardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeSection, finished]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10 px-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Logo size={28} showText={false} />
            <span className="text-base font-bold text-ink-500 dark:text-ink-400">
              {isUploadMode ? translations.analyzingUpload : translations.generatingLesson}
            </span>
          </div>
          <div className="w-full h-2.5 bg-cream-100 dark:bg-ink-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-shimmer animate-progress"></div>
          </div>
          <p className="text-xs text-ink-400 font-medium">{translations.connectingToAI}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-8 md:p-12 text-center space-y-6">
        <p className="text-red-500 font-bold text-lg">{error}</p>
        {errorDetail && (
          <pre className="text-left text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-xl overflow-auto max-h-40 border border-red-100">
            {errorDetail}
          </pre>
        )}
        <div className="flex gap-4 justify-center">
          <button onClick={onBack} className="px-6 py-3 bg-cream-100 dark:bg-ink-800 rounded-xl font-bold transition-all duration-150">
            {translations.backToDashboard}
          </button>
        </div>
      </div>
    );
  }

  // ── UPLOAD ANALYSIS VIEW ──────────────────────────────────────────────────
  if (isUploadMode && uploadAnalysis) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 view-enter space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 transition-colors min-h-[44px]"
          >
            <ArrowLeft size={18} className="rtl:rotate-180" />
            {translations.backToDashboard}
          </button>
        </div>
        <div>
          <p className="text-xs font-bold text-moss-600 uppercase tracking-widest mb-1">{translations.uploadAnalysisReady}</p>
          <h1 className="text-2xl font-bold text-ink-700 dark:text-white break-words">
            {session.studyContext.map(a => a.name).join(', ')}
          </h1>
        </div>

        {/* Summary */}
        <div className="bg-moss-50 dark:bg-moss-light/20 border border-moss-100 dark:border-moss-light/30 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={20} className="text-moss-600" />
            <h2 className="font-bold text-moss-700 dark:text-brand-100">{translations.uploadMaterial}</h2>
          </div>
          <p className="text-ink-500 dark:text-ink-400 leading-relaxed">{uploadAnalysis.summary}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Detected Topics with checkboxes */}
          <div className="bg-white dark:bg-ink-800 rounded-2xl p-6 md:p-8 border border-ink-100 dark:border-ink-700 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-amber-500" />
                <h3 className="font-bold text-ink-700 dark:text-white">{translations.detectedTopics}</h3>
              </div>
              <button
                onClick={() => {
                  if (selectedTopics.size === uploadAnalysis.topics.length) {
                    setSelectedTopics(new Set());
                  } else {
                    setSelectedTopics(new Set(uploadAnalysis.topics));
                  }
                }}
                className="text-xs font-bold text-moss-600 hover:text-moss-700 dark:text-moss-400 dark:hover:text-moss-300 transition-colors"
              >
                {selectedTopics.size === uploadAnalysis.topics.length ? translations.deselectAll : translations.selectAll}
              </button>
            </div>
            <ul className="space-y-3">
              {uploadAnalysis.topics.map((topic, i) => {
                const checked = selectedTopics.has(topic);
                const toggle = () => setSelectedTopics(prev => {
                  const next = new Set(prev);
                  if (next.has(topic)) next.delete(topic);
                  else next.add(topic);
                  return next;
                });
                return (
                  <li key={i}>
                    <label className="flex items-start gap-3 cursor-pointer group min-h-[32px]">
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                          checked
                            ? 'bg-moss-600 border-moss-600'
                            : 'border-ink-200 dark:border-ink-600 group-hover:border-moss-400'
                        }`}
                        onClick={toggle}
                      >
                        {checked && <CheckCircle size={13} className="text-white" />}
                      </div>
                      <span
                        className={`text-sm font-medium transition-colors ${
                          checked ? 'text-ink-600 dark:text-ink-400' : 'text-ink-400 dark:text-ink-400 line-through'
                        }`}
                        onClick={toggle}
                      >
                        {topic}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {selectedTopics.size === 0 && (
              <p className="mt-4 text-xs text-amber-600 dark:text-amber-400 font-medium">
                {lc.selectAtLeastOne}
              </p>
            )}
          </div>

          {/* Detected Info */}
          <div className="bg-white dark:bg-ink-800 rounded-2xl p-6 md:p-8 border border-ink-100 dark:border-ink-700 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <GraduationCap size={18} className="text-purple-500" />
              <h3 className="font-bold text-ink-700 dark:text-white">{translations.recommended}</h3>
            </div>
            {uploadAnalysis.detectedSubject && (
              <div className="mb-4">
                <span className="text-xs text-ink-400 uppercase tracking-wider font-bold">{translations.subjects}</span>
                <p className="font-bold text-ink-600 dark:text-ink-400 mt-1">{uploadAnalysis.detectedSubject}</p>
              </div>
            )}
            {uploadAnalysis.detectedGrade && (
              <div className="mb-4">
                <span className="text-xs text-ink-400 uppercase tracking-wider font-bold">{translations.selectGrade}</span>
                <p className="font-bold text-ink-600 dark:text-ink-400 mt-1">{uploadAnalysis.detectedGrade}</p>
              </div>
            )}
            <div>
              <span className="text-xs text-ink-400 uppercase tracking-wider font-bold">{translations.suggestedPractice}</span>
              <ul className="mt-2 space-y-2">
                {uploadAnalysis.suggestedExercises.map((ex, i) => (
                  <li key={i} className="text-sm text-ink-500 dark:text-ink-400 font-medium flex items-start gap-2">
                    <span className="text-moss-500 font-bold">{i + 1}.</span> {ex}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => onStartExercises(
              session.studyContext,
              uploadAnalysis?.detectedSubject ?? undefined,
              selectedTopics.size > 0 ? [...selectedTopics] : uploadAnalysis.topics
            )}
            disabled={selectedTopics.size === 0}
            className="flex-1 py-4 bg-moss-500 hover:bg-moss-600 text-white rounded-2xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] text-base disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <Zap size={22} fill="currentColor" />
            {translations.generateQuiz}
            {selectedTopics.size > 0 && selectedTopics.size < uploadAnalysis.topics.length && (
              <span className="text-white/70 text-sm font-medium">({selectedTopics.size})</span>
            )}
          </button>
          <button
            onClick={onBack}
            className="flex-1 py-4 bg-cream-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 rounded-2xl font-bold hover:bg-cream-200 transition-all duration-150"
          >
            {translations.backToDashboard}
          </button>
        </div>
      </div>
    );
  }

  // ── LESSON VIEW: paced interactive card flow ──────────────────────────────
  if (!lesson) return null;

  const sections = lesson.sections || [];
  const totalSteps = sections.length;
  const currentSection: LessonSection | undefined = sections[activeSection];
  const isLastSection = activeSection === totalSteps - 1;

  const checkIndices = sections.map((s, i) => (s.type === 'check' ? i : -1)).filter(i => i >= 0);
  const correctChecks = checkIndices.filter(i => answers[i] === sections[i].correctIndex).length;

  const isCheck = currentSection?.type === 'check' && (currentSection.options?.length ?? 0) > 0;
  const answered = currentSection ? answers[activeSection] !== undefined : false;
  const canContinue = !isCheck || answered;

  const handleAnswer = (optionIdx: number) => {
    if (answers[activeSection] !== undefined) return; // lock after first tap
    setAnswers(prev => ({ ...prev, [activeSection]: optionIdx }));
    if (optionIdx === currentSection?.correctIndex) setConfettiBurst(n => n + 1);
  };

  const handleFinish = () => {
    const xp = 10 + correctChecks * 5;
    if (!xpAwardedRef.current) {
      xpAwardedRef.current = true;
      onLessonComplete?.(xp);
    }
    setConfettiBurst(n => n + 1);
    setFinished(true);
  };

  // ── Completion screen ─────────────────────────────────────────────────────
  if (finished) {
    const xp = 10 + correctChecks * 5;
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 view-enter" ref={cardTopRef}>
        <Confetti trigger={confettiBurst} count={70} />
        <div className="bg-white dark:bg-ink-800 rounded-3xl border border-ink-100 dark:border-ink-700 p-8 md:p-10 text-center shadow-sm">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-400/30 mb-5 animate-pop">
            <Trophy size={38} />
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink-700 dark:text-ink-100">{lc.lessonDone}</h1>
          <p className="mt-2 text-lg font-bold text-moss-600 dark:text-moss-400">{lc.earnedXp(xp)}</p>
          {checkIndices.length > 0 && (
            <p className="mt-1 text-sm text-ink-400">{lc.checksRight(correctChecks, checkIndices.length)}</p>
          )}

          {/* Key takeaways */}
          {(lesson.keyPoints?.length ?? 0) > 0 && (
            <div className="mt-7 bg-moss-50 dark:bg-moss-light/20 rounded-2xl p-5 border border-moss-100 dark:border-moss-light/40 text-start">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={16} className="text-amber-500" />
                <h3 className="font-bold text-ink-700 dark:text-white text-xs uppercase tracking-widest">{translations.keyPoints}</h3>
              </div>
              <ul className="space-y-2">
                {lesson.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-ink-500 dark:text-ink-300">
                    <CheckCircle size={15} className="text-moss-500 shrink-0 mt-0.5" />
                    <MathText className="leading-relaxed">{point}</MathText>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-6 text-sm text-ink-400">{lc.keepMomentum}</p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onStartExercises(session.studyContext)}
              className="flex-1 py-4 bg-moss-500 hover:bg-moss-600 text-white rounded-2xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 min-h-[52px]"
            >
              <Play size={18} /> {translations.startPractice}
            </button>
            <button
              onClick={onBack}
              className="flex-1 py-4 bg-cream-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 rounded-2xl font-bold hover:bg-cream-200 dark:hover:bg-ink-700 transition-all duration-150 min-h-[52px]"
            >
              {translations.backToDashboard}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8 view-enter" ref={cardTopRef}>
      <Confetti trigger={confettiBurst} count={45} />

      {/* Top bar: back + step counter */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 transition-colors min-h-[44px]"
        >
          <ArrowLeft size={16} className="rtl:rotate-180" />
          <span className="hidden sm:inline">{translations.backToDashboard}</span>
        </button>
        <span className="text-xs font-bold text-ink-400 tabular-nums whitespace-nowrap">
          {lc.stepOf(activeSection + 1, totalSteps)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-cream-100 dark:bg-ink-800 rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-moss-500 rounded-full transition-all duration-500"
          style={{ width: `${((activeSection + 1) / Math.max(totalSteps, 1)) * 100}%` }}
        />
      </div>

      {/* Title */}
      <div className="mb-5">
        <p className="text-[11px] font-bold text-moss-600 uppercase tracking-widest mb-0.5">{translations.subjectsList[session.subject] ?? session.subject}</p>
        <h1 className="text-xl md:text-2xl font-bold text-ink-700 dark:text-white leading-tight break-words">{lesson.topicTitle}</h1>
      </div>

      {/* Current card */}
      {currentSection && (
        <div
          key={activeSection}
          className="bg-white dark:bg-ink-800 rounded-2xl border border-ink-100 dark:border-ink-700 p-5 md:p-7 shadow-sm animate-slide-up"
        >
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 mb-3 ${SECTION_BADGE[currentSection.type] || SECTION_BADGE['intro']}`}>
            {SECTION_ICONS[currentSection.type] || <BookOpen size={16} />}
            {sectionLabels[currentSection.type] || currentSection.type}
          </span>
          <h2 className="text-lg md:text-xl font-bold text-ink-700 dark:text-ink-100 mb-3 break-words">{currentSection.heading}</h2>

          {/* Body */}
          {currentSection.body && <BodyText text={currentSection.body} />}

          {/* Bullets */}
          {(currentSection.bullets?.length ?? 0) > 0 && (
            <ul className="mt-4 space-y-2.5">
              {currentSection.bullets!.map((b, i) => (
                <li key={i} className="flex items-start gap-3 bg-cream-50 dark:bg-ink-900/40 rounded-xl px-4 py-2.5">
                  <Sparkles size={14} className="text-moss-500 shrink-0 mt-1" />
                  <MathText className="text-sm md:text-base text-ink-600 dark:text-ink-300 leading-relaxed">{b}</MathText>
                </li>
              ))}
            </ul>
          )}

          {/* Quick check */}
          {isCheck && (
            <div className="mt-4">
              <p className="font-semibold text-ink-700 dark:text-ink-100 text-base md:text-lg mb-1">
                <MathText>{currentSection.question || ''}</MathText>
              </p>
              {!answered && <p className="text-xs text-ink-400 mb-3">{lc.tapAnswer}</p>}
              <div className="mt-3 space-y-2.5">
                {currentSection.options!.map((opt, i) => {
                  const chosen = answers[activeSection];
                  const isChosen = chosen === i;
                  const isRight = i === currentSection.correctIndex;
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
                  answers[activeSection] === currentSection.correctIndex
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                }`}>
                  <p className="font-bold mb-1">
                    {answers[activeSection] === currentSection.correctIndex ? lc.niceCorrect : lc.notQuite}
                  </p>
                  {currentSection.explanation && <MathText className="leading-relaxed">{currentSection.explanation}</MathText>}
                </div>
              )}
            </div>
          )}

          {/* Challenge reveal */}
          {currentSection.type === 'challenge' && currentSection.explanation && (
            <div className="mt-4">
              {!revealed[activeSection] ? (
                <>
                  <p className="text-xs text-ink-400 mb-3">{lc.thinkFirst}</p>
                  <button
                    onClick={() => setRevealed(prev => ({ ...prev, [activeSection]: true }))}
                    className="flex items-center gap-2 px-5 py-3 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-300 border-2 border-pink-200 dark:border-pink-800 rounded-xl font-bold text-sm hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors min-h-[48px]"
                  >
                    <Eye size={16} /> {lc.revealAnswer}
                  </button>
                </>
              ) : (
                <div className="p-4 rounded-xl bg-pink-50 dark:bg-pink-900/20 text-sm text-ink-600 dark:text-ink-300 animate-slide-up">
                  <MathText className="leading-relaxed">{currentSection.explanation}</MathText>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step dots */}
      <div className="flex items-center justify-center gap-1.5 my-5 flex-wrap">
        {sections.map((sec, i) => {
          const isCheckDot = sec.type === 'check';
          const done = i < activeSection;
          const current = i === activeSection;
          return (
            <button
              key={i}
              onClick={() => { if (i <= activeSection) setActiveSection(i); }}
              aria-label={`${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                current
                  ? 'w-6 h-2.5 bg-moss-500'
                  : done
                    ? `w-2.5 h-2.5 ${isCheckDot ? (answers[i] === sec.correctIndex ? 'bg-green-500' : 'bg-amber-400') : 'bg-moss-300 dark:bg-moss-600'}`
                    : 'w-2.5 h-2.5 bg-ink-100 dark:bg-ink-700'
              }`}
            />
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {activeSection > 0 && (
          <button
            onClick={() => setActiveSection(activeSection - 1)}
            className="px-5 py-4 bg-cream-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 rounded-2xl font-bold hover:bg-cream-200 dark:hover:bg-ink-700 transition-all duration-150 flex items-center justify-center min-h-[52px]"
            aria-label="Back"
          >
            <ChevronRight size={20} className="rotate-180 rtl:rotate-0" />
          </button>
        )}
        <button
          onClick={() => (isLastSection ? handleFinish() : setActiveSection(activeSection + 1))}
          disabled={!canContinue}
          className="flex-1 py-4 bg-moss-500 hover:bg-moss-600 text-white rounded-2xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed min-h-[52px]"
        >
          {isLastSection ? (
            <><Trophy size={18} /> {lc.finishLesson}</>
          ) : (
            <>{lc.continueBtn} <ChevronRight size={20} className="rtl:rotate-180" /></>
          )}
        </button>
      </div>
    </div>
  );
};

export default LessonView;
