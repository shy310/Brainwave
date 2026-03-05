import React, { useState, useEffect } from 'react';
import { Loader2, Trophy, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { GradeLevel, Language, Translations, Subject } from '../../types';
import { generateWordScrambleItems } from '../../services/aiService';

interface WordItem {
  word: string;
  definition: string;
  etymology: string;
  mode: 'unscramble' | 'fill-blank' | 'anagram';
}

interface Props {
  subject: Subject;
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  onComplete: (score: number, xp: number) => void;
}

function scrambleWord(word: string): string {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const result = arr.join('');
  return result === word && word.length > 1 ? scrambleWord(word) : result;
}

function makeAnagram(word: string): string {
  // Rearrange letters differently from original
  return scrambleWord(word);
}

function makeFillBlank(word: string): string {
  // Hide middle letters
  if (word.length <= 2) return word[0] + '_';
  const first = word[0];
  const last = word[word.length - 1];
  const blanks = '_'.repeat(word.length - 2);
  return `${first}${blanks}${last}`;
}

const WordScramblePlus: React.FC<Props> = ({ subject, userGrade, language, translations, onComplete }) => {
  const [items, setItems] = useState<WordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; correct_word: string; etymology: string } | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    generateWordScrambleItems(subject, userGrade, language)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [subject, userGrade, language]);

  const handleSubmit = () => {
    if (!items[currentIndex] || feedback) return;
    const item = items[currentIndex];
    const isCorrect = userInput.trim().toLowerCase() === item.word.toLowerCase();
    const newScore = isCorrect ? score + 1 : score;
    const newStreak = isCorrect ? streak + 1 : 0;
    setScore(newScore);
    setStreak(newStreak);
    setFeedback({ correct: isCorrect, correct_word: item.word, etymology: item.etymology });
  };

  const handleNext = () => {
    setFeedback(null);
    setUserInput('');
    const next = currentIndex + 1;
    if (next >= items.length) {
      setDone(true);
      const xp = Math.round(score * 5 + streak * 10);
      onComplete(score, xp);
    } else {
      setCurrentIndex(next);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-3">
      <Loader2 size={24} className="animate-spin text-brand-500" />
      <span className="font-bold text-gray-500">Generating words...</span>
    </div>
  );

  if (done) return (
    <div className="space-y-4 text-center py-8">
      <Trophy size={48} className="mx-auto text-yellow-500" />
      <p className="text-3xl font-black text-brand-600">{score}/{items.length}</p>
      <p className="text-gray-500">words correct | Best streak: {streak}</p>
    </div>
  );

  const item = items[currentIndex];
  if (!item) return null;

  const displayWord = item.mode === 'unscramble' ? scrambleWord(item.word)
    : item.mode === 'anagram' ? makeAnagram(item.word)
    : makeFillBlank(item.word);

  const modeLabel = item.mode === 'unscramble' ? '🔀 Unscramble'
    : item.mode === 'anagram' ? '🔄 Anagram'
    : '❓ Fill in blank';

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-gray-500">{currentIndex + 1}/{items.length}</span>
        <span className="font-bold text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 px-2.5 py-1 rounded-full">{modeLabel}</span>
        <span className="font-bold text-green-600">{score} ✓</span>
      </div>

      {/* Definition clue */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800">
        <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Definition</p>
        <p className="font-bold text-gray-800 dark:text-gray-200">{item.definition}</p>
      </div>

      {/* Scrambled/blanked word */}
      <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-6 text-center">
        <p className="text-4xl font-black tracking-widest text-gray-900 dark:text-white">{displayWord}</p>
        {streak > 1 && (
          <p className="text-xs text-orange-500 font-bold mt-2">🔥 {streak} streak</p>
        )}
      </div>

      {/* Input + feedback */}
      {!feedback ? (
        <div className="flex gap-2">
          <input
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Type the word..."
            autoFocus
            className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border-2 border-transparent focus:border-brand-400 rounded-xl outline-none font-bold text-gray-900 dark:text-white transition-all"
          />
          <button
            onClick={handleSubmit}
            disabled={!userInput.trim()}
            className="px-5 py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-black rounded-xl transition-colors"
          >
            ✓
          </button>
        </div>
      ) : (
        <div className={`rounded-2xl p-4 space-y-2 ${feedback.correct ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
          <div className="flex items-center gap-2">
            {feedback.correct
              ? <CheckCircle size={18} className="text-green-500" />
              : <XCircle size={18} className="text-red-500" />
            }
            <span className="font-black text-gray-900 dark:text-white">
              {feedback.correct ? '✓ Correct!' : `✗ The answer was: ${feedback.correct_word}`}
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 italic">{feedback.etymology}</p>
          <button
            onClick={handleNext}
            className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-colors text-sm"
          >
            Next Word →
          </button>
        </div>
      )}
    </div>
  );
};

export default WordScramblePlus;
