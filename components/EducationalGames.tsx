import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowLeft, Calculator, Globe, Layers, Loader2,
  Heart, Trophy, RefreshCw, Gamepad2, Bug, Zap, Puzzle, Shuffle
} from 'lucide-react';
import { GradeLevel, Language, Translations, Subject, GameType, GameQuestion, MemoryCard, BuggyCode } from '../types';
import { generateGameQuestions, generateBuggyCode } from '../services/aiService';
import { SUBJECTS_DATA } from '../constants';

interface Props {
  userGrade: GradeLevel;
  language: Language;
  translations: Translations;
  onBack: () => void;
  onXpEarned: (xp: number) => void;
  onContextUpdate: (ctx: string) => void;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildMemoryCards(questions: GameQuestion[]): MemoryCard[] {
  const groups: Record<string, GameQuestion[]> = {};
  for (const q of questions) {
    if (!groups[q.answer]) groups[q.answer] = [];
    groups[q.answer].push(q);
  }
  const cards: MemoryCard[] = [];
  Object.entries(groups).forEach(([pairId, qs]) => {
    if (qs.length >= 2) {
      cards.push({ id: qs[0].id, pairId, face: qs[0].question, isFlipped: false, isMatched: false });
      cards.push({ id: qs[1].id, pairId, face: qs[1].question, isFlipped: false, isMatched: false });
    }
  });
  return shuffle(cards);
}

/** Shuffle the letters of a word, guaranteeing the result differs from the original */
function scrambleWord(word: string): { char: string; id: number }[] {
  const letters = word.toUpperCase().split('').map((c, i) => ({ char: c, id: i }));
  if (letters.length <= 1) return letters;
  const shuffled = shuffle(letters);
  // If identical to original, swap first two to guarantee difference
  if (shuffled.map(l => l.char).join('') === word.toUpperCase()) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }
  return shuffled;
}

// ─── BALLOON TYPES ────────────────────────────────────────────────────────────

interface ActiveBalloon {
  id: number;
  answer: string;
  x: number;
  duration: number;
  colorIdx: number;
  height: number;
  popped: boolean;
  shaking: boolean;
}

const BALLOON_COLORS = [
  { body: '#ef4444', shine: '#fca5a5' },
  { body: '#3b82f6', shine: '#93c5fd' },
  { body: '#f59e0b', shine: '#fcd34d' },
  { body: '#10b981', shine: '#6ee7b7' },
  { body: '#8b5cf6', shine: '#c4b5fd' },
  { body: '#ec4899', shine: '#f9a8d4' },
];

const CARD_BACK_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-red-500',
  'from-cyan-500 to-blue-500',
  'from-violet-500 to-purple-600',
];

const LETTER_TILE_COLORS = [
  { bg: '#ef4444', hover: '#dc2626' },
  { bg: '#f97316', hover: '#ea580c' },
  { bg: '#eab308', hover: '#ca8a04' },
  { bg: '#22c55e', hover: '#16a34a' },
  { bg: '#06b6d4', hover: '#0891b2' },
  { bg: '#3b82f6', hover: '#2563eb' },
  { bg: '#8b5cf6', hover: '#7c3aed' },
  { bg: '#ec4899', hover: '#db2777' },
];

const GAME_CONFIGS = [
  { type: 'balloon-pop'   as GameType, icon: Globe,     color: 'from-sky-400 to-blue-500',       label: (t: Translations) => t.wordFlash,    desc: (t: Translations) => t.wordFlashDesc },
  { type: 'cave-runner'   as GameType, icon: Calculator, color: 'from-amber-500 to-orange-600',   label: (t: Translations) => t.mathRush,     desc: (t: Translations) => t.mathRushDesc },
  { type: 'memory-match'  as GameType, icon: Layers,    color: 'from-emerald-500 to-teal-600',    label: (t: Translations) => t.memoryMatch,  desc: (t: Translations) => t.memoryMatchDesc },
  { type: 'bug-fix'       as GameType, icon: Bug,       color: 'from-red-600 to-rose-700',         label: (t: Translations) => t.bugFix,       desc: (t: Translations) => t.bugFixDesc },
  { type: 'picture-tap'   as GameType, icon: Puzzle,    color: 'from-pink-400 to-rose-500',        label: (t: Translations) => t.pictureTap,   desc: (t: Translations) => t.pictureTapDesc },
  { type: 'word-scramble' as GameType, icon: Shuffle,   color: 'from-violet-500 to-purple-600',    label: (t: Translations) => t.wordScramble, desc: (t: Translations) => t.wordScrambleDesc },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const EducationalGames: React.FC<Props> = ({
  userGrade, language, translations, onBack, onXpEarned, onContextUpdate
}) => {
  const t = translations;

  // ── Shared state ────────────────────────────────────────────────────────────
  const [activeGame, setActiveGame] = useState<GameType | null>(null);
  const [subject, setSubject] = useState<Subject>(Subject.MATH);
  const [loading, setLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [xpAwarded, setXpAwarded] = useState(false);
  const [flashCorrect, setFlashCorrect] = useState(false);
  const [flashWrong, setFlashWrong] = useState(false);
  const [brokenLiveIdx, setBrokenLiveIdx] = useState<number | null>(null);
  const [scoreFlyId, setScoreFlyId] = useState(0);

  // ── Balloon Pop state ────────────────────────────────────────────────────────
  const [balloonQuestions, setBalloonQuestions] = useState<GameQuestion[]>([]);
  const [balloonQIdx, setBalloonQIdx] = useState(0);
  const [balloonTimeLeft, setBalloonTimeLeft] = useState(60);
  const [activeBalloons, setActiveBalloons] = useState<ActiveBalloon[]>([]);
  const balloonIdRef = useRef(0);
  const balloonQIdxRef = useRef(0);
  const balloonTimeRef = useRef(60);
  const balloonQuestionsRef = useRef<GameQuestion[]>([]);

  // ── Cave Runner state ────────────────────────────────────────────────────────
  const [caveQuestions, setCaveQuestions] = useState<GameQuestion[]>([]);
  const [caveSetOffset, setCaveSetOffset] = useState(0);
  const [caveTimeLeft, setCaveTimeLeft] = useState(45);
  const [cartActive, setCartActive] = useState(false);
  const [cartKey, setCartKey] = useState(0);
  const [cartDuration, setCartDuration] = useState(6);
  const [cartAnswer, setCartAnswer] = useState('');
  const [correctCaveIdx, setCorrectCaveIdx] = useState(0);
  const [caveFeedback, setCaveFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [feedbackCaveIdx, setFeedbackCaveIdx] = useState<number | null>(null);
  const caveTimeRef = useRef(45);

  // ── Memory Match state ───────────────────────────────────────────────────────
  const [memoryCards, setMemoryCards] = useState<MemoryCard[]>([]);
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [memoryLocked, setMemoryLocked] = useState(false);

  // ── Bug Fix state ────────────────────────────────────────────────────────────
  const [buggyCode, setBuggyCode] = useState<BuggyCode | null>(null);
  const [bugTimeLeft, setBugTimeLeft] = useState(150);
  const [fixedBugs, setFixedBugs] = useState<Set<number>>(new Set());
  const [selectedBugIdx, setSelectedBugIdx] = useState<number | null>(null);
  const [userFixInput, setUserFixInput] = useState('');
  const [wrongFix, setWrongFix] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [worldSaved, setWorldSaved] = useState(false);
  const bugTimeRef = useRef(150);

  // ── Picture Tap state ────────────────────────────────────────────────────────
  const [ptQuestions, setPtQuestions] = useState<GameQuestion[]>([]);
  const [ptQIdx, setPtQIdx] = useState(0);
  const [ptTimeLeft, setPtTimeLeft] = useState(60);
  const [ptOptions, setPtOptions] = useState<string[]>([]);
  const [ptFeedback, setPtFeedback] = useState<{ optIdx: number; correct: boolean } | null>(null);
  const ptTimeRef = useRef(60);

  // ── Word Scramble state ──────────────────────────────────────────────────────
  const [wsQuestions, setWsQuestions] = useState<GameQuestion[]>([]);
  const [wsQIdx, setWsQIdx] = useState(0);
  const [wsTimeLeft, setWsTimeLeft] = useState(45);
  const [wsLetterPool, setWsLetterPool] = useState<{ char: string; id: number }[]>([]);
  const [wsAnswer, setWsAnswer] = useState<{ char: string; id: number }[]>([]);
  const [wsLastFilledIdx, setWsLastFilledIdx] = useState(-1);
  const wsTimeRef = useRef(45);
  const wsQuestionsRef = useRef<GameQuestion[]>([]);
  const wsQIdxRef = useRef(0);

  // ── Callbacks ────────────────────────────────────────────────────────────────

  const triggerCorrect = useCallback(() => {
    setFlashCorrect(true);
    setTimeout(() => setFlashCorrect(false), 350);
    setScoreFlyId(id => id + 1);
  }, []);

  const triggerWrong = useCallback((liveIdx: number) => {
    setFlashWrong(true);
    setBrokenLiveIdx(liveIdx);
    setTimeout(() => { setFlashWrong(false); setBrokenLiveIdx(null); }, 500);
  }, []);

  const handleGameOver = useCallback(() => setGameOver(true), []);

  const loseLife = useCallback(() => {
    setLives(prev => {
      const nl = prev - 1;
      triggerWrong(nl);
      if (nl <= 0) handleGameOver();
      return nl;
    });
  }, [triggerWrong, handleGameOver]);

  // ── START GAME ────────────────────────────────────────────────────────────────
  const handleStartGame = async (gameType: GameType) => {
    setActiveGame(gameType);
    setLoading(true);
    setScore(0);
    setLives(3);
    setGameOver(false);
    setXpAwarded(false);
    setFlashCorrect(false);
    setFlashWrong(false);
    // Balloon reset
    setActiveBalloons([]);
    setBalloonQIdx(0);
    setBalloonTimeLeft(60);
    balloonQIdxRef.current = 0;
    balloonTimeRef.current = 60;
    // Cave reset
    setCartActive(false);
    setCaveTimeLeft(45);
    caveTimeRef.current = 45;
    setCaveSetOffset(0);
    // Memory reset
    setMemoryCards([]);
    setFlippedIds([]);
    setMemoryLocked(false);
    // Bug Fix reset
    setBuggyCode(null);
    setBugTimeLeft(150);
    bugTimeRef.current = 150;
    setFixedBugs(new Set());
    setSelectedBugIdx(null);
    setUserFixInput('');
    setExploded(false);
    setWorldSaved(false);
    // Picture Tap reset
    setPtQuestions([]);
    setPtQIdx(0);
    setPtTimeLeft(60);
    ptTimeRef.current = 60;
    setPtOptions([]);
    setPtFeedback(null);
    // Word Scramble reset
    setWsQuestions([]);
    setWsQIdx(0);
    setWsTimeLeft(45);
    wsTimeRef.current = 45;
    setWsLetterPool([]);
    setWsAnswer([]);
    setWsLastFilledIdx(-1);
    wsQuestionsRef.current = [];
    wsQIdxRef.current = 0;

    onContextUpdate(`Playing ${gameType}`);

    try {
      if (gameType === 'bug-fix') {
        const code = await generateBuggyCode(subject, userGrade, language);
        setBuggyCode(code);
      } else if (gameType === 'picture-tap') {
        const qs = await generateGameQuestions('picture-tap', subject, userGrade, language, 20);
        setPtQuestions(qs);
        if (qs.length > 0) {
          const q = qs[0];
          setPtOptions(shuffle([q.answer, ...(q.distractors ?? []).slice(0, 3)]).slice(0, 4));
        }
      } else if (gameType === 'word-scramble') {
        const qs = await generateGameQuestions('word-scramble', subject, userGrade, language, 15);
        setWsQuestions(qs);
        wsQuestionsRef.current = qs;
        wsQIdxRef.current = 0;
        if (qs.length > 0) {
          setWsLetterPool(scrambleWord(qs[0].answer));
          setWsAnswer([]);
        }
      } else {
        const count = gameType === 'memory-match' ? 12 : 20;
        const qs = await generateGameQuestions(gameType, subject, userGrade, language, count);
        if (gameType === 'balloon-pop') {
          setBalloonQuestions(qs);
          balloonQuestionsRef.current = qs;
        } else if (gameType === 'cave-runner') {
          setCaveQuestions(qs);
        } else if (gameType === 'memory-match') {
          setMemoryCards(buildMemoryCards(qs));
        }
      }
    } catch {
      // fall through — game started with empty data
    }
    setLoading(false);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // BALLOON POP — game loop
  // ═══════════════════════════════════════════════════════════════════════════

  const spawnBalloon = useCallback((
    questionsPool: GameQuestion[],
    qIdx: number,
    timeLeft: number,
    currentBalloons: ActiveBalloon[]
  ) => {
    if (questionsPool.length === 0) return;
    const q = questionsPool[qIdx % questionsPool.length];
    const correctAnswer = q.answer;
    const distractors = q.distractors ?? [];
    const hasCorrect = currentBalloons.some(b => b.answer === correctAnswer && !b.popped);
    const useCorrect = !hasCorrect || Math.random() < 0.35;
    const answerPool = useCorrect
      ? [correctAnswer]
      : (distractors.length > 0 ? distractors : [correctAnswer]);
    const answer = answerPool[Math.floor(Math.random() * answerPool.length)];
    const elapsed = 60 - timeLeft;
    const speed = Math.max(3.5, 10 - elapsed * 0.11);
    const balloon: ActiveBalloon = {
      id: balloonIdRef.current++,
      answer,
      x: 3 + Math.random() * 78,
      duration: speed,
      colorIdx: Math.floor(Math.random() * BALLOON_COLORS.length),
      height: 92 + Math.floor(Math.random() * 46),
      popped: false,
      shaking: false,
    };
    setActiveBalloons(prev => [...prev, balloon]);
  }, []);

  useEffect(() => {
    if (activeGame !== 'balloon-pop' || loading || gameOver) return;
    const TARGET_COUNT = 4;
    let lastSpawn = Date.now();
    const tick = setInterval(() => {
      balloonTimeRef.current -= 1;
      setBalloonTimeLeft(balloonTimeRef.current);
      if (balloonTimeRef.current <= 0) { handleGameOver(); clearInterval(tick); return; }
      const newQIdx = Math.floor((60 - balloonTimeRef.current) / 10);
      if (newQIdx !== balloonQIdxRef.current) {
        balloonQIdxRef.current = newQIdx;
        setBalloonQIdx(newQIdx);
      }
      const now = Date.now();
      if (now - lastSpawn > 1200) {
        setActiveBalloons(prev => {
          const alive = prev.filter(b => !b.popped);
          if (alive.length < TARGET_COUNT) {
            spawnBalloon(balloonQuestionsRef.current, balloonQIdxRef.current, balloonTimeRef.current, alive);
          }
          return prev;
        });
        lastSpawn = now;
      }
    }, 1000);
    setTimeout(() => {
      for (let i = 0; i < TARGET_COUNT; i++) {
        setTimeout(() => {
          setActiveBalloons(prev => {
            spawnBalloon(balloonQuestionsRef.current, 0, 60, prev);
            return prev;
          });
        }, i * 300);
      }
    }, 100);
    return () => clearInterval(tick);
  }, [activeGame, loading, gameOver, spawnBalloon, handleGameOver]);

  const handleBalloonClick = useCallback((balloonId: number, answer: string) => {
    const q = balloonQuestionsRef.current[balloonQIdxRef.current % Math.max(1, balloonQuestionsRef.current.length)];
    if (!q) return;
    if (answer === q.answer) {
      setActiveBalloons(prev => prev.map(b => b.id === balloonId ? { ...b, popped: true } : b));
      triggerCorrect();
      setScore(s => s + 1);
      setTimeout(() => setActiveBalloons(prev => prev.filter(b => b.id !== balloonId)), 400);
    } else {
      setActiveBalloons(prev => prev.map(b => b.id === balloonId ? { ...b, shaking: true } : b));
      setTimeout(() => setActiveBalloons(prev => prev.map(b => b.id === balloonId ? { ...b, shaking: false } : b)), 420);
      loseLife();
    }
  }, [triggerCorrect, loseLife]);

  const handleBalloonExit = useCallback((balloonId: number) => {
    setActiveBalloons(prev => prev.filter(b => b.id !== balloonId));
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // CAVE RUNNER — game logic
  // ═══════════════════════════════════════════════════════════════════════════

  const caves = useMemo(() => {
    if (caveQuestions.length < 3) return [];
    return [0, 1, 2].map(i => caveQuestions[(caveSetOffset + i) % caveQuestions.length]);
  }, [caveQuestions, caveSetOffset]);

  const [caveCartIdx, setCaveCartIdx] = useState(0);

  const launchNextCart = useCallback((caves: GameQuestion[], timeLeft: number) => {
    if (caves.length < 3) return;
    const idx = Math.floor(Math.random() * 3);
    setCaveCartIdx(idx);
    setCartAnswer(caves[idx].answer);
    setCorrectCaveIdx(idx);
    const speed = Math.max(3, 7 - (45 - timeLeft) * 0.07);
    setCartDuration(speed);
    setCartKey(k => k + 1);
    setCartActive(true);
  }, []);

  useEffect(() => {
    if (activeGame !== 'cave-runner' || loading || gameOver || caves.length < 3) return;
    const tick = setInterval(() => {
      caveTimeRef.current -= 1;
      setCaveTimeLeft(caveTimeRef.current);
      if (caveTimeRef.current <= 0) { handleGameOver(); clearInterval(tick); }
    }, 1000);
    launchNextCart(caves, caveTimeRef.current);
    return () => clearInterval(tick);
  }, [activeGame, loading, gameOver, caves, launchNextCart, handleGameOver]);

  const handleCaveClick = useCallback((caveIdx: number) => {
    if (!cartActive || caveFeedback) return;
    setCartActive(false);
    if (caveIdx === correctCaveIdx) {
      setCaveFeedback('correct');
      setFeedbackCaveIdx(caveIdx);
      triggerCorrect();
      setScore(s => s + 1);
    } else {
      setCaveFeedback('wrong');
      setFeedbackCaveIdx(caveIdx);
      loseLife();
    }
    setTimeout(() => {
      setCaveFeedback(null);
      setFeedbackCaveIdx(null);
      setScore(prev => {
        if ((prev) % 3 === 0 && prev > 0) setCaveSetOffset(o => o + 3);
        return prev;
      });
      launchNextCart(caves, caveTimeRef.current);
    }, 700);
  }, [cartActive, caveFeedback, correctCaveIdx, triggerCorrect, loseLife, launchNextCart, caves]);

  const handleCartExit = useCallback(() => {
    if (!cartActive) return;
    setCartActive(false);
    loseLife();
    setTimeout(() => launchNextCart(caves, caveTimeRef.current), 600);
  }, [cartActive, loseLife, launchNextCart, caves]);

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMORY MATCH
  // ═══════════════════════════════════════════════════════════════════════════

  const handleCardFlip = useCallback((id: string) => {
    if (memoryLocked) return;
    setMemoryCards(prev => {
      const card = prev.find(c => c.id === id);
      if (!card || card.isMatched || card.isFlipped) return prev;
      return prev.map(c => c.id === id ? { ...c, isFlipped: true } : c);
    });
    setFlippedIds(prev => {
      const newFlipped = [...prev, id];
      if (newFlipped.length === 2) {
        setMemoryLocked(true);
        setTimeout(() => {
          setMemoryCards(cards => {
            const [id1, id2] = newFlipped;
            const c1 = cards.find(c => c.id === id1);
            const c2 = cards.find(c => c.id === id2);
            if (c1 && c2 && c1.pairId === c2.pairId) {
              const updated = cards.map(c => c.id === id1 || c.id === id2 ? { ...c, isMatched: true } : c);
              setScore(s => s + 1);
              triggerCorrect();
              if (updated.every(c => c.isMatched)) handleGameOver();
              return updated;
            } else {
              setLives(l => {
                const nl = l - 1;
                triggerWrong(nl);
                if (nl <= 0) handleGameOver();
                return nl;
              });
              return cards.map(c => c.id === id1 || c.id === id2 ? { ...c, isFlipped: false } : c);
            }
          });
          setFlippedIds([]);
          setMemoryLocked(false);
        }, 800);
        return newFlipped;
      }
      return newFlipped;
    });
  }, [memoryLocked, triggerCorrect, triggerWrong, handleGameOver]);

  // ═══════════════════════════════════════════════════════════════════════════
  // BUG FIX
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (activeGame !== 'bug-fix' || loading || gameOver || !buggyCode) return;
    const tick = setInterval(() => {
      bugTimeRef.current -= 1;
      setBugTimeLeft(bugTimeRef.current);
      if (bugTimeRef.current <= 0) {
        setExploded(true);
        handleGameOver();
        clearInterval(tick);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [activeGame, loading, gameOver, buggyCode, handleGameOver]);

  const handleBugLineClick = useCallback((bugIdx: number) => {
    setSelectedBugIdx(prev => prev === bugIdx ? null : bugIdx);
    setUserFixInput('');
    setWrongFix(false);
  }, []);

  const handleConfirmFix = useCallback(() => {
    if (!buggyCode || selectedBugIdx === null) return;
    const bug = buggyCode.bugs[selectedBugIdx];
    const correct = userFixInput.trim() === bug.fixedLine.trim();
    if (correct) {
      const next = new Set(fixedBugs);
      next.add(selectedBugIdx);
      setFixedBugs(next);
      setSelectedBugIdx(null);
      setUserFixInput('');
      setWrongFix(false);
      setScore(s => s + 1);
      triggerCorrect();
      if (next.size === buggyCode.bugs.length) {
        setWorldSaved(true);
        handleGameOver();
      }
    } else {
      setWrongFix(true);
      loseLife();
      setTimeout(() => setWrongFix(false), 600);
    }
  }, [buggyCode, selectedBugIdx, userFixInput, fixedBugs, triggerCorrect, loseLife, handleGameOver]);

  // ═══════════════════════════════════════════════════════════════════════════
  // PICTURE TAP — timer
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (activeGame !== 'picture-tap' || loading || gameOver) return;
    const tick = setInterval(() => {
      ptTimeRef.current -= 1;
      setPtTimeLeft(ptTimeRef.current);
      if (ptTimeRef.current <= 0) { handleGameOver(); clearInterval(tick); }
    }, 1000);
    return () => clearInterval(tick);
  }, [activeGame, loading, gameOver, handleGameOver]);

  const handlePictureTapAnswer = useCallback((opt: string, optIdx: number) => {
    if (ptFeedback) return;
    const q = ptQuestions[ptQIdx % Math.max(1, ptQuestions.length)];
    if (!q) return;
    if (opt === q.answer) {
      setPtFeedback({ optIdx, correct: true });
      triggerCorrect();
      setScore(s => s + 1);
      setTimeout(() => {
        setPtFeedback(null);
        const nextIdx = ptQIdx + 1;
        setPtQIdx(nextIdx);
        const nextQ = ptQuestions[nextIdx % ptQuestions.length];
        if (nextQ) {
          setPtOptions(shuffle([nextQ.answer, ...(nextQ.distractors ?? []).slice(0, 3)]).slice(0, 4));
        }
      }, 600);
    } else {
      setPtFeedback({ optIdx, correct: false });
      loseLife();
      setTimeout(() => setPtFeedback(null), 500);
    }
  }, [ptFeedback, ptQuestions, ptQIdx, triggerCorrect, loseLife]);

  // ═══════════════════════════════════════════════════════════════════════════
  // WORD SCRAMBLE — timer + letter handlers
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (activeGame !== 'word-scramble' || loading || gameOver) return;
    const tick = setInterval(() => {
      wsTimeRef.current -= 1;
      setWsTimeLeft(wsTimeRef.current);
      if (wsTimeRef.current <= 0) { handleGameOver(); clearInterval(tick); }
    }, 1000);
    return () => clearInterval(tick);
  }, [activeGame, loading, gameOver, handleGameOver]);

  const handleWsPoolClick = useCallback((tileId: number) => {
    const tile = wsLetterPool.find(l => l.id === tileId);
    if (!tile) return;
    const newPool = wsLetterPool.filter(l => l.id !== tileId);
    const newAnswer = [...wsAnswer, tile];
    setWsLetterPool(newPool);
    setWsAnswer(newAnswer);
    setWsLastFilledIdx(newAnswer.length - 1);

    const q = wsQuestionsRef.current[wsQIdxRef.current % Math.max(1, wsQuestionsRef.current.length)];
    if (!q || newAnswer.length < q.answer.length) return;

    // Word complete — check
    const userWord = newAnswer.map(l => l.char).join('');
    if (userWord === q.answer.toUpperCase()) {
      triggerCorrect();
      setScore(s => s + 1);
      const nextIdx = wsQIdxRef.current + 1;
      wsQIdxRef.current = nextIdx;
      setWsQIdx(nextIdx);
      setTimeout(() => {
        const nextQ = wsQuestionsRef.current[nextIdx % Math.max(1, wsQuestionsRef.current.length)];
        if (nextQ) {
          setWsLetterPool(scrambleWord(nextQ.answer));
          setWsAnswer([]);
          setWsLastFilledIdx(-1);
        }
      }, 600);
    } else {
      // Wrong — flash and reset after brief pause
      loseLife();
      setTimeout(() => {
        const currQ = wsQuestionsRef.current[wsQIdxRef.current % Math.max(1, wsQuestionsRef.current.length)];
        if (currQ) {
          setWsLetterPool(scrambleWord(currQ.answer));
          setWsAnswer([]);
          setWsLastFilledIdx(-1);
        }
      }, 600);
    }
  }, [wsLetterPool, wsAnswer, triggerCorrect, loseLife]);

  const handleWsAnswerClick = useCallback((tileId: number, slotIdx: number) => {
    // Remove from answer (only the clicked slot), restore to pool
    const removed = wsAnswer[slotIdx];
    if (!removed) return;
    setWsAnswer(prev => prev.filter((_, i) => i !== slotIdx));
    setWsLetterPool(prev => [...prev, { char: removed.char, id: removed.id }]);
  }, [wsAnswer]);

  // ── PLAY AGAIN ────────────────────────────────────────────────────────────
  const handlePlayAgain = () => {
    if (!xpAwarded) { onXpEarned(score * 15); setXpAwarded(true); }
    setActiveGame(null);
    setGameOver(false);
    setScore(0);
  };

  // ── HEARTS ────────────────────────────────────────────────────────────────
  const Hearts = ({ count }: { count: number }) => (
    <div className="flex gap-1.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <Heart key={i} size={22}
          className={i < count
            ? i === brokenLiveIdx ? 'text-red-500 fill-red-500 animate-heartbreak' : 'text-red-500 fill-red-500'
            : 'text-gray-300 dark:text-gray-600'} />
      ))}
    </div>
  );

  // ── SCORE FLY ──────────────────────────────────────────────────────────────
  const ScoreFly = () => (
    scoreFlyId > 0 ? (
      <span key={scoreFlyId} className="animate-score-fly absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-300 font-black text-xl pointer-events-none z-20">
        +1
      </span>
    ) : null
  );

  // ─── MENU ─────────────────────────────────────────────────────────────────
  if (!activeGame) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Gamepad2 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t.educationalGames}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t.educationalGamesDesc}</p>
            </div>
          </div>
        </div>

        {/* Subject selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">{t.selectSubject}:</span>
          <div className="flex gap-2 flex-wrap">
            {SUBJECTS_DATA.map(s => (
              <button key={s.id} onClick={() => setSubject(s.id)}
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
                  subject === s.id
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-indigo-400'
                }`}>
                {t.subjectsList[s.id]}
              </button>
            ))}
          </div>
        </div>

        {/* Game cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {GAME_CONFIGS.map(({ type, icon: Icon, color, label, desc }) => (
            <button key={type} onClick={() => handleStartGame(type)}
              className="text-start bg-white dark:bg-gray-800 rounded-[2rem] p-7 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all group">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                <Icon size={32} className="text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">{label(t)}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{desc(t)}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── LOADING ──────────────────────────────────────────────────────────────
  if (loading) {
    const loadingMsg = activeGame === 'bug-fix' ? t.generatingBuggyCode : t.generatingGame;
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
        <Loader2 size={56} className="text-indigo-600 animate-spin" />
        <p className="text-xl font-semibold text-gray-600 dark:text-gray-300">{loadingMsg}</p>
      </div>
    );
  }

  // ─── GAME OVER ────────────────────────────────────────────────────────────
  if (gameOver) {
    const isBugFix = activeGame === 'bug-fix';

    if (isBugFix && exploded && !worldSaved) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-4"
          style={{ background: 'radial-gradient(circle, #7f1d1d 0%, #111 70%)' }}>
          <div className="animate-explode text-9xl">💥</div>
          <h2 className="text-4xl font-black text-red-400 text-center animate-glitch">{t.missionFailed}</h2>
          <p className="text-gray-300 text-lg text-center max-w-sm">{buggyCode?.narrative}</p>
          <p className="text-red-300 font-bold text-xl">{t.bugsRemaining}: {(buggyCode?.bugs.length ?? 0) - fixedBugs.size}</p>
          <div className="flex gap-4 mt-4 flex-wrap justify-center">
            <button onClick={handlePlayAgain}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black px-8 py-3 rounded-2xl shadow-lg transition-all">
              <RefreshCw size={18} /> {t.playAgain}
            </button>
          </div>
        </div>
      );
    }

    if (isBugFix && worldSaved) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-4"
          style={{ background: 'radial-gradient(circle, #052e16 0%, #0f172a 70%)' }}>
          <div className="animate-world-saved text-8xl">🌍</div>
          <h2 className="text-4xl font-black text-emerald-400 text-center">{t.worldSaved}</h2>
          <p className="text-gray-300 text-lg text-center max-w-sm">{buggyCode?.title}</p>
          <p className="text-emerald-400 font-bold text-2xl">+{score * 15} XP</p>
          <div className="flex gap-4 mt-2 flex-wrap justify-center">
            <button onClick={handlePlayAgain}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-3 rounded-2xl shadow-lg transition-all">
              <RefreshCw size={18} /> {t.playAgain}
            </button>
          </div>
        </div>
      );
    }

    // Standard game over
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 px-4">
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-2xl animate-trophy">
          <Trophy size={56} className="text-white" />
        </div>
        <div className="text-center">
          <h2 className="text-5xl font-black text-gray-900 dark:text-white mb-3">{t.gameOver}</h2>
          <p className="text-2xl text-gray-600 dark:text-gray-400">
            {t.yourScore}: <span className="font-black text-indigo-600 text-4xl">{score}</span>
          </p>
          <p className="text-xl text-emerald-600 dark:text-emerald-400 font-bold mt-2">+{score * 15} XP</p>
        </div>
        <button onClick={handlePlayAgain}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-10 py-4 rounded-2xl shadow-lg transition-all text-lg">
          <RefreshCw size={20} /> {t.playAgain}
        </button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BALLOON POP
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeGame === 'balloon-pop') {
    const currentQ = balloonQuestions[balloonQIdx % Math.max(1, balloonQuestions.length)];
    const timerPct = (balloonTimeLeft / 60) * 100;
    const timerColor = balloonTimeLeft > 30 ? '#22c55e' : balloonTimeLeft > 15 ? '#f59e0b' : '#ef4444';

    return (
      <div className="rounded-3xl mx-2 my-2 overflow-hidden relative select-none"
        style={{ minHeight: '82vh', background: 'linear-gradient(to bottom, #0ea5e9 0%, #38bdf8 30%, #bae6fd 70%, #e0f7fa 100%)' }}>

        {flashCorrect && <div className="absolute inset-0 z-20 pointer-events-none rounded-3xl" style={{ background: 'rgba(34,197,94,0.3)' }} />}
        {flashWrong && <div className="absolute inset-0 z-20 pointer-events-none rounded-3xl" style={{ background: 'rgba(239,68,68,0.3)' }} />}

        {[{t:6,l:5,s:1.2},{t:10,l:55,s:0.9},{t:3,l:30,s:1},{t:14,l:75,s:0.8}].map((c,i) => (
          <div key={i} className="absolute pointer-events-none opacity-70"
            style={{ top: `${c.t}%`, left: `${c.l}%`, transform: `scale(${c.s})` }}>
            <div className="relative">
              <div className="w-16 h-8 bg-white rounded-full" />
              <div className="absolute -top-4 left-3 w-10 h-10 bg-white rounded-full" />
              <div className="absolute -top-2 left-8 w-8 h-8 bg-white rounded-full" />
            </div>
          </div>
        ))}

        <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2">
          <button onClick={() => setActiveGame(null)}
            className="p-2 rounded-xl bg-black/20 hover:bg-black/30 text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <span className="text-white font-black text-lg drop-shadow">{t.wordFlash}</span>
          <div className="flex items-center gap-4">
            <Hearts count={lives} />
            <div className="relative">
              <span className="text-2xl font-black text-white drop-shadow tabular-nums">{score}</span>
              <ScoreFly />
            </div>
          </div>
        </div>

        <div className="mx-4 h-3 bg-black/20 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${timerPct}%`, background: timerColor }} />
        </div>

        <div className="relative z-10 flex justify-center mt-3 mb-2 px-4">
          <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg px-6 py-3 max-w-xs text-center border border-white">
            <p className="text-xs font-bold text-sky-500 uppercase tracking-widest mb-0.5">{balloonTimeLeft}s</p>
            <p className="text-lg font-black text-gray-900 leading-tight">{currentQ?.question ?? '...'}</p>
          </div>
        </div>

        <div className="relative mx-2" style={{ height: '58vh' }}>
          {activeBalloons.map(balloon => {
            const bc = BALLOON_COLORS[balloon.colorIdx];
            const w = Math.round(balloon.height * 0.82);
            return (
              <div
                key={balloon.id}
                onClick={() => handleBalloonClick(balloon.id, balloon.answer)}
                onAnimationEnd={() => !balloon.popped && handleBalloonExit(balloon.id)}
                className={`cursor-pointer ${balloon.shaking ? 'animate-tile-shake' : ''}`}
                style={{
                  position: 'absolute',
                  left: `${balloon.x}%`,
                  bottom: '-150px',
                  animationName: balloon.popped ? 'balloon-pop' : 'balloon-fly-up',
                  animationDuration: balloon.popped ? '0.35s' : `${balloon.duration}s`,
                  animationTimingFunction: 'linear',
                  animationFillMode: 'forwards',
                  zIndex: 5,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div style={{
                  width: `${w}px`,
                  height: `${balloon.height}px`,
                  borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                  background: `radial-gradient(circle at 35% 30%, ${bc.shine}, ${bc.body})`,
                  boxShadow: `0 8px 24px ${bc.body}88`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  <span className="text-white font-black text-xs text-center px-2 leading-tight drop-shadow"
                    style={{ maxWidth: `${w - 12}px`, fontSize: Math.max(10, Math.min(14, w / 7)) }}>
                    {balloon.answer}
                  </span>
                  <div style={{
                    position: 'absolute', top: '12%', left: '20%',
                    width: '28%', height: '35%', borderRadius: '50%',
                    background: bc.shine, opacity: 0.5,
                  }} />
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: bc.body, marginTop: -4 }} />
                <svg width="3" height="30" viewBox="0 0 3 30" style={{ opacity: 0.5 }}>
                  <path d="M1.5 0 Q3 8 1.5 15 Q0 22 1.5 30" stroke="#374151" strokeWidth="1.2" fill="none" />
                </svg>
              </div>
            );
          })}
        </div>

        <div className="mx-3 h-5 rounded-full" style={{ background: 'linear-gradient(to right, #4ade80, #22c55e)' }} />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CAVE RUNNER
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeGame === 'cave-runner') {
    const timerPct = (caveTimeLeft / 45) * 100;
    const timerColor = caveTimeLeft > 20 ? 'from-amber-400 to-yellow-500'
      : caveTimeLeft > 10 ? 'from-orange-500 to-red-500'
      : 'from-red-600 to-rose-700';

    return (
      <div className="rounded-3xl mx-2 my-2 overflow-hidden relative select-none"
        style={{ minHeight: '82vh', background: 'linear-gradient(to bottom, #1c1003 0%, #2d1a06 40%, #3d2210 70%, #6b3a18 100%)' }}>

        {flashCorrect && <div className="absolute inset-0 z-20 pointer-events-none rounded-3xl" style={{ background: 'rgba(34,197,94,0.25)' }} />}
        {flashWrong && <div className="absolute inset-0 z-20 pointer-events-none rounded-3xl" style={{ background: 'rgba(239,68,68,0.25)' }} />}

        <div className="absolute top-0 left-0 right-0 flex justify-around pointer-events-none">
          {[30,50,20,45,35,60,25,40].map((h,i) => (
            <div key={i} style={{
              width: 18 + (i%3)*8, height: h,
              background: 'linear-gradient(to bottom, #4a2c0a, #2d1a06)',
              clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
            }} />
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-between px-4 pt-5 pb-2">
          <button onClick={() => setActiveGame(null)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-black text-lg">{t.mathRush}</span>
          </div>
          <div className="flex items-center gap-4">
            <Hearts count={lives} />
            <div className="relative">
              <span className={`text-2xl font-black tabular-nums ${caveTimeLeft <= 10 ? 'text-red-400 animate-detonate' : 'text-amber-300'}`}>
                {caveTimeLeft}s
              </span>
            </div>
            <div className="relative">
              <span className="text-2xl font-black text-white tabular-nums">{score}</span>
              <ScoreFly />
            </div>
          </div>
        </div>

        <div className="mx-4 h-3 bg-white/10 rounded-full overflow-hidden mb-4">
          <div className={`h-full bg-gradient-to-r ${timerColor} rounded-full transition-all duration-1000`}
            style={{ width: `${timerPct}%` }} />
        </div>

        <p className="text-center text-amber-200/80 text-sm font-bold mb-2">{t.directTheCart}</p>

        <div className="relative mx-4" style={{ height: '55vh' }}>
          <div className="absolute bottom-20 left-0 right-0 h-3 rounded-full"
            style={{ background: 'linear-gradient(to right, #78350f, #d97706, #78350f)' }} />
          {[10,25,40,55,70,85].map((pos,i) => (
            <div key={i} className="absolute bottom-[76px] rounded-sm"
              style={{ left: `${pos}%`, width: 14, height: 10,
                background: '#92400e', transform: 'translateX(-50%)' }} />
          ))}

          {cartActive && (
            <div
              key={cartKey}
              onAnimationEnd={handleCartExit}
              style={{
                position: 'absolute',
                bottom: 22,
                left: '-18%',
                animation: `cart-slide ${cartDuration}s linear forwards`,
                zIndex: 10,
              }}
            >
              <div style={{
                width: 72, height: 48,
                background: 'linear-gradient(to bottom, #d97706, #92400e)',
                borderRadius: '4px 4px 0 0',
                border: '2px solid #78350f',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                position: 'relative',
              }}>
                <span className="text-white font-black text-lg drop-shadow">{cartAnswer}</span>
                <div style={{ position: 'absolute', top: 4, left: 4, width: 6, height: 6, borderRadius: '50%', background: '#78350f' }} />
                <div style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: '#78350f' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, paddingInline: 6 }}>
                {[0,1].map(i => (
                  <div key={i} style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'radial-gradient(circle, #6b7280, #374151)',
                    border: '2px solid #1f2937',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                  }} />
                ))}
              </div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 flex justify-around items-end px-2">
            {caves.map((q, i) => {
              const isFeedbackCave = feedbackCaveIdx === i;
              const isCorrectFeedback = isFeedbackCave && caveFeedback === 'correct';
              const isWrongFeedback = isFeedbackCave && caveFeedback === 'wrong';
              return (
                <div key={i} className="flex flex-col items-center cursor-pointer"
                  onClick={() => handleCaveClick(i)}
                  style={{ width: '28%' }}>
                  <div className={`mb-2 px-3 py-1.5 rounded-xl font-black text-base text-center transition-all ${
                    isCorrectFeedback ? 'bg-emerald-500 text-white scale-110' :
                    isWrongFeedback ? 'bg-red-500 text-white animate-tile-shake' :
                    'bg-amber-400 text-gray-900'
                  }`}
                    style={{ minWidth: 70, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                    {q?.question ?? '?'}
                  </div>
                  <div style={{
                    width: '100%', height: 80,
                    background: 'linear-gradient(to bottom, #0a0a0a, #1a0a00)',
                    borderRadius: '60% 60% 0 0',
                    border: '3px solid #92400e',
                    borderBottom: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                    boxShadow: isCorrectFeedback ? '0 0 20px rgba(52,211,153,0.6)' :
                               isWrongFeedback ? '0 0 20px rgba(239,68,68,0.6)' :
                               'inset 0 -10px 30px rgba(0,0,0,0.8)',
                    transition: 'box-shadow 0.3s',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: isCorrectFeedback ? 'rgba(52,211,153,0.4)' :
                                  isWrongFeedback ? 'rgba(239,68,68,0.4)' :
                                  'rgba(180, 83, 9, 0.3)',
                      filter: 'blur(8px)',
                    }} />
                    <div style={{
                      position: 'absolute', bottom: 12, left: '15%', right: '15%',
                      height: 2, background: '#78350f', borderRadius: 1, opacity: 0.6,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-around mt-1 pointer-events-none">
          {[20,35,15,40,25].map((h,i) => (
            <div key={i} style={{
              width: 14 + (i%3)*6, height: h,
              background: 'linear-gradient(to top, #4a2c0a, #2d1a06)',
              clipPath: 'polygon(0 100%, 100% 100%, 50% 0)',
            }} />
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMORY MATCH
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeGame === 'memory-match') {
    const matchedCount = memoryCards.filter(c => c.isMatched).length / 2;
    const totalPairs = memoryCards.length / 2;
    return (
      <div className="min-h-[80vh] bg-gradient-to-br from-gray-900 via-indigo-950 to-purple-950 rounded-3xl mx-2 my-2 p-5 flex flex-col relative overflow-hidden">
        {flashCorrect && <div className="absolute inset-0 bg-green-400 animate-flash-green rounded-3xl z-10 pointer-events-none" />}
        {flashWrong && <div className="absolute inset-0 bg-red-500 animate-flash-red rounded-3xl z-10 pointer-events-none" />}

        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveGame(null)}
              className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors">
              <ArrowLeft size={18} />
            </button>
            <span className="text-white font-black text-xl">{t.memoryMatch}</span>
          </div>
          <div className="flex items-center gap-5">
            <Hearts count={lives} />
            <div className="relative">
              <span className="text-3xl font-black text-white tabular-nums">{score}</span>
              <ScoreFly />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-3 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: totalPairs > 0 ? `${(matchedCount / totalPairs) * 100}%` : '0%' }} />
          </div>
          <span className="text-white/70 text-sm font-bold">{matchedCount}/{totalPairs}</span>
        </div>

        {memoryCards.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={40} className="text-white/50 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 flex-1">
            {memoryCards.map((card, idx) => (
              <div key={card.id} onClick={() => handleCardFlip(card.id)}
                className="cursor-pointer" style={{ perspective: '800px', height: 80 }}>
                <div style={{
                  position: 'relative', width: '100%', height: '100%',
                  transformStyle: 'preserve-3d',
                  transform: card.isFlipped || card.isMatched ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
                }}>
                  <div style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}
                    className={`rounded-2xl bg-gradient-to-br ${CARD_BACK_COLORS[idx % CARD_BACK_COLORS.length]} flex items-center justify-center shadow-lg border-2 border-white/10`}>
                    <span className="text-3xl font-black text-white/80">?</span>
                  </div>
                  <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0 }}
                    className={`rounded-2xl flex items-center justify-center p-2 text-center border-2 shadow-lg ${
                      card.isMatched
                        ? 'bg-emerald-500 border-emerald-300 shadow-emerald-500/50'
                        : 'bg-white dark:bg-gray-100 border-gray-200'
                    }`}>
                    <span className={`text-xs font-bold leading-tight ${card.isMatched ? 'text-white' : 'text-gray-800'}`}>
                      {card.face}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUG FIX — SAVE THE WORLD
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeGame === 'bug-fix' && buggyCode) {
    const minutes = Math.floor(bugTimeLeft / 60);
    const seconds = bugTimeLeft % 60;
    const timerStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
    const isCritical = bugTimeLeft <= 30;
    const bugsLeft = buggyCode.bugs.length - fixedBugs.size;

    return (
      <div className="rounded-3xl mx-2 my-2 overflow-hidden flex flex-col relative"
        style={{ minHeight: '82vh', background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1b2a 50%, #0a0a1a 100%)' }}>

        {flashCorrect && <div className="absolute inset-0 z-20 pointer-events-none" style={{ background: 'rgba(34,197,94,0.2)' }} />}
        {flashWrong && <div className="absolute inset-0 z-20 pointer-events-none" style={{ background: 'rgba(239,68,68,0.2)' }} />}

        <div className="absolute inset-0 pointer-events-none opacity-10"
          style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.03) 2px, rgba(0,255,0,0.03) 4px)' }} />

        <div className="relative z-10 px-4 pt-4 pb-3 border-b border-red-900/40">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveGame(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className={`text-xs font-bold tracking-widest uppercase ${isCritical ? 'text-red-400 animate-glitch' : 'text-red-500'}`}>
                  {t.systemCompromised}
                </div>
                <div className="text-white font-black text-sm">{buggyCode.title}</div>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <Hearts count={lives} />
              <div className="text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wider">⏱ TIME</div>
                <div className={`text-2xl font-black tabular-nums font-mono ${isCritical ? 'text-red-400 animate-detonate' : 'text-amber-300'}`}>
                  {timerStr}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wider">🐛 BUGS</div>
                <div className="text-2xl font-black text-red-400">{bugsLeft}</div>
              </div>
            </div>
          </div>

          <div className="mt-3 px-3 py-2 rounded-xl border border-red-900/50 bg-red-950/30">
            <p className="text-red-300 text-sm leading-relaxed">{buggyCode.narrative}</p>
          </div>
          <p className="text-green-400/70 text-xs mt-2 text-center">{t.clickBugToFix}</p>
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4"
          style={{ fontFamily: '"Fira Code", "Cascadia Code", monospace' }}>
          {buggyCode.code.map((line, lineIdx) => {
            const bugIdx = buggyCode.bugs.findIndex(b => b.lineIndex === lineIdx);
            const isBug = bugIdx !== -1;
            const isFixed = isBug && fixedBugs.has(bugIdx);
            const isSelected = isBug && selectedBugIdx === bugIdx;

            return (
              <div key={lineIdx}>
                <div
                  onClick={() => isBug && !isFixed && handleBugLineClick(bugIdx)}
                  className={`flex items-start gap-3 px-3 py-1 rounded-lg transition-all ${
                    isFixed ? 'animate-bug-fixed cursor-default' :
                    isBug ? 'cursor-pointer hover:bg-red-950/50' :
                    'cursor-default'
                  }`}
                  style={{
                    background: isFixed ? 'rgba(34,197,94,0.12)' :
                                isSelected ? 'rgba(239,68,68,0.2)' :
                                isBug ? 'rgba(239,68,68,0.1)' :
                                'transparent',
                    border: isFixed ? '1px solid rgba(34,197,94,0.3)' :
                            isSelected ? '1px solid rgba(239,68,68,0.5)' :
                            isBug ? '1px solid rgba(239,68,68,0.2)' :
                            '1px solid transparent',
                    marginBottom: 2,
                  }}
                >
                  <span className="text-gray-600 text-xs select-none w-6 shrink-0 pt-0.5 text-right">
                    {lineIdx + 1}
                  </span>
                  <span className={`text-sm leading-relaxed flex-1 ${
                    isFixed ? 'text-emerald-400' :
                    isSelected ? 'text-red-300' :
                    isBug ? 'text-red-400' :
                    'text-green-300'
                  }`}>
                    {isFixed ? buggyCode.bugs[bugIdx].fixedLine : line || '\u00A0'}
                  </span>
                  {isFixed && <span className="text-emerald-400 text-sm shrink-0">✓</span>}
                  {isBug && !isFixed && <span className="text-red-400 text-xs shrink-0 animate-pulse">⚠</span>}
                </div>

                {isSelected && (
                  <div className={`mx-4 mb-2 p-3 rounded-xl border ${wrongFix ? 'border-red-500 bg-red-950/50' : 'border-amber-500/50 bg-amber-950/30'}`}>
                    <p className="text-amber-300 text-xs mb-2 font-bold">{t.typeCorrectLine}</p>
                    <p className="text-gray-400 text-xs mb-2 italic">Hint: {buggyCode.bugs[bugIdx].hint}</p>
                    <div className="flex gap-2">
                      <input
                        value={userFixInput}
                        onChange={e => setUserFixInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleConfirmFix()}
                        placeholder={line}
                        autoFocus
                        className={`flex-1 bg-black/40 text-green-300 text-sm px-3 py-2 rounded-lg border outline-none font-mono ${
                          wrongFix ? 'border-red-500' : 'border-amber-500/40 focus:border-amber-400'
                        }`}
                      />
                      <button onClick={handleConfirmFix}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-sm rounded-lg transition-colors shrink-0">
                        {t.confirmFix}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="relative z-10 px-4 pb-4 pt-3 border-t border-green-900/40">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              {buggyCode.bugs.map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full transition-all ${
                  fixedBugs.has(i) ? 'bg-emerald-400 shadow-emerald-400/50 shadow-sm' : 'bg-red-600'
                }`} />
              ))}
              <span className="text-gray-400 text-sm ms-2">{fixedBugs.size}/{buggyCode.bugs.length} {t.bugsRemaining.replace('bugs', 'fixed')}</span>
            </div>
            <button
              onClick={() => {
                if (fixedBugs.size === buggyCode.bugs.length) {
                  setWorldSaved(true);
                  handleGameOver();
                }
              }}
              disabled={fixedBugs.size < buggyCode.bugs.length}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl font-black text-sm transition-all ${
                fixedBugs.size === buggyCode.bugs.length
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/50 shadow-lg'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}>
              <Zap size={16} /> {t.submitFix}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PICTURE TAP (K-2)
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeGame === 'picture-tap') {
    const currentQ = ptQuestions[ptQIdx % Math.max(1, ptQuestions.length)];
    const timerPct = (ptTimeLeft / 60) * 100;
    const timerColor = ptTimeLeft > 30 ? '#a78bfa' : ptTimeLeft > 15 ? '#f59e0b' : '#ef4444';

    const TILE_STYLES = [
      { bg: 'linear-gradient(135deg,#f43f5e,#fb7185)', shadow: '#f43f5e' },
      { bg: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', shadow: '#8b5cf6' },
      { bg: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', shadow: '#0ea5e9' },
      { bg: 'linear-gradient(135deg,#10b981,#34d399)', shadow: '#10b981' },
    ];

    return (
      <div className="rounded-3xl mx-2 my-2 overflow-hidden relative select-none"
        style={{ minHeight: '82vh', background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 40%, #7c3aed 100%)' }}>

        {flashCorrect && <div className="absolute inset-0 z-20 pointer-events-none rounded-3xl" style={{ background: 'rgba(34,197,94,0.35)' }} />}
        {flashWrong && <div className="absolute inset-0 z-20 pointer-events-none rounded-3xl" style={{ background: 'rgba(239,68,68,0.35)' }} />}

        {/* Stars decoration */}
        {[{t:8,l:10},{t:15,l:80},{t:5,l:50},{t:20,l:25},{t:12,l:65}].map((s,i) => (
          <div key={i} className="absolute text-white/20 pointer-events-none"
            style={{ top: `${s.t}%`, left: `${s.l}%`, fontSize: 14 + (i%3)*6 }}>★</div>
        ))}

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2">
          <button onClick={() => setActiveGame(null)}
            className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <span className="text-white font-black text-xl drop-shadow">{t.pictureTap}</span>
          <div className="flex items-center gap-4">
            <Hearts count={lives} />
            <div className="relative">
              <span className="text-3xl font-black text-white drop-shadow tabular-nums">{score}</span>
              <ScoreFly />
            </div>
          </div>
        </div>

        {/* Timer bar */}
        <div className="mx-4 h-4 bg-white/20 rounded-full overflow-hidden mb-5">
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${timerPct}%`, background: timerColor, boxShadow: `0 0 10px ${timerColor}88` }} />
        </div>

        {/* Question cloud */}
        <div className="flex justify-center mb-6 px-4">
          <div className="bg-white rounded-3xl shadow-2xl px-8 py-5 text-center max-w-sm w-full border-4 border-purple-200">
            <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-2">{t.tapTheCorrect}</p>
            <p className="text-2xl font-black text-gray-900 leading-tight">{currentQ?.question ?? '...'}</p>
            <p className={`text-sm font-bold mt-2 ${ptTimeLeft <= 15 ? 'text-red-500' : 'text-purple-400'}`}>{ptTimeLeft}s</p>
          </div>
        </div>

        {/* 2×2 picture tiles */}
        <div className="grid grid-cols-2 gap-4 px-6 max-w-sm mx-auto">
          {ptOptions.map((opt, i) => {
            const fb = ptFeedback;
            const isThis = fb?.optIdx === i;
            const isCorrectFb = isThis && fb.correct;
            const isWrongFb = isThis && !fb.correct;
            const style = TILE_STYLES[i % TILE_STYLES.length];
            return (
              <button
                key={`${ptQIdx}-${i}`}
                onClick={() => handlePictureTapAnswer(opt, i)}
                disabled={!!ptFeedback}
                className={`
                  flex flex-col items-center justify-center
                  rounded-3xl transition-all active:scale-90
                  ${isCorrectFb ? 'animate-pic-correct' : ''}
                  ${isWrongFb ? 'animate-tile-shake' : ''}
                  ${!ptFeedback ? 'hover:scale-105' : ''}
                `}
                style={{
                  minHeight: 140,
                  background: isCorrectFb ? 'linear-gradient(135deg,#22c55e,#4ade80)' :
                              isWrongFb   ? 'linear-gradient(135deg,#ef4444,#f87171)' :
                              style.bg,
                  boxShadow: `0 8px 24px ${style.shadow}55, 0 0 0 4px rgba(255,255,255,0.15)`,
                  border: isCorrectFb ? '4px solid #86efac' :
                          isWrongFb   ? '4px solid #fca5a5' :
                          '4px solid rgba(255,255,255,0.2)',
                }}
              >
                <span style={{ fontSize: 64, lineHeight: 1.1, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' }}>
                  {opt}
                </span>
                {isCorrectFb && <span className="text-white font-black text-lg mt-1">✓</span>}
                {isWrongFb   && <span className="text-white font-black text-lg mt-1">✗</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WORD SCRAMBLE (Grades 3-5)
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeGame === 'word-scramble') {
    const currentQ = wsQuestions[wsQIdx % Math.max(1, wsQuestions.length)];
    const wordLength = currentQ?.answer?.length ?? 0;
    const timerPct = (wsTimeLeft / 45) * 100;
    const timerColor = wsTimeLeft > 20 ? '#a78bfa' : wsTimeLeft > 10 ? '#f59e0b' : '#ef4444';

    return (
      <div className="rounded-3xl mx-2 my-2 overflow-hidden flex flex-col relative select-none"
        style={{ minHeight: '82vh', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)' }}>

        {flashCorrect && <div className="absolute inset-0 z-20 pointer-events-none" style={{ background: 'rgba(34,197,94,0.25)' }} />}
        {flashWrong && <div className="absolute inset-0 z-20 pointer-events-none" style={{ background: 'rgba(239,68,68,0.25)' }} />}

        {/* Dot grid decoration */}
        <div className="absolute inset-0 pointer-events-none opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2">
          <button onClick={() => setActiveGame(null)}
            className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <span className="text-white font-black text-xl">{t.wordScramble}</span>
          <div className="flex items-center gap-4">
            <Hearts count={lives} />
            <div className="relative">
              <span className="text-3xl font-black text-white tabular-nums">{score}</span>
              <ScoreFly />
            </div>
          </div>
        </div>

        {/* Timer bar */}
        <div className="mx-4 h-4 bg-white/15 rounded-full overflow-hidden mb-5">
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${timerPct}%`, background: timerColor, boxShadow: `0 0 10px ${timerColor}88` }} />
        </div>

        {/* Clue card */}
        <div className="flex justify-center mb-6 px-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 text-center w-full max-w-md border border-white/20 shadow-lg">
            <p className="text-xs font-black text-violet-300 uppercase tracking-widest mb-2">{t.unscrambleWord}</p>
            <p className="text-xl font-black text-white leading-snug">{currentQ?.question ?? '...'}</p>
            <p className={`text-sm font-bold mt-2 ${wsTimeLeft <= 10 ? 'text-red-400 animate-detonate' : 'text-violet-300'}`}>{wsTimeLeft}s</p>
          </div>
        </div>

        {/* Letter pool */}
        <div className="flex justify-center flex-wrap gap-3 px-6 mb-6 min-h-[4rem]">
          {wsLetterPool.map((tile, i) => {
            const col = LETTER_TILE_COLORS[i % LETTER_TILE_COLORS.length];
            return (
              <button
                key={tile.id}
                onClick={() => handleWsPoolClick(tile.id)}
                className="w-14 h-14 rounded-2xl font-black text-2xl text-white shadow-xl transition-all hover:scale-110 active:scale-90 animate-letter-pop"
                style={{
                  background: col.bg,
                  boxShadow: `0 6px 18px ${col.bg}66`,
                  border: '3px solid rgba(255,255,255,0.25)',
                }}
              >
                {tile.char}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="mx-6 mb-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/20" />
          <span className="text-white/40 text-xs font-bold uppercase tracking-widest">{t.clickLetters}</span>
          <div className="flex-1 h-px bg-white/20" />
        </div>

        {/* Answer slots */}
        <div className="flex justify-center flex-wrap gap-2 px-6 mb-2">
          {Array.from({ length: wordLength }).map((_, i) => {
            const letter = wsAnswer[i];
            const isLast = i === wsLastFilledIdx;
            return (
              <button
                key={i}
                onClick={() => letter && handleWsAnswerClick(letter.id, i)}
                className={`
                  w-14 h-14 rounded-2xl font-black text-2xl transition-all
                  ${letter ? 'hover:scale-95 active:scale-90' : 'cursor-default'}
                  ${isLast ? 'animate-slot-fill' : ''}
                `}
                style={{
                  background: letter
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.75))'
                    : 'rgba(255,255,255,0.08)',
                  border: letter ? '3px solid rgba(255,255,255,0.6)' : '3px dashed rgba(255,255,255,0.25)',
                  color: letter ? '#1e1b4b' : 'rgba(255,255,255,0.2)',
                  boxShadow: letter ? '0 4px 14px rgba(0,0,0,0.25)' : 'none',
                }}
              >
                {letter?.char ?? ''}
              </button>
            );
          })}
        </div>

        {/* Hint */}
        {wsAnswer.length > 0 && (
          <p className="text-center text-violet-300/60 text-xs mt-3">
            Tap a letter in your answer to remove it
          </p>
        )}
      </div>
    );
  }

  return null;
};

export default EducationalGames;
