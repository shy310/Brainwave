import React, { useState, useRef } from 'react';
import {
  ArrowLeft, Loader2, Search, Play, Database, Trophy,
  AlertCircle, ChevronDown, ChevronUp, Lightbulb, FileText,
  CheckCircle, RefreshCw, BookOpen
} from 'lucide-react';
import {
  GradeLevel, Language, Translations, Subject, MysteryCase, QueryResult,
  CaseDifficulty, CaseTheme
} from '../types';
import { generateMysteryV2, explainSqlQuery, evaluateSqlEfficiency } from '../services/aiService';

interface Props {
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  theme: 'light' | 'dark';
  onBack: () => void;
  onXpEarned: (xp: number) => void;
  onContextUpdate: (ctx: string) => void;
}

interface MysteryV2 extends MysteryCase {
  hints?: string[];
  conceptTags?: string[];
}

type Phase = 'setup' | 'investigation' | 'results';

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

async function runSqlViaPiston(pythonSetup: string, userQuery: string): Promise<QueryResult> {
  const fullCode = `${pythonSetup}\n\ntry:\n    cur.execute("""${userQuery.replace(/"""/g, "'''")}""")\n    rows = cur.fetchall()\n    if cur.description:\n        cols = [d[0] for d in cur.description]\n        print(' | '.join(cols))\n        print('-' * max(30, sum(len(c) for c in cols) + 3 * max(0, len(cols)-1)))\n        for row in rows:\n            print(' | '.join(str(v) for v in row))\n        print(f"\\n({len(rows)} row(s)")\n    else:\n        conn.commit()\n        print("Query executed. Rows affected:", cur.rowcount)\nexcept Exception as e:\n    import sys; print(f"SQL Error: {e}", file=sys.stderr)`;

  try {
    const res = await fetch(PISTON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'python', version: '*', files: [{ name: 'main.py', content: fullCode }] }),
    });
    const data = await res.json();
    const stdout = data.run?.stdout ?? '';
    const stderr = data.run?.stderr ?? '';
    const isError = !!stderr || data.run?.code !== 0;
    return { query: userQuery, output: isError ? stderr || stdout : stdout, isError };
  } catch (e: any) {
    return { query: userQuery, output: `Network error: ${e.message}`, isError: true };
  }
}

const SqlDetective: React.FC<Props> = ({
  userGrade, language, translations, theme, onBack, onXpEarned, onContextUpdate
}) => {
  const [phase, setPhase] = useState<Phase>('setup');

  // Setup
  const [difficulty, setDifficulty] = useState<CaseDifficulty>('detective');
  const [caseTheme, setCaseTheme] = useState<CaseTheme>('crime');
  const [loadingCase, setLoadingCase] = useState(false);

  // Investigation
  const [mystery, setMystery] = useState<MysteryV2 | null>(null);
  const [queryHistory, setQueryHistory] = useState<QueryResult[]>([]);
  const [evidenceLog, setEvidenceLog] = useState<QueryResult[]>([]);
  const [currentQuery, setCurrentQuery] = useState('SELECT ');
  const [running, setRunning] = useState(false);
  const [accusation, setAccusation] = useState('');
  const [hintsUsed, setHintsUsed] = useState(0);
  const [shownHints, setShownHints] = useState<string[]>([]);
  const [showSchema, setShowSchema] = useState(false);
  const [firstQuery, setFirstQuery] = useState(true);

  // Query explainer
  const [queryExplanation, setQueryExplanation] = useState<string | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);

  // Results
  const [efficiencyResult, setEfficiencyResult] = useState<{ score: number; optimalQuery: string; explanation: string } | null>(null);
  const [verdict, setVerdict] = useState<'correct' | 'wrong' | null>(null);

  const handleGenerateCase = async () => {
    setLoadingCase(true);
    onContextUpdate(`SQL Detective — ${difficulty} ${caseTheme}`);
    try {
      const data = await generateMysteryV2(Subject.SCIENCE, userGrade, difficulty, caseTheme, language) as MysteryV2;
      setMystery(data);
      setPhase('investigation');
      setQueryHistory([]);
      setEvidenceLog([]);
      setCurrentQuery('SELECT ');
      setHintsUsed(0);
      setShownHints([]);
      setFirstQuery(true);
      setQueryExplanation(null);
    } catch (e) { console.error(e); }
    finally { setLoadingCase(false); }
  };

  const handleRunQuery = async () => {
    if (!mystery || !currentQuery.trim() || running) return;
    setRunning(true);
    const result = await runSqlViaPiston(mystery.pythonSetup, currentQuery);
    setQueryHistory(prev => [...prev, result]);
    if (!result.isError) {
      setEvidenceLog(prev => [...prev, result]);
      if (firstQuery) setFirstQuery(false);
    }
    setRunning(false);
  };

  const handleGetHint = () => {
    if (!mystery?.hints || hintsUsed >= 3) return;
    const hint = mystery.hints[hintsUsed] ?? `Hint ${hintsUsed + 1}: Try querying a different table.`;
    setShownHints(prev => [...prev, hint]);
    setHintsUsed(prev => prev + 1);
  };

  const handleExplainQuery = async () => {
    if (!mystery || !currentQuery.trim() || loadingExplain) return;
    setLoadingExplain(true);
    try {
      const explanation = await explainSqlQuery(currentQuery, mystery.schemaDescription, userGrade, language);
      setQueryExplanation(explanation);
    } catch { /* ignore */ }
    finally { setLoadingExplain(false); }
  };

  const handleAccuse = async () => {
    if (!mystery || !accusation) return;
    const isCorrect = accusation === mystery.culprit;
    setVerdict(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      // Evaluate efficiency of last successful query
      const lastGood = [...evidenceLog].reverse()[0];
      if (lastGood) {
        try {
          const eff = await evaluateSqlEfficiency(lastGood.query, mystery.schemaDescription, language);
          setEfficiencyResult(eff);
        } catch { /* ignore */ }
      }
      const xp = Math.max(0, 80 + (firstQuery ? 30 : 0) - hintsUsed * 15);
      onXpEarned(xp);
    }
    setPhase('results');
  };

  // ── SETUP ─────────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><ArrowLeft size={20} /></button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center">
              <Search size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">{translations.sqlDetective}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{translations.sqlDetectiveDesc}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          {/* Difficulty */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{translations.caseDifficulty}</label>
            <div className="grid grid-cols-2 gap-3">
              {([ ['rookie', translations.rookieCase, 'SELECT only'],
                  ['detective', translations.detectiveCase, 'JOINs'],
                  ['inspector', translations.inspectorCase, 'Subqueries'],
                  ['chief', translations.chiefCase, 'Window fns'],
              ] as [CaseDifficulty, string, string][]).map(([d, label, sub]) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`py-3 px-4 rounded-xl font-bold text-sm border-2 text-left transition-all ${
                    difficulty === d
                      ? 'border-slate-500 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {label}
                  <div className="text-xs font-normal text-gray-400 mt-0.5">{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{translations.caseTheme}</label>
            <div className="grid grid-cols-2 gap-3">
              {([ ['crime', translations.crimeTheme, '🔍'],
                  ['corporate', translations.corporateTheme, '🏢'],
                  ['archaeological', translations.archaeologicalTheme, '🏺'],
                  ['medical', translations.medicalTheme, '🏥'],
              ] as [CaseTheme, string, string][]).map(([t, label, emoji]) => (
                <button
                  key={t}
                  onClick={() => setCaseTheme(t)}
                  className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                    caseTheme === t
                      ? 'border-slate-500 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {emoji} {label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerateCase}
            disabled={loadingCase}
            className="w-full py-4 bg-gradient-to-r from-slate-600 to-slate-800 text-white font-black rounded-2xl hover:from-slate-700 hover:to-slate-900 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            {loadingCase
              ? <><Loader2 size={20} className="animate-spin" /> Generating case...</>
              : <><Search size={20} /> Generate Case</>
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
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><ArrowLeft size={20} /></button>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Case {verdict === 'correct' ? 'Solved!' : 'Review'}</h1>
        </div>

        <div className={`rounded-2xl p-5 text-center space-y-2 ${
          verdict === 'correct'
            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
            : 'bg-gradient-to-r from-red-500 to-pink-600 text-white'
        }`}>
          {verdict === 'correct'
            ? <><Trophy size={32} className="mx-auto mb-2" /><p className="font-black text-xl">Correct!</p></>
            : <><AlertCircle size={32} className="mx-auto mb-2" /><p className="font-black text-xl">Not quite...</p></>
          }
          <p className="text-white/80">Culprit: <strong>{mystery?.culprit}</strong></p>
          <p className="text-white/80 text-sm">You accused: <strong>{accusation}</strong></p>
        </div>

        {efficiencyResult && (
          <div className="space-y-3">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">{translations.efficiencyScore}</p>
                <span className="text-lg font-black text-gray-900 dark:text-white">{efficiencyResult.score}/100</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mb-3">
                <div className="h-2 rounded-full bg-blue-500" style={{ width: `${efficiencyResult.score}%` }} />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">{efficiencyResult.explanation}</p>
            </div>
            {efficiencyResult.optimalQuery && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-xs font-black text-green-600 dark:text-green-400 uppercase tracking-wider mb-2">{translations.optimalSolution}</p>
                <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{efficiencyResult.optimalQuery}</pre>
              </div>
            )}
          </div>
        )}

        {mystery?.conceptTags && mystery.conceptTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {mystery.conceptTags.map(tag => (
              <span key={tag} className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full">{tag}</span>
            ))}
          </div>
        )}

        <button
          onClick={() => { setPhase('setup'); setMystery(null); setVerdict(null); setEfficiencyResult(null); }}
          className="w-full py-4 bg-gradient-to-r from-slate-600 to-slate-800 text-white font-black rounded-2xl hover:from-slate-700 hover:to-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          <RefreshCw size={20} /> {translations.newCase}
        </button>
      </div>
    );
  }

  // ── INVESTIGATION ─────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-6 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h2 className="font-black text-gray-900 dark:text-white">{mystery?.title}</h2>
          <p className="text-xs text-gray-500">SQL Detective — {difficulty}</p>
        </div>
        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full capitalize">{caseTheme}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Case info + Evidence log */}
        <div className="space-y-3">
          {/* Case description */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Case</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{mystery?.description}</p>
            {mystery?.suspects && (
              <div className="mt-3">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1.5">Suspects</p>
                <div className="flex flex-wrap gap-1">
                  {mystery.suspects.map(s => (
                    <button
                      key={s}
                      onClick={() => setAccusation(s)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border-2 transition-all ${
                        accusation === s
                          ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-slate-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Schema */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setShowSchema(s => !s)}
              className="w-full flex items-center justify-between p-3 text-sm font-black text-gray-700 dark:text-gray-200"
            >
              <span className="flex items-center gap-2"><Database size={14} /> Schema</span>
              {showSchema ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showSchema && (
              <div className="px-4 pb-4">
                <pre className="text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
                  {mystery?.schemaDescription}
                </pre>
              </div>
            )}
          </div>

          {/* Evidence log */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText size={12} /> {translations.evidenceLog} ({evidenceLog.length})
            </p>
            {evidenceLog.length === 0 && <p className="text-xs text-gray-400">No evidence yet</p>}
            {evidenceLog.slice(-3).map((e, i) => (
              <div key={i} className="mb-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700">
                <p className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate">{e.query}</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 truncate">{e.output.split('\n')[0]}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Query editor + output */}
        <div className="lg:col-span-2 space-y-3">
          {/* Clues */}
          {mystery?.clues && mystery.clues.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800 p-4">
              <p className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">Clues</p>
              <ul className="space-y-1">
                {mystery.clues.map((c, i) => <li key={i} className="text-xs text-amber-800 dark:text-amber-300">• {c}</li>)}
              </ul>
            </div>
          )}

          {/* Query editor */}
          <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-700">
            <div className="px-4 py-2.5 border-b border-gray-700 flex items-center gap-2">
              <Database size={14} className="text-gray-400" />
              <span className="text-xs font-mono text-gray-400 flex-1">SQL Query</span>
            </div>
            <div className="p-3">
              <textarea
                value={currentQuery}
                onChange={e => setCurrentQuery(e.target.value)}
                rows={4}
                className="w-full bg-transparent font-mono text-sm text-green-400 outline-none resize-none"
                placeholder="SELECT * FROM ..."
                spellCheck={false}
              />
            </div>
            <div className="px-3 pb-3 flex gap-2 flex-wrap">
              <button
                onClick={handleRunQuery}
                disabled={running}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors"
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run
              </button>
              <button
                onClick={handleExplainQuery}
                disabled={loadingExplain}
                className="flex items-center gap-1.5 text-sm font-bold text-blue-400 hover:text-blue-300 border border-blue-700 hover:border-blue-600 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                {loadingExplain ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />} {translations.queryExplainer}
              </button>
              <button
                onClick={handleGetHint}
                disabled={hintsUsed >= 3}
                className="flex items-center gap-1.5 text-sm font-bold text-amber-400 hover:text-amber-300 border border-amber-700 hover:border-amber-600 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                <Lightbulb size={14} /> Hint {3 - hintsUsed} left
              </button>
            </div>
          </div>

          {/* Query explanation */}
          {queryExplanation && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800">
              <p className="text-xs font-black text-blue-600 dark:text-blue-400 mb-1">{translations.queryExplainer}</p>
              <p className="text-xs text-blue-800 dark:text-blue-300">{queryExplanation}</p>
            </div>
          )}

          {/* Hints */}
          {shownHints.length > 0 && (
            <div className="space-y-2">
              {shownHints.map((h, i) => (
                <div key={i} className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-100 dark:border-amber-800">
                  <p className="text-xs font-black text-amber-600 dark:text-amber-400 mb-1">Hint {i + 1}</p>
                  <p className="text-xs text-amber-800 dark:text-amber-300">{h}</p>
                </div>
              ))}
            </div>
          )}

          {/* Query output */}
          {queryHistory.length > 0 && (
            <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-700">
                <span className="text-xs text-gray-400 font-mono">Output</span>
              </div>
              <div className="p-4 max-h-[200px] overflow-y-auto font-mono text-sm">
                {queryHistory.slice(-1).map((r, i) => (
                  <pre key={i} className={`whitespace-pre-wrap ${r.isError ? 'text-red-400' : 'text-green-400'}`}>
                    {r.output || '(no output)'}
                  </pre>
                ))}
              </div>
            </div>
          )}

          {/* Accuse */}
          {accusation && (
            <button
              onClick={handleAccuse}
              className="w-full py-3.5 bg-gradient-to-r from-red-600 to-pink-600 text-white font-black rounded-2xl hover:from-red-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <CheckCircle size={18} /> Accuse: {accusation}
            </button>
          )}
          {!accusation && (
            <p className="text-center text-xs text-gray-400">Select a suspect above to make your accusation</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SqlDetective;
