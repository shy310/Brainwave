import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Send, Loader2, Mic, Camera, Pencil, Lightbulb,
  RotateCcw, ChevronDown, ChevronRight, Clock, Star, BookOpen, X,
  BarChart2, TrendingUp, ZoomIn, ZoomOut
} from 'lucide-react';
import { GradeLevel, Language, Translations } from '../types';
import { streamAI } from '../services/aiService';

// ── Types ──────────────────────────────────────────────────────────────────────

type TutorMode = 'tutor' | 'solver' | 'practice';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isImage?: boolean;
  steps?: string[];
  isHint?: boolean;
}

interface PracticeQuestion {
  problem: string;
  answer: string;
  hint: string;
  userAnswer: string;
  result?: { correct: boolean; explanation: string };
  revealed: boolean;
}

interface MathSession {
  id: string;
  topic: string;
  mode: TutorMode;
  messages: ChatMessage[];
  createdAt: number;
  score?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SYMBOLS = ['∑','∫','∂','√','∞','≠','≤','≥','±','×','÷','π','θ','λ','Δ','α','β','γ','φ','²','³','⁻¹','( )','[ ]','{ }'];

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '';

const TUTOR_SYSTEM = `You are a patient, encouraging math tutor inside BrainWave, an AI learning platform.
Never give the full answer directly.
Always break problems into the smallest possible steps, one at a time.
After every response, ask one short question to check understanding.
If the student is stuck, give a nudge — not the answer.
Use simple language. Be warm and supportive.`;

const SOLVER_SYSTEM = `You are a precise math solver inside BrainWave.
Format your entire response as numbered steps, each starting with "Step N:" on its own line.
Explain what you are doing at each step and why.
End with a line that starts with "Answer:" containing only the final result.
Never skip steps. Be thorough.`;

// ── Helpers ────────────────────────────────────────────────────────────────────

async function callAI(system: string, userContent: object[] | string, maxTokens = 2000): Promise<string> {
  const content = typeof userContent === 'string'
    ? userContent
    : userContent;
  const res = await fetch(`${API_BASE}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system,
      messages: [{ role: 'user', content }],
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const block = (data.content ?? []).find((b: any) => b.type === 'text');
  return block?.text ?? '';
}

function parseSteps(text: string): string[] {
  const lines = text.split('\n');
  const steps: string[] = [];
  let current = '';
  for (const line of lines) {
    if (/^Step \d+:/i.test(line.trim())) {
      if (current) steps.push(current.trim());
      current = line;
    } else {
      current += '\n' + line;
    }
  }
  if (current) steps.push(current.trim());
  return steps;
}

function newId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  theme: 'light' | 'dark';
  onBack: () => void;
  onXpEarned: (xp: number) => void;
  onContextUpdate: (ctx: string) => void;
}

// ── Function Graph ─────────────────────────────────────────────────────────────

interface GraphProps {
  fnStr: string;
  xMin?: number;
  xMax?: number;
}

const FunctionGraph: React.FC<GraphProps> = ({ fnStr, xMin = -10, xMax = 10 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState({ xMin, xMax });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const padding = 40;
    const plotW = W - 2 * padding;
    const plotH = H - 2 * padding;

    // Evaluate function safely
    let evalFn: (x: number) => number;
    try {
      // Sanitize: allow only safe math expressions
      const safe = fnStr
        .replace(/\^/g, '**')
        .replace(/sin/g, 'Math.sin')
        .replace(/cos/g, 'Math.cos')
        .replace(/tan/g, 'Math.tan')
        .replace(/sqrt/g, 'Math.sqrt')
        .replace(/abs/g, 'Math.abs')
        .replace(/log/g, 'Math.log')
        .replace(/exp/g, 'Math.exp')
        .replace(/PI/g, 'Math.PI')
        .replace(/pi/g, 'Math.PI')
        .replace(/e\b/g, 'Math.E');
      evalFn = new Function('x', `"use strict"; return (${safe});`) as (x: number) => number;
      // Test it
      const test = evalFn(1);
      if (typeof test !== 'number') throw new Error('Not a number');
      setError(null);
    } catch {
      setError('Could not parse function. Use format: x^2 + 2*x - 1');
      return;
    }

    // Sample function
    const steps = plotW;
    const points: { px: number; py: number }[] = [];
    const xStep = (range.xMax - range.xMin) / steps;

    let yMin = Infinity, yMax = -Infinity;
    const ys: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const x = range.xMin + i * xStep;
      try {
        const y = evalFn(x);
        ys.push(isFinite(y) ? y : NaN);
        if (isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
      } catch { ys.push(NaN); }
    }

    if (!isFinite(yMin) || !isFinite(yMax)) { setError('Function produces no valid values in range'); return; }

    // Add 10% padding to y range
    const yPad = (yMax - yMin) * 0.1 || 1;
    const yLow = yMin - yPad;
    const yHigh = yMax + yPad;

    const toCanvas = (x: number, y: number) => ({
      px: padding + ((x - range.xMin) / (range.xMax - range.xMin)) * plotW,
      py: padding + ((yHigh - y) / (yHigh - yLow)) * plotH,
    });

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    const xTicks = 10;
    const yTicks = 8;
    for (let i = 0; i <= xTicks; i++) {
      const x = range.xMin + i * (range.xMax - range.xMin) / xTicks;
      const { px } = toCanvas(x, yLow);
      ctx.beginPath();
      ctx.moveTo(px, padding);
      ctx.lineTo(px, H - padding);
      ctx.stroke();
    }
    for (let i = 0; i <= yTicks; i++) {
      const y = yLow + i * (yHigh - yLow) / yTicks;
      const { py } = toCanvas(range.xMin, y);
      ctx.beginPath();
      ctx.moveTo(padding, py);
      ctx.lineTo(W - padding, py);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    // X axis (y=0 if in range)
    if (yLow <= 0 && yHigh >= 0) {
      const { py } = toCanvas(0, 0);
      ctx.beginPath();
      ctx.moveTo(padding, py);
      ctx.lineTo(W - padding, py);
      ctx.stroke();
    }
    // Y axis (x=0 if in range)
    if (range.xMin <= 0 && range.xMax >= 0) {
      const { px } = toCanvas(0, yLow);
      ctx.beginPath();
      ctx.moveTo(px, padding);
      ctx.lineTo(px, H - padding);
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#475569';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= xTicks; i += 2) {
      const xVal = range.xMin + i * (range.xMax - range.xMin) / xTicks;
      const { px } = toCanvas(xVal, yLow);
      ctx.fillText(xVal.toFixed(1), px, H - padding + 16);
    }
    ctx.textAlign = 'end';
    for (let i = 0; i <= yTicks; i += 2) {
      const yVal = yLow + i * (yHigh - yLow) / yTicks;
      const { py } = toCanvas(range.xMin, yVal);
      ctx.fillText(yVal.toFixed(1), padding - 6, py + 4);
    }

    // Plot function
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= steps; i++) {
      const x = range.xMin + i * xStep;
      const y = ys[i];
      if (isNaN(y)) { started = false; continue; }
      const { px, py } = toCanvas(x, y);
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Function label
    ctx.fillStyle = '#6366f1';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'start';
    ctx.fillText(`y = ${fnStr}`, padding + 4, padding - 10);

  }, [fnStr, range]);

  const zoom = (factor: number) => {
    const mid = (range.xMin + range.xMax) / 2;
    const half = (range.xMax - range.xMin) / 2 * factor;
    setRange({ xMin: mid - half, xMax: mid + half });
  };

  return (
    <div className="mt-3 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800/40">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-brand-500" />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Graph: y = {fnStr}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => zoom(1.5)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-all" title="Zoom out">
            <ZoomOut size={13} />
          </button>
          <button onClick={() => zoom(0.67)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-all" title="Zoom in">
            <ZoomIn size={13} />
          </button>
          <button onClick={() => setRange({ xMin: -10, xMax: 10 })} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 text-[10px] font-bold transition-all" title="Reset">
            Reset
          </button>
        </div>
      </div>
      {error ? (
        <div className="px-4 py-3 text-xs text-red-500">{error}</div>
      ) : (
        <canvas ref={canvasRef} width={520} height={300} className="w-full block" />
      )}
    </div>
  );
};

// ── Step Card ──────────────────────────────────────────────────────────────────

const StepCard: React.FC<{ step: string; index: number }> = ({ step, index }) => {
  const [expanded, setExpanded] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);

  const explain = async () => {
    if (explanation) { setExpanded(e => !e); return; }
    setLoading(true);
    setExpanded(true);
    try {
      const text = await callAI(
        'You are a math tutor. Explain clearly and simply.',
        `Explain this step in more detail, as if teaching a beginner:\n"${step}"`,
        600
      );
      setExplanation(text);
    } catch { setExplanation('Could not load explanation.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="border-l-4 border-brand-500 bg-white dark:bg-gray-900 rounded-r-xl px-5 py-4 mb-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{index + 1}</span>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{step}</p>
        </div>
        <button
          onClick={explain}
          className="flex-shrink-0 text-xs text-brand-500 hover:text-brand-600 mt-2 font-medium transition-colors flex items-center gap-1 mt-0.5"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Explain more
        </button>
      </div>
      {expanded && (
        <div className="mt-2 ml-8 text-xs text-gray-600 dark:text-gray-400 bg-brand-50 dark:bg-brand-900/20 rounded-lg p-3">
          {loading ? <Loader2 size={14} className="animate-spin" /> : explanation}
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const MathTutorView: React.FC<Props> = ({
  userGrade, language, onBack, onXpEarned, onContextUpdate
}) => {
  const [mode, setMode] = useState<TutorMode>('tutor');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [practiceQuestions, setPracticeQuestions] = useState<PracticeQuestion[]>([]);
  const [practiceScore, setPracticeScore] = useState<string | null>(null);
  const [practiceTopic, setPracticeTopic] = useState('');
  const [imgBase64, setImgBase64] = useState<string | null>(null);
  const [showCanvas, setShowCanvas] = useState(false);
  const [sessions, setSessions] = useState<MathSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionTopic, setSessionTopic] = useState('Math Session');
  const [expandedSessions, setExpandedSessions] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [gradingIdx, setGradingIdx] = useState<number | null>(null);
  const [graphFn, setGraphFn] = useState<string | null>(null);
  const [generatingGraph, setGeneratingGraph] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // ── Load sessions on mount ──
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('mathSessions') || '[]');
    setSessions(saved);
  }, []);

  // ── Persist session on message change ──
  useEffect(() => {
    if (!currentSessionId || messages.length === 0) return;
    const existing: MathSession[] = JSON.parse(localStorage.getItem('mathSessions') || '[]');
    const updated = existing.map(s =>
      s.id === currentSessionId ? { ...s, messages, score: practiceScore ?? s.score } : s
    );
    localStorage.setItem('mathSessions', JSON.stringify(updated));
    setSessions(updated);
  }, [messages, practiceScore]);

  // ── Start new session ──
  const startSession = useCallback((m: TutorMode) => {
    const id = newId();
    const session: MathSession = { id, topic: 'New Session', mode: m, messages: [], createdAt: Date.now() };
    const existing: MathSession[] = JSON.parse(localStorage.getItem('mathSessions') || '[]');
    const updated = [session, ...existing];
    localStorage.setItem('mathSessions', JSON.stringify(updated));
    setSessions(updated);
    setCurrentSessionId(id);
    setMessages([]);
    setPracticeScore(null);
    setSessionTopic('New Session');
  }, []);

  // ── Update session topic ──
  const updateSessionTopic = useCallback((id: string, topic: string) => {
    setSessionTopic(topic);
    const existing: MathSession[] = JSON.parse(localStorage.getItem('mathSessions') || '[]');
    const updated = existing.map(s => s.id === id ? { ...s, topic } : s);
    localStorage.setItem('mathSessions', JSON.stringify(updated));
    setSessions(updated);
  }, []);

  // ── Detect topic after first message ──
  const detectTopic = useCallback(async (firstMsg: string, id: string) => {
    try {
      const topic = await callAI(
        'Reply with only a 3-word-or-less math topic name, nothing else.',
        `In 3 words or less, what math topic is this: "${firstMsg}"`,
        20
      );
      const clean = topic.trim().replace(/["'.]/g, '');
      if (clean) updateSessionTopic(id, clean);
    } catch { /* silent */ }
  }, [updateSessionTopic]);

  // ── Switch mode ──
  const switchMode = (m: TutorMode) => {
    setMode(m);
    setMessages([]);
    setStreamingText('');
    setPracticeQuestions([]);
    setPracticeScore(null);
    setImgBase64(null);
    setGraphFn(null);
    startSession(m);
    onContextUpdate(`Math Tutor — ${m} mode`);
  };

  // ── Symbol insert ──
  const insertSymbol = (symbol: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = input.slice(0, start) + symbol + input.slice(end);
    setInput(newVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + symbol.length, start + symbol.length);
    }, 0);
  };

  // ── Image upload ──
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setImgBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  // ── Voice input ──
  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.onresult = (e: any) => setInput(e.results[0][0].transcript);
    recognition.start();
  };

  // ── Canvas drawing ──
  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d')!;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
  };
  const submitCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    setImgBase64(base64);
    setShowCanvas(false);
    handleSubmit(base64);
  };

  // ── Hint ──
  const handleHint = async () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    setLoading(true);
    try {
      const hint = await callAI(
        'You are a Socratic math tutor. Give one tiny hint — do not reveal the answer.',
        `The student is working on: "${lastUser.content}"\nGive ONE small hint pointing in the right direction. Do NOT reveal the answer or the next full step. Be Socratic. One sentence only.`,
        120
      );
      const hintMsg: ChatMessage = { role: 'assistant', content: hint, isHint: true };
      setMessages(prev => [...prev, hintMsg]);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  // ── Generate Graph ──────────────────────────────────────────────────────────
  const generateGraph = async () => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return;
    setGeneratingGraph(true);
    setGraphFn(null);
    try {
      const raw = await callAI(
        'You are a math function extractor. Reply with ONLY the right-hand side of a y = f(x) function. No "y =", no explanation, no markdown. Just the expression, e.g.: x**2 + 2*x - 1',
        `Extract the primary mathematical function from this solution. Reply with ONLY the expression for f(x) where y = f(x), using ** for powers, * for multiplication. If there is no graphable function, reply with "x".\n\nSolution:\n${lastAssistant.content.slice(0, 800)}`,
        80
      );
      const fn = raw.trim().replace(/^y\s*=\s*/i, '').replace(/f\(x\)\s*=\s*/i, '').trim();
      setGraphFn(fn || 'x');
    } catch { setGraphFn('x'); }
    finally { setGeneratingGraph(false); }
  };

  // ── Main submit ──────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (overrideImgBase64?: string) => {
    const img = overrideImgBase64 ?? imgBase64;
    const text = input.trim();
    if (!text && !img) return;

    let sid = currentSessionId;
    if (!sid) {
      const id = newId();
      const session: MathSession = { id, topic: 'New Session', mode, messages: [], createdAt: Date.now() };
      const existing: MathSession[] = JSON.parse(localStorage.getItem('mathSessions') || '[]');
      localStorage.setItem('mathSessions', JSON.stringify([session, ...existing]));
      setSessions([session, ...existing]);
      setCurrentSessionId(id);
      sid = id;
    }

    // Build user message
    const userMsg: ChatMessage = {
      role: 'user',
      content: text || '(image)',
      isImage: !!img,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setImgBase64(null);
    setLoading(true);
    setStreamingText('');

    // Detect topic after first message
    if (messages.length === 0 && text) {
      detectTopic(text, sid);
    }

    try {
      if (mode === 'tutor') {
        if (img) {
          // Non-streaming for image input
          const response = await callAI(TUTOR_SYSTEM, [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: img } },
            { type: 'text', text: text || 'Please help me solve this problem.' },
          ], 1000);
          setMessages(prev => [...prev, { role: 'assistant', content: response }]);
          onXpEarned(5);
        } else {
          // Streaming
          const history = newMessages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
          const userInput = history[history.length - 1].content;
          let full = '';
          await streamAI(
            TUTOR_SYSTEM,
            userInput,
            (chunk) => { full += chunk; setStreamingText(full); },
            (fullText) => {
              setStreamingText('');
              setMessages(prev => [...prev, { role: 'assistant', content: fullText }]);
              onXpEarned(5);
            }
          );
        }
      } else if (mode === 'solver') {
        if (img) {
          const response = await callAI(SOLVER_SYSTEM, [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: img } },
            { type: 'text', text: text || 'Solve this problem.' },
          ], 2000);
          const steps = parseSteps(response);
          setMessages(prev => [...prev, { role: 'assistant', content: response, steps: steps.length > 1 ? steps : undefined }]);
          onXpEarned(10);
        } else {
          let full = '';
          await streamAI(
            SOLVER_SYSTEM,
            text,
            (chunk) => { full += chunk; setStreamingText(full); },
            (fullText) => {
              setStreamingText('');
              const steps = parseSteps(fullText);
              setMessages(prev => [...prev, { role: 'assistant', content: fullText, steps: steps.length > 1 ? steps : undefined }]);
              onXpEarned(10);
            }
          );
        }
      }
    } catch (err) {
      setStreamingText('');
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
      setStreamingText('');
    }
  }, [input, imgBase64, messages, mode, currentSessionId, detectTopic, onXpEarned]);

  // ── Practice: generate questions ────────────────────────────────────────────
  const generatePractice = async () => {
    if (!practiceTopic.trim()) return;
    setLoading(true);
    setPracticeQuestions([]);
    setPracticeScore(null);

    let sid = currentSessionId;
    if (!sid) {
      const id = newId();
      const session: MathSession = { id, topic: practiceTopic, mode: 'practice', messages: [], createdAt: Date.now() };
      const existing: MathSession[] = JSON.parse(localStorage.getItem('mathSessions') || '[]');
      localStorage.setItem('mathSessions', JSON.stringify([session, ...existing]));
      setSessions([session, ...existing]);
      setCurrentSessionId(id);
      sid = id;
      updateSessionTopic(id, practiceTopic);
    }

    try {
      const raw = await callAI(
        'You are a math problem generator. Return only valid JSON arrays, no markdown.',
        `Generate exactly 5 practice problems about: "${practiceTopic}".
Return ONLY a raw JSON array with no markdown, no backticks, no explanation:
[
  { "problem": "...", "answer": "...", "hint": "one-sentence hint without giving answer" },
  { "problem": "...", "answer": "...", "hint": "..." },
  { "problem": "...", "answer": "...", "hint": "..." },
  { "problem": "...", "answer": "...", "hint": "..." },
  { "problem": "...", "answer": "...", "hint": "..." }
]`,
        1000
      );
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      const qs: PracticeQuestion[] = (Array.isArray(parsed) ? parsed : []).map((q: any) => ({
        problem: q.problem ?? '',
        answer: q.answer ?? '',
        hint: q.hint ?? '',
        userAnswer: '',
        revealed: false,
      }));
      setPracticeQuestions(qs);
    } catch {
      setPracticeQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Practice: grade one answer ───────────────────────────────────────────────
  const gradeAnswer = async (idx: number) => {
    const q = practiceQuestions[idx];
    if (!q.userAnswer.trim()) return;
    setGradingIdx(idx);
    try {
      const raw = await callAI(
        'You are a math grader. Reply with only raw JSON.',
        `Problem: "${q.problem}"\nCorrect answer: "${q.answer}"\nStudent answered: "${q.userAnswer}"\nReply with ONLY raw JSON, no markdown: { "correct": true or false, "explanation": "one sentence" }`,
        150
      );
      const result = JSON.parse(raw.replace(/```json|```/g, '').trim());
      const updated = practiceQuestions.map((pq, i) =>
        i === idx ? { ...pq, result: { correct: !!result.correct, explanation: result.explanation ?? '' } } : pq
      );
      setPracticeQuestions(updated);

      // Check if all answered
      const allDone = updated.every(pq => pq.result !== undefined);
      if (allDone) {
        const correct = updated.filter(pq => pq.result?.correct).length;
        const scoreStr = `${correct}/5`;
        setPracticeScore(scoreStr);
        onXpEarned(15 + (correct === 5 ? 5 : 0));
      }
    } catch { /* silent */ }
    finally { setGradingIdx(null); }
  };

  // ── Restore session ──
  const restoreSession = (s: MathSession) => {
    setMode(s.mode);
    setMessages(s.messages);
    setCurrentSessionId(s.id);
    setSessionTopic(s.topic);
    setPracticeScore(s.score ?? null);
    setPracticeQuestions([]);
    setStreamingText('');
    setExpandedSessions(false);
  };

  // ── Keyboard submit ──
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── Render messages ──────────────────────────────────────────────────────────
  const renderMessage = (msg: ChatMessage, i: number) => {
    const isUser = msg.role === 'user';
    if (isUser) return (
      <div key={i} className="flex justify-end mb-3">
        <div className="bg-brand-500 text-white text-sm px-4 py-3 rounded-2xl rounded-br-sm max-w-[80%]">
          {msg.isImage && <span className="text-xs opacity-70 block mb-1">📷 Image attached</span>}
          {msg.content}
        </div>
      </div>
    );

    // Assistant — solver with steps
    if (msg.steps && msg.steps.length > 1) return (
      <div key={i} className="mb-4">
        <div className="text-xs text-brand-400 font-bold uppercase tracking-widest mb-2">Solution</div>
        {msg.steps.map((step, si) => <StepCard key={si} step={step} index={si} />)}
      </div>
    );

    // Assistant — hint
    if (msg.isHint) return (
      <div key={i} className="flex gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
          <Lightbulb size={14} className="text-yellow-500" />
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-yellow-800 dark:text-yellow-200 max-w-[80%]">
          {msg.content}
        </div>
      </div>
    );

    // Regular assistant
    return (
      <div key={i} className="flex gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0 text-sm font-bold text-brand-600 dark:text-brand-400">∑</div>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200 text-sm px-4 py-3 rounded-2xl rounded-bl-sm max-w-[80%] shadow-card whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  };

  // ── MAIN RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full view-enter">

      {/* Sessions Sidebar */}
      <div className="w-56 shrink-0 border-e border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 overflow-y-auto hidden md:flex flex-col">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400 px-4 py-3">
          History
        </div>
        <div className="flex-1 overflow-y-auto px-0 py-1">
          {sessions.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No sessions yet</p>
          )}
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => restoreSession(s)}
              className={`w-full text-left px-3 py-2.5 mx-2 rounded-xl cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all duration-150 mb-1 ${currentSessionId === s.id ? 'bg-white dark:bg-gray-800 shadow-sm' : ''}`}
              style={{ width: 'calc(100% - 1rem)' }}
            >
              <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{s.topic}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${s.mode === 'tutor' ? 'bg-brand-100 text-brand-600' : s.mode === 'solver' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {s.mode}
                </span>
                {s.score && <span className="text-yellow-500 font-bold">{s.score}</span>}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">{new Date(s.createdAt).toLocaleDateString()}</div>
            </button>
          ))}
        </div>
        <button
          onClick={() => switchMode(mode)}
          className="w-full px-3 py-2 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-xl transition-all m-2 mt-auto"
        >
          + New Session
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
          <button onClick={onBack} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
            <ArrowLeft size={18} />
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">∑</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-none">Math Tutor</h1>
            <p className="text-xs text-gray-400 truncate max-w-[180px]">{sessionTopic}</p>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'practice' && practiceScore && (
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold">
                {practiceScore} ⭐
              </span>
            )}
            {/* Mode tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              {(['tutor','solver','practice'] as TutorMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`capitalize transition-all ${mode === m ? 'bg-white dark:bg-gray-900 shadow-sm text-brand-600 font-semibold rounded-lg px-5 py-2 text-sm transition-all' : 'text-gray-500 px-5 py-2 text-sm font-medium hover:text-gray-700 dark:hover:text-gray-300 transition-all'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">

          {/* Practice Mode Setup */}
          {mode === 'practice' && practiceQuestions.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold mb-4">∑</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Practice Problems</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-xs">Enter a math topic and get 5 practice problems with instant grading.</p>
              <div className="w-full max-w-sm space-y-3">
                <input
                  value={practiceTopic}
                  onChange={e => setPracticeTopic(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && generatePractice()}
                  placeholder="e.g. quadratic equations, derivatives, fractions…"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                />
                <button
                  onClick={generatePractice}
                  disabled={loading || !practiceTopic.trim()}
                  className="w-full py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-semibold shadow-brand flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                  Generate Practice
                </button>
              </div>
            </div>
          )}

          {/* Practice Questions */}
          {mode === 'practice' && practiceQuestions.length > 0 && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {practiceScore && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 text-center">
                  <div className="text-3xl font-bold text-green-700 dark:text-green-400">{practiceScore}</div>
                  <div className="text-sm text-green-600 dark:text-green-500 font-bold">
                    {practiceScore === '5/5' ? '🎉 Perfect score!' : 'Keep practicing!'}
                  </div>
                </div>
              )}
              {practiceQuestions.map((q, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-card mb-3">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="w-7 h-7 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{q.problem}</p>
                  </div>
                  {q.result ? (
                    <div className={`rounded-xl p-4 mt-2 text-sm ${q.result.correct ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                      <div className={`font-bold mb-1 ${q.result.correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{q.result.correct ? '✓ Correct!' : '✗ Not quite'}</div>
                      <div className="text-xs opacity-80">{q.result.explanation}</div>
                      {!q.result.correct && <div className="text-xs mt-1 font-bold">Answer: {q.answer}</div>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={q.userAnswer}
                          onChange={e => {
                            const updated = practiceQuestions.map((pq, i) => i === idx ? { ...pq, userAnswer: e.target.value } : pq);
                            setPracticeQuestions(updated);
                          }}
                          onKeyDown={e => e.key === 'Enter' && gradeAnswer(idx)}
                          placeholder="Your answer…"
                          className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all mt-3"
                        />
                        <button
                          onClick={() => gradeAnswer(idx)}
                          disabled={gradingIdx === idx || !q.userAnswer.trim()}
                          className="px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 disabled:opacity-50 transition-all duration-150 mt-3"
                        >
                          {gradingIdx === idx ? <Loader2 size={14} className="animate-spin" /> : 'Check'}
                        </button>
                      </div>
                      {!q.revealed && (
                        <button
                          onClick={() => {
                            const updated = practiceQuestions.map((pq, i) => i === idx ? { ...pq, revealed: true } : pq);
                            setPracticeQuestions(updated);
                          }}
                          className="text-xs text-gray-400 hover:text-brand-500 flex items-center gap-1 transition-all duration-150"
                        >
                          <Lightbulb size={11} /> Hint: {q.hint}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => { setPracticeQuestions([]); setPracticeScore(null); }}
                className="w-full py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-500 hover:border-brand-400 hover:text-brand-500 font-bold flex items-center justify-center gap-2 transition-all duration-150"
              >
                <RotateCcw size={14} /> New Topic
              </button>
            </div>
          )}

          {/* Chat / Solver area */}
          {mode !== 'practice' && (
            <>
              {/* Welcome state */}
              {messages.length === 0 && !streamingText && (
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold mb-4">∑</div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {mode === 'tutor' ? 'Ask me anything' : 'What do you need solved?'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                    {mode === 'tutor'
                      ? "I'll guide you step by step without giving away the answer."
                      : "I'll show you every step clearly so you understand the method."}
                  </p>
                </div>
              )}

              {/* Messages */}
              {(messages.length > 0 || streamingText) && (
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.map(renderMessage)}
                  {/* Graph section (solver mode) */}
                  {mode === 'solver' && messages.some(m => m.role === 'assistant') && (
                    <div className="mb-2">
                      {graphFn ? (
                        <FunctionGraph fnStr={graphFn} />
                      ) : (
                        <button
                          onClick={generateGraph}
                          disabled={generatingGraph}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-50 to-violet-50 dark:from-brand-900/20 dark:to-violet-900/20 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 rounded-xl text-xs font-bold hover:from-brand-100 hover:to-violet-100 dark:hover:from-brand-900/30 dark:hover:to-violet-900/30 transition-all disabled:opacity-50"
                        >
                          {generatingGraph ? <Loader2 size={13} className="animate-spin" /> : <BarChart2 size={13} />}
                          {generatingGraph ? 'Generating Graph…' : 'Graph this function'}
                        </button>
                      )}
                      {graphFn && (
                        <button
                          onClick={() => setGraphFn(null)}
                          className="mt-1 text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-1 transition-all"
                        >
                          <X size={10} /> Close graph
                        </button>
                      )}
                    </div>
                  )}
                  {streamingText && (
                    <div className="flex gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0 text-sm font-bold text-brand-600 dark:text-brand-400">∑</div>
                      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200 text-sm px-4 py-3 rounded-2xl rounded-bl-sm max-w-[80%] shadow-card whitespace-pre-wrap">
                        {streamingText}
                        <span className="inline-block w-1.5 h-4 bg-brand-400 ml-0.5 animate-pulse align-middle" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </>
          )}

          {/* Input area footer (tutor + solver only) */}
          {mode !== 'practice' && (
            <div className="border-t border-gray-100 dark:border-gray-800 p-4 bg-white dark:bg-gray-900 flex-shrink-0">
              {/* Symbol toolbar */}
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2 mb-3">
                {SYMBOLS.map(sym => (
                  <button
                    key={sym}
                    onClick={() => insertSymbol(sym)}
                    className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono hover:bg-brand-50 hover:border-brand-300 hover:text-brand-600 dark:hover:bg-brand-900/20 cursor-pointer transition-all duration-150 shrink-0"
                  >
                    {sym}
                  </button>
                ))}
              </div>

              {/* Image preview */}
              {imgBase64 && (
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                    <img src={`data:image/png;base64,${imgBase64}`} alt="attached" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs text-gray-500">Image attached</span>
                  <button onClick={() => setImgBase64(null)} className="ml-auto text-gray-400 hover:text-red-500 transition-all duration-150">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Input row */}
              <div className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={mode === 'tutor' ? 'Ask a math question…' : 'Enter a problem to solve…'}
                  rows={2}
                  className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all resize-none min-h-[60px] max-h-[120px] text-gray-900 dark:text-white placeholder-gray-400"
                />
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleSubmit()}
                    disabled={loading || (!input.trim() && !imgBase64)}
                    className="p-2.5 bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-all duration-150 shrink-0 disabled:opacity-40"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>

              {/* Action buttons row */}
              <div className="flex items-center gap-2 mt-2">
                {/* Upload image */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all"
                  title="Upload image"
                >
                  <Camera size={16} />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

                {/* Voice */}
                <button
                  onClick={handleVoice}
                  className="p-2.5 rounded-xl text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all"
                  title="Voice input"
                >
                  <Mic size={16} />
                </button>

                {/* Draw */}
                <button
                  onClick={() => setShowCanvas(true)}
                  className="p-2.5 rounded-xl text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all"
                  title="Draw problem"
                >
                  <Pencil size={16} />
                </button>

                {/* Hint — tutor mode only */}
                {mode === 'tutor' && messages.length > 0 && (
                  <button
                    onClick={handleHint}
                    disabled={loading}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-xl text-xs font-bold hover:bg-yellow-200 dark:hover:bg-yellow-900/40 disabled:opacity-50 transition-all duration-150"
                  >
                    <Lightbulb size={13} /> Hint
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Draw Canvas Modal */}
      {showCanvas && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-4 w-full max-w-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 dark:text-white">Draw your problem</h3>
              <button onClick={() => setShowCanvas(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-all duration-150">
                <X size={18} />
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={560}
              height={300}
              className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={() => setDrawing(false)}
              onMouseLeave={() => setDrawing(false)}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={clearCanvas}
                className="flex-1 py-2 border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-bold hover:border-gray-300 transition-all duration-150"
              >
                Clear
              </button>
              <button
                onClick={submitCanvas}
                className="flex-1 py-2 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-all duration-150"
              >
                Submit drawing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MathTutorView;
