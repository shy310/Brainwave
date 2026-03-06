import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2,
  Presentation as PresentationIcon, Maximize2, Minimize2, Printer,
  Download, RefreshCw, ZoomIn, ZoomOut, Plus, Trash2, Clock, Edit2
} from 'lucide-react';
import {
  GradeLevel, Language, Translations, Subject, Presentation, PresentationSlide,
  PresentationAudience, PresStructure
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

// ── Fallback theme (used before AI returns a topic-specific one) ───────────────
const FALLBACK_THEME = {
  bg: 'from-violet-700 via-indigo-700 to-purple-800',
  text: 'white',
  bgHex: '2E1065',
  midHex: '3B0764',
  accentHex: 'A78BFA',
  lightHex: 'EDE9FE',
  darkHex: '0D0621',
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
  const [slideSize, setSlideSize] = useState<'16:9' | '4:3'>('16:9');
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
  const [autoTheme, setAutoTheme] = useState<{ bg: string; bgHex: string; midHex?: string; accentHex: string; lightHex: string; darkHex: string } | null>(null);

  const applyTheme = (theme: any) => {
    if (!theme) { setAutoTheme(null); return; }
    const r = parseInt(theme.bgHex.slice(0, 2), 16);
    const g = parseInt(theme.bgHex.slice(2, 4), 16);
    const b = parseInt(theme.bgHex.slice(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    setAutoTheme(brightness > 180 ? FALLBACK_THEME : theme);
  };

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
            applyTheme((result as any).theme);
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
        applyTheme((result as any).theme);
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
      prs.layout = slideSize === '4:3' ? 'LAYOUT_4x3' : 'LAYOUT_WIDE';

      const th = autoTheme ?? FALLBACK_THEME;
      const bg = th.bgHex;
      const mid = th.midHex ?? th.bgHex;
      const acc = th.accentHex;
      const lt = th.lightHex;
      const dk = th.darkHex;
      const txt = 'FFFFFF';
      const muted = 'FFFFFF';
      const W = slideSize === '4:3' ? 10.0 : 13.33;
      const H = 7.5;

      for (const slide of presentation.slides) {
        const s = prs.addSlide();
        // pptxgenjs doesn't support gradient slide backgrounds — use flat darkest
        // color as base, then layer a gradient rectangle as the first shape
        s.background = { color: dk };

        // ── Full-slide gradient rectangle (must be FIRST shape, behind everything) ──
        s.addShape(prs.ShapeType.rect, {
          x: 0, y: 0, w: W, h: H,
          fill: {
            type: 'gradient',
            stops: [
              { position: 0,   color: bg,  transparency: 0 },
              { position: 50,  color: mid, transparency: 0 },
              { position: 100, color: dk,  transparency: 0 },
            ],
            angle: 135,
          } as any,
          line: { type: 'none' },
        });

        const isTitle = slide.layout === 'title';
        const isQuote = slide.layout === 'quote';

        // ── Shared decorative shapes (positions mirror SVG viewBox 800×450 → inches) ──
        // Large circle top-right (SVG cx=780 cy=-30 r=220 → x=9.34 y=-4.17 w=7.33)
        s.addShape(prs.ShapeType.ellipse, {
          x: 9.34, y: -4.17, w: 7.33, h: 7.33,
          fill: { color: lt, transparency: 88 },
          line: { type: 'none' },
        });
        // Medium accent circle (SVG cx=720 cy=60 r=120 → x=9.2 y=-0.59 w=4.0)
        s.addShape(prs.ShapeType.ellipse, {
          x: 9.2, y: -0.59, w: 4.0, h: 4.0,
          fill: { color: acc, transparency: 78 },
          line: { type: 'none' },
        });
        // Bottom-left circle (SVG cx=-40 cy=490 r=180 → x=-3.67 y=5.17 w=6.0)
        s.addShape(prs.ShapeType.ellipse, {
          x: -3.67, y: 5.17, w: 6.0, h: 6.0,
          fill: { color: dk, transparency: 72 },
          line: { type: 'none' },
        });

        if (isTitle) {
          // Bottom accent bar (SVG x=0 y=420 w=800 h=6 → y=7.4 h=0.1)
          s.addShape(prs.ShapeType.rect, { x: 0, y: 7.4, w: W, h: 0.1, fill: { color: acc, transparency: 40 }, line: { type: 'none' } });
          // Diagonal stripe (SVG x=520 w=60 → x=8.67 w=1.0)
          s.addShape(prs.ShapeType.rect, { x: 8.67, y: 0, w: 1.0, h: H, fill: { color: acc, transparency: 88 }, line: { type: 'none' } });
          // Dot row (SVG cx=60+i*28 cy=390 → x=1.0+i*0.47 y=6.5)
          for (let i = 0; i < 5; i++) {
            s.addShape(prs.ShapeType.ellipse, { x: 1.0 + i * 0.47, y: 6.5, w: 0.12, h: 0.12, fill: { color: lt, transparency: 50 }, line: { type: 'none' } });
          }
          // Tag pill
          s.addShape(prs.ShapeType.roundRect, { x: 3.8, y: 2.1, w: 2.8, h: 0.38, fill: { color: acc, transparency: 75 }, line: { color: acc, transparency: 60 }, rectRadius: 0.12 });
          s.addText('✦  PRESENTATION', { x: 3.8, y: 2.1, w: 2.8, h: 0.38, fontSize: 8, bold: true, color: txt, align: 'center', valign: 'middle', charSpacing: 3 });
          // Title
          s.addText(slide.title, { x: 0.8, y: 2.6, w: W - 1.6, h: 2.0, fontSize: 48, bold: true, color: txt, align: 'center', valign: 'middle', wrap: true });
          // Subtitle
          if (slide.body) {
            s.addText(slide.body, { x: 1.8, y: 4.7, w: W - 3.6, h: 0.7, fontSize: 16, color: muted, align: 'center', italic: true, transparency: 35 });
          }
          // Divider dots
          s.addShape(prs.ShapeType.ellipse, { x: 5.9, y: 5.5, w: 0.1, h: 0.1, fill: { color: txt, transparency: 55 }, line: { type: 'none' } });
          s.addShape(prs.ShapeType.rect, { x: 4.6, y: 5.53, w: 1.2, h: 0.04, fill: { color: txt, transparency: 60 }, line: { type: 'none' } });
          s.addShape(prs.ShapeType.ellipse, { x: 6.1, y: 5.5, w: 0.1, h: 0.1, fill: { color: txt, transparency: 55 }, line: { type: 'none' } });
          s.addShape(prs.ShapeType.rect, { x: 6.3, y: 5.53, w: 1.2, h: 0.04, fill: { color: txt, transparency: 60 }, line: { type: 'none' } });

        } else if (isQuote) {
          // Bold left bar (two layers)
          s.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: H, fill: { color: acc, transparency: 20 }, line: { type: 'none' } });
          s.addShape(prs.ShapeType.rect, { x: 0.22, y: 0, w: 0.08, h: H, fill: { color: acc, transparency: 65 }, line: { type: 'none' } });
          // Dot cluster top-right
          for (let i = 0; i < 3; i++) {
            s.addShape(prs.ShapeType.ellipse, { x: W - 1.2 + i * 0.28, y: 0.5, w: 0.16, h: 0.16, fill: { color: acc, transparency: 50 }, line: { type: 'none' } });
          }
          // Bottom accent line
          s.addShape(prs.ShapeType.rect, { x: 0.6, y: H - 0.6, w: 3.0, h: 0.05, fill: { color: acc, transparency: 40 }, line: { type: 'none' } });
          // Giant quote mark
          s.addText('\u201C', { x: 0.5, y: 0.1, w: 2.5, h: 1.8, fontSize: 110, bold: true, color: txt, transparency: 80, fontFace: 'Georgia' });
          // Quote body
          s.addText(slide.body || slide.bullets[0] || '', { x: 0.7, y: 1.5, w: W - 1.4, h: 3.2, fontSize: 24, italic: true, bold: true, color: txt, align: 'left', valign: 'middle', wrap: true, lineSpacingMultiple: 1.3 });
          // Attribution
          s.addShape(prs.ShapeType.rect, { x: 0.7, y: 4.85, w: 0.6, h: 0.05, fill: { color: acc, transparency: 30 }, line: { type: 'none' } });
          s.addText(`${slide.title}`, { x: 1.45, y: 4.75, w: 6, h: 0.35, fontSize: 12, bold: true, color: muted, charSpacing: 2, transparency: 30 });

        } else {
          // Top accent bar (SVG y=0 h=5 → h=0.08)
          s.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.08, fill: { color: acc, transparency: 45 }, line: { type: 'none' } });
          // Left sidebar (two layers, SVG x=0 w=12 + x=12 w=6)
          s.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 0.2, h: H, fill: { color: acc, transparency: 50 }, line: { type: 'none' } });
          s.addShape(prs.ShapeType.rect, { x: 0.2, y: 0, w: 0.1, h: H, fill: { color: acc, transparency: 78 }, line: { type: 'none' } });
          // Right edge bar (SVG x=790 w=10 → x=13.17 w=0.17)
          s.addShape(prs.ShapeType.rect, { x: W - 0.17, y: 0, w: 0.17, h: H, fill: { color: acc, transparency: 20 }, line: { type: 'none' } });
          // Dot grid bottom-right (SVG cx=680+col*20 cy=340+row*20 → x=11.34+col*0.33 y=5.67+row*0.33)
          for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 4; col++) {
              s.addShape(prs.ShapeType.ellipse, { x: 11.34 + col * 0.33, y: 5.67 + row * 0.33, w: 0.1, h: 0.1, fill: { color: acc, transparency: 60 }, line: { type: 'none' } });
            }
          }
          // Diamond accent
          s.addShape(prs.ShapeType.rect, { x: W - 3.2, y: 0.6, w: 0.2, h: 0.2, fill: { color: lt, transparency: 55 }, line: { type: 'none' } });
          // Slide number badge
          s.addShape(prs.ShapeType.roundRect, { x: 0.4, y: 0.3, w: 0.65, h: 0.38, fill: { color: acc, transparency: 65 }, line: { color: acc, transparency: 85 }, rectRadius: 0.06 });
          s.addText(String(slide.slideNumber).padStart(2, '0'), { x: 0.4, y: 0.3, w: 0.65, h: 0.38, fontSize: 11, bold: true, color: txt, align: 'center', valign: 'middle' });
          // Horizontal rule
          s.addShape(prs.ShapeType.rect, { x: 1.2, y: 0.47, w: W - 4.5, h: 0.025, fill: { color: txt, transparency: 82 }, line: { type: 'none' } });
          // Title
          const contentW = slide.layout === 'split' ? 6.0 : W - 1.2;
          s.addText(slide.title, { x: 0.4, y: 0.8, w: contentW, h: 1.1, fontSize: 30, bold: true, color: txt, wrap: true, valign: 'top' });
          // Bullets
          slide.bullets.slice(0, 5).forEach((b, i) => {
            const yPos = 2.05 + i * 0.88;
            s.addShape(prs.ShapeType.roundRect, { x: 0.4, y: yPos, w: 0.32, h: 0.32, fill: { color: acc, transparency: 62 }, line: { color: acc, transparency: 78 }, rectRadius: 0.05 });
            s.addText(String(i + 1), { x: 0.4, y: yPos, w: 0.32, h: 0.32, fontSize: 9, bold: true, color: txt, align: 'center', valign: 'middle' });
            s.addText(b, { x: 0.85, y: yPos - 0.02, w: contentW - 0.5, h: 0.82, fontSize: 13, color: txt, wrap: true, valign: 'top', lineSpacingMultiple: 1.2 });
          });
          // Footer
          s.addShape(prs.ShapeType.rect, { x: 0.4, y: H - 0.45, w: W - 0.8, h: 0.025, fill: { color: txt, transparency: 82 }, line: { type: 'none' } });
          s.addText(`${presentation.title}  ·  ${slide.slideNumber} / ${presentation.slides.length}`, { x: 0.4, y: H - 0.42, w: W - 0.8, h: 0.28, fontSize: 8, color: muted, align: 'right', transparency: 30 });
        }

        if (slide.speakerNotes) s.addNotes(slide.speakerNotes);
      }
      await prs.writeFile({ fileName: `${presentation.title.replace(/[^a-z0-9]/gi, '_')}.pptx` });
    } catch (e) { console.error('PPTX export failed:', e); }
  };

  const themeInfo = autoTheme ?? FALLBACK_THEME;
  const slides = presentation?.slides ?? [];
  const slide = slides[currentSlide];

  const renderSlide = (s: PresentationSlide, size: 'editor' | 'presenter') => {
    const large = size === 'presenter';
    const tc = themeInfo.text;
    const isPaper = false;
    const isSplit = s.layout === 'split' && s.imageKeyword && !imgErrors[currentSlide];
    const accent = themeInfo.accentHex;
    const light = themeInfo.lightHex;
    const dark = themeInfo.darkHex;

    const TitleDeco = () => (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 450" preserveAspectRatio="none">
        <circle cx="780" cy="-30" r="220" fill={`#${light}`} fillOpacity="0.15" />
        <circle cx="720" cy="60" r="120" fill={`#${accent}`} fillOpacity="0.2" />
        <circle cx="-40" cy="490" r="180" fill={`#${dark}`} fillOpacity="0.3" />
        <rect x="520" y="0" width="60" height="450" fill={`#${accent}`} fillOpacity="0.08" transform="skewX(-15)" />
        <rect x="600" y="0" width="25" height="450" fill={`#${light}`} fillOpacity="0.06" transform="skewX(-15)" />
        <rect x="0" y="420" width="800" height="6" fill={`#${accent}`} fillOpacity="0.4" />
        {[0,1,2,3,4].map(i => (
          <circle key={i} cx={60 + i * 28} cy={390} r="4" fill={`#${light}`} fillOpacity="0.5" />
        ))}
      </svg>
    );

    const ContentDeco = () => (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 450" preserveAspectRatio="none">
        <circle cx="760" cy="-60" r="200" fill={`#${light}`} fillOpacity="0.1" />
        <circle cx="730" cy="40" r="80" fill={`#${accent}`} fillOpacity="0.15" />
        <circle cx="30" cy="430" r="100" fill={`#${dark}`} fillOpacity="0.2" />
        <rect x="0" y="0" width="800" height="5" fill={`#${accent}`} fillOpacity="0.5" />
        <rect x="790" y="0" width="10" height="450" fill={`#${accent}`} fillOpacity="0.2" />
        {[0,1,2].map(row => [0,1,2,3].map(col => (
          <circle key={`${row}-${col}`} cx={680 + col * 20} cy={340 + row * 20} r="3" fill={`#${accent}`} fillOpacity="0.25" />
        )))}
      </svg>
    );

    const QuoteDeco = () => (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 450" preserveAspectRatio="none">
        <rect x="0" y="0" width="12" height="450" fill={`#${accent}`} fillOpacity="0.9" />
        <rect x="12" y="0" width="6" height="450" fill={`#${accent}`} fillOpacity="0.3" />
        <circle cx="650" cy="225" r="280" fill={`#${light}`} fillOpacity="0.07" />
        <circle cx="650" cy="225" r="180" fill={`#${accent}`} fillOpacity="0.08" />
        {[0,1,2].map(i => (
          <circle key={i} cx={710 + i * 22} cy={50} r="6" fill={`#${accent}`} fillOpacity="0.4" />
        ))}
        <rect x="60" y="400" width="200" height="3" fill={`#${accent}`} fillOpacity="0.6" />
      </svg>
    );

    // ── TITLE SLIDE ──────────────────────────────────────────────────────────
    if (s.layout === 'title') return (
      <div className="relative flex flex-col items-center justify-center h-full text-center px-12 gap-4 overflow-hidden">
        <TitleDeco />
        <div className={`relative z-10 px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.25em] border-2 ${
          isPaper ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-white/30 bg-white/10 text-white/80'
        }`}>
          ✦ Presentation
        </div>
        <h1 className={`relative z-10 ${large ? 'text-6xl sm:text-7xl' : 'text-4xl'} font-black leading-tight tracking-tight ${isPaper ? 'text-gray-900' : 'text-white'} max-w-3xl drop-shadow-sm`}>
          {s.title}
        </h1>
        {s.body && (
          <p className={`relative z-10 ${large ? 'text-xl' : 'text-sm'} max-w-xl font-medium ${isPaper ? 'text-gray-600' : 'text-white/65'}`}>
            {s.body}
          </p>
        )}
        <div className="relative z-10 flex items-center gap-3 mt-1">
          <div className={`w-12 h-0.5 ${isPaper ? 'bg-amber-400' : 'bg-white/30'}`} />
          <div className={`w-2.5 h-2.5 rotate-45 ${isPaper ? 'bg-amber-400' : 'bg-white/40'}`} />
          <div className={`w-12 h-0.5 ${isPaper ? 'bg-amber-400' : 'bg-white/30'}`} />
        </div>
      </div>
    );

    // ── QUOTE SLIDE ──────────────────────────────────────────────────────────
    if (s.layout === 'quote') return (
      <div className="relative flex flex-col justify-center h-full overflow-hidden">
        <QuoteDeco />
        <div className="relative z-10 flex flex-col gap-4 pl-10 sm:pl-16 pr-12 sm:pr-20">
          <span className={`${large ? 'text-[9rem]' : 'text-[5rem]'} leading-none select-none font-serif -mb-6 ${isPaper ? 'text-amber-400' : 'text-white/20'}`}>
            &ldquo;
          </span>
          <p className={`${large ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg'} font-bold italic leading-relaxed ${isPaper ? 'text-gray-800' : 'text-white/90'}`}>
            {s.body || s.bullets[0]}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <div className={`w-10 h-0.5 ${isPaper ? 'bg-amber-500' : 'bg-white/40'}`} />
            <span className={`${large ? 'text-base' : 'text-xs'} font-black uppercase tracking-widest ${isPaper ? 'text-amber-700' : 'text-white/60'}`}>
              {s.title}
            </span>
          </div>
        </div>
      </div>
    );

    // ── SPLIT SLIDE ──────────────────────────────────────────────────────────
    if (isSplit) return (
      <div className="relative flex h-full overflow-hidden">
        <ContentDeco />
        <div className="relative z-10 flex-1 flex flex-col justify-center pl-8 sm:pl-10 pr-4 py-8 gap-4">
          <div className={`self-start px-3 py-1 rounded-lg text-xs font-black ${isPaper ? 'bg-amber-200 text-amber-800' : 'bg-white/15 text-white/70'}`}>
            {String(s.slideNumber).padStart(2, '0')}
          </div>
          <h2 className={`${large ? 'text-3xl sm:text-4xl' : 'text-xl'} font-black leading-tight ${isPaper ? 'text-gray-900' : 'text-white'}`}>
            {s.title}
          </h2>
          <ul className="space-y-2.5 flex-1 overflow-hidden">
            {s.bullets.slice(0, large ? 5 : 4).map((b, i) => (
              <li key={i} className={`flex items-start gap-3 ${large ? 'text-base sm:text-lg' : 'text-xs'}`}>
                <span className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black mt-0.5 ${
                  isPaper ? 'bg-amber-200 text-amber-800' : 'bg-white/20 text-white/80'
                }`}>{i + 1}</span>
                <span className={isPaper ? 'text-gray-700' : 'text-white/85'}>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative w-2/5 flex-shrink-0">
          <img
            src={getImageUrl(s.imageKeyword!)}
            alt={s.imageKeyword}
            className="w-full h-full object-cover"
            onError={() => setImgErrors(prev => ({ ...prev, [currentSlide]: true }))}
          />
          <div className={`absolute inset-0 bg-gradient-to-r ${themeInfo.bg} opacity-50`} />
        </div>
      </div>
    );

    // ── CONTENT SLIDE ─────────────────────────────────────────────────────────
    return (
      <div className="relative flex h-full overflow-hidden">
        <ContentDeco />
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 z-20 ${isPaper ? 'bg-amber-400' : 'bg-white/30'}`} />
        <div className="relative z-10 flex flex-col justify-center w-full pl-7 sm:pl-10 pr-8 sm:pr-12 py-8 gap-3">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-0.5 rounded-md text-xs font-black ${
              isPaper ? 'bg-amber-200 text-amber-800' : 'bg-white/15 text-white/60'
            }`}>
              {String(s.slideNumber).padStart(2, '0')}
            </span>
            <div className={`flex-1 h-px ${isPaper ? 'bg-amber-200' : 'bg-white/15'}`} />
            <div className={`w-2 h-2 rotate-45 ${isPaper ? 'bg-amber-300' : 'bg-white/20'}`} />
          </div>
          <h2 className={`${large ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl'} font-black leading-tight ${isPaper ? 'text-gray-900' : 'text-white'}`}>
            {s.title}
          </h2>
          <ul className="space-y-2 flex-1 overflow-hidden">
            {s.bullets.slice(0, large ? 6 : 5).map((b, i) => (
              <li key={i} className={`flex items-start gap-3 ${large ? 'text-lg sm:text-xl' : 'text-sm'}`}>
                <span className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black mt-0.5 border ${
                  isPaper ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white/10 border-white/20 text-white/60'
                }`}>{i + 1}</span>
                <span className={`leading-snug ${isPaper ? 'text-gray-700' : 'text-white/88'}`}>{b}</span>
              </li>
            ))}
          </ul>
          {s.body && (
            <p className={`${large ? 'text-sm' : 'text-xs'} leading-relaxed pt-2 border-t ${
              isPaper ? 'border-amber-200 text-gray-500' : 'border-white/10 text-white/45'
            }`}>{s.body}</p>
          )}
          <div className={`flex items-center justify-between text-xs ${isPaper ? 'text-gray-400' : 'text-white/25'}`}>
            <span className="font-bold truncate max-w-[50%]">{slides[0]?.title}</span>
            <span>{s.slideNumber} / {slides.length}</span>
          </div>
        </div>
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

          {/* Slide size */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Slide Size</label>
            <div className="flex gap-2">
              {(['16:9', '4:3'] as const).map(sz => (
                <button
                  key={sz}
                  onClick={() => setSlideSize(sz)}
                  className={`flex-1 py-2.5 rounded-xl font-black text-sm border-2 transition-all ${
                    slideSize === sz
                      ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {sz}
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

          {/* Auto theme note */}
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            ✦ Colors will be automatically chosen to match your topic
          </p>

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
