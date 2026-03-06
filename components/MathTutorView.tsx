import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Send, Loader2, Mic, Camera, Pencil, Lightbulb,
  RotateCcw, ChevronDown, ChevronRight, Clock, Star, BookOpen, X
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
    <div className="border-l-4 border-brand-400 pl-4 py-2 mb-3 bg-gray-50 dark:bg-gray-800/50 rounded-r-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{index + 1}</span>
          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{step}</p>
        </div>
        <button
          onClick={explain}
          className="flex-shrink-0 text-xs text-brand-500 hover:text-brand-600 font-bold flex items-center gap-1 mt-0.5"
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
        <div className="max-w-[75%] bg-brand-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm shadow-sm">
          {msg.isImage && <span className="text-xs opacity-70 block mb-1">📷 Image attached</span>}
          {msg.content}
        </div>
      </div>
    );

    // Assistant — solver with steps
    if (msg.steps && msg.steps.length > 1) return (
      <div key={i} className="mb-4">
        <div className="text-xs text-brand-400 font-black uppercase tracking-widest mb-2">Solution</div>
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
        <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0 text-sm font-black text-brand-600 dark:text-brand-400">∑</div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 max-w-[80%] shadow-sm whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  };

  // ── MAIN RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50 dark:bg-gray-900">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg">∑</div>
          <div>
            <h1 className="font-black text-gray-900 dark:text-white text-base leading-none">Math Tutor</h1>
            <p className="text-xs text-gray-400 truncate max-w-[180px]">{sessionTopic}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'practice' && practiceScore && (
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-black">
              {practiceScore} ⭐
            </span>
          )}
          {/* Mode tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-0.5 gap-0.5">
            {(['tutor','solver','practice'] as TutorMode[]).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black capitalize transition-all ${mode === m ? 'bg-white dark:bg-gray-600 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">

        {/* Sessions Sidebar */}
        <div className="w-52 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col hidden lg:flex">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">History</span>
            <button
              onClick={() => switchMode(mode)}
              className="text-xs text-brand-500 hover:text-brand-600 font-bold"
            >
              + New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No sessions yet</p>
            )}
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => restoreSession(s)}
                className={`w-full text-left px-2.5 py-2 rounded-lg transition-all text-xs ${currentSessionId === s.id ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
              >
                <div className="font-bold truncate">{s.topic}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${s.mode === 'tutor' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : s.mode === 'solver' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                    {s.mode}
                  </span>
                  {s.score && <span className="text-yellow-500 font-black">{s.score}</span>}
                </div>
                <div className="text-[9px] text-gray-400 mt-0.5">{new Date(s.createdAt).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* Practice Mode Setup */}
          {mode === 'practice' && practiceQuestions.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-black mb-4">∑</div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">Practice Problems</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-xs">Enter a math topic and get 5 practice problems with instant grading.</p>
              <div className="w-full max-w-sm space-y-3">
                <input
                  value={practiceTopic}
                  onChange={e => setPracticeTopic(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && generatePractice()}
                  placeholder="e.g. quadratic equations, derivatives, fractions…"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-400"
                />
                <button
                  onClick={generatePractice}
                  disabled={loading || !practiceTopic.trim()}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-black text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                  Generate Practice
                </button>
              </div>
            </div>
          )}

          {/* Practice Questions */}
          {mode === 'practice' && practiceQuestions.length > 0 && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {practiceScore && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 text-center">
                  <div className="text-3xl font-black text-green-700 dark:text-green-400">{practiceScore}</div>
                  <div className="text-sm text-green-600 dark:text-green-500 font-bold">
                    {practiceScore === '5/5' ? '🎉 Perfect score!' : 'Keep practicing!'}
                  </div>
                </div>
              )}
              {practiceQuestions.map((q, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="w-7 h-7 rounded-full bg-brand-500 text-white text-xs font-black flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{q.problem}</p>
                  </div>
                  {q.result ? (
                    <div className={`rounded-xl p-3 text-sm ${q.result.correct ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                      <div className="font-black mb-1">{q.result.correct ? '✓ Correct!' : '✗ Not quite'}</div>
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
                          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-brand-400"
                        />
                        <button
                          onClick={() => gradeAnswer(idx)}
                          disabled={gradingIdx === idx || !q.userAnswer.trim()}
                          className="px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-black hover:bg-brand-600 disabled:opacity-50"
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
                          className="text-xs text-gray-400 hover:text-brand-500 flex items-center gap-1"
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
                className="w-full py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-500 hover:border-brand-400 hover:text-brand-500 font-bold flex items-center justify-center gap-2"
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
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-black mb-4">∑</div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">
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
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {messages.map(renderMessage)}
                  {streamingText && (
                    <div className="flex gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0 text-sm font-black text-brand-600 dark:text-brand-400">∑</div>
                      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 max-w-[80%] shadow-sm whitespace-pre-wrap">
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

          {/* Input area (tutor + solver only) */}
          {mode !== 'practice' && (
            <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 px-3 pb-3 pt-2">
              {/* Symbol toolbar */}
              <div className="flex gap-1 overflow-x-auto pb-1.5 mb-2 scrollbar-none">
                {SYMBOLS.map(sym => (
                  <button
                    key={sym}
                    onClick={() => insertSymbol(sym)}
                    className="flex-shrink-0 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm hover:bg-brand-100 dark:hover:bg-brand-900/30 hover:text-brand-600 dark:hover:text-brand-400 font-mono transition-colors"
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
                  <button onClick={() => setImgBase64(null)} className="ml-auto text-gray-400 hover:text-red-500">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Textarea row */}
              <div className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={mode === 'tutor' ? 'Ask a math question…' : 'Enter a problem to solve…'}
                  rows={2}
                  className="flex-1 resize-none px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-brand-400 min-h-[60px] max-h-[120px]"
                />
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleSubmit()}
                    disabled={loading || (!input.trim() && !imgBase64)}
                    className="w-9 h-9 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors"
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
                  className="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                  title="Upload image"
                >
                  <Camera size={16} />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

                {/* Voice */}
                <button
                  onClick={handleVoice}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                  title="Voice input"
                >
                  <Mic size={16} />
                </button>

                {/* Draw */}
                <button
                  onClick={() => setShowCanvas(true)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                  title="Draw problem"
                >
                  <Pencil size={16} />
                </button>

                {/* Hint — tutor mode only */}
                {mode === 'tutor' && messages.length > 0 && (
                  <button
                    onClick={handleHint}
                    disabled={loading}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-xl text-xs font-black hover:bg-yellow-200 dark:hover:bg-yellow-900/40 disabled:opacity-50 transition-colors"
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 w-full max-w-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-gray-900 dark:text-white">Draw your problem</h3>
              <button onClick={() => setShowCanvas(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
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
                className="flex-1 py-2 border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-bold hover:border-gray-300"
              >
                Clear
              </button>
              <button
                onClick={submitCanvas}
                className="flex-1 py-2 bg-brand-500 text-white rounded-xl text-sm font-black hover:bg-brand-600"
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
