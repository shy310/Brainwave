
import React, { useState, useEffect } from 'react';
import { LearningSession, Lesson, GradeLevel, Language, Translations, Attachment, UploadAnalysis, Subject } from '../types';
import { generateLesson, analyzeUpload } from '../services/aiService';
import { SUBJECTS_DATA } from '../constants';
import {
  BookOpen, ChevronRight, Lightbulb, ListChecks, FileText, Layers,
  Play, ArrowLeft, Upload, Zap, CheckCircle, Tag, GraduationCap
} from 'lucide-react';
import Logo from './Logo';
import MathText from './MathText';

interface Props {
  session: LearningSession;
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  onStartExercises: (studyContext: Attachment[], detectedSubject?: Subject, selectedTopics?: string[]) => void;
  onBack: () => void;
  onContextUpdate: (ctx: string) => void;
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  intro: <BookOpen size={18} className="text-brand-500" />,
  concept: <Lightbulb size={18} className="text-amber-500" />,
  example: <ListChecks size={18} className="text-green-500" />,
  summary: <Layers size={18} className="text-purple-500" />,
};

const SECTION_BADGE: Record<string, string> = {
  intro: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  concept: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  example: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  summary: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const LessonView: React.FC<Props> = ({
  session, userGrade, language, translations, onStartExercises, onBack, onContextUpdate
}) => {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [uploadAnalysis, setUploadAnalysis] = useState<UploadAnalysis | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const isUploadMode = session.phase === 'upload_analysis' && session.studyContext.length > 0;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setActiveSection(0);

      if (isUploadMode) {
        onContextUpdate(`Analyzing uploaded materials: ${session.studyContext.map(a => a.name).join(', ')}`);
        try {
          const result = await analyzeUpload(session.studyContext, userGrade, language);
          if (result) {
            setUploadAnalysis(result);
            setSelectedTopics(new Set(result.topics));
          } else {
            setError("Could not analyze the uploaded file. Please try again.");
          }
        } catch (e: any) {
          setError("Could not analyze the uploaded file.");
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
            setError("Could not generate the lesson. Please try again.");
          }
        } catch (e: any) {
          setError("Could not generate the lesson.");
          setErrorDetail(e?.message || String(e));
          console.error("generateLesson error:", e);
        }
      }
      setLoading(false);
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.topicId, session.subject, session.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Logo size={28} showText={false} />
            <span className="text-base font-bold text-gray-700 dark:text-gray-200">
              {isUploadMode ? translations.analyzingUpload : translations.generatingLesson}
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-shimmer animate-progress"></div>
          </div>
          <p className="text-xs text-gray-400 font-medium">{translations.connectingToAI}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center space-y-6">
        <p className="text-red-500 font-bold text-lg">{error}</p>
        {errorDetail && (
          <pre className="text-left text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-xl overflow-auto max-h-40 border border-red-100">
            {errorDetail}
          </pre>
        )}
        <div className="flex gap-4 justify-center">
          <button onClick={onBack} className="px-6 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold transition-all duration-150">
            {translations.backToDashboard}
          </button>
        </div>
      </div>
    );
  }

  // ── UPLOAD ANALYSIS VIEW ──────────────────────────────────────────────────
  if (isUploadMode && uploadAnalysis) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8 view-enter space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft size={18} className="rtl:rotate-180" />
            {translations.backToDashboard}
          </button>
        </div>
        <div>
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-1">{translations.uploadAnalysisReady}</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {session.studyContext.map(a => a.name).join(', ')}
          </h1>
        </div>

        {/* Summary */}
        <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/30 rounded-2xl p-8">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={20} className="text-brand-600" />
            <h2 className="font-bold text-brand-900 dark:text-brand-100">{translations.uploadMaterial}</h2>
          </div>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{uploadAnalysis.summary}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Detected Topics with checkboxes */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-100 dark:border-gray-800 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-amber-500" />
                <h3 className="font-bold text-gray-900 dark:text-white">{translations.detectedTopics}</h3>
              </div>
              <button
                onClick={() => {
                  if (selectedTopics.size === uploadAnalysis.topics.length) {
                    setSelectedTopics(new Set());
                  } else {
                    setSelectedTopics(new Set(uploadAnalysis.topics));
                  }
                }}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
              >
                {selectedTopics.size === uploadAnalysis.topics.length ? translations.deselectAll : translations.selectAll}
              </button>
            </div>
            <ul className="space-y-3">
              {uploadAnalysis.topics.map((topic, i) => {
                const checked = selectedTopics.has(topic);
                return (
                  <li key={i}>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        checked
                          ? 'bg-brand-600 border-brand-600'
                          : 'border-gray-300 dark:border-gray-600 group-hover:border-brand-400'
                      }`}
                        onClick={() => {
                          setSelectedTopics(prev => {
                            const next = new Set(prev);
                            if (next.has(topic)) next.delete(topic);
                            else next.add(topic);
                            return next;
                          });
                        }}
                      >
                        {checked && <CheckCircle size={13} className="text-white" />}
                      </div>
                      <span
                        className={`text-sm font-medium transition-colors ${
                          checked ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500 line-through'
                        }`}
                        onClick={() => {
                          setSelectedTopics(prev => {
                            const next = new Set(prev);
                            if (next.has(topic)) next.delete(topic);
                            else next.add(topic);
                            return next;
                          });
                        }}
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
                Select at least one topic to generate a quiz.
              </p>
            )}
          </div>

          {/* Detected Info */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-100 dark:border-gray-800 shadow-card">
            <div className="flex items-center gap-2 mb-6">
              <GraduationCap size={18} className="text-purple-500" />
              <h3 className="font-bold text-gray-900 dark:text-white">{translations.recommended}</h3>
            </div>
            {uploadAnalysis.detectedSubject && (
              <div className="mb-4">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">{translations.subjects}</span>
                <p className="font-bold text-gray-800 dark:text-gray-200 mt-1">{uploadAnalysis.detectedSubject}</p>
              </div>
            )}
            {uploadAnalysis.detectedGrade && (
              <div className="mb-4">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">{translations.selectGrade}</span>
                <p className="font-bold text-gray-800 dark:text-gray-200 mt-1">{uploadAnalysis.detectedGrade}</p>
              </div>
            )}
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">{translations.suggestedPractice}</span>
              <ul className="mt-2 space-y-2">
                {uploadAnalysis.suggestedExercises.map((ex, i) => (
                  <li key={i} className="text-sm text-gray-600 dark:text-gray-400 font-medium flex items-start gap-2">
                    <span className="text-brand-500 font-bold">{i + 1}.</span> {ex}
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
            className="flex-1 py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-semibold shadow-brand transition-all duration-150 active:scale-[0.98] text-base disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <Zap size={22} fill="currentColor" />
            {translations.generateQuiz}
            {selectedTopics.size > 0 && selectedTopics.size < uploadAnalysis.topics.length && (
              <span className="text-white/70 text-sm font-medium">({selectedTopics.size} topic{selectedTopics.size !== 1 ? 's' : ''})</span>
            )}
          </button>
          <button
            onClick={onBack}
            className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-2xl font-bold hover:bg-gray-200 transition-all duration-150"
          >
            {translations.backToDashboard}
          </button>
        </div>
      </div>
    );
  }

  // ── LESSON VIEW ───────────────────────────────────────────────────────────
  if (!lesson) return null;

  const sections = lesson.sections || [];
  const currentSection = sections[activeSection];
  const isLastSection = activeSection === sections.length - 1;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 view-enter">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 mb-6 transition-colors"
      >
        <ArrowLeft size={16} className="rtl:rotate-180" />
        {translations.backToDashboard}
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-1">{session.subject}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{lesson.topicTitle}</h1>
        </div>
        <button
          onClick={() => onStartExercises(session.studyContext)}
          className="hidden sm:flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold shadow-brand transition-all duration-150 active:scale-[0.98]"
        >
          <Play size={16} /> {translations.startPractice}
        </button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {sections.map((sec, i) => (
          <button
            key={i}
            onClick={() => setActiveSection(i)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-150 whitespace-nowrap flex-shrink-0 ${
              i === activeSection
                ? 'bg-brand-500 text-white shadow-brand'
                : i < activeSection
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            {i < activeSection ? <CheckCircle size={14} /> : SECTION_ICONS[sec.type] || <BookOpen size={14} />}
            {sec.heading}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {currentSection && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 mb-4 shadow-card animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Section type badge */}
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full inline-block mb-3 ${SECTION_BADGE[currentSection.type] || SECTION_BADGE['intro']}`}>
                {currentSection.type.charAt(0).toUpperCase() + currentSection.type.slice(1)}
              </span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">{currentSection.heading}</h2>
              <div className="prose dark:prose-invert max-w-none">
                {currentSection.body.split('\n').map((line, i) => {
                  if (!line.trim()) return <br key={i} />;
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return (
                      <p key={i} className="font-bold text-gray-900 dark:text-white text-base">
                        <MathText>{line.replace(/\*\*/g, '')}</MathText>
                      </p>
                    );
                  }
                  if (line.match(/^\d+\./)) {
                    return (
                      <div key={i} className="flex gap-3 my-2">
                        <span className="text-brand-600 font-bold flex-shrink-0">{line.match(/^\d+/)?.[0]}.</span>
                        <MathText className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{line.replace(/^\d+\./, '').trim()}</MathText>
                      </div>
                    );
                  }
                  if (line.startsWith('- ') || line.startsWith('• ')) {
                    return (
                      <div key={i} className="flex gap-3 my-2">
                        <span className="text-brand-600 flex-shrink-0">•</span>
                        <MathText className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{line.replace(/^[-•]\s/, '')}</MathText>
                      </div>
                    );
                  }
                  return (
                    <p key={i} className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      <MathText>{line}</MathText>
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-4">
            {activeSection > 0 && (
              <button
                onClick={() => setActiveSection(activeSection - 1)}
                className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-2xl font-bold hover:bg-gray-200 transition-all duration-150 flex items-center justify-center gap-2"
              >
                <ChevronRight size={20} className="rotate-180 rtl:rotate-0" />
                {translations.backToLesson}
              </button>
            )}
            {!isLastSection ? (
              <button
                onClick={() => setActiveSection(activeSection + 1)}
                className="flex-1 py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-semibold shadow-brand transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {translations.next} <ChevronRight size={20} className="rtl:rotate-180" />
              </button>
            ) : (
              <button
                onClick={() => onStartExercises(session.studyContext)}
                className="w-full py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-semibold shadow-brand transition-all duration-150 active:scale-[0.98] mt-6 text-base flex items-center justify-center gap-2"
              >
                <Play size={20} /> {translations.startPractice}
              </button>
            )}
          </div>
        </div>

        {/* Sidebar: Key Points */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-card sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb size={18} className="text-amber-500" />
              <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-widest">{translations.keyPoints}</h3>
            </div>

            {/* Key points box */}
            <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-4 border border-brand-100 dark:border-brand-900/40 mt-4">
              <ul className="space-y-2">
                {(lesson.keyPoints || []).map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
                    <div className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <MathText className="leading-relaxed">{point}</MathText>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => onStartExercises(session.studyContext)}
                className="w-full py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-semibold shadow-brand transition-all duration-150 active:scale-[0.98] mt-6 text-base flex items-center justify-center gap-2"
              >
                <Zap size={18} fill="currentColor" />
                {translations.startPractice}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonView;
