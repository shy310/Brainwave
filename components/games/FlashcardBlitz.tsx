import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, RotateCcw, Trophy, Clock, Layers } from 'lucide-react';
import { GradeLevel, Language, Translations, Subject, FlashCard } from '../../types';
import { generateFlashcards } from '../../services/aiService';

interface Props {
  subject: Subject;
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  onComplete: (score: number, xp: number) => void;
}

type CardState = 'front' | 'back';

const FlashcardBlitz: React.FC<Props> = ({ subject, userGrade, language, translations, onComplete }) => {
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [timedMode, setTimedMode] = useState(true);
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardState, setCardState] = useState<CardState>('front');
  const [knownIndices, setKnownIndices] = useState<Set<number>>(new Set());
  const [unknownQueue, setUnknownQueue] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [done, setDone] = useState(false);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    generateFlashcards(subject, userGrade, language).then(result => {
      setCards(result);
      setUnknownQueue(result.map((_, i) => i));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [subject, userGrade, language]);

  useEffect(() => {
    if (!started || !timedMode || done) return;
    if (timeLeft <= 0) { finishGame(); return; }
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [started, timedMode, timeLeft, done]);

  const finishGame = useCallback(() => {
    setDone(true);
    const known = knownIndices.size;
    const total = cards.length;
    const knownRatio = total > 0 ? known / total : 0;
    const xp = Math.round(knownRatio * 50);
    onComplete(known, xp);
  }, [knownIndices, cards, onComplete]);

  const handleFlip = () => { setFlipped(true); setCardState('back'); };

  const handleKnow = () => {
    setKnownIndices(prev => new Set([...prev, currentIndex]));
    nextCard(true);
  };

  const handleDontKnow = () => {
    setUnknownQueue(prev => [...prev.filter(i => i !== currentIndex), currentIndex]);
    nextCard(false);
  };

  const nextCard = (wasCorrect: boolean) => {
    setFlipped(false);
    setCardState('front');
    const remaining = unknownQueue.filter(i => i !== currentIndex);
    const nextQueue = wasCorrect ? remaining : [...remaining, currentIndex];
    if (nextQueue.length === 0) { finishGame(); return; }
    setUnknownQueue(nextQueue);
    setCurrentIndex(nextQueue[0]);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-3">
      <Loader2 size={24} className="animate-spin text-brand-500" />
      <span className="font-bold text-gray-500">Generating flashcards...</span>
    </div>
  );

  if (!started) return (
    <div className="space-y-4 text-center py-8">
      <Layers size={48} className="mx-auto text-brand-400" />
      <h3 className="font-black text-xl text-gray-900 dark:text-white">{translations.flashcardBlitz}</h3>
      <p className="text-gray-500 dark:text-gray-400">{cards.length} cards ready</p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => { setTimedMode(true); setStarted(true); }}
          className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-colors"
        >
          ⏱ {translations.timedMode}
        </button>
        <button
          onClick={() => { setTimedMode(false); setStarted(true); }}
          className="px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl transition-colors"
        >
          {translations.relaxedMode}
        </button>
      </div>
    </div>
  );

  if (done) return (
    <div className="space-y-4 text-center py-8">
      <Trophy size={48} className="mx-auto text-yellow-500" />
      <h3 className="font-black text-xl text-gray-900 dark:text-white">Done!</h3>
      <p className="text-3xl font-black text-brand-600">{knownIndices.size}/{cards.length}</p>
      <p className="text-gray-500">cards mastered</p>
      {knownIndices.size < cards.length && (
        <div>
          <p className="text-sm font-bold text-gray-500 mb-2">Review missed cards:</p>
          <div className="space-y-1 max-h-40 overflow-y-auto text-left px-4">
            {cards.filter((_, i) => !knownIndices.has(i)).map((c, i) => (
              <div key={i} className="text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                <span className="font-bold text-red-700 dark:text-red-400">{c.front}</span>: {c.back}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const card = cards[currentIndex];
  if (!card) return null;

  return (
    <div className="space-y-4">
      {timedMode && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-gray-500">{unknownQueue.length} cards left</span>
          <div className={`flex items-center gap-1.5 font-black ${timeLeft <= 10 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
            <Clock size={16} /> {timeLeft}s
          </div>
          <span className="font-bold text-green-600">{knownIndices.size} known</span>
        </div>
      )}

      {/* Card */}
      <div
        onClick={!flipped ? handleFlip : undefined}
        className={`relative w-full min-h-[200px] rounded-2xl cursor-pointer select-none transition-all ${
          !flipped
            ? 'bg-gradient-to-br from-brand-500 to-purple-600 text-white shadow-xl hover:shadow-2xl hover:scale-[1.01]'
            : 'bg-white dark:bg-gray-800 border-2 border-brand-300 text-gray-900 dark:text-white shadow-xl'
        }`}
      >
        <div className="p-6 flex flex-col items-center justify-center min-h-[200px] text-center">
          <p className="text-xs font-black uppercase tracking-widest opacity-60 mb-3">
            {!flipped ? 'TERM' : 'DEFINITION'}
          </p>
          <p className="text-xl font-bold leading-relaxed">
            {!flipped ? card.front : card.back}
          </p>
          {!flipped && <p className="text-xs opacity-50 mt-4">Tap to reveal</p>}
        </div>
      </div>

      {flipped && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDontKnow}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-black hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            <XCircle size={20} /> {translations.dontKnow}
          </button>
          <button
            onClick={handleKnow}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-black hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
          >
            <CheckCircle size={20} /> {translations.knowIt}
          </button>
        </div>
      )}
    </div>
  );
};

export default FlashcardBlitz;
