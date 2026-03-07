import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Youtube, FileText, Lightbulb, BookOpen, Mic, MicOff, RotateCcw,
  ChevronRight, ChevronLeft, Check, X, Loader2, Save, Clock, Tag,
  Zap, PlayCircle, PauseCircle, Volume2, Layers, Star, Trophy,
  ArrowLeft, Plus, Trash2, Download, Hash, AlignLeft, Brain
} from 'lucide-react';
import { GradeLevel, Language, Translations } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '';

// ── Types ─────────────────────────────────────────────────────────────────────

type SourceMode = 'youtube' | 'text' | 'topic';
type NoteTab = 'notes' | 'flashcards' | 'quiz' | 'podcast';
type Confidence = 'new' | 'hard' | 'good' | 'easy';

interface NoteSection {
  type: 'intro' | 'concept' | 'example' | 'summary' | 'definition' | 'formula';
  title: string;
  content: string;
}

interface GeneratedNote {
  title: string;
  summary: string;
  sections: NoteSection[];
  keyPoints: string[];
  equations: string[];
  tags: string[];
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  confidence: Confidence;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  userAnswer: number | null;
}

interface SavedNote {
  id: string;
  createdAt: number;
  title: string;
  source: string;
  note: GeneratedNote;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOTES_DB_KEY = 'brainwave_notes_v1';

function extractVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return m ? m[1] : null;
}

async function callAI(system: string, userContent: string, maxTokens = 2000): Promise<string> {
  const res = await fetch(`${API_BASE}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system,
      messages: [{ role: 'user', content: userContent }],
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const block = (data.content ?? []).find((b: any) => b.type === 'text');
  return block?.text ?? '';
}

function parseJSON<T>(raw: string): T | null {
  try {
    // Extract the outermost JSON object or array
    const start = raw.search(/[\[{]/);
    const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
    if (start === -1 || end === -1) return null;
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

const SECTION_STYLES: Record<string, { bg: string; border: string; badge: string; icon: React.ReactNode }> = {
  intro:      { bg: 'bg-blue-50 dark:bg-blue-900/10',    border: 'border-blue-200 dark:border-blue-800',    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',    icon: <BookOpen size={14} /> },
  concept:    { bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-200 dark:border-purple-800', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', icon: <Brain size={14} /> },
  example:    { bg: 'bg-amber-50 dark:bg-amber-900/10',   border: 'border-amber-200 dark:border-amber-800',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',   icon: <Lightbulb size={14} /> },
  summary:    { bg: 'bg-green-50 dark:bg-green-900/10',   border: 'border-green-200 dark:border-green-800',   badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',   icon: <Layers size={14} /> },
  definition: { bg: 'bg-cyan-50 dark:bg-cyan-900/10',     border: 'border-cyan-200 dark:border-cyan-800',     badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',     icon: <Hash size={14} /> },
  formula:    { bg: 'bg-rose-50 dark:bg-rose-900/10',     border: 'border-rose-200 dark:border-rose-800',     badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',     icon: <Zap size={14} /> },
};

const CONFIDENCE_CONFIG: Record<Confidence, { label: string; color: string }> = {
  new:  { label: 'New',      color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  hard: { label: 'Hard',     color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  good: { label: 'Good',     color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  easy: { label: 'Easy',     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  theme: 'light' | 'dark';
  onBack: () => void;
  onXpEarned: (xp: number) => void;
  onContextUpdate: (ctx: string) => void;
}

// ── Main Component ────────────────────────────────────────────────────────────

const NotesView: React.FC<Props> = ({ userGrade, language, theme, onBack, onXpEarned, onContextUpdate }) => {
  const [sourceMode, setSourceMode] = useState<SourceMode>('topic');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [textInput, setTextInput] = useState('');
  const [topicInput, setTopicInput] = useState('');

  const [note, setNote] = useState<GeneratedNote | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);

  const [activeTab, setActiveTab] = useState<NoteTab>('notes');
  const [loading, setLoading] = useState(false);
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);

  // Flashcard state
  const [cardIdx, setCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz state
  const [quizAnswered, setQuizAnswered] = useState(0);

  // Podcast (TTS) state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // History
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Video ID
  const videoId = sourceMode === 'youtube' ? extractVideoId(youtubeUrl) : null;

  useEffect(() => {
    const saved: SavedNote[] = JSON.parse(localStorage.getItem(NOTES_DB_KEY) || '[]');
    setSavedNotes(saved);
  }, []);

  useEffect(() => {
    onContextUpdate('AI Notes — Generate rich notes, flashcards & quizzes');
  }, []);

  const saveNote = useCallback((n: GeneratedNote, fc: Flashcard[], qz: QuizQuestion[], sourceLabel: string) => {
    const saved: SavedNote[] = JSON.parse(localStorage.getItem(NOTES_DB_KEY) || '[]');
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const entry: SavedNote = { id, createdAt: Date.now(), title: n.title, source: sourceLabel, note: n, flashcards: fc, quiz: qz };
    const updated = [entry, ...saved.slice(0, 49)];
    localStorage.setItem(NOTES_DB_KEY, JSON.stringify(updated));
    setSavedNotes(updated);
    setActiveNoteId(id);
    return id;
  }, []);

  // ── Generate Notes ────────────────────────────────────────────────────────

  const generateNotes = async () => {
    let sourcePrompt = '';
    let sourceLabel = '';

    if (sourceMode === 'youtube' && youtubeUrl.trim()) {
      sourcePrompt = `Generate comprehensive study notes for a video at: ${youtubeUrl}\nBased on the URL/topic, create detailed educational notes as if the video covers this subject.`;
      sourceLabel = `YouTube: ${youtubeUrl}`;
    } else if (sourceMode === 'text' && textInput.trim()) {
      sourcePrompt = `Convert this content into structured study notes:\n\n${textInput}`;
      sourceLabel = 'Text input';
    } else if (sourceMode === 'topic' && topicInput.trim()) {
      sourcePrompt = `Create comprehensive educational notes about: "${topicInput}" for a ${userGrade} student.`;
      sourceLabel = topicInput;
    } else {
      return;
    }

    setLoading(true);
    setNote(null);
    setFlashcards([]);
    setQuiz([]);
    setActiveTab('notes');

    const system = `You are an expert educational note-taker for BrainWave AI.
Create beautifully structured, comprehensive study notes.
Always respond with ONLY a valid JSON object — no markdown, no backticks, no explanation outside the JSON.
The JSON must match this exact schema:
{
  "title": "string",
  "summary": "2-3 sentence overview",
  "sections": [
    { "type": "intro|concept|example|summary|definition|formula", "title": "string", "content": "detailed content" }
  ],
  "keyPoints": ["bullet point 1", "bullet point 2"],
  "equations": ["equation 1 if relevant, else empty array"],
  "tags": ["tag1", "tag2", "tag3"]
}
Include 4-7 sections, 5-8 key points, appropriate equations for math/science topics.`;

    try {
      const raw = await callAI(system, sourcePrompt, 3000);
      const parsed = parseJSON<GeneratedNote>(raw);
      if (parsed && parsed.title && parsed.sections) {
        setNote(parsed);
        onXpEarned(10);
        onContextUpdate(`Notes: ${parsed.title}`);
        // Auto-generate flashcards
        doGenerateFlashcards(parsed, sourceLabel);
      } else {
        throw new Error('Invalid note format');
      }
    } catch (e) {
      console.error('Note generation error:', e);
    } finally {
      setLoading(false);
    }
  };

  const doGenerateFlashcards = async (n: GeneratedNote, sourceLabel: string) => {
    setGeneratingFlashcards(true);
    const system = `You are a flashcard creator. Return ONLY a raw JSON array of flashcard objects.
Each flashcard: { "front": "question or term", "back": "answer or definition" }
Create 8-12 high-quality flashcards from the provided notes.`;
    const prompt = `Create flashcards from these notes:\nTitle: ${n.title}\nKey Points: ${n.keyPoints.join('; ')}\nSections: ${n.sections.map(s => s.title + ': ' + s.content.slice(0, 200)).join('\n')}`;
    try {
      const raw = await callAI(system, prompt, 2000);
      const parsed = parseJSON<{ front: string; back: string }[]>(raw);
      if (Array.isArray(parsed)) {
        const cards: Flashcard[] = parsed.map((c, i) => ({
          id: `fc-${i}`,
          front: c.front || '',
          back: c.back || '',
          confidence: 'new' as Confidence,
        }));
        setFlashcards(cards);
        // Save after flashcards are ready
        saveNote(n, cards, [], sourceLabel);
      }
    } catch { /* silent */ } finally {
      setGeneratingFlashcards(false);
    }
  };

  const generateQuiz = async () => {
    if (!note) return;
    setGeneratingQuiz(true);
    const system = `You are a quiz generator. Return ONLY a raw JSON array of quiz question objects.
Schema: { "question": "string", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "string" }
Create 5-7 multiple choice questions. correctIndex is 0-based index into options array.`;
    const prompt = `Create a quiz from:\nTitle: ${note.title}\nKey Points: ${note.keyPoints.join('; ')}\nContent: ${note.sections.map(s => s.content).join(' ').slice(0, 1500)}`;
    try {
      const raw = await callAI(system, prompt, 2000);
      const parsed = parseJSON<{ question: string; options: string[]; correctIndex: number; explanation: string }[]>(raw);
      if (Array.isArray(parsed)) {
        const questions: QuizQuestion[] = parsed.map(q => ({
          question: q.question || '',
          options: q.options || [],
          correctIndex: q.correctIndex ?? 0,
          explanation: q.explanation || '',
          userAnswer: null,
        }));
        setQuiz(questions);
        setQuizAnswered(0);
        onXpEarned(5);
        // Update saved note
        const current = savedNotes.find(s => s.id === activeNoteId);
        if (current && activeNoteId) {
          const allSaved: SavedNote[] = JSON.parse(localStorage.getItem(NOTES_DB_KEY) || '[]');
          const updated = allSaved.map(s => s.id === activeNoteId ? { ...s, quiz: questions } : s);
          localStorage.setItem(NOTES_DB_KEY, JSON.stringify(updated));
          setSavedNotes(updated);
        }
      }
    } catch { /* silent */ } finally {
      setGeneratingQuiz(false);
    }
  };

  // ── Podcast (TTS) ─────────────────────────────────────────────────────────

  const buildPodcastText = (n: GeneratedNote) =>
    `${n.title}. ${n.summary}. ` +
    n.sections.map(s => `${s.title}. ${s.content}`).join('. ') +
    `. Key points: ${n.keyPoints.join('. ')}.`;

  const togglePodcast = () => {
    if (!note) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const text = buildPodcastText(note);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechRate;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  // ── Load saved note ───────────────────────────────────────────────────────

  const loadSavedNote = (s: SavedNote) => {
    setNote(s.note);
    setFlashcards(s.flashcards);
    setQuiz(s.quiz);
    setActiveNoteId(s.id);
    setActiveTab('notes');
    setShowHistory(false);
    setCardIdx(0);
    setIsFlipped(false);
    setQuizAnswered(0);
    setIsSpeaking(false);
  };

  const deleteSavedNote = (id: string) => {
    const updated = savedNotes.filter(s => s.id !== id);
    setSavedNotes(updated);
    localStorage.setItem(NOTES_DB_KEY, JSON.stringify(updated));
    if (activeNoteId === id) {
      setNote(null);
      setFlashcards([]);
      setQuiz([]);
      setActiveNoteId(null);
    }
  };

  // ── Flashcard navigation ──────────────────────────────────────────────────

  const nextCard = () => { setCardIdx(i => (i + 1) % flashcards.length); setIsFlipped(false); };
  const prevCard = () => { setCardIdx(i => (i - 1 + flashcards.length) % flashcards.length); setIsFlipped(false); };

  const setCardConfidence = (conf: Confidence) => {
    setFlashcards(prev => prev.map((c, i) => i === cardIdx ? { ...c, confidence: conf } : c));
    nextCard();
  };

  // ── Quiz ──────────────────────────────────────────────────────────────────

  const answerQuiz = (qIdx: number, optIdx: number) => {
    setQuiz(prev => prev.map((q, i) => i === qIdx ? { ...q, userAnswer: optIdx } : q));
    setQuizAnswered(prev => prev + 1);
    const isCorrect = quiz[qIdx].correctIndex === optIdx;
    if (isCorrect) onXpEarned(5);
  };

  const quizScore = quiz.length > 0 ? quiz.filter(q => q.userAnswer === q.correctIndex).length : 0;
  const quizDone = quiz.length > 0 && quiz.every(q => q.userAnswer !== null);

  // ── Render ────────────────────────────────────────────────────────────────

  const canGenerate =
    (sourceMode === 'youtube' && youtubeUrl.trim()) ||
    (sourceMode === 'text' && textInput.trim()) ||
    (sourceMode === 'topic' && topicInput.trim());

  return (
    <div className="flex h-full view-enter bg-gray-50 dark:bg-gray-950">

      {/* Left panel — source + history */}
      <div className="w-72 shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={onBack} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <FileText size={16} className="text-white" />
              </div>
              <span className="font-bold text-gray-900 dark:text-white text-sm">AI Notes</span>
            </div>
            <button
              onClick={() => setShowHistory(h => !h)}
              className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              title="History"
            >
              <Clock size={16} />
            </button>
          </div>

          {/* Source mode tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-3">
            {[
              { mode: 'topic' as const, icon: <Brain size={12} />, label: 'Topic' },
              { mode: 'youtube' as const, icon: <Youtube size={12} />, label: 'YouTube' },
              { mode: 'text' as const, icon: <AlignLeft size={12} />, label: 'Text' },
            ].map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => setSourceMode(mode)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-lg font-semibold transition-all duration-150 ${
                  sourceMode === mode
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Source inputs */}
          {sourceMode === 'topic' && (
            <input
              value={topicInput}
              onChange={e => setTopicInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generateNotes()}
              placeholder="e.g. Photosynthesis, World War II, Python loops…"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all text-gray-900 dark:text-white placeholder-gray-400"
            />
          )}

          {sourceMode === 'youtube' && (
            <div className="space-y-2">
              <input
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generateNotes()}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all text-gray-900 dark:text-white placeholder-gray-400"
              />
              {videoId && (
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    className="w-full aspect-video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="YouTube video"
                  />
                </div>
              )}
            </div>
          )}

          {sourceMode === 'text' && (
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="Paste any text, article, lecture notes, or document content…"
              rows={6}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none text-gray-900 dark:text-white placeholder-gray-400"
            />
          )}

          <button
            onClick={generateNotes}
            disabled={loading || !canGenerate}
            className="w-full mt-3 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25"
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
              : <><Zap size={14} /> Generate Notes</>
            }
          </button>
        </div>

        {/* History list */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {showHistory ? (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 pt-3 pb-2">Saved Notes ({savedNotes.length})</div>
              {savedNotes.length === 0 && <p className="text-xs text-gray-400 text-center py-6">No saved notes yet</p>}
              {savedNotes.map(s => (
                <div
                  key={s.id}
                  className={`flex items-start gap-2 px-3 py-3 mx-2 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all mb-1 group ${activeNoteId === s.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}
                  onClick={() => loadSavedNote(s)}
                >
                  <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText size={10} className="text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{s.title}</div>
                    <div className="text-[10px] text-gray-400 truncate">{s.source}</div>
                    <div className="text-[10px] text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteSavedNote(s.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">How it works</div>
              {[
                { icon: <Brain size={12} />, text: 'Enter a topic, YouTube URL, or paste text' },
                { icon: <Zap size={12} />, text: 'AI generates rich, structured notes' },
                { icon: <Star size={12} />, text: 'Review with flashcards or take a quiz' },
                { icon: <Volume2 size={12} />, text: 'Listen with Podcast mode (TTS)' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-2.5 mb-3">
                  <div className="w-5 h-5 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0 mt-0.5">{icon}</div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <button onClick={onBack} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 transition-all">
            <ArrowLeft size={18} />
          </button>
          <span className="font-bold text-gray-900 dark:text-white">AI Notes</span>
        </div>

        {/* Empty state */}
        {!note && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg shadow-violet-500/25">
              <FileText size={36} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">AI-Powered Notes</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-2">
              Generate beautifully structured notes from any YouTube video, text, or topic.
            </p>
            <p className="text-sm text-gray-400">Use the left panel to get started.</p>
            {/* Mobile quick start */}
            <div className="md:hidden mt-6 w-full max-w-sm space-y-3">
              <input
                value={topicInput}
                onChange={e => setTopicInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generateNotes()}
                placeholder="Enter any topic…"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-violet-500 transition-all"
              />
              <button
                onClick={generateNotes}
                disabled={loading || !topicInput.trim()}
                className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                Generate Notes
              </button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center animate-pulse">
              <Brain size={28} className="text-white" />
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-900 dark:text-white mb-1">Generating Notes…</p>
              <p className="text-sm text-gray-400">AI is creating your personalized study notes</p>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}

        {/* Note content */}
        {note && !loading && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 pt-4 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate flex-1">{note.title}</h1>
                <div className="flex items-center gap-1.5">
                  {note.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full text-xs font-medium">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                {([
                  { id: 'notes' as const, label: 'Notes', icon: <FileText size={13} /> },
                  { id: 'flashcards' as const, label: `Flashcards${flashcards.length > 0 ? ` (${flashcards.length})` : ''}`, icon: <Layers size={13} />, loading: generatingFlashcards },
                  { id: 'quiz' as const, label: quiz.length > 0 ? `Quiz (${quiz.length})` : 'Quiz', icon: <Trophy size={13} /> },
                  { id: 'podcast' as const, label: 'Podcast', icon: <Volume2 size={13} /> },
                ] as { id: NoteTab; label: string; icon: React.ReactNode; loading?: boolean }[]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id === 'quiz' && quiz.length === 0) generateQuiz();
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-semibold transition-all border-b-2 ${
                      activeTab === tab.id
                        ? 'border-violet-500 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/10'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {tab.loading ? <Loader2 size={13} className="animate-spin" /> : tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">

              {/* NOTES TAB */}
              {activeTab === 'notes' && (
                <div className="p-6 max-w-3xl mx-auto space-y-4">
                  {/* Summary */}
                  <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/10 dark:to-purple-900/10 border border-violet-200 dark:border-violet-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain size={16} className="text-violet-600 dark:text-violet-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">Summary</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{note.summary}</p>
                  </div>

                  {/* Sections */}
                  {note.sections.map((section, i) => {
                    const style = SECTION_STYLES[section.type] || SECTION_STYLES.concept;
                    return (
                      <div key={i} className={`${style.bg} border ${style.border} rounded-2xl p-5`}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${style.badge}`}>
                            {style.icon}
                            {section.type.charAt(0).toUpperCase() + section.type.slice(1)}
                          </span>
                          <h3 className="font-bold text-gray-900 dark:text-white text-sm">{section.title}</h3>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{section.content}</p>
                      </div>
                    );
                  })}

                  {/* Key Points */}
                  {note.keyPoints.length > 0 && (
                    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Star size={16} className="text-amber-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Key Points</span>
                      </div>
                      <ul className="space-y-2">
                        {note.keyPoints.map((point, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                            <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Equations */}
                  {note.equations.length > 0 && note.equations[0] && (
                    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap size={16} className="text-rose-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Formulas & Equations</span>
                      </div>
                      <div className="space-y-2">
                        {note.equations.map((eq, i) => (
                          <div key={i} className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3 font-mono text-sm text-rose-800 dark:text-rose-300">
                            {eq}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* FLASHCARDS TAB */}
              {activeTab === 'flashcards' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                  {generatingFlashcards ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={28} className="animate-spin text-violet-500" />
                      <p className="text-sm text-gray-500">Generating flashcards…</p>
                    </div>
                  ) : flashcards.length === 0 ? (
                    <div className="text-center">
                      <p className="text-gray-400 mb-4">No flashcards yet</p>
                      <button
                        onClick={() => note && doGenerateFlashcards(note, 'manual')}
                        className="px-4 py-2 bg-violet-500 text-white rounded-xl font-semibold text-sm"
                      >
                        Generate Flashcards
                      </button>
                    </div>
                  ) : (
                    <div className="w-full max-w-lg">
                      {/* Progress */}
                      <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
                        <span>{cardIdx + 1} / {flashcards.length}</span>
                        <div className="flex items-center gap-3">
                          {(['hard', 'good', 'easy'] as Confidence[]).map(c => {
                            const count = flashcards.filter(f => f.confidence === c).length;
                            const cfg = CONFIDENCE_CONFIG[c];
                            return count > 0 ? (
                              <span key={c} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>{count} {cfg.label}</span>
                            ) : null;
                          })}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full mb-6 overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${((cardIdx + 1) / flashcards.length) * 100}%` }} />
                      </div>

                      {/* Card */}
                      <div
                        className="flashcard-container cursor-pointer mb-6 select-none"
                        onClick={() => setIsFlipped(f => !f)}
                        style={{ perspective: 1000 }}
                      >
                        <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
                          <div className="flashcard-front bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[200px] shadow-lg">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Question</span>
                            <p className="text-center font-semibold text-gray-900 dark:text-white text-base leading-relaxed">{flashcards[cardIdx]?.front}</p>
                            <span className="text-xs text-gray-400 mt-4">Tap to reveal answer</span>
                          </div>
                          <div className="flashcard-back bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[200px] shadow-lg">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-200 mb-4">Answer</span>
                            <p className="text-center font-semibold text-white text-base leading-relaxed">{flashcards[cardIdx]?.back}</p>
                          </div>
                        </div>
                      </div>

                      {/* Confidence buttons (show when flipped) */}
                      {isFlipped ? (
                        <div className="flex gap-2 justify-center mb-4">
                          {([
                            { conf: 'hard' as const, label: 'Hard', color: 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400' },
                            { conf: 'good' as const, label: 'Good', color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400' },
                            { conf: 'easy' as const, label: 'Easy', color: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' },
                          ]).map(({ conf, label, color }) => (
                            <button key={conf} onClick={() => setCardConfidence(conf)} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${color}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-4">
                          <button onClick={prevCard} className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
                            <ChevronLeft size={18} />
                          </button>
                          <button onClick={nextCard} className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      )}

                      {/* Shuffle / Reset */}
                      <div className="flex justify-center mt-3">
                        <button
                          onClick={() => { setCardIdx(0); setIsFlipped(false); setFlashcards(prev => prev.map(c => ({ ...c, confidence: 'new' as Confidence }))); }}
                          className="text-xs text-gray-400 hover:text-violet-500 flex items-center gap-1 transition-all"
                        >
                          <RotateCcw size={11} /> Reset progress
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* QUIZ TAB */}
              {activeTab === 'quiz' && (
                <div className="p-6 max-w-2xl mx-auto">
                  {generatingQuiz ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <Loader2 size={28} className="animate-spin text-violet-500" />
                      <p className="text-sm text-gray-500">Generating quiz questions…</p>
                    </div>
                  ) : quiz.length === 0 ? (
                    <div className="text-center py-16">
                      <Trophy size={36} className="text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-400 mb-4">Quiz not generated yet</p>
                      <button onClick={generateQuiz} className="px-4 py-2 bg-violet-500 text-white rounded-xl font-semibold text-sm">
                        Generate Quiz
                      </button>
                    </div>
                  ) : (
                    <div>
                      {quizDone && (
                        <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800 rounded-2xl p-5 mb-6 text-center">
                          <div className="text-3xl font-bold text-violet-700 dark:text-violet-300 mb-1">{quizScore}/{quiz.length}</div>
                          <div className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                            {quizScore === quiz.length ? 'Perfect! Outstanding work!' : quizScore >= quiz.length * 0.7 ? 'Great job! Keep it up!' : 'Keep studying — you\'ll get there!'}
                          </div>
                          <button
                            onClick={() => { setQuiz(prev => prev.map(q => ({ ...q, userAnswer: null }))); setQuizAnswered(0); }}
                            className="mt-3 text-xs text-violet-600 dark:text-violet-400 flex items-center gap-1 mx-auto hover:underline"
                          >
                            <RotateCcw size={11} /> Try again
                          </button>
                        </div>
                      )}
                      <div className="space-y-5">
                        {quiz.map((q, qi) => (
                          <div key={qi} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                            <div className="flex items-start gap-3 mb-4">
                              <span className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{qi + 1}</span>
                              <p className="font-semibold text-gray-900 dark:text-white text-sm">{q.question}</p>
                            </div>
                            <div className="space-y-2 ml-9">
                              {q.options.map((opt, oi) => {
                                const answered = q.userAnswer !== null;
                                const isSelected = q.userAnswer === oi;
                                const isCorrect = q.correctIndex === oi;
                                let cls = 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/10';
                                if (answered && isCorrect) cls = 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400';
                                else if (answered && isSelected && !isCorrect) cls = 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400';
                                else if (answered) cls = 'border-gray-200 dark:border-gray-700 text-gray-400 opacity-60';
                                return (
                                  <button
                                    key={oi}
                                    onClick={() => !answered && answerQuiz(qi, oi)}
                                    disabled={answered}
                                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 flex items-center justify-between ${cls}`}
                                  >
                                    <span>{opt}</span>
                                    {answered && isCorrect && <Check size={14} />}
                                    {answered && isSelected && !isCorrect && <X size={14} />}
                                  </button>
                                );
                              })}
                            </div>
                            {q.userAnswer !== null && (
                              <div className="ml-9 mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs text-gray-600 dark:text-gray-400">
                                <span className="font-bold">Explanation: </span>{q.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PODCAST TAB */}
              {activeTab === 'podcast' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                  <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-2xl transition-all duration-500 ${
                    isSpeaking
                      ? 'bg-gradient-to-br from-violet-500 to-purple-600 scale-110 shadow-violet-500/40'
                      : 'bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800'
                  }`}>
                    {isSpeaking
                      ? <PauseCircle size={40} className="text-white" />
                      : <PlayCircle size={40} className="text-gray-600 dark:text-gray-400" />
                    }
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{note.title}</h3>
                  <p className="text-sm text-gray-400 mb-6">Podcast Mode — AI reads your notes aloud</p>

                  {/* Speed control */}
                  <div className="flex items-center gap-4 mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-6 py-3">
                    <span className="text-xs text-gray-400 font-semibold">Speed</span>
                    {[0.75, 1, 1.25, 1.5, 2].map(rate => (
                      <button
                        key={rate}
                        onClick={() => { setSpeechRate(rate); if (utteranceRef.current) utteranceRef.current.rate = rate; }}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-all ${speechRate === rate ? 'bg-violet-500 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                      >
                        {rate}×
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={togglePodcast}
                    className={`px-8 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg ${
                      isSpeaking
                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/25'
                        : 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-violet-500/25'
                    }`}
                  >
                    {isSpeaking ? <><MicOff size={16} /> Stop</> : <><Mic size={16} /> Play Notes</>}
                  </button>

                  <div className="mt-8 max-w-xl w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
                    <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Content Preview</div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-6">
                      {buildPodcastText(note)}
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesView;
