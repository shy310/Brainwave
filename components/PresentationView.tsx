import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2,
  Presentation as PresentationIcon, Maximize2, Minimize2, Printer,
  Download, RefreshCw, ZoomIn, ZoomOut, Plus, Trash2, Clock, Edit2
} from 'lucide-react';
import {
  GradeLevel, Language, Translations, Subject, Presentation, PresentationSlide,
  PresentationTheme, PresentationAudience, PresStructure
} from '../types';
import {
  generatePresentationV2, streamAI, regenerateSlide, adjustSlideComplexity, addSlideBetween
} from '../services/aiService';
import { SUBJECTS_DATA } from '../constants';

interface Props {
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  theme: 'light' | 'dark';
  onBack: () => void;
  onXpEarned: (xp: number) => void;
  onContextUpdate: (ctx: string) => void;
}

// ── Theme definitions ──────────────────────────────────────────────────────────
const THEMES: Record<PresentationTheme, { bg: string; text: string; accent: string; swatch: string; label: string }> = {
  vivid:    { bg: 'from-violet-600 to-indigo-700',  text: 'white', accent: 'bg-white/20', swatch: 'bg-gradient-to-br from-violet-600 to-indigo-700', label: 'Vivid' },
  ocean:    { bg: 'from-cyan-600 to-blue-700',       text: 'white', accent: 'bg-white/20', swatch: 'bg-gradient-to-br from-cyan-600 to-blue-700',       label: 'Ocean' },
  forest:   { bg: 'from-green-600 to-emerald-700',   text: 'white', accent: 'bg-white/20', swatch: 'bg-gradient-to-br from-green-600 to-emerald-700',   label: 'Forest' },
  sunset:   { bg: 'from-orange-500 to-red-600',      text: 'white', accent: 'bg-white/20', swatch: 'bg-gradient-to-br from-orange-500 to-red-600',      label: 'Sunset' },
  midnight: { bg: 'from-gray-900 to-slate-800',      text: 'white', accent: 'bg-white/10', swatch: 'bg-gradient-to-br from-gray-900 to-slate-800',      label: 'Midnight' },
  paper:    { bg: 'from-amber-50 to-stone-100',      text: 'gray-900', accent: 'bg-black/5', swatch: 'bg-gradient-to-br from-amber-50 to-stone-100 border border-gray-200', label: 'Paper' },
};

const SLIDE_COUNTS = [5, 8, 10, 15, 20];

const getImageUrl = (keyword: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(keyword.toLowerCase().replace(/\s+/g, '-'))}/600/400`;

type Phase = 'setup' | 'editor' | 'presenter';

const PresentationView: React.FC<Props> = ({
  userGrade, language, translations: t, theme: appTheme, onBack, onXpEarned, onContextUpdate
}) => {
  const [phase, setPhase] = useState<Phase>('setup');

  // Setup state
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState<Subject>(Subject.SCIENCE);
  const [slideCount, setSlideCount] = useState(8);
  const [presTheme, setPresTheme] = useState<PresentationTheme>('vivid');
  const [audience, setAudience] = useState<PresentationAudience>('class');
  const [structure, setStructure] = useState<PresStructure>('informative');
  const [includes, setIncludes] = useState({ toc: false, summary: true, qa: false, references: false });

  // Generation
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [streamBuffer, setStreamBuffer] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Presentation state
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});

  // Editor
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBullets, setEditBullets] = useState('');
  const [editingSlideOp, setEditingSlideOp] = useState<number | null>(null);

  // Presenter timer
  const [elapsed, setElapsed] = useState(0);
  const [xpGiven, setXpGiven] = useState(false);
  const presenterStartRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const slideContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation for presenter
  const navigate = useCallback((newIndex: number) => {
    if (!presentation) return;
    if (newIndex < 0 || newIndex >= presentation.slides.length) return;
    setCurrentSlide(newIndex);
    setAnimKey(k => k + 1);
  }, [presentation]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      slideContainerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (phase !== 'presenter' || !presentation) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault(); navigate(currentSlide + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault(); navigate(currentSlide - 1);
    } else if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
    }
  }, [phase, presentation, currentSlide, navigate, toggleFullscreen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Presenter timer
  useEffect(() => {
    if (phase === 'presenter') {
      presenterStartRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - presenterStartRef.current) / 1000);
        setElapsed(secs);
        if (secs >= 120 && !xpGiven) { onXpEarned(30); setXpGiven(true); }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, xpGiven, onXpEarned]);

  const formatTime = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  // ── GENERATE ──────────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    setStreamBuffer('');
    setGenerationProgress('Starting generation...');
    onContextUpdate(`Presentation: ${topic}`);

    try {
      // Use streamAI to show live progress text, then fetch full JSON
      let fullText = '';
      setGenerationProgress('Generating your presentation...');

      await streamAI(
        `Generate a ${slideCount}-slide ${structure} presentation about "${topic}" for ${audience} audience. Grade: ${userGrade}. Language: ${language}.`,
        'Start generating the presentation now.',
        (chunk) => {
          fullText += chunk;
          // Show a snippet of what's being generated
          const lastLine = fullText.split('\n').filter(l => l.trim()).slice(-1)[0] ?? '';
          if (lastLine.includes('"title"')) setGenerationProgress(`Generating slide content...`);
        },
        async (_full) => {
          // Stream done — now generate full structured JSON
          setGenerationProgress('Finalizing slides...');
          try {
            const result = await generatePresentationV2(
              topic, subject, userGrade, slideCount, audience, structure, includes, language
            );
            setPresentation(result);
            setCurrentSlide(0);
            setAnimKey(0);
            setImgErrors({});
            setPhase('editor');
          } catch (e: any) {
            setError(e.message || 'Failed to generate presentation');
          } finally {
            setGenerating(false);
            setGenerationProgress('');
          }
        }
      );
    } catch (e: any) {
      // Fallback: direct generation without streaming
      try {
        const result = await generatePresentationV2(
          topic, subject, userGrade, slideCount, audience, structure, includes, language
        );
        setPresentation(result);
        setCurrentSlide(0);
        setAnimKey(0);
        setImgErrors({});
        setPhase('editor');
      } catch (e2: any) {
        setError(e2.message || 'Failed to generate presentation');
      } finally {
        setGenerating(false);
        setGenerationProgress('');
      }
    }
  };

  // ── SLIDE EDITING ─────────────────────────────────────────────────────────────
  const startEdit = (slideIndex: number) => {
    const slide = presentation!.slides[slideIndex];
    setEditingSlide(slideIndex);
    setEditTitle(slide.title);
    setEditBullets(slide.bullets.join('\n'));
  };

  const saveEdit = () => {
    if (editingSlide === null || !presentation) return;
    const updated = [...presentation.slides];
    updated[editingSlide] = {
      ...updated[editingSlide],
      title: editTitle,
      bullets: editBullets.split('\n').filter(l => l.trim()),
    };
    setPresentation({ ...presentation, slides: updated });
    setEditingSlide(null);
  };

  const handleRegenerateSlide = async (idx: number) => {
    if (!presentation) return;
    setEditingSlideOp(idx);
    try {
      const newSlide = await regenerateSlide(
        presentation.slides[idx], topic, subject, audience, structure, userGrade, language
      );
      const updated = [...presentation.slides];
      updated[idx] = { ...newSlide, slideNumber: idx + 1 };
      setPresentation({ ...presentation, slides: updated });
    } catch { /* ignore */ }
    finally { setEditingSlideOp(null); }
  };

  const handleAdjustComplexity = async (idx: number, dir: 'simpler' | 'detailed') => {
    if (!presentation) return;
    setEditingSlideOp(idx);
    try {
      const newSlide = await adjustSlideComplexity(presentation.slides[idx], dir, userGrade, language);
      const updated = [...presentation.slides];
      updated[idx] = { ...newSlide, slideNumber: idx + 1 };
      setPresentation({ ...presentation, slides: updated });
    } catch { /* ignore */ }
    finally { setEditingSlideOp(null); }
  };

  const handleAddSlideAfter = async (idx: number) => {
    if (!presentation) return;
    setEditingSlideOp(idx);
    try {
      const prev = presentation.slides[idx];
      const next = presentation.slides[idx + 1] ?? presentation.slides[idx];
      const newSlide = await addSlideBetween(prev, next, topic, userGrade, language);
      const updated = [...presentation.slides];
      updated.splice(idx + 1, 0, newSlide);
      // Renumber
      const renumbered = updated.map((s, i) => ({ ...s, slideNumber: i + 1 }));
      setPresentation({ ...presentation, slides: renumbered, totalSlides: renumbered.length });
    } catch { /* ignore */ }
    finally { setEditingSlideOp(null); }
  };

  const handleDeleteSlide = (idx: number) => {
    if (!presentation || presentation.slides.length <= 1) return;
    const updated = presentation.slides.filter((_, i) => i !== idx).map((s, i) => ({ ...s, slideNumber: i + 1 }));
    setPresentation({ ...presentation, slides: updated, totalSlides: updated.length });
    if (currentSlide >= updated.length) setCurrentSlide(updated.length - 1);
  };

  const handleMoveSlide = (idx: number, dir: 'up' | 'down') => {
    if (!presentation) return;
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= presentation.slides.length) return;
    const updated = [...presentation.slides];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    const renumbered = updated.map((s, i) => ({ ...s, slideNumber: i + 1 }));
    setPresentation({ ...presentation, slides: renumbered });
  };

  // ── PPTX EXPORT ──────────────────────────────────────────────────────────────
  const handleExportPptx = async () => {
    if (!presentation) return;
    try {
      const pptxgen = (await import('pptxgenjs')).default;
      const prs = new pptxgen();
      const themeInfo = THEMES[presTheme];

      for (const slide of presentation.slides) {
        const s = prs.addSlide();
        // Background
        s.background = { color: presTheme === 'paper' ? 'FFF8F0' : presTheme === 'midnight' ? '1e293b' : '4F46E5' };
        const textColor = presTheme === 'paper' ? '1a1a1a' : 'FFFFFF';
        s.addText(slide.title, {
          x: 0.5, y: 0.3, w: 9, h: 1, fontSize: 28, bold: true, color: textColor, align: 'left',
        });
        slide.bullets.forEach((b, i) => {
          s.addText(`• ${b}`, {
            x: 0.5, y: 1.5 + i * 0.55, w: 9, h: 0.5, fontSize: 14, color: textColor, align: 'left',
          });
        });
        if (slide.speakerNotes) s.addNotes(slide.speakerNotes);
      }
      await prs.writeFile({ fileName: `${presentation.title.replace(/[^a-z0-9]/gi, '_')}.pptx` });
    } catch (e) { console.error('PPTX export failed:', e); }
  };

  const themeInfo = THEMES[presTheme];
  const slides = presentation?.slides ?? [];
  const slide = slides[currentSlide];

  const renderSlide = (s: PresentationSlide, size: 'editor' | 'presenter') => {
    const large = size === 'presenter';
    const tc = themeInfo.text;
    const isSplit = s.layout === 'split' && s.imageKeyword && !imgErrors[currentSlide];

    if (s.layout === 'title') return (
      <div className="flex flex-col items-center justify-center h-full text-center px-10 gap-5">
        <div className={`w-20 h-1 rounded-full bg-${tc}/30`} />
        <h1 className={`${large ? 'text-5xl sm:text-7xl' : 'text-3xl'} font-black text-${tc} leading-tight tracking-tight`}>
          {s.title}
        </h1>
        {s.body && (
          <p className={`${large ? 'text-2xl' : 'text-sm'} text-${tc}/60 max-w-2xl font-medium`}>
            {s.body}
          </p>
        )}
        {s.bullets[0] && (
          <p className={`${large ? 'text-lg' : 'text-xs'} text-${tc}/40 italic mt-2 max-w-xl`}>
            {s.bullets[0]}
          </p>
        )}
        <div className={`w-20 h-1 rounded-full bg-${tc}/30 mt-2`} />
      </div>
    );

    if (s.layout === 'quote') return (
      <div className="flex flex-col justify-center h-full px-12 gap-4">
        <span className={`${large ? 'text-9xl' : 'text-6xl'} text-${tc}/15 font-serif leading-none -mb-4 select-none`}>
          &ldquo;
        </span>
        <p className={`${large ? 'text-3xl' : 'text-lg'} font-bold text-${tc}/90 italic leading-relaxed`}>
          {s.body || s.bullets[0]}
        </p>
        <p className={`text-${tc}/50 ${large ? 'text-lg' : 'text-xs'} font-bold tracking-widest uppercase mt-2`}>
          — {s.title}
        </p>
      </div>
    );

    if (isSplit) return (
      <div className="flex h-full">
        <div className="flex-1 flex flex-col justify-center p-8 sm:p-10 gap-4 overflow-hidden">
          <div className={`flex items-center gap-2 text-${tc}/30 text-xs font-black tracking-widest uppercase mb-1`}>
            <div className={`h-px flex-1 bg-${tc}/20`} />
            <span>{String(s.slideNumber).padStart(2, '0')}</span>
          </div>
          <h2 className={`${large ? 'text-3xl sm:text-4xl' : 'text-xl'} font-black text-${tc} leading-tight`}>
            {s.title}
          </h2>
          <ul className="space-y-2 flex-1 overflow-hidden">
            {s.bullets.slice(0, large ? 5 : 4).map((b, i) => (
              <li key={i} className={`flex items-start gap-2 ${large ? 'text-lg' : 'text-xs'} text-${tc}/85`}>
                <span className={`text-${tc}/40 font-black mt-0.5 flex-shrink-0`}>→</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div className="w-2/5 flex-shrink-0 relative overflow-hidden">
          <img
            src={getImageUrl(s.imageKeyword!)}
            alt={s.imageKeyword}
            className="w-full h-full object-cover opacity-50"
            onError={() => setImgErrors(prev => ({ ...prev, [currentSlide]: true }))}
          />
          <div className={`absolute inset-0 bg-gradient-to-r from-current to-transparent opacity-30`} />
        </div>
      </div>
    );

    return (
      <div className="flex flex-col justify-center h-full p-8 sm:p-12 gap-4">
        <div className={`flex items-center gap-3 text-${tc}/30`}>
          <span className="font-black text-xs tracking-widest">{String(s.slideNumber).padStart(2, '0')}</span>
          <div className={`flex-1 h-px bg-${tc}/15`} />
        </div>
        <h2 className={`${large ? 'text-4xl sm:text-5xl' : 'text-2xl'} font-black text-${tc} leading-tight`}>
          {s.title}
        </h2>
        <ul className="space-y-3 flex-1 overflow-hidden">
          {s.bullets.slice(0, large ? 6 : 5).map((b, i) => (
            <li key={i} className={`flex items-start gap-3 ${large ? 'text-xl' : 'text-sm'} text-${tc}/85 leading-snug`}>
              <span className={`w-1.5 h-1.5 rounded-full bg-${tc}/40 mt-2 flex-shrink-0`} />
              {b}
            </li>
          ))}
        </ul>
        {s.body && (
          <p className={`text-${tc}/45 ${large ? 'text-base' : 'text-xs'} border-t border-${tc}/10 pt-3 leading-relaxed`}>
            {s.body}
          </p>
        )}
        <p className={`text-${tc}/20 text-xs text-right`}>{s.slideNumber} / {slides.length}</p>
      </div>
    );
  };

  // ── SETUP PHASE ───────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"><ArrowLeft size={20} /></button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
              <PresentationIcon size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t.presentationGen}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t.presentationGenDesc}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          {/* Topic + Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t.presentationTopic}</label>
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder={t.topicPlaceholder}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border-2 border-transparent focus:border-brand-400 rounded-xl outline-none font-medium text-gray-900 dark:text-white transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t.subject}</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value as Subject)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border-2 border-transparent focus:border-brand-400 rounded-xl outline-none font-medium text-gray-900 dark:text-white transition-all"
              >
                {SUBJECTS_DATA.map(s => <option key={s.id} value={s.id}>{s.id.charAt(0) + s.id.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
          </div>

          {/* Slide count */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t.slideCount}</label>
            <div className="flex gap-2">
              {SLIDE_COUNTS.map(n => (
                <button
                  key={n}
                  onClick={() => setSlideCount(n)}
                  className={`flex-1 py-2.5 rounded-xl font-black text-sm border-2 transition-all ${
                    slideCount === n
                      ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Audience */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t.audiencePicker}</label>
            <div className="grid grid-cols-2 gap-2">
              {([ ['class', t.audienceClass, '👥'], ['teacher', t.audienceTeacher, '👨‍🏫'],
                  ['parents', t.audienceParents, '👨‍👩‍👧'], ['competition', t.audienceCompetition, '🏆'],
              ] as [PresentationAudience, string, string][]).map(([a, label, emoji]) => (
                <button
                  key={a}
                  onClick={() => setAudience(a)}
                  className={`py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${
                    audience === a
                      ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {emoji} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Structure */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t.structureType}</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {([ ['informative', t.informativeStructure], ['persuasive', t.persuasiveStructure],
                  ['how-to', t.howToStructure], ['compare-contrast', t.compareContrastStructure],
                  ['timeline', t.timelineStructure],
              ] as [PresStructure, string][]).map(([s, label]) => (
                <button
                  key={s}
                  onClick={() => setStructure(s)}
                  className={`py-2.5 rounded-xl font-bold text-xs border-2 transition-all ${
                    structure === s
                      ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Theme picker */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t.visualTheme}</label>
            <div className="flex gap-3 flex-wrap">
              {(Object.keys(THEMES) as PresentationTheme[]).map(th => (
                <button
                  key={th}
                  onClick={() => setPresTheme(th)}
                  title={THEMES[th].label}
                  className={`w-10 h-10 rounded-xl ${THEMES[th].swatch} transition-all ${
                    presTheme === th ? 'ring-4 ring-brand-400 scale-110' : 'hover:scale-105'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Include toggles */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t.includes}</label>
            <div className="flex flex-wrap gap-2">
              {([ ['toc', 'Table of Contents'], ['summary', 'Summary'], ['qa', 'Q&A'], ['references', 'References'],
              ] as [keyof typeof includes, string][]).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setIncludes(prev => ({ ...prev, [k]: !prev[k] }))}
                  className={`px-3 py-1.5 rounded-full font-bold text-xs border-2 transition-all ${
                    includes[k]
                      ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-400'
                  }`}
                >
                  {includes[k] ? '✓ ' : ''}{label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            className="w-full py-4 bg-gradient-to-r from-brand-500 to-purple-600 text-white font-black rounded-2xl hover:from-brand-600 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            {generating
              ? <><Loader2 size={20} className="animate-spin" /> {generationProgress || t.generatingSlide}</>
              : <><PresentationIcon size={20} /> {t.generatePresentation}</>
            }
          </button>
        </div>
      </div>
    );
  }

  // ── EDITOR PHASE ──────────────────────────────────────────────────────────────
  if (phase === 'editor' && presentation) {
    return (
      <div className="px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => setPhase('setup')} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><ArrowLeft size={20} /></button>
            <div>
              <h2 className="font-black text-gray-900 dark:text-white text-lg truncate max-w-[200px] sm:max-w-none">{presentation.title}</h2>
              <p className="text-xs text-gray-400">{slides.length} slides</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <Printer size={16} /> PDF
            </button>
            <button
              onClick={handleExportPptx}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <Download size={16} /> {t.exportPptx}
            </button>
            <button
              onClick={() => { setCurrentSlide(0); setPhase('presenter'); setElapsed(0); setXpGiven(false); }}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm rounded-xl transition-colors"
            >
              <PresentationIcon size={16} /> Present
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Sidebar: slide list */}
          <div className="lg:col-span-1 space-y-1.5 max-h-[600px] overflow-y-auto">
            {slides.map((s, idx) => (
              <div
                key={idx}
                onClick={() => { setCurrentSlide(idx); setEditingSlide(null); }}
                className={`relative group rounded-xl border-2 cursor-pointer transition-all p-3 ${
                  currentSlide === idx
                    ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className={`w-full h-12 rounded-lg bg-gradient-to-br ${themeInfo.bg} mb-2 flex items-center justify-center`}>
                  <span className="text-white text-xs font-bold px-2 text-center truncate">{s.title}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{s.slideNumber}. {s.title}</p>
                {/* Reorder controls */}
                <div className="absolute right-1 top-1 hidden group-hover:flex flex-col gap-0.5">
                  <button onClick={e => { e.stopPropagation(); handleMoveSlide(idx, 'up'); }} disabled={idx === 0} className="p-0.5 bg-white dark:bg-gray-700 rounded text-gray-500 hover:text-gray-900 disabled:opacity-30 text-xs">▲</button>
                  <button onClick={e => { e.stopPropagation(); handleMoveSlide(idx, 'down'); }} disabled={idx === slides.length-1} className="p-0.5 bg-white dark:bg-gray-700 rounded text-gray-500 hover:text-gray-900 disabled:opacity-30 text-xs">▼</button>
                </div>
              </div>
            ))}
          </div>

          {/* Main: slide editor */}
          <div className="lg:col-span-3 space-y-3">
            {slide && (
              <>
                {/* Slide preview */}
                <div className={`w-full aspect-video bg-gradient-to-br ${themeInfo.bg} rounded-2xl overflow-hidden relative`}>
                  <div className="absolute inset-0 p-8 flex flex-col">
                    {editingSlide === currentSlide ? (
                      <div className="flex flex-col gap-3 h-full" onClick={e => e.stopPropagation()}>
                        <input
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          className="text-2xl font-black bg-white/20 text-white placeholder-white/60 rounded-xl px-3 py-2 outline-none border-2 border-white/30 focus:border-white"
                        />
                        <textarea
                          value={editBullets}
                          onChange={e => setEditBullets(e.target.value)}
                          rows={6}
                          placeholder="One bullet per line..."
                          className="flex-1 bg-white/10 text-white text-sm font-medium rounded-xl px-3 py-2 outline-none border-2 border-white/20 focus:border-white/50 resize-none"
                        />
                        <div className="flex gap-2">
                          <button onClick={saveEdit} className="bg-white text-brand-600 font-black px-4 py-2 rounded-xl text-sm hover:bg-brand-50">Save</button>
                          <button onClick={() => setEditingSlide(null)} className="bg-white/20 text-white font-bold px-4 py-2 rounded-xl text-sm hover:bg-white/30">Cancel</button>
                        </div>
                      </div>
                    ) : renderSlide(slide, 'editor')}
                  </div>
                </div>

                {/* Per-slide toolbar */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => editingSlide === currentSlide ? setEditingSlide(null) : startEdit(currentSlide)}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    <Edit2 size={12} /> {t.editSlide}
                  </button>
                  <button
                    onClick={() => handleRegenerateSlide(currentSlide)}
                    disabled={editingSlideOp === currentSlide}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 transition-colors disabled:opacity-50"
                  >
                    {editingSlideOp === currentSlide ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} {t.regenerateSlide}
                  </button>
                  <button
                    onClick={() => handleAdjustComplexity(currentSlide, 'simpler')}
                    disabled={editingSlideOp === currentSlide}
                    className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 px-3 py-2 rounded-xl border border-green-200 dark:border-green-800 transition-colors disabled:opacity-50"
                  >
                    <ZoomOut size={12} /> {t.makeSimpler}
                  </button>
                  <button
                    onClick={() => handleAdjustComplexity(currentSlide, 'detailed')}
                    disabled={editingSlideOp === currentSlide}
                    className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-800 transition-colors disabled:opacity-50"
                  >
                    <ZoomIn size={12} /> {t.moreDetailed}
                  </button>
                  <button
                    onClick={() => handleAddSlideAfter(currentSlide)}
                    disabled={editingSlideOp === currentSlide}
                    className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800 transition-colors disabled:opacity-50"
                  >
                    <Plus size={12} /> {t.addSlide}
                  </button>
                  {slides.length > 1 && (
                    <button
                      onClick={() => handleDeleteSlide(currentSlide)}
                      className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-xl border border-red-200 dark:border-red-800 transition-colors"
                    >
                      <Trash2 size={12} /> {t.deleteSlide}
                    </button>
                  )}
                </div>

                {/* Speaker notes */}
                {slide.speakerNotes && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">Speaker Notes</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{slide.speakerNotes}</p>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between">
                  <button onClick={() => navigate(currentSlide - 1)} disabled={currentSlide === 0} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 text-gray-600 dark:text-gray-300"><ChevronLeft size={20} /></button>
                  <div className="flex gap-1">
                    {slides.map((_, i) => (
                      <div key={i} onClick={() => navigate(i)} className={`rounded-full cursor-pointer transition-all ${i === currentSlide ? 'bg-brand-500 w-4 h-2' : 'bg-gray-200 dark:bg-gray-700 w-2 h-2'}`} />
                    ))}
                  </div>
                  <button onClick={() => navigate(currentSlide + 1)} disabled={currentSlide >= slides.length - 1} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 text-gray-600 dark:text-gray-300"><ChevronRight size={20} /></button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── PRESENTER PHASE ───────────────────────────────────────────────────────────
  if (phase === 'presenter' && presentation && slide) {
    return (
      <div ref={slideContainerRef} className={`min-h-screen flex flex-col ${appTheme === 'dark' ? 'bg-gray-950' : 'bg-gray-900'}`}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-black/30 flex-shrink-0">
          <button onClick={() => setPhase('editor')} className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-bold transition-colors">
            <ArrowLeft size={16} /> Edit
          </button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-white/60 text-sm">
              <Clock size={14} /> {formatTime(elapsed)}
              {elapsed >= 120 && !xpGiven && <span className="text-green-400 text-xs ml-1">+30 XP</span>}
            </div>
            <span className="text-white/60 text-sm">{currentSlide + 1} / {slides.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNotes(n => !n)} className="p-2 text-white/60 hover:text-white transition-colors">
              {showNotes ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button onClick={() => window.print()} className="p-2 text-white/60 hover:text-white transition-colors">
              <Printer size={16} />
            </button>
            <button onClick={toggleFullscreen} className="p-2 text-white/60 hover:text-white transition-colors">
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Thumbnail sidebar (non-fullscreen) */}
          {!isFullscreen && (
            <div className="w-32 bg-black/20 overflow-y-auto flex flex-col gap-2 p-2 flex-shrink-0">
              {slides.map((s, i) => (
                <button
                  key={i}
                  onClick={() => navigate(i)}
                  className={`w-full aspect-video rounded-lg overflow-hidden border-2 transition-all ${i === currentSlide ? 'border-white' : 'border-transparent opacity-50 hover:opacity-70'}`}
                >
                  <div className={`w-full h-full bg-gradient-to-br ${themeInfo.bg} flex items-center justify-center p-1`}>
                    <span className="text-white text-[8px] font-bold text-center leading-tight">{s.title}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Slide area */}
          <div key={animKey} className="flex-1 flex items-center justify-center p-6">
            <div className={`w-full max-w-4xl aspect-video bg-gradient-to-br ${themeInfo.bg} rounded-2xl overflow-hidden relative shadow-2xl`}>
              <div className="absolute inset-0">
                {renderSlide(slide, 'presenter')}
              </div>
            </div>
          </div>
        </div>

        {/* Speaker notes */}
        {showNotes && slide.speakerNotes && (
          <div className="bg-black/40 px-8 py-4 flex-shrink-0">
            <p className="text-xs font-black text-white/40 uppercase tracking-wider mb-1">Notes</p>
            <p className="text-white/70 text-sm">{slide.speakerNotes}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4 py-4 bg-black/20 flex-shrink-0">
          <button onClick={() => navigate(currentSlide - 1)} disabled={currentSlide === 0} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <div key={i} onClick={() => navigate(i)} className={`rounded-full cursor-pointer transition-all ${i === currentSlide ? 'bg-white w-5 h-2' : 'bg-white/30 w-2 h-2 hover:bg-white/50'}`} />
            ))}
          </div>
          <button onClick={() => navigate(currentSlide + 1)} disabled={currentSlide >= slides.length - 1} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-colors">
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default PresentationView;
