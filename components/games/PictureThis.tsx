import React, { useState, useEffect } from 'react';
import { Loader2, Trophy, CheckCircle, XCircle, Clock, Image } from 'lucide-react';
import { GradeLevel, Language, Translations, Subject } from '../../types';
import { generatePictureThisQuestions } from '../../services/aiService';

interface PictureQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Props {
  subject: Subject;
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  onComplete: (score: number, xp: number) => void;
}

const OPTION_ICONS = ['🔵', '🟡', '🔴', '🟢'];

const PictureThis: React.FC<Props> = ({ subject, userGrade, language, translations, onComplete }) => {
  const [questions, setQuestions] = useState<PictureQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [answered, setAnswered] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    generatePictureThisQuestions(subject, userGrade, language)
      .then(setQuestions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [subject, userGrade, language]);

  useEffect(() => {
    if (loading || done || answered !== null || questions.length === 0) return;
    if (timeLeft <= 0) { handleAnswer(-1); return; }
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, loading, done, answered, questions.length]);

  const handleAnswer = (optionIndex: number) => {
    if (answered !== null || done) return;
    setAnswered(optionIndex);
    const q = questions[currentIndex];
    const isCorrect = optionIndex === q.correctIndex;
    const newScore = isCorrect ? score + 1 : score;
    if (isCorrect) setScore(newScore);

    setTimeout(() => {
      const next = currentIndex + 1;
      if (next >= questions.length) {
        setDone(true);
        const speedBonus = timeLeft > 10 ? 5 : 0;
        const xp = newScore * 8 + speedBonus;
        onComplete(newScore, xp);
      } else {
        setCurrentIndex(next);
        setAnswered(null);
        setTimeLeft(20);
      }
    }, 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-3">
      <Loader2 size={24} className="animate-spin text-brand-500" />
      <span className="font-bold text-gray-500">Generating questions...</span>
    </div>
  );

  if (done) return (
    <div className="space-y-4 text-center py-8">
      <Trophy size={48} className="mx-auto text-yellow-500" />
      <p className="text-3xl font-black text-brand-600">{score}/{questions.length}</p>
      <p className="text-gray-500">questions correct</p>
    </div>
  );

  const q = questions[currentIndex];
  if (!q) return null;

  const timerPct = (timeLeft / 20) * 100;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-gray-500">{currentIndex + 1}/{questions.length}</span>
        <div className={`flex items-center gap-1.5 font-black ${timeLeft <= 5 ? 'text-red-500' : 'text-gray-500'}`}>
          <Clock size={16} /> {timeLeft}s
        </div>
        <span className="font-bold text-green-600">{score} ✓</span>
      </div>

      {/* Timer bar */}
      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${timeLeft <= 5 ? 'bg-red-500' : 'bg-brand-500'}`}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      {/* Question */}
      <div className="bg-gradient-to-br from-brand-500 to-purple-600 rounded-2xl p-6 text-center min-h-[120px] flex flex-col items-center justify-center gap-3">
        <Image size={32} className="text-white/60" />
        <p className="text-white font-black text-lg leading-tight">{q.question}</p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3">
        {q.options.map((opt, i) => {
          let bg = 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20';
          if (answered !== null) {
            if (i === q.correctIndex) bg = 'bg-green-50 dark:bg-green-900/20 border-green-400 text-green-700 dark:text-green-400';
            else if (i === answered) bg = 'bg-red-50 dark:bg-red-900/20 border-red-400 text-red-700 dark:text-red-400';
            else bg = 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700 text-gray-400 opacity-60';
          }
          return (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={answered !== null}
              className={`flex items-start gap-3 p-4 rounded-2xl border-2 font-bold text-sm text-left transition-all ${bg}`}
            >
              <span className="text-xl flex-shrink-0">{OPTION_ICONS[i]}</span>
              <span className="leading-tight">{opt}</span>
              {answered !== null && i === q.correctIndex && <CheckCircle size={16} className="ml-auto flex-shrink-0 text-green-500" />}
              {answered !== null && i === answered && i !== q.correctIndex && <XCircle size={16} className="ml-auto flex-shrink-0 text-red-500" />}
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {answered !== null && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300">{q.explanation}</p>
        </div>
      )}
    </div>
  );
};

export default PictureThis;
