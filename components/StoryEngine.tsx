import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, Loader2, BookOpen, Send, Star, Feather, CheckCircle,
  ChevronRight, Lightbulb, RefreshCw, Trophy
} from 'lucide-react';
import {
  GradeLevel, Language, Translations, Subject, StoryMode, StoryLength, WritingFocus,
  BranchChoice, InlineSuggestion
} from '../types';
import { generateStoryOpeningV2, continueStoryV2, generateStorySummary, streamAI } from '../services/aiService';

interface Props {
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  theme: 'light' | 'dark';
  onBack: () => void;
  onXpEarned: (xp: number) => void;
  onContextUpdate: (ctx: string) => void;
}

interface Chapter {
  index: number;
  userText?: string;
  aiText: string;
}

type Phase = 'setup' | 'writing' | 'results';

const GENRES = ['Fantasy', 'Sci-Fi', 'Mystery', 'Adventure', 'Historical', 'Humor'];
const GENRE_EMOJIS: Record<string, string> = {
  Fantasy: '🧙', 'Sci-Fi': '🚀', Mystery: '🔍', Adventure: '⚔️', Historical: '🏛️', Humor: '😄'
};

const MIN_WORDS: Partial<Record<GradeLevel, number>> = {
  [GradeLevel.KINDER]: 10,
  [GradeLevel.ELEMENTARY_1_3]: 20,
  [GradeLevel.ELEMENTARY_4_6]: 30,
  [GradeLevel.MIDDLE_7_8]: 80,
  [GradeLevel.HIGH_9_10]: 150,
  [GradeLevel.HIGH_11_12]: 150,
  [GradeLevel.COLLEGE_FRESHMAN]: 150,
  [GradeLevel.COLLEGE_ADVANCED]: 150,
};

const CHAPTER_COUNTS: Record<StoryLength, number> = { short: 3, medium: 5, epic: 8 };

const StoryEngine: React.FC<Props> = ({
  userGrade, language, translations, theme, onBack, onXpEarned, onContextUpdate
}) => {
  const [phase, setPhase] = useState<Phase>('setup');

  // Setup
  const [mode, setMode] = useState<StoryMode>('collaborative');
  const [storyLength, setStoryLength] = useState<StoryLength>('short');
  const [writingFocus, setWritingFocus] = useState<WritingFocus | ''>('');
  const [selectedGenre, setSelectedGenre] = useState('Fantasy');

  // Writing state
  const [title, setTitle] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [streamedText, setStreamedText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [nextPrompt, setNextPrompt] = useState('');
  const [suggestions, setSuggestions] = useState<InlineSuggestion[]>([]);
  const [branchChoices, setBranchChoices] = useState<BranchChoice[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<BranchChoice | null>(null);
  const [wordCount, setWordCount] = useState(0);

  // Results
  const [storySummary, setStorySummary] = useState<{ bestSentence: string; synopsis: string; vocabularyElevations: { word: string; suggestion: string }[] } | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chapters, streamedText, suggestions, branchChoices]);

  const totalChapters = CHAPTER_COUNTS[storyLength];
  const minWords = MIN_WORDS[userGrade] ?? 50;
  const userWordCount = userInput.trim().split(/\s+/).filter(Boolean).length;
  const meetsMin = userWordCount >= minWords || mode !== 'collaborative';

  const handleStartStory = async () => {
    setLoadingSetup(true);
    onContextUpdate(`Story Engine — ${selectedGenre} ${storyLength}`);
    try {
      const data = await generateStoryOpeningV2(
        Subject.LANGUAGE, selectedGenre, mode,
        writingFocus || '', userGrade, language
      );
      setTitle(data.title);
      setChapters([{ index: 0, aiText: data.opening }]);
      setNextPrompt(data.prompt ?? '');
      setCurrentChapter(1);
      if (data.choices) setBranchChoices(data.choices);
      setPhase('writing');
    } catch (e) { console.error(e); }
    finally { setLoadingSetup(false); }
  };

  const handleSubmitChapter = async () => {
    const isGuided = mode === 'guided';
    const inputText = selectedBranch ? selectedBranch.text : userInput.trim();
    if (!isGuided && !inputText) return;
    if (mode === 'collaborative' && !meetsMin) return;

    setUserInput('');
    setSelectedBranch(null);
    setSuggestions([]);
    setBranchChoices([]);
    setStreamedText('');
    setStreaming(true);

    const totalUserWords = chapters.reduce((acc, c) => acc + (c.userText?.split(/\s+/).filter(Boolean).length ?? 0), 0) + userWordCount;
    setWordCount(totalUserWords);

    let fullText = '';
    const systemPrompt = `You are writing a ${selectedGenre} story titled "${title}" with a student. Mode: ${mode}. Continue the story compellingly in 100-200 words. Respond in ${language}.`;
    const userMsg = inputText
      ? `Student's chapter: "${inputText}"\nContinue the story from here.`
      : `Continue the story for chapter ${currentChapter + 1}.`;

    await streamAI(systemPrompt, userMsg, (chunk) => {
      fullText += chunk;
      setStreamedText(prev => prev + chunk);
    }, async (full) => {
      setStreaming(false);
      setStreamedText('');

      const newChapter: Chapter = { index: currentChapter, userText: inputText || undefined, aiText: full };
      const newChapters = [...chapters, newChapter];
      setChapters(newChapters);

      const nextChapterNum = currentChapter + 1;

      if (nextChapterNum >= totalChapters) {
        // Story complete — generate summary
        setLoadingResults(true);
        try {
          const summary = await generateStorySummary(
            newChapters.filter(c => c.userText).map(c => c.userText!),
            language
          );
          setStorySummary(summary);
          const totalWords = newChapters.reduce((acc, c) => acc + (c.userText?.split(/\s+/).filter(Boolean).length ?? 0), 0);
          const lengthMult = { short: 1, medium: 1.5, epic: 2 }[storyLength];
          onXpEarned(Math.round((totalWords / 50) * lengthMult * 10));
        } catch { /* ignore */ }
        setLoadingResults(false);
        setPhase('results');
        return;
      }

      setCurrentChapter(nextChapterNum);

      // Every 2 chapters: fetch branches/suggestions via continueStoryV2
      if ((nextChapterNum) % 2 === 0) {
        try {
          const storyHistory = newChapters.flatMap(c => [
            ...(c.userText ? [{ role: 'user', text: c.userText }] : []),
            { role: 'ai', text: c.aiText },
          ]);
          const cont = await continueStoryV2({
            storyHistory,
            userContribution: inputText ?? '',
            chapter: nextChapterNum,
            totalChapters,
            mode,
            writingFocus: writingFocus ?? '',
            acceptedSuggestions: [],
            language,
          });
          if (cont.choices) setBranchChoices(cont.choices);
          if (cont.nextPrompt) setNextPrompt(cont.nextPrompt);
          if (cont.suggestions) setSuggestions(cont.suggestions);
        } catch { /* ignore */ }
      }
    });
  };

  // Guided mode auto-continues
  useEffect(() => {
    if (mode === 'guided' && phase === 'writing' && !streaming && currentChapter > 0 && currentChapter < totalChapters && branchChoices.length === 0) {
      handleSubmitChapter();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter, mode, phase, streaming, branchChoices.length]);

  // ── SETUP ─────────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><ArrowLeft size={20} /></button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <BookOpen size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">{translations.storyEngine}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{translations.storyEngineDesc}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          {/* Mode */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{translations.writingMode}</label>
            <div className="grid grid-cols-3 gap-3">
              {([ ['collaborative', translations.collaborativeMode, '✍️'],
                  ['solo', translations.soloMode, '📝'],
                  ['guided', translations.guidedMode, '🤖'],
              ] as [StoryMode, string, string][]).map(([m, label, emoji]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                    mode === m
                      ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <div className="text-xl mb-1">{emoji}</div>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Length */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{translations.storyLength}</label>
            <div className="grid grid-cols-3 gap-3">
              {([ ['short', translations.shortStory, '3 ch.'],
                  ['medium', translations.mediumStory, '5 ch.'],
                  ['epic', translations.epicStory, '8 ch.'],
              ] as [StoryLength, string, string][]).map(([l, label, sub]) => (
                <button
                  key={l}
                  onClick={() => setStoryLength(l)}
                  className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                    storyLength === l
                      ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {label}
                  <div className="text-xs font-normal text-gray-400 mt-0.5">{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Genre */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Genre</label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGenre(g)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-sm border-2 transition-all ${
                    selectedGenre === g
                      ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {GENRE_EMOJIS[g]} {g}
                </button>
              ))}
            </div>
          </div>

          {/* Writing Focus (optional) */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{translations.writingFocus} <span className="font-normal normal-case tracking-normal">(optional)</span></label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setWritingFocus('')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs border-2 transition-all ${
                  writingFocus === ''
                    ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500'
                }`}
              >
                None
              </button>
              {([ ['descriptive', translations.descriptiveFocus],
                  ['dialogue', translations.dialogueFocus],
                  ['plot-twists', translations.plotTwistFocus],
                  ['character', translations.characterFocus],
              ] as [WritingFocus, string][]).map(([f, label]) => (
                <button
                  key={f}
                  onClick={() => setWritingFocus(f)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs border-2 transition-all ${
                    writingFocus === f
                      ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStartStory}
            disabled={loadingSetup}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-black rounded-2xl hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            {loadingSetup
              ? <><Loader2 size={20} className="animate-spin" /> Creating story...</>
              : <><Feather size={20} /> {translations.startStory}</>
            }
          </button>
        </div>
      </div>
    );
  }

  // ── RESULTS ───────────────────────────────────────────────────────────────────
  if (phase === 'results') {
    return (
      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><ArrowLeft size={20} /></button>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">{title}</h1>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-5 text-white text-center space-y-1">
          <Trophy size={32} className="mx-auto mb-2" />
          <p className="font-black text-xl">Story Complete!</p>
          <p className="text-white/80 text-sm">{chapters.length} chapters written</p>
        </div>

        {loadingResults && (
          <div className="flex items-center justify-center gap-3 py-6">
            <Loader2 size={24} className="animate-spin text-purple-500" />
            <span className="font-bold text-gray-500">Analyzing your story...</span>
          </div>
        )}

        {storySummary && (
          <div className="space-y-3">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-black text-yellow-600 dark:text-yellow-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Star size={12} /> {translations.bestSentence}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{storySummary.bestSentence}"</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Synopsis</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{storySummary.synopsis}</p>
            </div>
            {storySummary.vocabularyElevations?.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-xs font-black text-green-600 dark:text-green-400 uppercase tracking-wider mb-2">
                  {translations.vocabularyElevate}
                </p>
                <div className="space-y-1.5">
                  {storySummary.vocabularyElevations.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 dark:text-gray-400 line-through">{v.word}</span>
                      <ChevronRight size={14} className="text-green-500" />
                      <span className="font-bold text-green-700 dark:text-green-400">{v.suggestion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => { setPhase('setup'); setChapters([]); setStorySummary(null); setTitle(''); setCurrentChapter(0); }}
          className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-black rounded-2xl hover:from-purple-600 hover:to-pink-700 transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          <RefreshCw size={20} /> Write Another Story
        </button>
      </div>
    );
  }

  // ── WRITING ───────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><ArrowLeft size={20} /></button>
        <div className="text-center">
          <h2 className="font-black text-gray-900 dark:text-white text-lg truncate max-w-[200px]">{title}</h2>
          <p className="text-xs text-gray-400">Chapter {Math.min(currentChapter, totalChapters)} / {totalChapters}</p>
        </div>
        {/* Progress dots */}
        <div className="flex gap-1">
          {Array.from({ length: totalChapters }).map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${
              i < currentChapter ? 'bg-purple-500' : i === currentChapter ? 'bg-purple-300 animate-pulse' : 'bg-gray-200 dark:bg-gray-700'
            }`} />
          ))}
        </div>
      </div>

      {/* Chapters */}
      {chapters.map((ch, i) => (
        <div key={i} className="space-y-3">
          {ch.userText && (
            <div className="flex justify-end">
              <div className="max-w-[90%] bg-purple-500 text-white rounded-2xl rounded-br-sm px-4 py-3">
                <p className="text-xs font-black opacity-70 mb-1">Chapter {ch.index} — You</p>
                <p className="text-sm leading-relaxed">{ch.userText}</p>
              </div>
            </div>
          )}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-sm px-5 py-4">
            <p className="text-xs font-black text-purple-500 mb-2 flex items-center gap-1">
              <BookOpen size={12} /> AI {i === 0 ? 'Opening' : `Chapter ${ch.index}`}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{ch.aiText}</p>
          </div>
        </div>
      ))}

      {/* Streaming */}
      {streamedText && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-sm px-5 py-4">
          <p className="text-xs font-black text-purple-500 mb-2">AI Writing...</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {streamedText}<span className="inline-block w-1.5 h-4 bg-purple-400 animate-pulse ml-0.5 rounded-sm" />
          </p>
        </div>
      )}

      {/* Branch choices */}
      {branchChoices.length > 0 && !streaming && (
        <div className="space-y-2">
          <p className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider">{translations.branchChoicePrompt}</p>
          {branchChoices.map(choice => (
            <button
              key={choice.id}
              onClick={() => { setSelectedBranch(choice); setBranchChoices([]); handleSubmitChapter(); }}
              className="w-full text-left p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
            >
              <p className="font-bold text-sm text-gray-900 dark:text-white">{choice.text}</p>
              {choice.consequence && <p className="text-xs text-gray-400 mt-0.5">{choice.consequence}</p>}
            </button>
          ))}
        </div>
      )}

      {/* Inline suggestions */}
      {suggestions.length > 0 && !streaming && mode === 'collaborative' && (
        <div className="space-y-2">
          <p className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
            <Lightbulb size={12} /> {translations.suggestionLabel}
          </p>
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                s.type === 'sensory' ? 'bg-blue-100 text-blue-700' :
                s.type === 'tension' ? 'bg-red-100 text-red-700' :
                s.type === 'vocabulary' ? 'bg-green-100 text-green-700' :
                'bg-purple-100 text-purple-700'
              }`}>{s.type}</span>
              <button
                onClick={() => setUserInput(prev => prev + (prev ? ' ' : '') + s.text)}
                className="text-xs text-amber-700 dark:text-amber-300 hover:underline text-left flex-1"
              >
                {s.text}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* User input (collaborative/solo only) */}
      {mode !== 'guided' && !streaming && currentChapter < totalChapters && branchChoices.length === 0 && (
        <div className="space-y-2">
          {nextPrompt && (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic pl-1">{nextPrompt}</p>
          )}
          <textarea
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            placeholder={`Write your part of the story... (min ${minWords} words)`}
            rows={4}
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 focus:border-purple-400 rounded-2xl outline-none text-sm text-gray-900 dark:text-white transition-all resize-none"
          />
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${meetsMin ? 'text-green-600' : 'text-gray-400'}`}>
              {userWordCount} / {minWords} words {meetsMin && <CheckCircle size={12} className="inline" />}
            </span>
            <button
              onClick={handleSubmitChapter}
              disabled={!meetsMin || !userInput.trim()}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-black px-5 py-2.5 rounded-xl hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 transition-all shadow-md"
            >
              <Send size={16} /> Continue <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};

export default StoryEngine;
