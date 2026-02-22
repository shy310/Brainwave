import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Loader2, Search, RefreshCw, Play, Database, Trophy, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { GradeLevel, Language, Translations, Subject, MysteryCase, QueryResult } from '../types';
import { generateMystery } from '../services/aiService';
import { SUBJECTS_DATA } from '../constants';

interface Props {
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  onBack: () => void;
  onXpEarned: (xp: number) => void;
  onContextUpdate: (ctx: string) => void;
}

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function runSqlQuery(pythonSetup: string, userQuery: string): Promise<QueryResult> {
  const code = `import sqlite3
conn = sqlite3.connect(':memory:')
c = conn.cursor()
${pythonSetup}
conn.commit()
try:
    c.execute("""${userQuery.replace(/"""/g, "'''")}""")
    rows = c.fetchall()
    col_names = [desc[0] for desc in c.description] if c.description else []
    if col_names:
        print(' | '.join(col_names))
        print('-' * (sum(len(n) for n in col_names) + 3 * (len(col_names) - 1)))
    for row in rows:
        print(' | '.join(str(v) if v is not None else 'NULL' for v in row))
    if not rows:
        print('(no rows returned)')
except Exception as e:
    print(f'Error: {e}')
conn.close()
`;

  try {
    const res = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        version: '*',
        files: [{ name: 'query.py', content: code }],
      }),
    });
    const data = await res.json();
    const output = data?.run?.stdout ?? '';
    const stderr = data?.run?.stderr ?? '';
    return {
      query: userQuery,
      output: output.trim() || stderr.trim() || '(no output)',
      isError: !!stderr && !output,
    };
  } catch (e: any) {
    return { query: userQuery, output: `Network error: ${e.message}`, isError: true };
  }
}

const SqlDetective: React.FC<Props> = ({
  userGrade, language, translations, onBack, onXpEarned, onContextUpdate
}) => {
  const t = translations;

  const [subject, setSubject] = useState<Subject>(Subject.HISTORY);
  const [phase, setPhase] = useState<'setup' | 'investigating' | 'verdict'>('setup');
  const [loading, setLoading] = useState(false);
  const [mystery, setMystery] = useState<MysteryCase | null>(null);
  const [queryHistory, setQueryHistory] = useState<QueryResult[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSuspect, setSelectedSuspect] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<'correct' | 'wrong' | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(true);
  const [cluesOpen, setCluesOpen] = useState(true);
  const [xpAwarded, setXpAwarded] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    resultsRef.current?.scrollTo({ top: resultsRef.current.scrollHeight, behavior: 'smooth' });
  }, [queryHistory]);

  const handleGenerateMystery = async () => {
    setLoading(true);
    onContextUpdate(`SQL Detective: ${subject}`);
    try {
      const m = await generateMystery(subject, userGrade, language);
      setMystery(m);
      setQueryHistory([]);
      setCurrentQuery('');
      setSelectedSuspect(null);
      setVerdict(null);
      setXpAwarded(false);
      setPhase('investigating');
    } catch {
      // stay on setup
    }
    setLoading(false);
  };

  const handleRunQuery = async () => {
    if (!currentQuery.trim() || isRunning || !mystery) return;
    setIsRunning(true);
    const result = await runSqlQuery(mystery.pythonSetup, currentQuery.trim());
    setQueryHistory(prev => [...prev, result]);
    setIsRunning(false);
  };

  const handleAccuse = (suspect: string) => {
    if (!mystery) return;
    setSelectedSuspect(suspect);
    const correct = suspect === mystery.culprit;
    setVerdict(correct ? 'correct' : 'wrong');
    if (correct) {
      setPhase('verdict');
      if (!xpAwarded) { onXpEarned(150); setXpAwarded(true); }
    }
  };

  const handleReset = () => {
    if (!xpAwarded && verdict === 'correct') { onXpEarned(150); setXpAwarded(true); }
    setPhase('setup');
    setMystery(null);
    setQueryHistory([]);
    setCurrentQuery('');
    setSelectedSuspect(null);
    setVerdict(null);
  };

  // ── SETUP ───────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
              <Search size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t.sqlDetective}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t.sqlDetectiveDesc}</p>
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
                    subject === s.id ? 'bg-cyan-600 border-cyan-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-cyan-400'
                  }`}>
                  {t.subjectsList[s.id]}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-cyan-50 dark:bg-cyan-950/30 rounded-2xl p-5 border border-cyan-100 dark:border-cyan-900/30">
            <p className="text-sm text-cyan-800 dark:text-cyan-300 font-semibold mb-2">How it works:</p>
            <ul className="text-sm text-cyan-700 dark:text-cyan-400 space-y-1 list-disc list-inside">
              <li>AI creates a crime scene with a real SQLite database</li>
              <li>Query the database using SQL to gather clues</li>
              <li>When you have enough evidence, accuse the culprit</li>
              <li>The database actually runs — real query results!</li>
            </ul>
          </div>

          <button onClick={handleGenerateMystery} disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white font-black py-4 rounded-2xl text-lg shadow-lg transition-all">
            {loading
              ? <><Loader2 size={22} className="animate-spin" />{t.generatingMystery}</>
              : <><Search size={22} />{t.sqlDetective}</>}
          </button>
        </div>
      </div>
    );
  }

  // ── VERDICT ──────────────────────────────────────────────────────────────────
  if (phase === 'verdict' && mystery) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 px-4">
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-2xl">
          <Trophy size={56} className="text-white" />
        </div>
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-black text-gray-900 dark:text-white">{t.caseSolved}</h2>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            The culprit was <span className="font-black text-cyan-600 text-2xl">{mystery.culprit}</span>
          </p>
          <p className="text-green-600 dark:text-green-400 font-bold text-xl">+150 XP</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{queryHistory.length} queries run</p>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <button onClick={handleReset}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-black px-8 py-3 rounded-2xl shadow-lg transition-all">
            <RefreshCw size={18} /> New Mystery
          </button>
          <button onClick={onBack}
            className="flex items-center gap-2 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold px-8 py-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            {t.backToDashboard}
          </button>
        </div>
      </div>
    );
  }

  // ── INVESTIGATING ────────────────────────────────────────────────────────────
  if (!mystery) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setPhase('setup')}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">{mystery.title}</h2>
            <p className="text-xs text-cyan-600 dark:text-cyan-400 font-bold uppercase tracking-wide">{t.sqlDetective}</p>
          </div>
        </div>
        <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full font-semibold">
          {queryHistory.length} queries
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT — Case info */}
        <div className="space-y-3">
          {/* Description */}
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/30">
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">🔍 Case File</p>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{mystery.description}</p>
          </div>

          {/* Schema (collapsible) */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setSchemaOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
              <span className="flex items-center gap-2"><Database size={16} />{t.caseSchema}</span>
              {schemaOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {schemaOpen && (
              <div className="px-4 pb-4">
                <pre className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 rounded-xl p-3 overflow-auto max-h-48">
                  {mystery.schemaDescription}
                </pre>
              </div>
            )}
          </div>

          {/* Clues (collapsible) */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setCluesOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
              <span className="flex items-center gap-2">💡 Clues</span>
              {cluesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {cluesOpen && (
              <ul className="px-4 pb-4 space-y-2">
                {mystery.clues.map((clue, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                    <span className="text-cyan-500 font-bold shrink-0">{i + 1}.</span>
                    {clue}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Suspect lineup */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">🕵️ Suspects — {t.accuseSuspect}:</p>
            <div className="space-y-2">
              {mystery.suspects.map(suspect => {
                const isSelected = selectedSuspect === suspect;
                const isWrong = isSelected && verdict === 'wrong';
                return (
                  <button key={suspect} onClick={() => !verdict && handleAccuse(suspect)}
                    disabled={verdict === 'correct'}
                    className={`w-full text-start px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      isWrong
                        ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                        : verdict === 'correct'
                          ? 'border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/20'
                    }`}>
                    {suspect}
                    {isWrong && (
                      <span className="ms-2 text-xs text-red-500">✗ {t.wrongAccusation}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT — Query editor + results */}
        <div className="space-y-3">
          {/* Query editor */}
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-700">
            <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 font-mono">SQL Query</p>
            <textarea
              value={currentQuery}
              onChange={e => setCurrentQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleRunQuery(); } }}
              placeholder={t.sqlPlaceholder}
              rows={5}
              className="w-full bg-transparent text-green-300 text-sm font-mono placeholder-gray-600 outline-none resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-600 font-mono">Ctrl+Enter to run</span>
              <button onClick={handleRunQuery} disabled={!currentQuery.trim() || isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-all">
                {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {t.runQuery}
              </button>
            </div>
          </div>

          {/* Query results */}
          <div ref={resultsRef} className="space-y-2 max-h-80 overflow-y-auto">
            {queryHistory.length === 0 && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 text-center border border-gray-100 dark:border-gray-700">
                <Search size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Run a query to see results</p>
              </div>
            )}
            {[...queryHistory].reverse().map((r, i) => (
              <div key={i} className={`rounded-2xl overflow-hidden border ${
                r.isError ? 'border-red-200 dark:border-red-800' : 'border-gray-100 dark:border-gray-700'
              }`}>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-inherit flex items-center gap-2">
                  {r.isError
                    ? <AlertCircle size={12} className="text-red-500" />
                    : <Play size={12} className="text-green-500" />}
                  <code className="text-xs text-gray-600 dark:text-gray-400 truncate">{r.query}</code>
                </div>
                <div className="bg-white dark:bg-gray-900 px-3 py-3">
                  <pre className={`text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-auto max-h-40 ${
                    r.isError ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'
                  }`}>{r.output}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SqlDetective;
