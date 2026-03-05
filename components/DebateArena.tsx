import React, { useState, useRef } from 'react';
import {
  ArrowLeft, Loader2, Swords, Send, Shield, Brain, Users,
  ChevronRight, Trophy, Zap, HelpCircle, Star
} from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import {
  GradeLevel, Language, Translations, DebateFormat, DebateDifficulty, ArgumentScore
} from '../types';
import {
  generateDebateTopicV2, evaluateDebateArgumentV2, suggestDebateEvidence,
  identifyWeakPoint, generateDebateSummary, streamAI
} from '../services/aiService';

interface Props {
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  theme: 'light' | 'dark';
  onBack: () => void;
  onXpEarned: (xp: number) => void;
  onContextUpdate: (ctx: string) => void;
}

interface Turn {
  round: number;
  userArg: string;
  aiArg: string;
  score: ArgumentScore;
}

type Phase = 'setup' | 'debate' | 'results';

const DebateArena: React.FC<Props> = ({
  userGrade, language, translations, theme, onBack, onXpEarned, onContextUpdate
}) => {
  const [phase, setPhase] = useState<Phase>('setup');

  // Setup
  const [format, setFormat] = useState<DebateFormat>('classic');
  const [difficulty, setDifficulty] = useState<DebateDifficulty>('competitive');
  const [roundCount, setRoundCount] = useState<3 | 5 | 7>(3);
  const [topic, setTopic] = useState('');

  // Debate state
  const [debateData, setDebateData] = useState<{ topic: string; aiSide: string; userSide: string; openingStatement: string } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [userInput, setUserInput] = useState('');
  const [streamedAiArg, setStreamedAiArg] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(false);

  // Helpers
  const [evidenceSuggestions, setEvidenceSuggestions] = useState<string[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [weakPoint, setWeakPoint] = useState<string | null>(null);
  const [loadingWeakPoint, setLoadingWeakPoint] = useState(false);

  // Results
  const [summary, setSummary] = useState<{ strongestArg: string; weakestArg: string; whatOpponentCouldSay: string } | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleStartDebate = async () => {
    if (!topic.trim()) return;
    setLoadingSetup(true);
    onContextUpdate(`Debate Arena — ${topic}`);
    try {
      const data = await generateDebateTopicV2(topic, format, 'pro', difficulty, userGrade, language);
      setDebateData(data);
      setPhase('debate');
      setTurns([]);
      setCurrentRound(1);
    } catch (e) { console.error(e); }
    finally { setLoadingSetup(false); }
  };

  const handleSubmitArgument = async () => {
    if (!userInput.trim() || !debateData || streaming || evaluating) return;
    const arg = userInput.trim();
    setUserInput('');
    setEvidenceSuggestions([]);
    setWeakPoint(null);
    setStreaming(true);
    setStreamedAiArg('');

    let fullAiArg = '';
    const systemPrompt = `You are debating "${debateData.topic}". You argue: "${debateData.aiSide}". Format: ${format}. Difficulty: ${difficulty}. Respond to the user's argument with a strong counter-argument in 3-5 sentences. Language: ${language}.`;

    await streamAI(
      systemPrompt,
      `User's argument (Round ${currentRound}): "${arg}"`,
      (chunk) => { fullAiArg += chunk; setStreamedAiArg(prev => prev + chunk); },
      async (full) => {
        setStreaming(false);
        setStreamedAiArg('');
        setEvaluating(true);
        try {
          const history = turns.map(t => [
            { role: 'user', text: t.userArg },
            { role: 'ai', text: t.aiArg },
          ]).flat();
          const result = await evaluateDebateArgumentV2({
            topic: debateData.topic, userSide: debateData.userSide,
            aiSide: debateData.aiSide, userArgument: arg, format, difficulty,
            history, round: currentRound, totalRounds: roundCount, language,
          });
          const turn: Turn = { round: currentRound, userArg: arg, aiArg: full, score: result.scores };
          const allTurns = [...turns, turn];
          setTurns(allTurns);

          if (currentRound >= roundCount) {
            setLoadingResults(true);
            try {
              const summTurns = allTurns.map(t => [
                { role: 'user', text: t.userArg },
                { role: 'ai', text: t.aiArg },
              ]).flat();
              const summ = await generateDebateSummary(debateData.topic, summTurns, language);
              setSummary(summ);
            } catch { /* ignore */ }
            setLoadingResults(false);
            const avgScore = allTurns.reduce((acc, t) =>
              acc + (t.score.logic + t.score.evidence + t.score.persuasiveness + t.score.relevance) / 4, 0) / allTurns.length;
            const diffMult = { casual: 1, competitive: 1.2, academic: 1.5 }[difficulty];
            // scores are 0-10, multiply by 10 to get 0-100 scale
            onXpEarned(Math.round(avgScore * 10 * roundCount * diffMult * 1.5));
            setPhase('results');
          } else {
            setCurrentRound(r => r + 1);
          }
        } catch (e) { console.error(e); }
        finally { setEvaluating(false); }
      }
    );
  };

  const handleGetEvidence = async () => {
    if (!debateData || loadingEvidence) return;
    setLoadingEvidence(true);
    try {
      const facts = await suggestDebateEvidence(debateData.topic, debateData.userSide, language);
      setEvidenceSuggestions(facts);
    } catch { /* ignore */ }
    finally { setLoadingEvidence(false); }
  };

  const handleWeakPoint = async () => {
    if (!turns.length || loadingWeakPoint) return;
    const lastAiArg = turns[turns.length - 1].aiArg;
    setLoadingWeakPoint(true);
    try {
      const hint = await identifyWeakPoint(lastAiArg, language);
      setWeakPoint(hint);
    } catch { /* ignore */ }
    finally { setLoadingWeakPoint(false); }
  };

  const avgScores = turns.length > 0 ? {
    logic:          turns.reduce((a, t) => a + t.score.logic, 0) / turns.length,
    evidence:       turns.reduce((a, t) => a + t.score.evidence, 0) / turns.length,
    persuasiveness: turns.reduce((a, t) => a + t.score.persuasiveness, 0) / turns.length,
    relevance:      turns.reduce((a, t) => a + t.score.relevance, 0) / turns.length,
  } : null;

  const radarData = avgScores ? [
    { subject: translations.logic,          A: avgScores.logic },
    { subject: translations.evidence,       A: avgScores.evidence },
    { subject: translations.persuasiveness, A: avgScores.persuasiveness },
    { subject: translations.relevance,      A: avgScores.relevance },
  ] : [];

  // ── SETUP ─────────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
              <Swords size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">{translations.debateArena}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{translations.debateArenaDesc}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          {/* Topic */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{translations.debateTopic}</label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStartDebate()}
              placeholder={translations.debateTopicPlaceholder}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border-2 border-transparent focus:border-red-400 rounded-xl outline-none font-medium text-gray-900 dark:text-white transition-all"
            />
          </div>

          {/* Format */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{translations.debateFormat}</label>
            <div className="grid grid-cols-2 gap-3">
              {([ ['classic', translations.classicFormat, <Swords size={16} />, 'bg-blue-500'],
                  ['devils-advocate', translations.devilsAdvocate, <Brain size={16} />, 'bg-red-500'],
                  ['steel-man', translations.steelMan, <Shield size={16} />, 'bg-green-500'],
                  ['socratic', translations.socraticFormat, <HelpCircle size={16} />, 'bg-purple-500'],
              ] as [DebateFormat, string, React.ReactNode, string][]).map(([f, label, icon, color]) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                    format === f
                      ? `border-transparent ${color} text-white`
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{translations.debateDifficulty}</label>
            <div className="flex gap-3">
              {([ ['casual', translations.casualMode],
                  ['competitive', translations.competitiveMode],
                  ['academic', translations.academicMode],
              ] as [DebateDifficulty, string][]).map(([d, label]) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${
                    difficulty === d
                      ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Rounds */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{translations.roundCount}</label>
            <div className="flex gap-3">
              {([3, 5, 7] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRoundCount(r)}
                  className={`flex-1 py-2.5 rounded-xl font-black text-sm border-2 transition-all ${
                    roundCount === r
                      ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStartDebate}
            disabled={loadingSetup || !topic.trim()}
            className="w-full py-4 bg-gradient-to-r from-red-500 to-pink-600 text-white font-black rounded-2xl hover:from-red-600 hover:to-pink-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            {loadingSetup
              ? <><Loader2 size={20} className="animate-spin" /> Loading...</>
              : <><Swords size={20} /> {translations.startDebate}</>
            }
          </button>
        </div>
      </div>
    );
  }

  // ── RESULTS ───────────────────────────────────────────────────────────────────
  if (phase === 'results') {
    return (
      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">{translations.finalVerdict}</h1>
        </div>

        {radarData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-black text-gray-900 dark:text-white mb-4 text-center">Performance Analysis</h3>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontWeight: 700 }} />
                <Radar name="You" dataKey="A" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {radarData.map(d => (
                <div key={d.subject} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{d.subject}</span>
                  <span className="text-sm font-black text-gray-900 dark:text-white">{Math.round(d.A)}/100</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {loadingResults && (
          <div className="flex items-center justify-center gap-3 py-8">
            <Loader2 size={24} className="animate-spin text-red-500" />
            <span className="font-bold text-gray-500">Generating summary...</span>
          </div>
        )}

        {summary && (
          <div className="space-y-3">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-black text-green-600 dark:text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Star size={12} /> {translations.strongestArg}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{summary.strongestArg}"</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-2">
                {translations.weakestArg}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{summary.weakestArg}"</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
                {translations.whatOpponentSaid}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{summary.whatOpponentCouldSay}</p>
            </div>
          </div>
        )}

        <button
          onClick={() => { setPhase('setup'); setTurns([]); setTopic(''); setSummary(null); }}
          className="w-full py-4 bg-gradient-to-r from-red-500 to-pink-600 text-white font-black rounded-2xl hover:from-red-600 hover:to-pink-700 transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          <Swords size={20} /> New Debate
        </button>
      </div>
    );
  }

  // ── DEBATE ────────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider">{translations.roundCount}</p>
          <p className="text-xl font-black text-gray-900 dark:text-white">{currentRound} / {roundCount}</p>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: roundCount }).map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i < currentRound - 1 ? 'bg-red-500' : i === currentRound - 1 ? 'bg-red-300 animate-pulse' : 'bg-gray-200 dark:bg-gray-700'}`} />
          ))}
        </div>
      </div>

      {debateData && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <p className="font-black text-gray-900 dark:text-white text-center">{debateData.topic}</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-center">
              <p className="font-black text-blue-600 dark:text-blue-400 mb-0.5">You</p>
              <p className="text-blue-700 dark:text-blue-300 font-medium">{debateData.userSide}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-center">
              <p className="font-black text-red-600 dark:text-red-400 mb-0.5">AI</p>
              <p className="text-red-700 dark:text-red-300 font-medium">{debateData.aiSide}</p>
            </div>
          </div>
          {currentRound === 1 && debateData.openingStatement && (
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border-l-4 border-red-400">
              <p className="text-xs font-black text-red-500 mb-1">AI Opening</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{debateData.openingStatement}</p>
            </div>
          )}
        </div>
      )}

      {turns.map((turn, i) => (
        <div key={i} className="space-y-3">
          <div className="flex justify-end">
            <div className="max-w-[85%] bg-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-3">
              <p className="text-xs font-black opacity-70 mb-1">Round {turn.round} — You</p>
              <p className="text-sm">{turn.userArg}</p>
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3">
              <p className="text-xs font-black text-red-500 mb-1">AI</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{turn.aiArg}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            {(['logic','evidence','persuasiveness','relevance'] as const).map(key => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 w-28 capitalize">{(translations as any)[key] ?? key}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-gradient-to-r from-red-400 to-pink-500 transition-all" style={{ width: `${turn.score[key]}%` }} />
                </div>
                <span className="text-xs font-black text-gray-600 dark:text-gray-300 w-7 text-right">{turn.score[key]}</span>
              </div>
            ))}
            {turn.score.explanation && (
              <p className="text-xs text-gray-500 dark:text-gray-400 italic pt-1">{turn.score.explanation}</p>
            )}
          </div>
        </div>
      ))}

      {streamedAiArg && (
        <div className="flex justify-start">
          <div className="max-w-[85%] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3">
            <p className="text-xs font-black text-red-500 mb-1">AI</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {streamedAiArg}<span className="inline-block w-1.5 h-4 bg-red-400 animate-pulse ml-0.5 rounded-sm" />
            </p>
          </div>
        </div>
      )}

      {evaluating && (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 size={14} className="animate-spin" /> Evaluating argument...
        </div>
      )}

      {!streaming && !evaluating && currentRound <= roundCount && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGetEvidence}
            disabled={loadingEvidence}
            className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-800 transition-colors disabled:opacity-50"
          >
            {loadingEvidence ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} {translations.evidenceBtn}
          </button>
          {turns.length > 0 && (
            <button
              onClick={handleWeakPoint}
              disabled={loadingWeakPoint}
              className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 transition-colors disabled:opacity-50"
            >
              {loadingWeakPoint ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />} {translations.rebuttalsBtn}
            </button>
          )}
        </div>
      )}

      {evidenceSuggestions.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 space-y-1 border border-green-100 dark:border-green-800">
          <p className="text-xs font-black text-green-600 dark:text-green-400 mb-2">Evidence to cite:</p>
          {evidenceSuggestions.map((e, i) => (
            <button
              key={i}
              onClick={() => setUserInput(prev => prev + (prev ? ' ' : '') + e)}
              className="block text-xs text-green-700 dark:text-green-300 hover:underline text-left"
            >
              • {e}
            </button>
          ))}
        </div>
      )}

      {weakPoint && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 border border-purple-100 dark:border-purple-800">
          <p className="text-xs font-black text-purple-600 dark:text-purple-400 mb-1">Rebuttal coach:</p>
          <p className="text-xs text-purple-700 dark:text-purple-300">{weakPoint}</p>
        </div>
      )}

      {currentRound <= roundCount && !streaming && !evaluating && (
        <div className="space-y-2">
          <textarea
            ref={inputRef}
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            placeholder={`Make your argument for round ${currentRound}...`}
            rows={3}
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 focus:border-red-400 rounded-2xl outline-none text-sm font-medium text-gray-900 dark:text-white transition-all resize-none"
          />
          <button
            onClick={handleSubmitArgument}
            disabled={!userInput.trim()}
            className="w-full py-3.5 bg-gradient-to-r from-red-500 to-pink-600 text-white font-black rounded-2xl hover:from-red-600 hover:to-pink-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md"
          >
            <Send size={18} /> Submit Argument <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default DebateArena;
