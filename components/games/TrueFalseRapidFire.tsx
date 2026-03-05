import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, Trophy, Zap } from 'lucide-react';
import { GradeLevel, Language, Translations, Subject, TrueFalseItem } from '../../types';
import { generateTrueFalseItems } from '../../services/aiService';

interface Props {
  subject: Subject;
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  onComplete: (score: number, xp: number) => void;
}

const TrueFalseRapidFire: React.FC<Props> = ({ subject, userGrade, language, translations, onComplete }) => {
  const [items, setItems] = useState<TrueFalseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [showExplanation, setShowExplanation] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);

  useEffect(() => {
    generateTrueFalseItems(subject, userGrade, language)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [subject, userGrade, language]);

  const finishGame = useCallback((finalScore: number, finalStreak: number) => {
    setDone(true);
    const xp = finalScore * 10 + finalStreak * 5;
    onComplete(finalScore, xp);
  }, [onComplete]);

  useEffect(() => {
    if (loading || done || timerPaused || items.length === 0) return;
    if (timeLeft <= 0) {
      // Auto-wrong on timeout
      handleAnswer(null);
      return;
    }
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, loading, done, timerPaused, items.length]);

  const handleAnswer = useCallback((answer: boolean | null) => {
    if (done || items.length === 0) return;
    const item = items[currentIndex];
    const isCorrect = answer === item.isTrue;
    setLastAnswer(answer);
    setShowExplanation(true);
    setTimerPaused(true);

    const newScore = isCorrect ? score + 1 : score;
    const newStreak = isCorrect ? streak + 1 : 0;
    setScore(newScore);
    setStreak(newStreak);
    setMaxStreak(ms => Math.max(ms, newStreak));

    setTimeout(() => {
      setShowExplanation(false);
      setTimerPaused(false);
      setTimeLeft(10);
      setLastAnswer(null);
      const next = currentIndex + 1;
      if (next >= items.length) {
        finishGame(newScore, Math.max(maxStreak, newStreak));
      } else {
        setCurrentIndex(next);
      }
    }, 2500);
  }, [currentIndex, done, items, score, streak, maxStreak, finishGame]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showExplanation || done) return;
      if (e.key === 't' || e.key === 'T') handleAnswer(true);
      if (e.key === 'f' || e.key === 'F') handleAnswer(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleAnswer, showExplanation, done]);

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-3">
      <Loader2 size={24} className="animate-spin text-brand-500" />
      <span className="font-bold text-gray-500">Generating questions...</span>
    </div>
  );

  if (done) return (
    <div className="space-y-4 text-center py-8">
      <Trophy size={48} className="mx-auto text-yellow-500" />
      <p className="text-3xl font-black text-brand-600">{score}/{items.length}</p>
      <p className="text-gray-500">Best streak: {maxStreak} 🔥</p>
    </div>
  );

  const item = items[currentIndex];
  if (!item) return null;

  const timerPct = (timeLeft / 10) * 100;

  return (
    <div className="space-y-4">
      {/* Progress + stats */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-gray-500">{currentIndex + 1}/{items.length}</span>
        <div className="flex items-center gap-1 font-black text-orange-500">
          <Zap size={16} /> {streak} streak
        </div>
        <span className="font-bold text-green-600">{score} correct</span>
      </div>

      {/* Timer bar */}
      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${timeLeft <= 3 ? 'bg-red-500' : timeLeft <= 6 ? 'bg-orange-500' : 'bg-green-500'}`}
          style={{ width: `${timerPct}%` }}
        />
      </div>
      <p className={`text-center text-sm font-black ${timeLeft <= 3 ? 'text-red-500' : 'text-gray-400'}`}>{timeLeft}s</p>

      {/* Statement */}
      <div className={`rounded-2xl p-6 text-center min-h-[140px] flex items-center justify-center transition-colors ${
        showExplanation
          ? lastAnswer === item.isTrue
            ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-300'
            : 'bg-red-50 dark:bg-red-900/20 border-2 border-red-300'
          : 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700'
      }`}>
        <div className="space-y-3">
          <p className="text-lg font-bold text-gray-900 dark:text-white leading-relaxed">{item.statement}</p>
          {showExplanation && (
            <p className={`text-sm font-medium ${lastAnswer === item.isTrue ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {item.isTrue ? '✓ TRUE' : '✗ FALSE'} — {item.explanation}
            </p>
          )}
        </div>
      </div>

      {/* Buttons */}
      {!showExplanation && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleAnswer(true)}
            className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-black text-lg transition-colors shadow-lg"
          >
            <CheckCircle size={24} /> True <span className="text-xs opacity-60">[T]</span>
          </button>
          <button
            onClick={() => handleAnswer(false)}
            className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black text-lg transition-colors shadow-lg"
          >
            <XCircle size={24} /> False <span className="text-xs opacity-60">[F]</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default TrueFalseRapidFire;
