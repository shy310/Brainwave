import React, { useState } from 'react';
import {
  ArrowLeft, Layers, Bug, Share2, Image, CheckSquare, AlignLeft,
  Trophy, Zap, Star, Gamepad2
} from 'lucide-react';
import { GradeLevel, Language, Translations, Subject } from '../types';
import { SUBJECTS_DATA } from '../constants';
import FlashcardBlitz from './games/FlashcardBlitz';
import TrueFalseRapidFire from './games/TrueFalseRapidFire';
import ConceptConnector from './games/ConceptConnector';
import PictureThis from './games/PictureThis';
import BugHunt from './games/BugHunt';
import WordScramblePlus from './games/WordScramblePlus';

interface Props {
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  theme: 'light' | 'dark';
  onBack: () => void;
  onXpEarned: (xp: number) => void;
  onContextUpdate: (ctx: string) => void;
}

type GameId = 'flashcard' | 'truefalse' | 'concept' | 'picture' | 'bughunt' | 'scramble';

interface GameDef {
  id: GameId;
  icon: React.ReactNode;
  color: string;
  titleKey: keyof Translations;
  descKey: keyof Translations;
}

const GAMES: GameDef[] = [
  { id: 'flashcard', icon: <Layers size={24} />,     color: 'from-blue-500 to-indigo-600',    titleKey: 'flashcardBlitz',    descKey: 'flashcardBlitzDesc' },
  { id: 'truefalse', icon: <CheckSquare size={24} />, color: 'from-green-500 to-emerald-600',  titleKey: 'trueFalse',         descKey: 'trueFalseDesc' },
  { id: 'concept',   icon: <Share2 size={24} />,      color: 'from-purple-500 to-violet-600',  titleKey: 'conceptConnector',  descKey: 'conceptConnectorDesc' },
  { id: 'picture',   icon: <Image size={24} />,       color: 'from-pink-500 to-rose-600',      titleKey: 'pictureThis',       descKey: 'pictureThisDesc' },
  { id: 'bughunt',   icon: <Bug size={24} />,         color: 'from-red-500 to-orange-600',     titleKey: 'bugHunt',           descKey: 'bugHuntDesc' },
  { id: 'scramble',  icon: <AlignLeft size={24} />,   color: 'from-amber-500 to-yellow-600',   titleKey: 'wordScramblePlus',  descKey: 'wordScramblePlusDesc' },
];

const HS_KEY = 'brainwave_game_scores';

function loadHighScores(): Record<GameId, number> {
  try { return JSON.parse(localStorage.getItem(HS_KEY) || '{}'); } catch { return {} as Record<GameId, number>; }
}

function saveHighScore(gameId: GameId, score: number) {
  try {
    const db = loadHighScores();
    if ((db[gameId] ?? 0) < score) {
      db[gameId] = score;
      localStorage.setItem(HS_KEY, JSON.stringify(db));
    }
  } catch { /* ignore */ }
}

const EducationalGames: React.FC<Props> = ({
  userGrade, language, translations: t, theme, onBack, onXpEarned, onContextUpdate
}) => {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [subject, setSubject] = useState<Subject>(Subject.MATH);
  const [highScores, setHighScores] = useState<Record<GameId, number>>(loadHighScores);
  const [lastResult, setLastResult] = useState<{ game: GameId; score: number; xp: number } | null>(null);

  // Daily challenge: seeded by date mod 6
  const dailyGame = GAMES[new Date().getDate() % GAMES.length];

  const handleGameComplete = (gameId: GameId, score: number, xp: number) => {
    saveHighScore(gameId, score);
    setHighScores(loadHighScores());
    setLastResult({ game: gameId, score, xp });
    onXpEarned(xp);
    const isDailyChallenge = gameId === dailyGame.id;
    if (isDailyChallenge) onXpEarned(Math.round(xp * 0.5)); // bonus 50% for daily
  };

  const handleBack = () => {
    setActiveGame(null);
    setLastResult(null);
  };

  // ── ACTIVE GAME ───────────────────────────────────────────────────────────────
  if (activeGame) {
    const gameTitle = t[GAMES.find(g => g.id === activeGame)!.titleKey] as string;
    const commonProps = { subject, userGrade, language, translations: t, onComplete: (score: number, xp: number) => handleGameComplete(activeGame, score, xp) };

    return (
      <div className="px-4 py-6 space-y-4">
        {/* Game header */}
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-black text-xl text-gray-900 dark:text-white">{gameTitle}</h2>
            <p className="text-xs text-gray-500 capitalize">{subject}</p>
          </div>
        </div>

        {/* Results banner */}
        {lastResult?.game === activeGame && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy size={24} className="text-white" />
              <div>
                <p className="font-black text-white">Score: {lastResult.score}</p>
                <p className="text-sm text-white/80">+{lastResult.xp} XP earned</p>
              </div>
            </div>
            <button
              onClick={handleBack}
              className="bg-white text-orange-600 font-bold px-4 py-2 rounded-xl text-sm hover:bg-orange-50 transition-colors"
            >
              Back to Games
            </button>
          </div>
        )}

        {/* Game component */}
        {activeGame === 'flashcard'  && <FlashcardBlitz   {...commonProps} />}
        {activeGame === 'truefalse'  && <TrueFalseRapidFire {...commonProps} />}
        {activeGame === 'concept'    && <ConceptConnector  {...commonProps} />}
        {activeGame === 'picture'    && <PictureThis       {...commonProps} />}
        {activeGame === 'bughunt'    && <BugHunt           {...commonProps} theme={theme} />}
        {activeGame === 'scramble'   && <WordScramblePlus  {...commonProps} />}
      </div>
    );
  }

  // ── GAME HUB ─────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
            <Gamepad2 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t.educationalGames}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t.educationalGamesDesc}</p>
          </div>
        </div>
      </div>

      {/* Subject selector */}
      <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2 w-fit">
        <span className="text-sm font-semibold text-gray-500">{t.selectSubject}:</span>
        <select
          value={subject}
          onChange={e => setSubject(e.target.value as Subject)}
          className="bg-transparent text-gray-900 dark:text-white font-bold text-sm focus:outline-none"
        >
          {SUBJECTS_DATA.map(s => <option key={s.id} value={s.id}>{s.id.charAt(0) + s.id.slice(1).toLowerCase()}</option>)}
        </select>
      </div>

      {/* Daily Challenge banner */}
      <div className="bg-gradient-to-r from-brand-500 to-purple-600 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap size={24} className="text-white" />
          <div>
            <p className="text-xs font-black text-white/70 uppercase tracking-wider">{t.dailyChallenge}</p>
            <p className="font-black text-white">{t[dailyGame.titleKey] as string}</p>
            <p className="text-xs text-white/70 mt-0.5">1.5× XP bonus today</p>
          </div>
        </div>
        <button
          onClick={() => { onContextUpdate(`Games — ${t[dailyGame.titleKey] as string}`); setActiveGame(dailyGame.id); }}
          className="bg-white text-brand-600 font-black px-4 py-2.5 rounded-xl hover:bg-brand-50 transition-colors text-sm flex items-center gap-1.5"
        >
          <Star size={14} /> Play
        </button>
      </div>

      {/* Game cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAMES.map(game => {
          const hs = highScores[game.id];
          const isDaily = game.id === dailyGame.id;
          return (
            <div
              key={game.id}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all group"
            >
              <div className={`h-2 bg-gradient-to-r ${game.color}`} />
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${game.color} flex items-center justify-center text-white`}>
                    {game.icon}
                  </div>
                  <div className="text-right">
                    {isDaily && (
                      <span className="text-xs font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                        ⭐ Daily
                      </span>
                    )}
                    {hs !== undefined && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                        <Trophy size={11} /> <span className="font-bold">{hs}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-black text-gray-900 dark:text-white">{t[game.titleKey] as string}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t[game.descKey] as string}</p>
                </div>
                <button
                  onClick={() => { onContextUpdate(`Games — ${t[game.titleKey] as string}`); setActiveGame(game.id); }}
                  className={`w-full py-2.5 rounded-xl font-black text-white text-sm bg-gradient-to-r ${game.color} hover:opacity-90 transition-opacity`}
                >
                  Play
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EducationalGames;
