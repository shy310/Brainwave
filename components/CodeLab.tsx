import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import {
  ArrowLeft, Play, RefreshCw, Loader2, Code2,
  ChevronDown, ChevronUp, Send, Bot, Lightbulb, Trophy, Copy, Trash2, Clock, CheckCheck
} from 'lucide-react';
import {
  GradeLevel, Language, Translations, CodeLanguage, CodingChallenge, PistonRunResult
} from '../types';
import { generateCodingChallenge, generateTutorResponse } from '../services/aiService';

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
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
];

const STARTER_CODE: Record<CodeLanguage, string> = {
  python: '# Write your code here\n\n',
  javascript: '// Write your code here\n\n',
  java: 'public class Main {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}\n',
};

const PISTON_LANGUAGE: Record<CodeLanguage, string> = {
  python: 'python',
  javascript: 'javascript',
  java: 'java',
  cpp: 'c++',
};

// Piston requires correct file extensions for compilation (Java needs Main.java to match class name)
const PISTON_FILENAME: Record<CodeLanguage, string> = {
  python: 'main.py',
  javascript: 'main.js',
  java: 'Main.java',
  cpp: 'main.cpp',
};

interface ChatMsg { role: 'user' | 'ai'; text: string; }

const CodeLab: React.FC<Props> = ({
  userGrade, language, translations, theme, onBack, onXpEarned, onContextUpdate
}) => {
  const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>('python');
  const [code, setCode] = useState(STARTER_CODE['python']);
  const [challenge, setChallenge] = useState<CodingChallenge | null>(null);
  const [output, setOutput] = useState<PistonRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const [challengeComplete, setChallengeComplete] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(false);
  const [execTime, setExecTime] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Stable ref so Monaco keybinding closure always calls the latest handleRunCode
  const handleRunCodeRef = useRef<() => void>(() => {});

  const handleEditorMount = useCallback((editor: MonacoEditor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
    editorRef.current = editor;
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => handleRunCodeRef.current()
    );
  }, []);

  const handleLanguageChange = (lang: CodeLanguage) => {
    setCodeLanguage(lang);
    setCode(STARTER_CODE[lang]);
    setOutput(null);
    setChallenge(null);
    setChallengeComplete(false);
    setXpAwarded(false);
  };

  const handleNewChallenge = async () => {
    setLoadingChallenge(true);
    setOutput(null);
    setChallengeComplete(false);
    setXpAwarded(false);
    setHintIndex(0);
    setShowHints(false);
    onContextUpdate(`Code Lab — ${codeLanguage} challenge`);
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
    const t0 = performance.now();
    try {
      const res = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: PISTON_LANGUAGE[codeLanguage],
          version: '*',
          files: [{ name: PISTON_FILENAME[codeLanguage], content: code }],
        }),
      });
      const data = await res.json();
      const result: PistonRunResult = {
        stdout: data.run?.stdout ?? '',
        stderr: data.run?.stderr ?? '',
        exitCode: data.run?.code ?? 0,
      };
      setExecTime(Math.round(performance.now() - t0));
      setOutput(result);
      if (challenge && result.stderr === '' && result.stdout.trim() !== '') {
        setChallengeComplete(true);
      }
    } catch (e: any) {
      setExecTime(Math.round(performance.now() - t0));
      setOutput({ stdout: '', stderr: `Network error: ${e.message}`, exitCode: 1 });
    } finally {
      setRunning(false);
    }
  }, [codeLanguage, code, challenge]);

  // Keep the ref in sync so Monaco's keybinding always calls the latest version
  useEffect(() => {
    handleRunCodeRef.current = handleRunCode;
  }, [handleRunCode]);

  const handleClaimXp = () => {
    if (!challenge || xpAwarded) return;
    onXpEarned(challenge.xpValue);
    setXpAwarded(true);
  };

  const handleAskAI = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);
    try {
      const contextStr = `Code Lab — Language: ${codeLanguage}.\nCurrent code:\n\`\`\`${codeLanguage}\n${code}\n\`\`\`${challenge ? `\nChallenge: ${challenge.title}` : ''}`;
      const response = await generateTutorResponse(
        [],
        userMsg,
        [],
        { contextStr, grade: userGrade, language }
      );
      setChatMessages(prev => [...prev, { role: 'ai', text: response.text }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I had trouble responding. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
        >
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

      {/* Language + Challenge bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2">
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">{translations.selectLanguage}:</span>
          <select
            value={codeLanguage}
            onChange={e => handleLanguageChange(e.target.value as CodeLanguage)}
            className="bg-transparent text-gray-900 dark:text-white font-bold text-sm focus:outline-none"
          >
            {CODE_LANGUAGES.map(l => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleNewChallenge}
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
        {/* Left — Editor */}
        <div className="space-y-4">
          {/* Challenge description */}
          {challenge && (
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white">{challenge.title}</h3>
                <span className="text-xs font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">
                  +{challenge.xpValue} XP
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{challenge.description}</p>
              {challenge.expectedBehavior && (
                <p className="text-xs text-gray-500 dark:text-gray-500 italic">{challenge.expectedBehavior}</p>
              )}
              {/* Hints */}
              {challenge.hints.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowHints(h => !h)}
                    className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                  >
                    <Lightbulb size={12} />
                    {translations.hint} {showHints ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {showHints && (
                    <div className="mt-2 space-y-1.5">
                      {challenge.hints.slice(0, hintIndex + 1).map((h, i) => (
                        <p key={i} className="text-xs text-gray-600 dark:text-gray-400 pl-3 border-l-2 border-amber-400">
                          {h}
                        </p>
                      ))}
                      {hintIndex < challenge.hints.length - 1 && (
                        <button
                          onClick={() => setHintIndex(i => i + 1)}
                          className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                        >
                          Next hint →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Monaco Editor */}
          <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
            <Editor
              height="350px"
              language={codeLanguage === 'cpp' ? 'cpp' : codeLanguage}
              value={code}
              onChange={val => setCode(val ?? '')}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              onMount={handleEditorMount}
              loading={<div className="flex items-center justify-center h-[350px] bg-gray-50 dark:bg-gray-900"><Loader2 size={24} className="animate-spin text-gray-400" /></div>}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 12, bottom: 12 },
              }}
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

          {/* Challenge complete banner */}
          {challengeComplete && (
            <div className="rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy size={28} className="text-white" />
                <div>
                  <p className="font-black text-white">{translations.challengeComplete}</p>
                  <p className="text-sm text-white/80">+{challenge?.xpValue} XP</p>
                </div>
              </div>
              {!xpAwarded && (
                <button
                  onClick={handleClaimXp}
                  className="bg-white text-orange-600 font-bold px-4 py-2 rounded-xl hover:bg-orange-50 transition-colors text-sm"
                >
                  Claim XP
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right — Output + Chat */}
        <div className="space-y-4">
          {/* Output panel */}
          <div className="rounded-2xl bg-gray-900 border border-gray-700 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-700 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-2 text-xs text-gray-400 font-mono flex-1">{translations.outputLabel}</span>
              {execTime !== null && (
                <div className="flex items-center gap-1 text-xs text-gray-500 font-mono">
                  <Clock size={11} />
                  <span>{execTime < 1000 ? `${execTime}ms` : `${(execTime / 1000).toFixed(2)}s`}</span>
                  {output && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-bold ${
                      output.exitCode === 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                    }`}>
                      exit {output.exitCode}
                    </span>
                  )}
                </div>
              )}
              {output && (
                <>
                  <button
                    onClick={() => {
                      const text = [output.stdout, output.stderr].filter(Boolean).join('\n');
                      navigator.clipboard.writeText(text).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      });
                    }}
                    className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                    title="Copy output"
                  >
                    {copied ? <CheckCheck size={13} className="text-green-400" /> : <Copy size={13} />}
                  </button>
                  <button
                    onClick={() => { setOutput(null); setExecTime(null); }}
                    className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                    title="Clear output"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
            <div className="p-4 min-h-[120px] max-h-[260px] overflow-y-auto font-mono text-sm">
              {running && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 size={14} className="animate-spin" />
                  <span>{translations.runningCode}</span>
                </div>
              )}
              {!output && !running && (
                <span className="text-gray-500">{translations.noOutput}</span>
              )}
              {output?.stdout && (
                <pre className="text-green-400 whitespace-pre-wrap">{output.stdout}</pre>
              )}
              {output?.stderr && (
                <pre className="text-red-400 whitespace-pre-wrap">{output.stderr}</pre>
              )}
              {output && !output.stdout && !output.stderr && (
                <span className="text-gray-500 italic">(process exited with no output)</span>
              )}
            </div>
          </div>

          {/* AI Chat */}
          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden" style={{ height: '350px' }}>
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <Bot size={16} className="text-orange-500" />
              <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{translations.askAboutCode}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center mt-4">
                  {translations.codeAiPlaceholder}
                </p>
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
        </div>
      </div>
    </div>
  );
};

export default CodeLab;
