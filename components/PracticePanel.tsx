import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Exercise, QuestionType, GradeLevel, Subject, Translations, SkillAttemptEvent } from '../types';
import { generatePracticeSet, generateEasierVariant } from '../services/aiService';
import { checkAnswer } from '../services/mathEngine';
import { classifyMistake } from '../services/masteryEngine';
import { X, CheckCircle, XCircle, ChevronRight, Dumbbell, Sparkles, RotateCw } from 'lucide-react';
import Logo from './Logo';
import MathText from './MathText';
import Confetti from './Confetti';

interface Props {
  skill: string;
  subject: Subject;
  topicId?: string | null;
  grade: GradeLevel;
  language: string;
  translations: Translations;
  onSkillEvent: (ev: SkillAttemptEvent) => void;
  onClose: () => void;
}

/**
 * Adaptive practice loop. Generates a short set of similar problems on one
 * skill, grades each answer, and on a miss drops in an EASIER variant (with a
 * micro-explanation) before returning to the normal set. Every attempt feeds the
 * EMA mastery tracker via onSkillEvent.
 */
const PracticePanel: React.FC<Props> = ({ skill, subject, topicId, grade, language, translations, onSkillEvent, onClose }) => {
  const [queue, setQueue] = useState<Exercise[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [answered, setAnswered] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [easierNote, setEasierNote] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [done, setDone] = useState(false);
  const correctRef = useRef(0);
  const answeredCountRef = useRef(0);
  const startRef = useRef(Date.now());
  const injectedRef = useRef(0); // cap easier-variant injections

  useEffect(() => {
    let alive = true;
    (async () => {
      const set = await generatePracticeSet(skill, subject, grade, language, 4);
      if (!alive) return;
      setQueue(set);
      setLoading(false);
      startRef.current = Date.now();
    })();
    return () => { alive = false; };
  }, [skill, subject, grade, language]);

  const q = queue[idx];

  const grade1 = (): boolean => {
    if (!q) return false;
    if (q.questionType === QuestionType.NUMERIC) {
      const expected = q.answerExpression || q.sampleAnswer || '';
      return checkAnswer(typed, expected, q.acceptableAnswers ?? [], { unitRequired: q.unitRequired, tolerance: q.tolerance, roundTo: q.roundTo }).correct;
    }
    return selected === q.correctOptionId;
  };

  const submit = async () => {
    if (!q || answered) return;
    if (q.questionType === QuestionType.NUMERIC ? !typed.trim() : !selected) return;
    const correct = grade1();
    setWasCorrect(correct);
    setAnswered(true);
    answeredCountRef.current += 1;
    if (correct) { correctRef.current += 1; setConfetti(n => n + 1); }

    onSkillEvent({
      skillTag: q.skillTag || skill,
      subject, topicId: topicId ?? null,
      correct,
      questionType: q.questionType,
      difficulty: q.difficulty,
      timeMs: Math.max(0, Date.now() - startRef.current),
      hintsUsed: 0,
      mistakeKind: correct ? undefined : classifyMistake(q, q.questionType === QuestionType.NUMERIC ? typed : (q.options.find(o => o.id === selected)?.text ?? '')),
      explainEvidence: correct && q.questionType === QuestionType.NUMERIC,
    });

    // On a miss, drop in one easier variant next (bounded), to rebuild the idea.
    if (!correct && injectedRef.current < 2) {
      const easier = await generateEasierVariant(q.question, q.skillTag || skill, grade, language);
      if (easier) {
        injectedRef.current += 1;
        setQueue(prev => { const next = [...prev]; next.splice(idx + 1, 0, easier); return next; });
      }
    }
  };

  const next = () => {
    const nextIdx = idx + 1;
    if (nextIdx >= queue.length) { setDone(true); setConfetti(n => n + 1); return; }
    // Flag when the upcoming item is an injected easier variant (difficulty 1 after a miss).
    setEasierNote(!wasCorrect && (queue[nextIdx]?.difficulty ?? 3) <= 1);
    setIdx(nextIdx);
    setSelected(null); setTyped(''); setAnswered(false); setWasCorrect(false);
    startRef.current = Date.now();
  };

  return createPortal((
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-900/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <div className="bg-cream-50 dark:bg-ink-900 rounded-3xl border border-ink-100 dark:border-ink-700 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <Confetti trigger={confetti} count={50} />
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 dark:border-ink-700 sticky top-0 bg-cream-50 dark:bg-ink-900 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <Dumbbell size={18} className="text-moss-500 shrink-0" />
            <span className="font-semibold text-ink-700 dark:text-ink-100 truncate capitalize">{translations.practiceThis}: {skill}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-cream-100 dark:hover:bg-ink-800 rounded-xl transition-colors" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <Logo size={26} showText={false} />
              <span className="text-sm font-semibold text-ink-400">{translations.buildingPractice}</span>
              <div className="w-40 h-2 bg-cream-100 dark:bg-ink-800 rounded-full overflow-hidden"><div className="h-full rounded-full progress-shimmer animate-progress" /></div>
            </div>
          ) : done || !q ? (
            <div className="text-center py-8 view-enter">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-moss-400 to-moss-600 text-white flex items-center justify-center shadow-moss mb-4 animate-pop"><CheckCircle size={32} /></div>
              <h2 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100">{translations.practiceComplete}</h2>
              <p className="mt-1 text-moss-600 dark:text-moss-400 font-semibold">{translations.practiceScore(correctRef.current, answeredCountRef.current)}</p>
              <p className="mt-3 text-sm text-ink-400 max-w-xs mx-auto">{translations.practiceEncouragement}</p>
              <button onClick={onClose} className="mt-6 w-full py-3.5 bg-moss-500 hover:bg-moss-600 text-white rounded-2xl font-semibold shadow-moss transition-all active:scale-[0.98] min-h-[48px]">{translations.backToDashboard}</button>
            </div>
          ) : (
            <div key={idx} className="animate-slide-up">
              {easierNote && !answered && (
                <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                  <Sparkles size={12} /> {translations.easierOne}
                </div>
              )}
              <p className="text-xs font-bold text-ink-300 mb-2">{idx + 1} / {queue.length}</p>
              <h3 className="text-lg font-semibold text-ink-700 dark:text-ink-100 mb-4"><MathText>{q.question}</MathText></h3>

              {q.questionType === QuestionType.NUMERIC ? (
                <input
                  type="text" inputMode="decimal" value={typed} disabled={answered}
                  onChange={e => setTyped(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !answered) submit(); }}
                  placeholder={translations.typeYourAnswer}
                  className={`w-full px-4 py-3.5 rounded-xl border-2 text-base font-medium bg-white dark:bg-ink-800 outline-none min-h-[52px] ${answered ? (wasCorrect ? 'border-green-500' : 'border-red-400') : 'border-ink-200 dark:border-ink-600 focus:border-moss-400'} text-ink-700 dark:text-ink-100`}
                />
              ) : (
                <div className="space-y-2.5">
                  {q.options.map(opt => {
                    const isRight = opt.id === q.correctOptionId, isChosen = selected === opt.id;
                    let style = 'border-ink-200 dark:border-ink-600 hover:border-moss-400';
                    if (answered) { if (isRight) style = 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'; else if (isChosen) style = 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600'; else style = 'border-ink-100 dark:border-ink-700 opacity-60'; }
                    else if (isChosen) style = 'border-moss-500 bg-moss-50 dark:bg-moss-light/15';
                    return (
                      <button key={opt.id} disabled={answered} onClick={() => setSelected(opt.id)}
                        className={`w-full text-start px-4 py-3 rounded-xl border-2 font-medium text-sm md:text-base transition-all min-h-[46px] flex items-center gap-2 ${style}`}>
                        {answered && isRight && <CheckCircle size={16} className="shrink-0 text-green-600" />}
                        {answered && isChosen && !isRight && <XCircle size={16} className="shrink-0 text-red-500" />}
                        <MathText>{opt.text}</MathText>
                      </button>
                    );
                  })}
                </div>
              )}

              {answered && (
                <div className={`mt-4 p-4 rounded-xl text-sm ${wasCorrect ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'}`}>
                  <p className="font-bold mb-1">{wasCorrect ? translations.correct : translations.incorrect}</p>
                  {q.explanation && <MathText className="leading-relaxed">{q.explanation}</MathText>}
                </div>
              )}

              <button
                onClick={answered ? next : submit}
                disabled={!answered && (q.questionType === QuestionType.NUMERIC ? !typed.trim() : !selected)}
                className="mt-5 w-full py-3.5 bg-moss-500 hover:bg-moss-600 text-white rounded-2xl font-semibold shadow-moss transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]"
              >
                {!answered ? translations.practiceCheck : (idx + 1 >= queue.length ? <><RotateCw size={16} /> {translations.practiceComplete}</> : <>{translations.practiceNext} <ChevronRight size={18} className="rtl:rotate-180" /></>)}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  ), document.body);
};

export default PracticePanel;
