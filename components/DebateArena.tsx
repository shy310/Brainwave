import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Loader2, Send, Trophy, RefreshCw, Swords, Star } from 'lucide-react';
import { GradeLevel, Language, Translations, Subject, DebateTurn } from '../types';
import { generateDebateTopic, evaluateDebateArgument } from '../services/aiService';
import { SUBJECTS_DATA } from '../constants';

interface Props {
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  onBack: () => void;
  onXpEarned: (xp: number) => void;
  onContextUpdate: (ctx: string) => void;
}

const TOTAL_ROUNDS = 4;

const DebateArena: React.FC<Props> = ({
  userGrade, language, translations, onBack, onXpEarned, onContextUpdate
}) => {
  const t = translations;

  const [subject, setSubject] = useState<Subject>(Subject.HISTORY);
  const [phase, setPhase] = useState<'setup' | 'active' | 'complete'>('setup');
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState('');
  const [aiSide, setAiSide] = useState<'FOR' | 'AGAINST'>('FOR');
  const [turns, setTurns] = useState<DebateTurn[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [round, setRound] = useState(1);
  const [isThinking, setIsThinking] = useState(false);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [finalScore, setFinalScore] = useState(0);
  const [overallFeedback, setOverallFeedback] = useState('');
  const [xpAwarded, setXpAwarded] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const userSide = aiSide === 'FOR' ? 'AGAINST' : 'FOR';
  const userSideLabel = userSide === 'FOR' ? t.forSide : t.againstSide;
  const aiSideLabel = aiSide === 'FOR' ? t.forSide : t.againstSide;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, isThinking]);

  const handleStartDebate = async () => {
    setLoading(true);
    onContextUpdate(`Debate: ${subject}`);
    try {
      const data = await generateDebateTopic(subject, userGrade, language);
      setTopic(data.topic);
      setAiSide(data.aiSide);
      setTurns([{ role: 'ai', text: data.openingStatement }]);
      setRound(1);
      setRoundScores([]);
      setFinalScore(0);
      setOverallFeedback('');
      setCurrentInput('');
      setXpAwarded(false);
      setPhase('active');
    } catch {
      // failed — stay on setup
    }
    setLoading(false);
  };

  const handleSubmitArgument = async () => {
    if (!currentInput.trim() || isThinking) return;
    const userText = currentInput.trim();
    setCurrentInput('');
    const newTurns: DebateTurn[] = [...turns, { role: 'user', text: userText }];
    setTurns(newTurns);
    setIsThinking(true);

    try {
      const result = await evaluateDebateArgument({
        topic,
        aiSide,
        userSide,
        history: turns,
        userArgument: userText,
        round,
        language,
      });

      const updatedScores = [...roundScores, result.score];
      setRoundScores(updatedScores);

      const aiFeedbackTurn: DebateTurn = {
        role: 'ai',
        text: result.counterArgument,
        score: result.score,
        feedback: result.feedback,
      };
      setTurns([...newTurns, aiFeedbackTurn]);

      if (result.isLastRound) {
        setFinalScore(result.totalScore ?? Math.round(updatedScores.reduce((a, b) => a + b, 0) / updatedScores.length));
        setOverallFeedback(result.overallFeedback ?? '');
        setPhase('complete');
      } else {
        setRound(r => r + 1);
      }
    } catch {
      setTurns(prev => [...prev, { role: 'ai', text: '...' }]);
    }
    setIsThinking(false);
  };

  const handlePlayAgain = () => {
    if (!xpAwarded) { onXpEarned(finalScore * 12); setXpAwarded(true); }
    setPhase('setup');
    setTurns([]);
    setCurrentInput('');
    setRound(1);
  };

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center">
              <Swords size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t.debateArena}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t.debateArenaDesc}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">{t.selectSubject}</label>
            <div className="flex gap-2 flex-wrap">
              {SUBJECTS_DATA.map(s => (
                <button key={s.id} onClick={() => setSubject(s.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    subject === s.id ? 'bg-rose-600 border-rose-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-rose-400'
                  }`}>
                  {t.subjectsList[s.id]}
                </button>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-rose-50 dark:bg-rose-950/30 rounded-2xl p-5 border border-rose-100 dark:border-rose-900/30">
            <p className="text-sm text-rose-800 dark:text-rose-300 font-semibold mb-2">How it works:</p>
            <ul className="text-sm text-rose-700 dark:text-rose-400 space-y-1 list-disc list-inside">
              <li>AI picks a topic and argues <strong>{t.forSide}</strong></li>
              <li>You argue <strong>{t.againstSide}</strong> — {TOTAL_ROUNDS} rounds</li>
              <li>AI scores your logic, evidence, and persuasiveness (0–10 per round)</li>
            </ul>
          </div>

          <button onClick={handleStartDebate} disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-black py-4 rounded-2xl text-lg shadow-lg transition-all">
            {loading
              ? <><Loader2 size={22} className="animate-spin" />{t.generatingDebate}</>
              : <><Swords size={22} />{t.debateArena}</>}
          </button>
        </div>
      </div>
    );
  }

  // ── COMPLETE ────────────────────────────────────────────────────────────────
  if (phase === 'complete') {
    const stars = finalScore >= 8 ? 3 : finalScore >= 5 ? 2 : 1;
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-4">
          <div className="w-28 h-28 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-2xl">
            <Trophy size={56} className="text-white" />
          </div>
          <h2 className="text-4xl font-black text-gray-900 dark:text-white">{t.debateComplete}</h2>
          <div className="flex justify-center gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Star key={i} size={32}
                className={i < stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 dark:text-gray-700'} />
            ))}
          </div>
          <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            {t.finalDebateScore}: <span className="text-rose-600 text-4xl font-black">{finalScore}/10</span>
          </p>
          <p className="text-green-600 dark:text-green-400 font-bold text-xl">+{finalScore * 12} XP</p>
          {overallFeedback && (
            <p className="text-gray-600 dark:text-gray-400 text-base leading-relaxed max-w-md mx-auto">{overallFeedback}</p>
          )}
        </div>

        {/* Round scores */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-3">Round Scores</p>
          <div className="flex gap-3">
            {roundScores.map((s, i) => (
              <div key={i} className="flex-1 text-center">
                <div className="text-xs text-gray-500 mb-1">{t.roundLabel} {i + 1}</div>
                <div className={`text-2xl font-black ${s >= 8 ? 'text-green-600' : s >= 5 ? 'text-amber-500' : 'text-red-500'}`}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 flex-wrap justify-center">
          <button onClick={handlePlayAgain}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-black px-8 py-3 rounded-2xl shadow-lg transition-all">
            <RefreshCw size={18} /> {t.playAgain}
          </button>
          <button onClick={onBack}
            className="flex items-center gap-2 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold px-8 py-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            {t.backToDashboard}
          </button>
        </div>
      </div>
    );
  }

  // ── ACTIVE DEBATE ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => setPhase('setup')}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{t.roundLabel} {round}/{TOTAL_ROUNDS}</p>
            <p className="text-sm font-black text-gray-900 dark:text-white line-clamp-1">{topic}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 rounded-xl text-center">
            <p className="text-xs text-red-600 dark:text-red-400 font-bold">AI</p>
            <p className="text-xs font-black text-red-700 dark:text-red-300">{aiSideLabel}</p>
          </div>
          <div className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-center">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-bold">{t.yourArgument}</p>
            <p className="text-xs font-black text-blue-700 dark:text-blue-300">{userSideLabel}</p>
          </div>
        </div>
      </div>

      {/* Round progress bar */}
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-rose-500 to-red-600 rounded-full transition-all duration-700"
          style={{ width: `${((round - 1) / TOTAL_ROUNDS) * 100}%` }} />
      </div>

      {/* Turns */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-1">
        {turns.map((turn, i) => (
          <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-3xl px-5 py-4 space-y-2 ${
              turn.role === 'ai'
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-tl-sm'
                : 'bg-blue-600 text-white rounded-tr-sm'
            }`}>
              {turn.role === 'ai' && (
                <p className="text-xs font-bold text-red-500 uppercase tracking-wide">AI ({aiSideLabel})</p>
              )}
              <p className="text-sm leading-relaxed">{turn.text}</p>
              {turn.score !== undefined && (
                <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Your score:</span>
                    <span className={`font-black text-base ${turn.score >= 8 ? 'text-green-500' : turn.score >= 5 ? 'text-amber-500' : 'text-red-500'}`}>
                      {turn.score}/10
                    </span>
                  </div>
                  {turn.feedback && <p className="text-xs text-gray-500 dark:text-gray-400 italic">{turn.feedback}</p>}
                </div>
              )}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-3xl rounded-tl-sm px-5 py-4 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-gray-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <textarea
          value={currentInput}
          onChange={e => setCurrentInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitArgument(); } }}
          placeholder={t.debatePlaceholder}
          rows={3}
          disabled={isThinking}
          className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-rose-400 dark:focus:border-rose-500 transition-colors resize-none disabled:opacity-50"
        />
        <button onClick={handleSubmitArgument} disabled={!currentInput.trim() || isThinking}
          className="p-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-2xl shadow-md transition-all">
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

export default DebateArena;
