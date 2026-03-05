import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import {
  ArrowLeft, Play, RefreshCw, Loader2, Code2,
  Send, Bot, Lightbulb, Trophy, Copy, Trash2, Clock, CheckCheck,
  CheckCircle2, XCircle, ChevronRight, Sparkles, AlertTriangle, Tag
} from 'lucide-react';
import {
  GradeLevel, Language, Translations, CodeLanguage, CodingChallenge,
  PistonRunResult, ChallengeTestResult, CodeReview
} from '../types';
import {
  generateCodingChallenge, generateTutorResponse,
  getSocraticHint, evaluateCodeSolution, reviewCode, explainCodeError
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

const CODE_LANGUAGES: { id: CodeLanguage; label: string }[] = [
  { id: 'python',     label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'java',       label: 'Java' },
  { id: 'cpp',        label: 'C++' },
  { id: 'sql',        label: 'SQL' },
];

const STARTER_CODE: Record<CodeLanguage, string> = {
  python:     '# Write your code here\n\n',
  javascript: '// Write your code here\n\n',
  java:       'public class Main {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}\n',
  cpp:        '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}\n',
  sql:        '-- Write your SQL query here\nSELECT ',
};

// Wrap SQL in Python+sqlite3 for Piston execution
function buildPistonPayload(codeLanguage: CodeLanguage, userCode: string) {
  if (codeLanguage === 'sql') {
    const pyWrapper = `
import sqlite3, sys
conn = sqlite3.connect(':memory:')
cur = conn.cursor()
sql = """${userCode.replace(/"""/g, "'''")}"""
try:
    cur.execute(sql)
    rows = cur.fetchall()
    if cur.description:
        cols = [d[0] for d in cur.description]
        print(' | '.join(cols))
        print('-' * (sum(len(c) for c in cols) + 3 * (len(cols) - 1)))
        for row in rows:
            print(' | '.join(str(v) for v in row))
    else:
        conn.commit()
        print("Query executed successfully.")
except Exception as e:
    print(f"SQL Error: {e}", file=sys.stderr)
conn.close()
`.trim();
    return { language: 'python', version: '*', files: [{ name: 'main.py', content: pyWrapper }] };
  }
  const langMap: Record<CodeLanguage, string> = {
    python: 'python', javascript: 'javascript', java: 'java', cpp: 'c++', sql: 'python',
  };
  const fileMap: Record<CodeLanguage, string> = {
    python: 'main.py', javascript: 'main.js', java: 'Main.java', cpp: 'main.cpp', sql: 'main.py',
  };
  return { language: langMap[codeLanguage], version: '*', files: [{ name: fileMap[codeLanguage], content: userCode }] };
}

interface ChatMsg { role: 'user' | 'ai'; text: string; }

const TIER_LABELS = ['', 'Beginner', 'Easy', 'Intermediate', 'Hard', 'Expert'];
const TIER_COLORS = ['', 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'];

const CodeLab: React.FC<Props> = ({
  userGrade, language, translations, theme, onBack, onXpEarned, onContextUpdate
}) => {
  const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>('python');
  const [code, setCode] = useState(STARTER_CODE['python']);
  const [challenge, setChallenge] = useState<CodingChallenge | null>(null);
  const [output, setOutput] = useState<PistonRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [currentTier, setCurrentTier] = useState(1);

  // Hint system
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintTexts, setHintTexts] = useState<string[]>([]);
  const [loadingHint, setLoadingHint] = useState(false);

  // Error explainer
  const [errorExplanation, setErrorExplanation] = useState<string | null>(null);
  const [loadingError, setLoadingError] = useState(false);

  // Submit + test results
  const [testResults, setTestResults] = useState<ChallengeTestResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [allPassed, setAllPassed] = useState(false);

  // Code review
  const [codeReview, setCodeReview] = useState<CodeReview | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);

  // XP tracking
  const [xpAwarded, setXpAwarded] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());

  // UI
  const [execTime, setExecTime] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const handleRunCodeRef = useRef<() => void>(() => {});

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleEditorMount = useCallback((editor: MonacoEditor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => handleRunCodeRef.current());
  }, []);

  const resetChallenge = () => {
    setOutput(null);
    setTestResults(null);
    setAllPassed(false);
    setXpAwarded(false);
    setHintsUsed(0);
    setHintTexts([]);
    setErrorExplanation(null);
    setCodeReview(null);
    setStartTime(Date.now());
    setExecTime(null);
  };

  const handleLanguageChange = (lang: CodeLanguage) => {
    setCodeLanguage(lang);
    setCode(STARTER_CODE[lang]);
    setChallenge(null);
    resetChallenge();
  };

  const handleNewChallenge = async (tier = currentTier) => {
    setLoadingChallenge(true);
    setChallenge(null);
    resetChallenge();
    onContextUpdate(`Code Lab — ${codeLanguage} challenge tier ${tier}`);
    try {
      const c = await generateCodingChallenge(codeLanguage, userGrade, 'programming fundamentals', language);
      setChallenge(c);
      setCode(c.starterCode);
    } catch (e: any) {
      console.error('Challenge generation error:', e);
    } finally {
      setLoadingChallenge(false);
    }
  };

  const handleRunCode = useCallback(async () => {
    setRunning(true);
    setOutput(null);
    setExecTime(null);
    setErrorExplanation(null);
    const t0 = performance.now();
    try {
      const payload = buildPistonPayload(codeLanguage, code);
      const res = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const result: PistonRunResult = {
        stdout: data.run?.stdout ?? '',
        stderr: data.run?.stderr ?? '',
        exitCode: data.run?.code ?? 0,
      };
      setExecTime(Math.round(performance.now() - t0));
      setOutput(result);
    } catch (e: any) {
      setExecTime(Math.round(performance.now() - t0));
      setOutput({ stdout: '', stderr: `Network error: ${e.message}`, exitCode: 1 });
    } finally {
      setRunning(false);
    }
  }, [codeLanguage, code]);

  useEffect(() => { handleRunCodeRef.current = handleRunCode; }, [handleRunCode]);

  const handleGetHint = async () => {
    if (!challenge || hintsUsed >= 3 || loadingHint) return;
    setLoadingHint(true);
    try {
      const hint = await getSocraticHint(code, challenge.description, codeLanguage, hintsUsed + 1, userGrade, language);
      setHintTexts(prev => [...prev, hint]);
      setHintsUsed(prev => prev + 1);
    } catch {
      setHintTexts(prev => [...prev, 'Could not load hint. Please try again.']);
    } finally {
      setLoadingHint(false);
    }
  };

  const handleExplainError = async () => {
    if (!output?.stderr || loadingError) return;
    setLoadingError(true);
    try {
      const explanation = await explainCodeError(code, output.stderr, codeLanguage, userGrade, language);
      setErrorExplanation(explanation);
    } catch {
      setErrorExplanation('Could not explain error. Please try again.');
    } finally {
      setLoadingError(false);
    }
  };

  const handleSubmit = async () => {
    if (!challenge || !output || submitting) return;
    setSubmitting(true);
    setTestResults(null);
    try {
      const results = await evaluateCodeSolution(code, codeLanguage, challenge.expectedBehavior, output.stdout);
      setTestResults(results);
      const passed = results.every(r => r.passed);
      setAllPassed(passed);
      if (passed) {
        // Auto-fetch code review
        setLoadingReview(true);
        try {
          const review = await reviewCode(code, codeLanguage, userGrade, language);
          setCodeReview(review);
        } catch { /* ignore */ } finally {
          setLoadingReview(false);
        }
        // Award XP
        const elapsed = (Date.now() - startTime) / 1000;
        const xp = Math.max(0, 50 + 20 + (elapsed < 300 ? 15 : 0) - hintsUsed * 10);
        onXpEarned(Math.round(xp));
        setXpAwarded(true);
      }
    } catch (e: any) {
      console.error('Submit error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextChallenge = () => {
    const nextTier = Math.min(currentTier + 1, 5);
    setCurrentTier(nextTier);
    handleNewChallenge(nextTier);
  };

  const handleAskAI = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);
    try {
      const contextStr = `Code Lab — Language: ${codeLanguage}.\nCurrent code:\n\`\`\`${codeLanguage}\n${code}\n\`\`\`${challenge ? `\nChallenge: ${challenge.title}` : ''}`;
      const response = await generateTutorResponse([], userMsg, [], { contextStr, grade: userGrade, language });
      setChatMessages(prev => [...prev, { role: 'ai', text: response.text }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I had trouble responding. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const canSubmit = !!output && !!challenge && output.stderr === '' && output.stdout.trim() !== '' && !allPassed;
  const passedCount = testResults?.filter(r => r.passed).length ?? 0;

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <Code2 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">{translations.codeLab}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{translations.codeLabDesc}</p>
          </div>
        </div>
      </div>

      {/* Language + Controls bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2">
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">{translations.selectLanguage}:</span>
          <select
            value={codeLanguage}
            onChange={e => handleLanguageChange(e.target.value as CodeLanguage)}
            className="bg-transparent text-gray-900 dark:text-white font-bold text-sm focus:outline-none"
          >
            {CODE_LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2">
          <span className="text-xs font-bold text-gray-400">{translations.difficultyTier}:</span>
          {[1,2,3,4,5].map(t => (
            <button
              key={t}
              onClick={() => setCurrentTier(t)}
              className={`w-6 h-6 rounded-lg text-xs font-bold transition-colors ${
                t === currentTier ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <button
          onClick={() => handleNewChallenge(currentTier)}
          disabled={loadingChallenge}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-2xl transition-colors shadow-sm"
        >
          {loadingChallenge
            ? <><Loader2 size={16} className="animate-spin" /> {translations.generatingChallenge}</>
            : <><RefreshCw size={16} /> {translations.generateChallenge}</>
          }
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Editor + Output */}
        <div className="space-y-4">
          {/* Monaco Editor */}
          <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
            <Editor
              height="380px"
              language={codeLanguage === 'cpp' ? 'cpp' : codeLanguage === 'sql' ? 'sql' : codeLanguage}
              value={code}
              onChange={val => setCode(val ?? '')}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              onMount={handleEditorMount}
              loading={<div className="flex items-center justify-center h-[380px] bg-gray-50 dark:bg-gray-900"><Loader2 size={24} className="animate-spin text-gray-400" /></div>}
              options={{ minimap: { enabled: false }, fontSize: 14, lineNumbers: 'on', scrollBeyondLastLine: false, wordWrap: 'on', padding: { top: 12, bottom: 12 } }}
            />
          </div>

          {/* Run button */}
          <button
            onClick={handleRunCode}
            disabled={running}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl shadow-md hover:shadow-lg transition-all"
            title="Run (Ctrl+Enter)"
          >
            {running
              ? <><Loader2 size={18} className="animate-spin" /> {translations.runningCode}</>
              : <><Play size={18} /> {translations.runCode} <span className="ml-1 text-white/60 text-xs font-normal">Ctrl+Enter</span></>
            }
          </button>

          {/* Output console */}
          <div className="rounded-2xl bg-gray-900 border border-gray-700 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-700 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-2 text-xs text-gray-400 font-mono flex-1">{translations.outputLabel}</span>
              {execTime !== null && (
                <div className="flex items-center gap-1 text-xs text-gray-500 font-mono">
                  <Clock size={11} />
                  <span>{execTime < 1000 ? `${execTime}ms` : `${(execTime/1000).toFixed(2)}s`}</span>
                  {output && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-bold ${output.exitCode === 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                      exit {output.exitCode}
                    </span>
                  )}
                </div>
              )}
              {output && (
                <>
                  <button
                    onClick={() => { navigator.clipboard.writeText([output.stdout, output.stderr].filter(Boolean).join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
                    className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {copied ? <CheckCheck size={13} className="text-green-400" /> : <Copy size={13} />}
                  </button>
                  <button onClick={() => { setOutput(null); setExecTime(null); }} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
            <div className="p-4 min-h-[100px] max-h-[220px] overflow-y-auto font-mono text-sm">
              {running && <div className="flex items-center gap-2 text-gray-400"><Loader2 size={14} className="animate-spin" /><span>{translations.runningCode}</span></div>}
              {!output && !running && <span className="text-gray-500">{translations.noOutput}</span>}
              {output?.stdout && <pre className="text-green-400 whitespace-pre-wrap">{output.stdout}</pre>}
              {output?.stderr && <pre className="text-red-400 whitespace-pre-wrap">{output.stderr}</pre>}
              {output && !output.stdout && !output.stderr && <span className="text-gray-500 italic">(process exited with no output)</span>}
            </div>
          </div>

          {/* Explain Error button */}
          {output?.stderr && (
            <div className="space-y-2">
              <button
                onClick={handleExplainError}
                disabled={loadingError}
                className="flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
              >
                {loadingError ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                {translations.explainError}
              </button>
              {errorExplanation && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800">
                  {errorExplanation}
                </div>
              )}
            </div>
          )}

          {/* Submit Solution button */}
          {canSubmit && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-500 to-purple-600 hover:from-brand-600 hover:to-purple-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl shadow-md transition-all"
            >
              {submitting ? <><Loader2 size={18} className="animate-spin" /> {translations.testResults}...</> : <><Send size={18} /> {translations.submitSolution}</>}
            </button>
          )}
        </div>

        {/* RIGHT — Challenge panel */}
        <div className="space-y-4">
          {!challenge && !loadingChallenge && (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center space-y-3">
              <Code2 size={40} className="mx-auto text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">{translations.generateChallenge}</p>
              <button
                onClick={() => handleNewChallenge(currentTier)}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2.5 rounded-xl transition-colors"
              >
                {translations.generateChallenge}
              </button>
            </div>
          )}

          {loadingChallenge && (
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-8 flex items-center justify-center gap-3">
              <Loader2 size={24} className="animate-spin text-orange-500" />
              <span className="font-bold text-gray-600 dark:text-gray-300">{translations.generatingChallenge}</span>
            </div>
          )}

          {challenge && (
            <>
              {/* Challenge info */}
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-black text-gray-900 dark:text-white text-lg leading-tight">{challenge.title}</h3>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${TIER_COLORS[currentTier]}`}>
                      {TIER_LABELS[currentTier]}
                    </span>
                    <span className="text-xs font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-full">
                      +{challenge.xpValue} XP
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{challenge.description}</p>
                {challenge.expectedBehavior && (
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Expected</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-mono">{challenge.expectedBehavior}</p>
                  </div>
                )}
              </div>

              {/* Test Results */}
              {testResults && (
                <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-gray-900 dark:text-white">{translations.testResults}</h4>
                    <span className={`text-sm font-bold ${allPassed ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                      {passedCount}/{testResults.length} {translations.passedTests}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${allPassed ? 'bg-green-500' : 'bg-orange-500'}`}
                      style={{ width: `${(passedCount / testResults.length) * 100}%` }}
                    />
                  </div>
                  <div className="space-y-2">
                    {testResults.map((r, i) => (
                      <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-xl ${r.passed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                        {r.passed
                          ? <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                          : <XCircle size={16} className="text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        }
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{r.testLabel}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.actual}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All passed + XP banner */}
              {allPassed && (
                <div className="rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 p-4 flex items-center gap-3">
                  <Trophy size={28} className="text-white flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-black text-white">{translations.allTestsPassed}</p>
                    <p className="text-sm text-white/80">{translations.challengeComplete}</p>
                  </div>
                  <button
                    onClick={handleNextChallenge}
                    className="bg-white text-orange-600 font-bold px-4 py-2 rounded-xl hover:bg-orange-50 transition-colors text-sm flex items-center gap-1"
                  >
                    {translations.nextChallenge} <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {/* Code Review */}
              {(loadingReview || codeReview) && (
                <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-purple-500" />
                    <h4 className="font-black text-gray-900 dark:text-white">{translations.codeReview}</h4>
                  </div>
                  {loadingReview && <div className="flex items-center gap-2 text-gray-400"><Loader2 size={14} className="animate-spin" /><span className="text-sm">Analyzing code...</span></div>}
                  {codeReview && (
                    <>
                      <div className="space-y-2">
                        {codeReview.suggestions.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                            <span className="text-xs font-black text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                            <p className="text-xs text-gray-600 dark:text-gray-300">{s}</p>
                          </div>
                        ))}
                      </div>
                      {codeReview.conceptTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <Tag size={12} className="text-gray-400 mt-1" />
                          {codeReview.conceptTags.map(tag => (
                            <span key={tag} className="text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Hint system */}
              {!allPassed && (
                <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lightbulb size={16} className="text-amber-500" />
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{translations.getHint}</span>
                    </div>
                    <span className="text-xs text-gray-400 font-medium">
                      {translations.hintsRemaining}: {3 - hintsUsed}
                    </span>
                  </div>
                  {hintTexts.map((h, i) => (
                    <div key={i} className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">Hint {i+1}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{h}</p>
                    </div>
                  ))}
                  {hintsUsed < 3 && (
                    <button
                      onClick={handleGetHint}
                      disabled={loadingHint}
                      className="w-full py-2 text-sm font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loadingHint ? <><Loader2 size={14} className="animate-spin" /> Loading...</> : <><Lightbulb size={14} /> {translations.getHint} (−10 XP)</>}
                    </button>
                  )}
                </div>
              )}

              {/* AI Chat */}
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden" style={{ height: '280px' }}>
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                  <Bot size={16} className="text-orange-500" />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{translations.askAboutCode}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center mt-4">{translations.codeAiPlaceholder}</p>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-orange-500 text-white rounded-br-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-3 py-2">
                        <Loader2 size={14} className="animate-spin text-gray-400" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAskAI()}
                    placeholder={translations.codeAiPlaceholder}
                    className="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={handleAskAI}
                    disabled={chatLoading || !chatInput.trim()}
                    className="p-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeLab;
