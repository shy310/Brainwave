import React, { useState } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Eye, EyeOff,
  Loader2, Presentation as PresentationIcon, Sparkles, ImageOff
} from 'lucide-react';
import { GradeLevel, Language, Translations, Subject, Presentation, PresentationSlide } from '../types';
import { generatePresentation } from '../services/aiService';
import { SUBJECTS_DATA } from '../constants';

interface Props {
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  theme: 'light' | 'dark';
  onBack: () => void;
  onContextUpdate: (ctx: string) => void;
}

const SLIDE_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-red-500',
  'from-cyan-500 to-blue-500',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-500',
];

// Deterministic gradient based on slide index
const getGradient = (index: number) => SLIDE_GRADIENTS[index % SLIDE_GRADIENTS.length];

// Build a picsum image URL seeded by the keyword for visual consistency
const getImageUrl = (keyword: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(keyword.toLowerCase().replace(/\s+/g, '-'))}/600/400`;

const PresentationView: React.FC<Props> = ({
  userGrade, language, translations, onBack, onContextUpdate
}) => {
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState<Subject>(Subject.SCIENCE);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});
  // Key increments on each nav to re-trigger the slide-in animation
  const [animKey, setAnimKey] = useState(0);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setCurrentSlide(0);
    setPresentation(null);
    setImgErrors({});
    setAnimKey(0);
    onContextUpdate(`Generating presentation: ${topic}`);
    try {
      const result = await generatePresentation(topic, subject, userGrade, language);
      setPresentation(result);
    } catch (e: any) {
      setError(e.message || 'Failed to generate presentation');
    } finally {
      setLoading(false);
    }
  };

  const navigate = (newIndex: number) => {
    setCurrentSlide(newIndex);
    setAnimKey(k => k + 1);
  };

  const goBack = () => {
    setPresentation(null);
    setError(null);
    setCurrentSlide(0);
    setAnimKey(0);
  };

  const slide: PresentationSlide | undefined = presentation?.slides[currentSlide];
  const total = presentation?.totalSlides ?? presentation?.slides.length ?? 0;
  const gradient = getGradient(currentSlide);
  const isTitleSlide = !slide?.layout || slide.layout === 'title';
  const hasSplitLayout = slide?.layout === 'split' && slide.imageKeyword;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <Loader2 size={40} className="text-white animate-spin" />
        </div>
        <p className="text-xl font-semibold text-gray-600 dark:text-gray-300">
          {translations.generatingPresentation}
        </p>
      </div>
    );
  }

  // ── Slideshow ────────────────────────────────────────────────────────────────
  if (presentation && slide) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors"
          >
            <ArrowLeft size={18} />
            <span>{translations.backToDashboard}</span>
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {translations.slide} {currentSlide + 1} {translations.ofWord} {total}
            </span>
            <button
              onClick={() => setShowNotes(n => !n)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              title={translations.speakerNotes}
            >
              {showNotes ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* ── Slide Card ─────────────────────────────────────────────────────── */}
        <div
          key={animKey}
          className={`relative rounded-[2rem] bg-gradient-to-br ${gradient} shadow-2xl overflow-hidden animate-slide-in`}
          style={{ minHeight: '440px' }}
        >
          {/* Slide number badge */}
          <div className="absolute top-5 right-6 text-white/40 text-sm font-bold z-10">
            {currentSlide + 1} / {total}
          </div>

          {/* Split layout: content left + image right */}
          {hasSplitLayout ? (
            <div className="flex flex-col md:flex-row min-h-[440px]">
              {/* Content */}
              <div className="flex-1 p-8 md:p-10 space-y-5 flex flex-col justify-center">
                <h2 className="text-2xl md:text-3xl font-black text-white leading-tight pr-12">
                  {slide.title}
                </h2>
                <ul className="space-y-2.5">
                  {slide.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-2 h-2 rounded-full bg-white/70 mt-2 flex-shrink-0" />
                      <span className="text-base text-white/90 leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
                {slide.body && (
                  <p className="text-sm text-white/70 leading-relaxed border-t border-white/20 pt-4">
                    {slide.body}
                  </p>
                )}
              </div>
              {/* Image panel */}
              <div className="md:w-56 lg:w-64 flex-shrink-0 relative">
                {!imgErrors[currentSlide] ? (
                  <img
                    src={getImageUrl(slide.imageKeyword!)}
                    alt={slide.imageKeyword}
                    className="w-full h-48 md:h-full object-cover opacity-75"
                    onError={() => setImgErrors(e => ({ ...e, [currentSlide]: true }))}
                  />
                ) : (
                  <div className="w-full h-48 md:h-full bg-white/10 flex flex-col items-center justify-center gap-2">
                    <ImageOff size={28} className="text-white/40" />
                    <span className="text-white/40 text-xs font-medium">{slide.imageKeyword}</span>
                  </div>
                )}
                {/* Gradient overlay for blend */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20 pointer-events-none" />
              </div>
            </div>
          ) : (
            /* Standard full-width layout */
            <div className="p-8 md:p-10 flex flex-col justify-between min-h-[440px] space-y-6">
              <div className="space-y-6 flex-1">
                <h2 className={`font-black text-white leading-tight pr-12 ${isTitleSlide ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'}`}>
                  {slide.title}
                </h2>

                {/* Content layout: optional image + bullets side by side */}
                {slide.imageKeyword && !isTitleSlide ? (
                  <div className="flex flex-col sm:flex-row gap-6">
                    <ul className="flex-1 space-y-3">
                      {slide.bullets.map((bullet, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="w-2 h-2 rounded-full bg-white/70 mt-2 flex-shrink-0" />
                          <span className="text-base text-white/90 leading-relaxed">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                    {!imgErrors[currentSlide] ? (
                      <div className="sm:w-44 flex-shrink-0 self-start rounded-xl overflow-hidden shadow-lg">
                        <img
                          src={getImageUrl(slide.imageKeyword)}
                          alt={slide.imageKeyword}
                          className="w-full h-32 object-cover opacity-80"
                          onError={() => setImgErrors(e => ({ ...e, [currentSlide]: true }))}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {slide.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-2 h-2 rounded-full bg-white/70 mt-2 flex-shrink-0" />
                        <span className="text-base text-white/90 leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Body paragraph */}
                {slide.body && (
                  <p className="text-sm text-white/70 leading-relaxed border-t border-white/20 pt-4">
                    {slide.body}
                  </p>
                )}
              </div>

              <div className="text-right">
                <span className="text-white/30 text-xs font-medium">{presentation.title}</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => navigate(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
            className="p-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="flex gap-2">
            {Array.from({ length: Math.min(total, 12) }).map((_, i) => (
              <button
                key={i}
                onClick={() => navigate(i)}
                className={`rounded-full transition-all ${
                  i === currentSlide
                    ? 'w-6 h-2.5 bg-indigo-600'
                    : 'w-2.5 h-2.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => navigate(Math.min(total - 1, currentSlide + 1))}
            disabled={currentSlide === total - 1}
            className="p-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {/* Speaker notes */}
        {showNotes && slide.speakerNotes && (
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {translations.speakerNotes}
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {slide.speakerNotes}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Input form ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <PresentationIcon size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              {translations.presentationGenerator}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {translations.presentationGeneratorDesc}
            </p>
          </div>
        </div>
      </div>

      {/* Form card */}
      <div className="rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-8 space-y-6">
        {/* Subject */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {translations.selectSubject}
          </label>
          <select
            value={subject}
            onChange={e => setSubject(e.target.value as Subject)}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SUBJECTS_DATA.map(s => (
              <option key={s.id} value={s.id}>
                {translations.subjectsList[s.id]}
              </option>
            ))}
          </select>
        </div>

        {/* Topic */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {translations.enterTopicForSlides}
          </label>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder={translations.topicPlaceholder}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        <button
          onClick={handleGenerate}
          disabled={!topic.trim()}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all"
        >
          <Sparkles size={20} />
          {translations.generatePresentation}
        </button>
      </div>
    </div>
  );
};

export default PresentationView;
