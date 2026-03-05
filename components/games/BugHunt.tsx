import React, { useState, useEffect } from 'react';
import { Loader2, Trophy, Bug, CheckCircle, XCircle, Wrench } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { GradeLevel, Language, Translations, Subject, BuggyCode } from '../../types';
import { generateBuggyCode } from '../../services/aiService';

interface Props {
  subject: Subject;
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  theme: 'light' | 'dark';
  onComplete: (score: number, xp: number) => void;
}

interface LineResult {
  lineIndex: number;
  status: 'cold' | 'warm' | 'hot' | 'found';
}

const BugHunt: React.FC<Props> = ({ subject, userGrade, language, translations, theme, onComplete }) => {
  const [buggyCode, setBuggyCode] = useState<BuggyCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [lineResults, setLineResults] = useState<LineResult[]>([]);
  const [foundBugIndices, setFoundBugIndices] = useState<Set<number>>(new Set());
  const [wrongClicks, setWrongClicks] = useState(0);
  const [fixMode, setFixMode] = useState(false);
  const [fixedCode, setFixedCode] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    generateBuggyCode(subject, userGrade, language)
      .then(data => { setBuggyCode(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [subject, userGrade, language]);

  const handleLineClick = (lineIndex: number) => {
    if (!buggyCode || done || fixMode) return;
    const bug = buggyCode.bugs.find(b => b.lineIndex === lineIndex);
    if (bug) {
      if (foundBugIndices.has(lineIndex)) return;
      const newFound = new Set([...foundBugIndices, lineIndex]);
      setFoundBugIndices(newFound);
      setLineResults(prev => [...prev.filter(r => r.lineIndex !== lineIndex), { lineIndex, status: 'found' }]);
      if (newFound.size === buggyCode.bugs.length) {
        // All bugs found — enter fix mode
        setFixMode(true);
        setFixedCode(buggyCode.code.join('\n'));
      }
    } else {
      setWrongClicks(w => w + 1);
      // Proximity feedback based on distance to nearest bug
      const distances = buggyCode.bugs.map(b => Math.abs(b.lineIndex - lineIndex));
      const minDist = Math.min(...distances);
      const status = minDist === 0 ? 'found' : minDist <= 2 ? 'hot' : minDist <= 5 ? 'warm' : 'cold';
      setLineResults(prev => [...prev.filter(r => r.lineIndex !== lineIndex), { lineIndex, status }]);
    }
  };

  const handleFinish = () => {
    if (!buggyCode) return;
    setDone(true);
    const xp = foundBugIndices.size * 25 - wrongClicks * 5;
    onComplete(foundBugIndices.size, Math.max(0, xp));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-3">
      <Loader2 size={24} className="animate-spin text-brand-500" />
      <span className="font-bold text-gray-500">Generating buggy code...</span>
    </div>
  );

  if (!buggyCode) return <p className="text-center text-gray-500">Failed to load game.</p>;

  if (done) return (
    <div className="space-y-4 text-center py-8">
      <Trophy size={48} className="mx-auto text-yellow-500" />
      <p className="text-3xl font-black text-brand-600">{foundBugIndices.size}/{buggyCode.bugs.length}</p>
      <p className="text-gray-500">bugs found</p>
      <div className="text-left space-y-2">
        {buggyCode.bugs.map((b, i) => (
          <div key={i} className={`p-3 rounded-xl ${foundBugIndices.has(b.lineIndex) ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <p className="text-xs font-black text-gray-500 mb-1">Line {b.lineIndex + 1}</p>
            <p className="text-xs font-mono text-red-600 line-through">{b.buggyLine}</p>
            <p className="text-xs font-mono text-green-600">→ {b.fixedLine}</p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{buggyCode.narrative}</p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Found: {foundBugIndices.size}/3 bugs | Wrong clicks: {wrongClicks}</p>
      </div>

      {/* Found bug hints */}
      {foundBugIndices.size > 0 && (
        <div className="space-y-1">
          {[...foundBugIndices].map(lineIdx => {
            const bug = buggyCode.bugs.find(b => b.lineIndex === lineIdx);
            return bug ? (
              <div key={lineIdx} className="flex items-center gap-2 text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                <CheckCircle size={14} className="text-green-500" />
                <span className="text-gray-600 dark:text-gray-400">Line {lineIdx + 1}: {bug.hint}</span>
              </div>
            ) : null;
          })}
        </div>
      )}

      {!fixMode ? (
        // Bug hunting mode — click lines
        <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-700">
          <div className="px-4 py-2.5 border-b border-gray-700 flex items-center gap-2">
            <Bug size={14} className="text-gray-400" />
            <span className="text-xs font-mono text-gray-400">Click a line to investigate • Cold/Warm/Hot feedback</span>
          </div>
          <div className="p-3 overflow-x-auto">
            {buggyCode.code.map((line, i) => {
              const result = lineResults.find(r => r.lineIndex === i);
              const isFound = foundBugIndices.has(i);
              let bg = 'hover:bg-gray-800';
              let indicator = '';
              if (isFound) { bg = 'bg-green-900/30'; indicator = '🐛'; }
              else if (result?.status === 'hot') { bg = 'bg-red-900/20'; indicator = '🔥'; }
              else if (result?.status === 'warm') { bg = 'bg-orange-900/20'; indicator = '♨️'; }
              else if (result?.status === 'cold') { bg = 'bg-blue-900/10'; indicator = '❄️'; }
              return (
                <div
                  key={i}
                  onClick={() => handleLineClick(i)}
                  className={`flex items-center gap-3 px-2 py-1 rounded cursor-pointer transition-colors ${bg}`}
                >
                  <span className="text-gray-600 text-xs font-mono w-6 text-right flex-shrink-0">{i + 1}</span>
                  <pre className="text-green-400 text-xs font-mono flex-1 whitespace-pre">{line || ' '}</pre>
                  {indicator && <span className="text-sm">{indicator}</span>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // Fix mode — Monaco editor
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-black text-green-600 dark:text-green-400">
            <Wrench size={16} /> All bugs found! Fix the code to complete the challenge.
          </div>
          <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
            <Editor
              height="300px"
              language="python"
              value={fixedCode}
              onChange={val => setFixedCode(val ?? '')}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false }}
            />
          </div>
          <button
            onClick={handleFinish}
            className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 shadow-md"
          >
            <Trophy size={18} /> Submit Fix
          </button>
        </div>
      )}
    </div>
  );
};

export default BugHunt;
