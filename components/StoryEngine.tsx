import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Loader2, BookOpen, RefreshCw, Send, Star, Feather } from 'lucide-react';
import { GradeLevel, Language, Translations, Subject, StoryChapter, StoryEvaluation } from '../types';
import { generateStoryOpening, continueStory } from '../services/aiService';
import { SUBJECTS_DATA } from '../constants';

interface Props {
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  onBack: () => void;
  onXpEarned: (xp: number) => void;
  onContextUpdate: (ctx: string) => void;
}

const TOTAL_CHAPTERS = 4;
const MIN_WORDS = 30;

const GENRES = ['Adventure', 'Mystery', 'Science Fiction', 'Fantasy', 'Historical'];

const GENRE_LABELS: Record<string, string[]> = {
  en: ['Adventure', 'Mystery', 'Science Fiction', 'Fantasy', 'Historical'],
  ru: ['Приключения', 'Детектив', 'Научная фантастика', 'Фэнтези', 'Исторический'],
  he: ['הרפתקה', 'מסתורין', 'מדע בדיוני', 'פנטזיה', 'היסטורי'],
  ar: ['مغامرة', 'غموض', 'خيال علمي', 'فانتازيا', 'تاريخي'],
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

const StoryEngine: React.FC<Props> = ({
  userGrade, language, translations, onBack, onXpEarned, onContextUpdate
}) => {
  const t = translations;

  const [subject, setSubject] = useState<Subject>(Subject.LANGUAGE);
  const [genre, setGenre] = useState(GENRES[0]);
  const [phase, setPhase] = useState<'setup' | 'active' | 'complete'>('setup');
  const [loading, setLoading] = useState(false);
  const [chapters, setChapters] = useState<StoryChapter[]>([]);
  const [storyTitle, setStoryTitle] = useState('');
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [userInput, setUserInput] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [chapter, setChapter] = useState(1);
  const [isContinuing, setIsContinuing] = useState(false);
  const [evaluation, setEvaluation] = useState<StoryEvaluation | null>(null);
  const [xpAwarded, setXpAwarded] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWordCount(countWords(userInput));
  }, [userInput]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chapters, isContinuing]);

  const handleStart = async () => {
    setLoading(true);
    onContextUpdate(`Story: ${genre} / ${subject}`);
    try {
      const data = await generateStoryOpening(subject, genre, userGrade, language);
      setStoryTitle(data.title);
      setChapters([{ role: 'ai', text: data.opening, prompt: data.prompt }]);
      setCurrentPrompt(data.prompt);
      setChapter(1);
      setUserInput('');
      setEvaluation(null);
      setXpAwarded(false);
      setPhase('active');
    } catch {
      // stay on setup
    }
    setLoading(false);
  };

  const handleSubmitChapter = async () => {
    if (wordCount < MIN_WORDS || isContinuing) return;
    const userText = userInput.trim();
    setUserInput('');

    const isLastChapter = chapter >= TOTAL_CHAPTERS;
    const newChapters: StoryChapter[] = [...chapters, { role: 'user', text: userText }];
    setChapters(newChapters);
    setIsContinuing(true);

    try {
      const result = await continueStory({
        storyHistory: newChapters,
        userContribution: userText,
        chapter,
        language,
        isLastChapter,
      });

      const aiChapter: StoryChapter = {
        role: 'ai',
        text: result.continuation,
        prompt: result.nextPrompt,
      };
      setChapters([...newChapters, aiChapter]);

      if (isLastChapter && result.evaluation) {
        setEvaluation(result.evaluation);
        setPhase('complete');
        if (!xpAwarded) {
          onXpEarned(Math.round(result.evaluation.overall * 1.5));
          setXpAwarded(true);
        }
      } else {
        setCurrentPrompt(result.nextPrompt ?? '');
        setChapter(c => c + 1);
      }
    } catch {
      setChapters(prev => [...prev, { role: 'ai', text: '...' }]);
    }
    setIsContinuing(false);
  };

  const handlePlayAgain = () => {
    setPhase('setup');
    setChapters([]);
    setUserInput('');
    setEvaluation(null);
  };

  // ── SETUP ───────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <BookOpen size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t.storyEngine}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t.storyEngineDesc}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">{t.selectSubject}</label>
            <div className="flex gap-2 flex-wrap">
              {SUBJECTS_DATA.map(s => (
                <button key={s.id} onClick={() => setSubject(s.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    subject === s.id ? 'bg-violet-600 border-violet-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-violet-400'
                  }`}>
                  {t.subjectsList[s.id]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Genre</label>
            <div className="flex gap-2 flex-wrap">
              {GENRES.map((g, i) => {
                const labels = GENRE_LABELS[language] ?? GENRE_LABELS.en;
                return (
                  <button key={g} onClick={() => setGenre(g)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      genre === g ? 'bg-violet-600 border-violet-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-violet-400'
                    }`}>
                    {labels[i] ?? g}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-violet-50 dark:bg-violet-950/30 rounded-2xl p-5 border border-violet-100 dark:border-violet-900/30">
            <p className="text-sm text-violet-800 dark:text-violet-300 font-semibold mb-2">How it works:</p>
            <ul className="text-sm text-violet-700 dark:text-violet-400 space-y-1 list-disc list-inside">
              <li>AI writes the opening scene</li>
              <li>You write what happens next ({MIN_WORDS}+ words)</li>
              <li>AI continues — {TOTAL_CHAPTERS} chapters total</li>
              <li>Scored on creativity, vocabulary, and narrative flow</li>
            </ul>
          </div>

          <button onClick={handleStart} disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-black py-4 rounded-2xl text-lg shadow-lg transition-all">
            {loading
              ? <><Loader2 size={22} className="animate-spin" />{t.generatingStory}</>
              : <><Feather size={22} />{t.storyEngine}</>}
          </button>
        </div>
      </div>
    );
  }

  // ── COMPLETE ────────────────────────────────────────────────────────────────
  if (phase === 'complete' && evaluation) {
    const xp = Math.round(evaluation.overall * 1.5);
    const metrics = [
      { label: 'Creativity', value: evaluation.creativity },
      { label: 'Vocabulary', value: evaluation.vocabulary },
      { label: 'Narrative', value: evaluation.narrative },
    ];
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-4">
          <div className="w-28 h-28 mx-auto rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl">
            <Feather size={48} className="text-white" />
          </div>
          <h2 className="text-4xl font-black text-gray-900 dark:text-white">{t.storyComplete}</h2>
          <p className="text-xl font-bold text-gray-600 dark:text-gray-300">"{storyTitle}"</p>
          <p className="text-green-600 dark:text-green-400 font-bold text-xl">+{xp} XP</p>
          {evaluation.feedback && (
            <p className="text-gray-600 dark:text-gray-400 text-base leading-relaxed max-w-md mx-auto">{evaluation.feedback}</p>
          )}
        </div>

        {/* Score breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
          <p className="text-sm font-bold text-gray-600 dark:text-gray-400">Your Scores</p>
          {metrics.map(m => (
            <div key={m.label} className="space-y-1">
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-700 dark:text-gray-300">{m.label}</span>
                <span className="text-violet-600 dark:text-violet-400">{m.value}/100</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all duration-1000"
                  style={{ width: `${m.value}%` }} />
              </div>
            </div>
          ))}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <span className="font-bold text-gray-800 dark:text-white">Overall</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Star key={i} size={20}
                  className={i < (evaluation.overall >= 80 ? 3 : evaluation.overall >= 50 ? 2 : 1)
                    ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 dark:text-gray-700'} />
              ))}
              <span className="ms-2 text-xl font-black text-violet-600 dark:text-violet-400">{evaluation.overall}/100</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap justify-center">
          <button onClick={handlePlayAgain}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-black px-8 py-3 rounded-2xl shadow-lg transition-all">
            <RefreshCw size={18} /> {t.playAgain}
          </button>
          <button onClick={onBack}
            className="flex items-center gap-2 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold px-8 py-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            {t.backToDashboard}
          </button>
        </div>
      </div>
    );
  }

  // ── ACTIVE STORY ─────────────────────────────────────────────────────────────
  const wordsLeft = Math.max(0, MIN_WORDS - wordCount);
  const canSubmit = wordCount >= MIN_WORDS && !isContinuing;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => setPhase('setup')}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-xs text-violet-600 dark:text-violet-400 font-bold uppercase tracking-wider">
              Chapter {chapter}/{TOTAL_CHAPTERS}
            </p>
            <p className="text-sm font-black text-gray-900 dark:text-white">{storyTitle}</p>
          </div>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: TOTAL_CHAPTERS }).map((_, i) => (
            <div key={i} className={`h-2 w-8 rounded-full transition-all ${
              i < chapter - 1 ? 'bg-violet-600' : i === chapter - 1 ? 'bg-violet-400' : 'bg-gray-200 dark:bg-gray-700'
            }`} />
          ))}
        </div>
      </div>

      {/* Story */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-1">
        {chapters.map((ch, i) => (
          <div key={i} className={`rounded-2xl px-5 py-4 ${
            ch.role === 'ai'
              ? 'bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/30'
              : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'
          }`}>
            {ch.role === 'ai' && (
              <p className="text-xs font-bold text-violet-500 uppercase tracking-wider mb-2">Story</p>
            )}
            {ch.role === 'user' && (
              <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">Your Chapter</p>
            )}
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{ch.text}</p>
            {ch.role === 'ai' && ch.prompt && (
              <p className="text-sm font-bold text-violet-600 dark:text-violet-400 mt-3 pt-3 border-t border-violet-100 dark:border-violet-900/30">
                {ch.prompt}
              </p>
            )}
          </div>
        ))}
        {isContinuing && (
          <div className="flex items-center gap-3 px-5 py-4 bg-violet-50 dark:bg-violet-950/30 rounded-2xl border border-violet-100 dark:border-violet-900/30">
            <Loader2 size={18} className="animate-spin text-violet-500" />
            <span className="text-sm text-violet-600 dark:text-violet-400">{t.continuingStory}</span>
          </div>
        )}
      </div>

      {/* Writing area */}
      {!isContinuing && phase === 'active' && (
        <div className="space-y-2">
          {currentPrompt && (
            <p className="text-xs font-bold text-violet-600 dark:text-violet-400 px-1">{currentPrompt}</p>
          )}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <textarea
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                placeholder={t.writeYourChapter}
                rows={4}
                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-violet-400 dark:focus:border-violet-500 transition-colors resize-none"
              />
              <div className="flex justify-between px-1 mt-1">
                <span className={`text-xs font-semibold ${wordCount >= MIN_WORDS ? 'text-green-500' : 'text-gray-400'}`}>
                  {wordCount} {t.wordsWritten}
                </span>
                {wordsLeft > 0 && (
                  <span className="text-xs text-gray-400">{t.minWords} ({wordsLeft} more)</span>
                )}
              </div>
            </div>
            <button onClick={handleSubmitChapter} disabled={!canSubmit}
              className="p-3.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-2xl shadow-md transition-all self-start mt-0.5">
              <Send size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryEngine;
