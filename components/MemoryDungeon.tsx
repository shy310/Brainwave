import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  UserProfile, GradeLevel, Language, Translations, Dungeon, DungeonRoom,
  DungeonRoomType, SkillAttemptEvent, QuestionType, ErrorQuest,
} from '../types';
import { generateDungeon } from '../services/aiService';
import {
  planDungeon, injectSpareOnMiss, roomXp, confidenceFromRun, hintRewardMultiplier,
  buildDungeonSummary, dungeonQuestionTexts, DungeonSkillSeed, DungeonRoomOutcome, HINT_LEVELS,
} from '../services/dungeonEngine';
import { recordAttempt } from '../services/masteryEngine';
import { findQuestCandidates, buildQuest, MAX_ACTIVE_QUESTS } from '../services/questEngine';
import { checkAnswer } from '../services/mathEngine';
import {
  ArrowLeft, Swords, Skull, KeyRound, Search, Lightbulb, Brain, Puzzle,
  CheckCircle, XCircle, ChevronRight, Trophy, Sparkles, TrendingUp, RotateCw,
  Wrench, Castle, Shield, HelpCircle,
} from 'lucide-react';
import Logo from './Logo';
import MathText from './MathText';
import Confetti from './Confetti';

interface Props {
  user: UserProfile;
  grade: GradeLevel;
  language: Language;
  translations: Translations;
  fallbackTopics: DungeonSkillSeed[];
  onSkillEvent: (ev: SkillAttemptEvent) => void;
  onFinish: (xpEarned: number, askedTexts: string[], clearedAll: boolean) => void;
  onStartQuest?: (quest: ErrorQuest) => void;
  onBack: () => void;
}

const MAX_ATTEMPTS = 3;

type CLang = 'en' | 'ru' | 'he' | 'ar';
const clang = (l: string): CLang => (['en', 'ru', 'he', 'ar'].includes(l) ? l as CLang : 'en');

const ROOM_META: Record<DungeonRoomType, { icon: React.ReactNode; label: Record<CLang, string> }> = {
  'recall':            { icon: <KeyRound size={14} />, label: { en: 'Recall', ru: 'Вспомни', he: 'היזכרות', ar: 'استرجاع' } },
  'mc-trap':           { icon: <Shield size={14} />,   label: { en: 'Trap room', ru: 'Комната-ловушка', he: 'חדר מלכודת', ar: 'غرفة الفخ' } },
  'explanation':       { icon: <Brain size={14} />,    label: { en: 'Explain', ru: 'Объясни', he: 'הסבר', ar: 'اشرح' } },
  'matching':          { icon: <Puzzle size={14} />,   label: { en: 'Matching', ru: 'Сопоставь', he: 'התאמה', ar: 'مطابقة' } },
  'mistake-detective': { icon: <Search size={14} />,   label: { en: 'Mistake hunt', ru: 'Найди ошибку', he: 'ציד טעויות', ar: 'صيد الأخطاء' } },
  'mini-boss':         { icon: <Swords size={14} />,   label: { en: 'Mini-boss', ru: 'Мини-босс', he: 'מיני-בוס', ar: 'زعيم صغير' } },
  'final-boss':        { icon: <Skull size={14} />,    label: { en: 'Final boss', ru: 'Финальный босс', he: 'בוס אחרון', ar: 'الزعيم النهائي' } },
};

const COPY: Record<CLang, {
  title: string; tagline: string; why: string; enter: string; leave: string; empty: string;
  building: string; couldNot: string; retry: string;
  roomOf: (a: number, b: number) => string; revisit: string;
  yourAnswer: string; check: string; submit: string; tryAgain: string; next: string; descend: string; faceBoss: string;
  hintBtn: string; hintLevel: (n: number, total: number) => string; hintCost: string;
  cleared: string; notYet: string; missionMisread: string; willReturn: string;
  matchPrompt: string; bossPrompt: string; subOf: (a: number, b: number) => string;
  doneTitle: string; doneBoss: string; roomsCleared: (a: number, b: number) => string;
  flawless: (n: number) => string; strengthened: string; returning: string; returningDesc: string;
  questMade: string; startQuest: string; xpEarned: (n: number) => string; backHome: string;
}> = {
  en: {
    title: 'Memory Dungeon', tagline: 'Descend through rooms of pure recall. No notes, no peeking — pull the answers from memory.',
    why: 'Retrieving answers under a little pressure is how memories get strong. Struggled concepts come back later in new disguises.',
    enter: 'Enter the dungeon', leave: 'Leave', empty: 'Your dungeon is still forming — learn a few topics first, then come back to test them.',
    building: 'Carving the dungeon', couldNot: 'The dungeon collapsed before it formed. Try again.', retry: 'Try again',
    roomOf: (a, b) => `Room ${a} of ${b}`, revisit: 'Returning concept',
    yourAnswer: 'Answer from memory', check: 'Check', submit: 'Submit', tryAgain: 'Try again', next: 'Next room', descend: 'Descend', faceBoss: 'Face the boss',
    hintBtn: 'Reveal a hint', hintLevel: (n, total) => `Hint ${n} of ${total}`, hintCost: 'each hint lowers the reward',
    cleared: 'Room cleared!', notYet: 'Not yet — here\'s a nudge', missionMisread: 'The misconception', willReturn: 'This one returns later in a new form.',
    matchPrompt: 'Match each term to its pair', bossPrompt: 'Answer every part to defeat it', subOf: (a, b) => `Part ${a} of ${b}`,
    doneTitle: 'Dungeon cleared', doneBoss: 'Final boss defeated!', roomsCleared: (a, b) => `${a} of ${b} rooms cleared`,
    flawless: (n) => `${n} flawless (no hints, first try)`, strengthened: 'Skills strengthened', returning: 'Coming back for you', returningDesc: 'These return later in altered forms — spaced repetition at work.',
    questMade: 'A repair quest was forged', startQuest: 'Open quest', xpEarned: (n) => `+${n} XP`, backHome: 'Back to dashboard',
  },
  ru: {
    title: 'Подземелье памяти', tagline: 'Спускайся по комнатам чистого припоминания. Без подсказок и подглядывания — доставай ответы из памяти.',
    why: 'Извлечение ответов под лёгким давлением укрепляет память. Трудные темы вернутся позже в новом обличье.',
    enter: 'Войти в подземелье', leave: 'Выйти', empty: 'Подземелье ещё формируется — сначала изучи несколько тем, потом проверь их здесь.',
    building: 'Высекаем подземелье', couldNot: 'Подземелье обрушилось. Попробуй ещё раз.', retry: 'Ещё раз',
    roomOf: (a, b) => `Комната ${a} из ${b}`, revisit: 'Возвращение темы',
    yourAnswer: 'Ответь по памяти', check: 'Проверить', submit: 'Ответить', tryAgain: 'Ещё раз', next: 'Следующая комната', descend: 'Спуститься', faceBoss: 'К боссу',
    hintBtn: 'Показать подсказку', hintLevel: (n, total) => `Подсказка ${n} из ${total}`, hintCost: 'каждая подсказка снижает награду',
    cleared: 'Комната пройдена!', notYet: 'Пока нет — вот направление', missionMisread: 'Заблуждение', willReturn: 'Эта тема вернётся позже в новом виде.',
    matchPrompt: 'Сопоставь каждый термин с парой', bossPrompt: 'Ответь на все части, чтобы победить', subOf: (a, b) => `Часть ${a} из ${b}`,
    doneTitle: 'Подземелье пройдено', doneBoss: 'Финальный босс повержен!', roomsCleared: (a, b) => `${a} из ${b} комнат пройдено`,
    flawless: (n) => `${n} безупречно (без подсказок, с первого раза)`, strengthened: 'Навыки укреплены', returning: 'Вернём для тебя', returningDesc: 'Эти темы вернутся позже в изменённом виде — интервальное повторение.',
    questMade: 'Выкована миссия-ремонт', startQuest: 'Открыть миссию', xpEarned: (n) => `+${n} XP`, backHome: 'На главную',
  },
  he: {
    title: 'מבוך הזיכרון', tagline: 'רד דרך חדרים של היזכרות טהורה. בלי הערות ובלי הצצה — שלוף את התשובות מהזיכרון.',
    why: 'שליפת תשובות תחת מעט לחץ מחזקת את הזיכרון. מושגים קשים חוזרים בהמשך בתחפושת חדשה.',
    enter: 'להיכנס למבוך', leave: 'לצאת', empty: 'המבוך עדיין נוצר — למד כמה נושאים קודם, ואז חזור לבחון אותם.',
    building: 'חוצבים את המבוך', couldNot: 'המבוך קרס לפני שנוצר. נסה שוב.', retry: 'לנסות שוב',
    roomOf: (a, b) => `חדר ${a} מתוך ${b}`, revisit: 'מושג חוזר',
    yourAnswer: 'ענה מהזיכרון', check: 'בדיקה', submit: 'שלח', tryAgain: 'נסה שוב', next: 'החדר הבא', descend: 'לרדת', faceBoss: 'להתמודד עם הבוס',
    hintBtn: 'חשוף רמז', hintLevel: (n, total) => `רמז ${n} מתוך ${total}`, hintCost: 'כל רמז מקטין את הפרס',
    cleared: 'החדר נוקה!', notYet: 'עדיין לא — הנה כיוון', missionMisread: 'התפיסה השגויה', willReturn: 'זה יחזור בהמשך בצורה חדשה.',
    matchPrompt: 'התאם כל מושג לזוג שלו', bossPrompt: 'ענה על כל חלק כדי לנצח', subOf: (a, b) => `חלק ${a} מתוך ${b}`,
    doneTitle: 'המבוך נוקה', doneBoss: 'הבוס האחרון הובס!', roomsCleared: (a, b) => `${a} מתוך ${b} חדרים נוקו`,
    flawless: (n) => `${n} ללא רבב (בלי רמזים, בניסיון ראשון)`, strengthened: 'מיומנויות שהתחזקו', returning: 'יחזרו עבורך', returningDesc: 'אלה יחזרו בהמשך בצורות שונות — חזרה מרווחת בפעולה.',
    questMade: 'נוצרה משימת תיקון', startQuest: 'לפתוח משימה', xpEarned: (n) => `+${n} XP`, backHome: 'חזרה ללוח',
  },
  ar: {
    title: 'زنزانة الذاكرة', tagline: 'انزل عبر غرف من الاسترجاع الخالص. بلا ملاحظات ولا اختلاس نظر — استخرج الإجابات من ذاكرتك.',
    why: 'استرجاع الإجابات تحت ضغط بسيط يقوّي الذاكرة. المفاهيم الصعبة تعود لاحقاً بأشكال جديدة.',
    enter: 'ادخل الزنزانة', leave: 'خروج', empty: 'زنزانتك لا تزال تتشكل — تعلّم بعض المواضيع أولاً ثم عد لاختبارها.',
    building: 'ننحت الزنزانة', couldNot: 'انهارت الزنزانة قبل أن تتشكل. حاول ثانية.', retry: 'حاول ثانية',
    roomOf: (a, b) => `الغرفة ${a} من ${b}`, revisit: 'مفهوم عائد',
    yourAnswer: 'أجب من الذاكرة', check: 'تحقق', submit: 'إرسال', tryAgain: 'حاول ثانية', next: 'الغرفة التالية', descend: 'انزل', faceBoss: 'واجه الزعيم',
    hintBtn: 'اكشف تلميحاً', hintLevel: (n, total) => `تلميح ${n} من ${total}`, hintCost: 'كل تلميح يقلل المكافأة',
    cleared: 'تم اجتياز الغرفة!', notYet: 'ليس بعد — إليك توجيهاً', missionMisread: 'المفهوم الخاطئ', willReturn: 'سيعود هذا لاحقاً بشكل جديد.',
    matchPrompt: 'طابق كل مصطلح بزوجه', bossPrompt: 'أجب على كل جزء لهزيمته', subOf: (a, b) => `الجزء ${a} من ${b}`,
    doneTitle: 'تم اجتياز الزنزانة', doneBoss: 'هُزم الزعيم النهائي!', roomsCleared: (a, b) => `${a} من ${b} غرف مجتازة`,
    flawless: (n) => `${n} بلا أخطاء (بلا تلميحات، من أول محاولة)`, strengthened: 'مهارات تعززت', returning: 'ستعود لك', returningDesc: 'ستعود هذه لاحقاً بأشكال مختلفة — تكرار متباعد.',
    questMade: 'صُنعت مهمة إصلاح', startQuest: 'افتح المهمة', xpEarned: (n) => `+${n} XP`, backHome: 'إلى اللوحة',
  },
};

const shuffle = <T,>(arr: T[], seed: number): T[] => {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

type Phase = 'intro' | 'loading' | 'playing' | 'summary' | 'error';

const MemoryDungeon: React.FC<Props> = ({
  user, grade, language, translations, fallbackTopics, onSkillEvent, onFinish, onStartQuest, onBack,
}) => {
  const c = COPY[clang(language)];
  const beforeMap = useMemo(() => user.skillMap ?? {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const plan = useMemo(() => planDungeon(beforeMap, fallbackTopics), [beforeMap, fallbackTopics]);

  const [phase, setPhase] = useState<Phase>(plan.length ? 'intro' : 'error');
  const [dungeon, setDungeon] = useState<Dungeon | null>(null);
  const [confetti, setConfetti] = useState(0);

  // Per-room interaction state
  const [hints, setHints] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [resolved, setResolved] = useState<null | 'cleared' | 'revealed'>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [assign, setAssign] = useState<Record<number, number>>({});
  const [subIdx, setSubIdx] = useState(0);
  const [subAnswers, setSubAnswers] = useState<Record<number, number>>({});
  const [lastWrong, setLastWrong] = useState(false);

  const afterMapRef = useRef(beforeMap);
  const outcomesRef = useRef<DungeonRoomOutcome[]>([]);
  const earnedRef = useRef(0);
  const startRef = useRef(Date.now());
  const finishedRef = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  const room: DungeonRoom | undefined = dungeon?.rooms[dungeon.roomIndex];
  const total = dungeon?.rooms.length ?? plan.length;

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    startRef.current = Date.now();
  }, [dungeon?.roomIndex, phase]);

  const begin = async () => {
    setPhase('loading');
    for (let attempt = 0; attempt < 2; attempt++) {
      const { rooms, spares } = await generateDungeon(plan, grade, language, user.dungeonHistory ?? []);
      if (rooms.length) {
        setDungeon({
          id: `dungeon-${Date.now()}`, title: c.title, createdAt: new Date().toISOString(),
          language, rooms, spares, roomIndex: 0, clearedRooms: 0, earnedXp: 0,
        });
        setPhase('playing');
        return;
      }
    }
    setPhase('error');
  };

  const resetRoomState = () => {
    setHints(0); setAttempts(0); setResolved(null); setSelected(null);
    setTyped(''); setAssign({}); setSubIdx(0); setSubAnswers({}); setLastWrong(false);
  };

  const rights = useMemo(
    () => room?.pairs ? shuffle(room.pairs.map(p => p.right), (room.id || '').length + 7) : [],
    [room?.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Answer checking per room type ────────────────────────────────────────────
  const isRoomCorrect = (): boolean => {
    if (!room) return false;
    switch (room.type) {
      case 'recall': {
        const expected = room.answerExpression || room.sampleAnswer || '';
        return checkAnswer(typed, expected, room.acceptableAnswers ?? [], { unitRequired: room.unitRequired }).correct;
      }
      case 'mc-trap': case 'explanation': case 'mistake-detective':
        return selected === room.correctIndex;
      case 'matching':
        return (room.pairs ?? []).every((p, i) => assign[i] !== undefined && rights[assign[i]] === p.right);
      case 'mini-boss': case 'final-boss':
        return (room.subQuestions ?? []).every((s, i) => subAnswers[i] === s.correctIndex);
      default: return false;
    }
  };

  const recordRoom = (cleared: boolean, attemptsNow: number) => {
    if (!room) return;
    const firstTry = attemptsNow <= 1;
    const qType =
      room.type === 'recall' ? (room.answerExpression ? QuestionType.NUMERIC : QuestionType.SHORT_ANSWER)
      : room.type === 'matching' ? QuestionType.MULTI_SELECT
      : (room.type === 'mini-boss' || room.type === 'final-boss') ? QuestionType.MULTI_STEP
      : QuestionType.MULTIPLE_CHOICE;
    const ev: SkillAttemptEvent = {
      skillTag: room.skillTag,
      subject: room.subject,
      topicId: room.topicId ?? null,
      correct: cleared,
      questionType: qType,
      difficulty: room.difficulty,
      timeMs: Math.max(0, Date.now() - startRef.current),
      hintsUsed: hints,
      corrected: cleared && attemptsNow > 1,
      confidence: confidenceFromRun(hints, firstTry),
      mistakeKind: cleared ? undefined : (room.type === 'recall' ? 'recall' : 'concept'),
      explainEvidence: cleared && (room.type === 'recall' || room.type === 'explanation') && hints < HINT_LEVELS - 1,
    };
    onSkillEvent(ev);
    afterMapRef.current = recordAttempt(afterMapRef.current, ev);
    outcomesRef.current.push({ skillTag: room.skillTag, type: room.type, cleared, firstTry, hintsUsed: hints });
    if (cleared) {
      const xp = roomXp(room.xpValue || room.difficulty * 10, hints, attemptsNow);
      earnedRef.current += xp;
    }
  };

  const submit = () => {
    if (!room || resolved) return;
    const correct = isRoomCorrect();
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    if (correct) {
      setLastWrong(false);
      setResolved('cleared');
      recordRoom(true, nextAttempts);
      setConfetti(n => n + 1);
      return;
    }
    setLastWrong(true);
    if (nextAttempts >= MAX_ATTEMPTS) {
      // Out of attempts → reveal misconception, schedule a spaced return.
      setResolved('revealed');
      recordRoom(false, nextAttempts);
      setDungeon(d => d ? injectSpareOnMiss(d, room.skillTag) : d);
    } else {
      // Wrong but tries left → auto-surface the next hint so they're never stuck.
      setHints(h => Math.min(h + 1, HINT_LEVELS));
    }
  };

  const revealHint = () => setHints(h => Math.min(h + 1, HINT_LEVELS));

  const nextRoom = () => {
    if (!dungeon) return;
    if (dungeon.roomIndex + 1 >= dungeon.rooms.length) { finish(); return; }
    setDungeon(d => d ? { ...d, roomIndex: d.roomIndex + 1, clearedRooms: d.clearedRooms + (resolved === 'cleared' ? 1 : 0) } : d);
    resetRoomState();
  };

  const finish = () => {
    if (finishedRef.current || !dungeon) return;
    finishedRef.current = true;
    setConfetti(n => n + 1);
    const asked = dungeonQuestionTexts(dungeon.rooms);
    const clearedAll = outcomesRef.current.every(o => o.cleared);
    onFinish(earnedRef.current, asked, clearedAll);
    setPhase('summary');
  };

  // ── Summary data ─────────────────────────────────────────────────────────────
  const summary = useMemo(
    () => phase === 'summary' ? buildDungeonSummary(outcomesRef.current, earnedRef.current) : null,
    [phase]
  );
  const newQuest = useMemo(() => {
    if (phase !== 'summary') return null;
    const active = (user.activeQuests ?? []).filter(q => !q.completedAt);
    if (active.length >= MAX_ACTIVE_QUESTS) return null;
    const beforeKeys = new Set(findQuestCandidates(beforeMap, active, user.completedQuests ?? []).map(x => `${x.skillTag}::${x.mistakeKind}`));
    const fresh = findQuestCandidates(afterMapRef.current, active, user.completedQuests ?? [])
      .find(x => !beforeKeys.has(`${x.skillTag}::${x.mistakeKind}`));
    return fresh ? buildQuest(fresh, language) : null;
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Intro / error ────────────────────────────────────────────────────────────
  if (phase === 'intro' || (phase === 'error' && !dungeon && plan.length === 0)) {
    const blank = plan.length === 0;
    return (
      <div className="max-w-xl mx-auto px-4 md:px-6 py-10 view-enter" ref={topRef}>
        <div className="paper-card p-7 md:p-9 bg-gradient-to-br from-ink-800 to-ink-900 dark:from-ink-800 dark:to-black border-ink-700 text-center text-white">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-purple-500 to-clay-500 text-white flex items-center justify-center shadow-lg mb-5 animate-pop">
            <Castle size={30} />
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">{c.title}</h1>
          {blank ? (
            <p className="mt-3 text-ink-300">{c.empty}</p>
          ) : (
            <>
              <p className="mt-2 text-ink-300">{c.tagline}</p>
              <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-ink-200 text-start flex gap-3">
                <Sparkles size={18} className="text-purple-300 shrink-0 mt-0.5" />
                <span>{c.why}</span>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 flex-wrap text-xs text-ink-300">
                {plan.map((p, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/10">
                    {ROOM_META[p.type].icon} {ROOM_META[p.type].label[clang(language)]}
                  </span>
                ))}
              </div>
            </>
          )}
          <div className="mt-6 space-y-2.5">
            {!blank && (
              <button onClick={begin} className="w-full py-4 bg-gradient-to-r from-purple-500 to-clay-500 hover:from-purple-600 hover:to-clay-600 text-white rounded-2xl font-semibold shadow-lg transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 min-h-[52px]">
                <Swords size={18} /> {c.enter}
              </button>
            )}
            <button onClick={onBack} className="w-full py-3 text-ink-300 hover:text-white font-semibold transition-colors min-h-[44px]">{c.leave}</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 px-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Logo size={26} showText={false} />
            <span className="text-base font-bold text-ink-500 dark:text-ink-400">{c.building}</span>
          </div>
          <div className="w-full h-2.5 bg-cream-100 dark:bg-ink-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-shimmer animate-progress" />
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="max-w-md mx-auto p-8 text-center space-y-5 view-enter">
        <p className="text-ink-500 dark:text-ink-300 font-semibold">{c.couldNot}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={begin} className="px-5 py-3 bg-purple-500 text-white rounded-xl font-bold inline-flex items-center gap-2 min-h-[48px]"><RotateCw size={16} /> {c.retry}</button>
          <button onClick={onBack} className="px-5 py-3 bg-cream-100 dark:bg-ink-800 rounded-xl font-bold min-h-[48px]">{c.leave}</button>
        </div>
      </div>
    );
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  if (phase === 'summary' && summary) {
    const chips = (items: string[], style: string) => (
      <div className="flex flex-wrap gap-2">{items.map((s, i) => <span key={i} className={`text-sm font-medium px-3 py-1.5 rounded-full capitalize ${style}`}>{s}</span>)}</div>
    );
    const bossWon = outcomesRef.current.some(o => o.type === 'final-boss' && o.cleared);
    return (
      <div className="max-w-xl mx-auto px-4 md:px-6 py-10 view-enter" ref={topRef}>
        <Confetti trigger={confetti} count={110} />
        <div className="text-center mb-7">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-purple-500 to-clay-500 text-white flex items-center justify-center shadow-lg mb-4 animate-pop">
            {bossWon ? <Trophy size={38} /> : <Castle size={38} />}
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink-700 dark:text-ink-100">{bossWon ? c.doneBoss : c.doneTitle}</h1>
          <p className="mt-2 text-ink-400">{c.roomsCleared(summary.roomsCleared, summary.roomsTotal)}</p>
          <div className="mt-3 inline-flex items-center gap-3">
            <span className="px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold text-sm">{c.xpEarned(summary.earnedXp)}</span>
            {summary.flawless > 0 && <span className="px-4 py-2 rounded-full bg-moss-100 dark:bg-moss-light/30 text-moss-700 dark:text-moss-300 font-semibold text-sm">{c.flawless(summary.flawless)}</span>}
          </div>
        </div>

        <div className="space-y-4">
          {summary.strengthened.length > 0 && (
            <div className="paper-card p-5 bg-white dark:bg-ink-800 border-ink-100 dark:border-ink-700">
              <div className="flex items-center gap-2 mb-3 text-moss-600 dark:text-moss-400 font-semibold"><TrendingUp size={18} /> {c.strengthened}</div>
              {chips(summary.strengthened, 'bg-moss-100 text-moss-700 dark:bg-moss-light/30 dark:text-moss-300')}
            </div>
          )}
          {summary.returning.length > 0 && (
            <div className="paper-card p-5 bg-sky-50 dark:bg-sky-900/15 border-sky-100 dark:border-sky-900/30">
              <div className="flex items-center gap-2 mb-2 text-sky-700 dark:text-sky-300 font-semibold"><RotateCw size={18} /> {c.returning}</div>
              <p className="text-sm text-ink-600 dark:text-ink-300 mb-3">{c.returningDesc}</p>
              {chips(summary.returning, 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300')}
            </div>
          )}
          {newQuest && (
            <div className="paper-card p-5 bg-amber-50 dark:bg-amber-900/15 border-amber-100 dark:border-amber-900/30">
              <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-300 font-semibold"><Wrench size={18} /> {c.questMade}</div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{newQuest.badgeReward}</span>
                <div className="flex-1 min-w-0"><div className="font-semibold text-ink-700 dark:text-ink-100 truncate">{newQuest.title}</div><div className="text-xs text-ink-400 capitalize">{newQuest.skillTag}</div></div>
                {onStartQuest && <button onClick={() => onStartQuest(newQuest)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 shrink-0 min-h-[44px]">{c.startQuest} <ChevronRight size={15} className="rtl:rotate-180" /></button>}
              </div>
            </div>
          )}
        </div>

        <button onClick={onBack} className="mt-7 w-full py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-2xl font-semibold shadow-lg transition-all duration-150 active:scale-[0.98] min-h-[52px]">{c.backHome}</button>
      </div>
    );
  }

  // ── Room player ──────────────────────────────────────────────────────────────
  if (!room || !dungeon) return null;
  const isBoss = room.type === 'mini-boss' || room.type === 'final-boss';
  const meta = ROOM_META[room.type];
  const answered = resolved !== null;
  const canSubmit = (() => {
    if (answered) return false;
    switch (room.type) {
      case 'recall': return typed.trim().length > 0;
      case 'matching': return (room.pairs ?? []).every((_, i) => assign[i] !== undefined);
      case 'mini-boss': case 'final-boss': return (room.subQuestions ?? []).every((_, i) => subAnswers[i] !== undefined);
      default: return selected !== null;
    }
  })();
  const revealedHints = room.hints.slice(0, hints);
  const lastRoom = dungeon.roomIndex + 1 >= dungeon.rooms.length;
  const nextIsBoss = dungeon.rooms[dungeon.roomIndex + 1]?.type === 'final-boss';

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8 view-enter" ref={topRef}>
      <Confetti trigger={confetti} count={45} />

      <div className="flex items-center justify-between gap-3 mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 transition-colors min-h-[44px]">
          <ArrowLeft size={16} className="rtl:rotate-180" /><span className="hidden sm:inline">{c.leave}</span>
        </button>
        <span className="text-xs font-bold text-ink-400 tabular-nums">{c.roomOf(dungeon.roomIndex + 1, total)}</span>
      </div>

      {/* Dungeon corridor: room nodes */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
        {dungeon.rooms.map((r, i) => (
          <div key={r.id} className={`flex items-center shrink-0 ${i < dungeon.rooms.length - 1 ? 'flex-1 min-w-[24px]' : ''}`}>
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              i < dungeon.roomIndex ? 'bg-moss-500 text-white' : i === dungeon.roomIndex ? 'bg-purple-500 text-white ring-2 ring-purple-200 dark:ring-purple-900' : 'bg-ink-100 dark:bg-ink-700 text-ink-400'
            }`}>
              {i < dungeon.roomIndex ? <CheckCircle size={14} /> : ROOM_META[r.type].icon}
            </span>
            {i < dungeon.rooms.length - 1 && <span className={`h-0.5 flex-1 ${i < dungeon.roomIndex ? 'bg-moss-400' : 'bg-ink-100 dark:bg-ink-700'}`} />}
          </div>
        ))}
      </div>

      <div key={dungeon.roomIndex} className={`paper-card p-5 md:p-7 border-ink-100 dark:border-ink-700 animate-slide-up ${isBoss ? 'bg-gradient-to-br from-purple-50 to-clay-50 dark:from-purple-900/20 dark:to-clay-900/10' : 'bg-white dark:bg-ink-800'}`}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${isBoss ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'bg-cream-100 dark:bg-ink-700 text-ink-500 dark:text-ink-300'}`}>
            {meta.icon} {meta.label[clang(language)]}
          </span>
          {room.revisit && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 inline-flex items-center gap-1"><RotateCw size={11} /> {c.revisit}</span>}
        </div>
        <h2 className="font-display text-xl md:text-2xl font-semibold text-ink-700 dark:text-ink-100 mb-1">{room.title}</h2>

        {/* ── Content by type ── */}
        {(room.type === 'recall') && (
          <>
            <p className="text-base text-ink-600 dark:text-ink-200 mt-3 mb-4"><MathText>{room.question || ''}</MathText></p>
            <input type="text" inputMode="text" value={typed} disabled={answered}
              onChange={e => setTyped(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && canSubmit) submit(); }}
              placeholder={c.yourAnswer}
              className={`w-full px-4 py-3.5 rounded-xl border-2 text-base font-medium bg-cream-50 dark:bg-ink-900/40 outline-none transition-colors min-h-[52px] ${answered ? (resolved === 'cleared' ? 'border-green-500' : 'border-amber-400') : 'border-ink-200 dark:border-ink-600 focus:border-purple-400'} text-ink-700 dark:text-ink-100`} />
          </>
        )}

        {(room.type === 'mc-trap' || room.type === 'explanation' || room.type === 'mistake-detective') && (
          <>
            <p className="text-base font-medium text-ink-700 dark:text-ink-100 mt-3 mb-4"><MathText>{room.question || ''}</MathText></p>
            <div className="space-y-2.5">
              {(room.options ?? []).map((opt, i) => {
                const isRight = i === room.correctIndex, isChosen = selected === i;
                let style = 'border-ink-200 dark:border-ink-600 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10';
                if (answered) { if (isRight) style = 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'; else if (isChosen) style = 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300'; else style = 'border-ink-100 dark:border-ink-700 opacity-60'; }
                else if (isChosen) style = 'border-purple-500 bg-purple-50 dark:bg-purple-900/15';
                return (
                  <button key={i} onClick={() => !answered && setSelected(i)} disabled={answered}
                    className={`w-full text-start px-4 py-3.5 rounded-xl border-2 font-medium text-sm md:text-base transition-all duration-150 min-h-[48px] flex items-center gap-3 ${style} ${answered ? '' : 'active:scale-[0.99]'}`}>
                    {answered && isRight && <CheckCircle size={18} className="shrink-0 text-green-600 dark:text-green-400" />}
                    {answered && isChosen && !isRight && <XCircle size={18} className="shrink-0 text-red-500" />}
                    <MathText>{opt}</MathText>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {room.type === 'matching' && (
          <>
            <p className="text-sm text-ink-500 dark:text-ink-300 mt-3 mb-4">{c.matchPrompt}</p>
            <div className="space-y-3">
              {(room.pairs ?? []).map((p, li) => (
                <div key={li} className="rounded-xl border border-ink-100 dark:border-ink-700 p-3">
                  <div className="font-semibold text-ink-700 dark:text-ink-100 mb-2 text-sm"><MathText>{p.left}</MathText></div>
                  <div className="flex flex-wrap gap-2">
                    {rights.map((r, ri) => {
                      const chosen = assign[li] === ri;
                      const correct = answered && r === p.right;
                      const wrongPick = answered && chosen && r !== p.right;
                      let style = chosen ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/15 text-purple-700 dark:text-purple-300' : 'border-ink-200 dark:border-ink-600 text-ink-500 dark:text-ink-300';
                      if (correct) style = 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300';
                      else if (wrongPick) style = 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-500';
                      return (
                        <button key={ri} disabled={answered} onClick={() => setAssign(a => ({ ...a, [li]: ri }))}
                          className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all min-h-[40px] ${style}`}>
                          <MathText>{r}</MathText>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {isBoss && (
          <>
            <p className="text-sm text-ink-500 dark:text-ink-300 mt-3 mb-1">{c.bossPrompt}</p>
            <p className="text-xs font-semibold text-purple-500 mb-4">{c.subOf(Math.min(subIdx + 1, (room.subQuestions ?? []).length), (room.subQuestions ?? []).length)}</p>
            {(() => {
              const sq = (room.subQuestions ?? [])[subIdx];
              if (!sq) return null;
              const subDone = subAnswers[subIdx] !== undefined;
              return (
                <div>
                  <p className="text-base font-medium text-ink-700 dark:text-ink-100 mb-3"><MathText>{sq.question}</MathText></p>
                  <div className="space-y-2.5">
                    {sq.options.map((opt, i) => {
                      const isRight = i === sq.correctIndex, isChosen = subAnswers[subIdx] === i;
                      let style = 'border-ink-200 dark:border-ink-600 hover:border-purple-400';
                      if (subDone || answered) { if (isRight) style = 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'; else if (isChosen) style = 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600'; else style = 'border-ink-100 dark:border-ink-700 opacity-60'; }
                      else if (isChosen) style = 'border-purple-500 bg-purple-50 dark:bg-purple-900/15';
                      return (
                        <button key={i} disabled={subDone || answered}
                          onClick={() => { setSubAnswers(a => ({ ...a, [subIdx]: i })); if (subIdx < (room.subQuestions ?? []).length - 1) setTimeout(() => setSubIdx(s => s + 1), 550); }}
                          className={`w-full text-start px-4 py-3 rounded-xl border-2 font-medium text-sm md:text-base transition-all min-h-[44px] flex items-center gap-2 ${style}`}>
                          {(subDone || answered) && isRight && <CheckCircle size={16} className="shrink-0 text-green-600" />}
                          {(subDone || answered) && isChosen && !isRight && <XCircle size={16} className="shrink-0 text-red-500" />}
                          <MathText>{opt}</MathText>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* ── Hints ── */}
        {!answered && (
          <div className="mt-4">
            {revealedHints.length > 0 && (
              <div className="space-y-2 mb-3">
                {revealedHints.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 text-sm text-amber-800 dark:text-amber-200">
                    <Lightbulb size={15} className="shrink-0 mt-0.5 text-amber-500" />
                    <span><span className="font-bold me-1">{c.hintLevel(i + 1, HINT_LEVELS)}:</span><MathText>{h}</MathText></span>
                  </div>
                ))}
              </div>
            )}
            {hints < HINT_LEVELS && (
              <button onClick={revealHint} className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 min-h-[40px]">
                <HelpCircle size={15} /> {c.hintBtn}
                <span className="text-xs font-normal text-ink-400">· {Math.round(hintRewardMultiplier(hints + 1) * 100)}%</span>
              </button>
            )}
          </div>
        )}

        {/* ── Feedback ── */}
        {answered && (
          <div className={`mt-4 p-4 rounded-xl text-sm animate-slide-up ${resolved === 'cleared' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'}`}>
            <p className="font-bold mb-1">{resolved === 'cleared' ? c.cleared : c.missionMisread}</p>
            {room.explanation && <MathText className="leading-relaxed">{room.explanation}</MathText>}
            {resolved === 'revealed' && <p className="mt-2 text-xs font-medium opacity-80">{c.willReturn}</p>}
          </div>
        )}
        {!answered && lastWrong && attempts < MAX_ATTEMPTS && (
          <p className="mt-3 text-sm font-semibold text-amber-600 dark:text-amber-400">{c.notYet}</p>
        )}
      </div>

      {/* ── Action ── */}
      <button
        onClick={answered ? nextRoom : submit}
        disabled={!answered && !canSubmit}
        className="mt-5 w-full py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-2xl font-semibold shadow-lg transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed min-h-[52px]"
      >
        {!answered
          ? (attempts > 0 && lastWrong ? <><RotateCw size={18} /> {c.tryAgain}</> : c.submit)
          : lastRoom
            ? <><Trophy size={18} /> {c.doneTitle}</>
            : nextIsBoss ? <><Skull size={18} /> {c.faceBoss}</> : <>{c.next} <ChevronRight size={20} className="rtl:rotate-180" /></>}
      </button>
    </div>
  );
};

export default MemoryDungeon;
