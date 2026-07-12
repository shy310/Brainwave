import React, { useState, useMemo } from 'react';
import { UserProfile, Course, Topic, Subject, GradeLevel, Translations, TopicProgress, Language, ErrorQuest } from '../types';
import { ICON_MAP, SUBJECTS_DATA, CURRICULUM, getCurriculumCourse } from '../constants';
import {
  ArrowRight, ArrowUpRight, BookOpen, Calculator, FlaskConical, Globe,
  Laptop, TrendingUp, Flame, Sparkles, ChevronDown, ChevronRight, X,
  PlayCircle, Coffee, Pencil, BookMarked, Target, Award, Snowflake, Check,
  Brain, Clock
} from 'lucide-react';
import { DEFAULT_DAILY_GOAL, localDayKey, nextAchievement } from '../services/engagement';

// ─── Daily goal progress ring (SVG) ───────────────────────────────────────────
const DailyGoalRing: React.FC<{ value: number; goal: number; met: boolean }> = ({ value, goal, met }) => {
  const size = 132, stroke = 11, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-ink-100 dark:text-ink-700" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          className={met ? 'text-clay-400' : 'text-moss-500'}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {met ? (
          <>
            <Check size={30} className="text-clay-400" strokeWidth={3} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-clay-400 mt-0.5">{value}</span>
          </>
        ) : (
          <>
            <span className="font-display text-3xl font-semibold text-ink-700 dark:text-ink-100 leading-none count-in">{value}</span>
            <span className="text-xs text-ink-300 dark:text-ink-400 mt-1">/ {goal} XP</span>
          </>
        )}
      </div>
    </div>
  );
};

interface Props {
  user: UserProfile;
  courses: Course[];
  translations: Translations;
  searchQuery?: string;
  language?: Language;
  onSelectCourse: (courseId: string) => void;
  onResumeTopic: (courseId: string, topicId: string) => void;
  onSelectSubjectGrade: (subject: Subject, grade: GradeLevel) => void;
  onSetDailyGoal?: (goal: number) => void;
  onOpenAchievements?: () => void;
  missions?: ErrorQuest[];
  onStartQuest?: (quest: ErrorQuest) => void;
  comebackAvailable?: boolean;
  onStartComeback?: () => void;
}

// ── Personal missions copy (localized) ──────────────────────────────────────
const MISSION_COPY: Record<'en' | 'ru' | 'he' | 'ar', {
  header: string; sub: string; start: string; continueBtn: string;
  minutes: (n: number) => string; reward: string; stagesDone: (a: number, b: number) => string;
}> = {
  en: { header: 'Personal missions', sub: 'Short repair quests built from your own patterns — a few minutes each.', start: 'Start mission', continueBtn: 'Continue', minutes: (n) => `~${n} min`, reward: 'Reward', stagesDone: (a, b) => `${a}/${b} stages` },
  ru: { header: 'Личные миссии', sub: 'Короткие квесты-ремонты по твоим же паттернам — пара минут каждый.', start: 'Начать миссию', continueBtn: 'Продолжить', minutes: (n) => `~${n} мин`, reward: 'Награда', stagesDone: (a, b) => `${a}/${b} этапов` },
  he: { header: 'משימות אישיות', sub: 'מסעות תיקון קצרים שנבנו מהדפוסים שלך — דקות ספורות כל אחד.', start: 'התחל משימה', continueBtn: 'המשך', minutes: (n) => `~${n} דק׳`, reward: 'פרס', stagesDone: (a, b) => `${a}/${b} שלבים` },
  ar: { header: 'مهمات شخصية', sub: 'مهمات إصلاح قصيرة مبنية من أنماطك — دقائق قليلة لكل منها.', start: 'ابدأ المهمة', continueBtn: 'متابعة', minutes: (n) => `~${n} د`, reward: 'مكافأة', stagesDone: (a, b) => `${a}/${b} مراحل` },
};

// ── Two-Minute Comeback banner copy (localized) ──────────────────────────────
const COMEBACK_COPY: Record<'en' | 'ru' | 'he' | 'ar', { title: string; sub: string; cta: string; badge: string }> = {
  en: { title: 'Two-Minute Comeback', sub: 'A quick recall warm-up on things you learned before — it keeps them from slipping.', cta: 'Start', badge: '~2 min' },
  ru: { title: 'Двухминутное возвращение', sub: 'Быстрая разминка по пройденному — чтобы выученное не забылось.', cta: 'Начать', badge: '~2 мин' },
  he: { title: 'קאמבק של שתי דקות', sub: 'חימום היזכרות קצר על מה שלמדת — כדי שלא יישכח.', cta: 'להתחיל', badge: '~2 דק׳' },
  ar: { title: 'عودة في دقيقتين', sub: 'إحماء استذكار سريع لما تعلمته — كي لا يتلاشى.', cta: 'ابدأ', badge: '~دقيقتان' },
};

// ─── Editorial copy translations (the new strings I added) ─────────────────
type LangKey = 'en' | 'ru' | 'he' | 'ar';

const COPY: Record<LangKey, {
  greetingMorning: (n: string) => string;
  greetingDay: (n: string) => string;
  greetingAfternoon: (n: string) => string;
  greetingEvening: (n: string) => string;
  greetingLate: (n: string) => string;
  moodMorning: string;
  moodDay: string;
  moodAfternoon: string;
  moodEvening: string;
  moodLate: string;
  onARoll: string;
  today: string;
  daysStreak: (d: number) => string;
  level: (l: number) => string;
  topicsMastered: string;
  pickUpLeftOff: string;
  thereSuffix: string;
  continueLesson: string;
  freshStart: string;
  nothingOnPlate: string;
  pickSubject: string;
  whatSoundsGood: string;
  todayItalic: string;
  threeWays: string;
  worthCloserLook: string;
  yourSubjectLove: (s: string) => string;
  atMastery: (m: number) => string;
  practiceThis: string;
  warmUpTitle: string;
  warmUpDesc: string;
  quickCheck: string;
  takeQuiz: string;
  quizDesc: string;
  startQuiz: string;
  orJust: string;
  browseItalic: string;
  allSubjects: string;
  startHere: string;
  topicsStarted: (a: number, b: number) => string;
  workingOn: string;
  workingOnItalic: string;
  inProgress: string;
  next: string;
  continueBtn: string;
  reviewBtn: string;
  pickLevel: string;
  pickLevelDesc: string;
  nothingMatches: (q: string) => string;
  quotes: string[];
}> = {
  en: {
    greetingMorning: (n) => `Morning, ${n}`,
    greetingDay: (n) => `Hey, ${n}`,
    greetingAfternoon: (n) => `Afternoon, ${n}`,
    greetingEvening: (n) => `Evening, ${n}`,
    greetingLate: (n) => `Up late, ${n}?`,
    moodMorning: 'Best time of day to learn something new.',
    moodDay: 'Got a few minutes? Let\'s do something useful.',
    moodAfternoon: 'Power through one thing. You\'ll thank yourself later.',
    moodEvening: 'Quiet hours. Good for the deep stuff.',
    moodLate: '15 minutes now beats an hour of cramming tomorrow.',
    onARoll: "You're on a roll today",
    today: 'Today',
    daysStreak: (d) => `${d}-day streak`,
    level: (l) => `Level ${l}`,
    topicsMastered: 'topics mastered',
    pickUpLeftOff: 'Pick up where you left off',
    thereSuffix: '% there',
    continueLesson: 'Continue lesson',
    freshStart: 'Fresh start',
    nothingOnPlate: 'Nothing on your plate yet.',
    pickSubject: 'Pick a subject below and we\'ll start with something easy to warm up.',
    whatSoundsGood: 'What sounds good',
    todayItalic: 'today?',
    threeWays: 'Three ways to spend the next 20 minutes.',
    worthCloserLook: 'Worth a closer look',
    yourSubjectLove: (s) => `Your ${s} could use some love.`,
    atMastery: (m) => `You're at ${m}% mastery — let's nudge that up.`,
    practiceThis: 'Practice this',
    warmUpTitle: 'Try a quick math warm-up',
    warmUpDesc: '5 minutes. Easy questions to get you in the zone.',
    quickCheck: 'Quick check',
    takeQuiz: 'Take a 10-question quiz.',
    quizDesc: 'Mixed difficulty. See what\'s stuck and what isn\'t.',
    startQuiz: 'Start quiz',
    orJust: 'Or just',
    browseItalic: 'browse',
    allSubjects: 'All subjects, your level.',
    startHere: 'Start here',
    topicsStarted: (a, b) => `${a} of ${b} topics started`,
    workingOn: 'What you\'re',
    workingOnItalic: 'working on',
    inProgress: 'All your in-progress courses.',
    next: 'Next:',
    continueBtn: 'Continue',
    reviewBtn: 'Review',
    pickLevel: 'Pick your level.',
    pickLevelDesc: 'So we serve the right difficulty.',
    nothingMatches: (q) => `Nothing matches "${q}".`,
    quotes: [
      'Show up, even when it\'s boring.',
      'Small wins, every day.',
      'You don\'t need motivation — just start.',
      'The hard part is the first 5 minutes.',
      'Future-you will thank you.',
    ],
  },
  ru: {
    greetingMorning: (n) => `Доброе утро, ${n}`,
    greetingDay: (n) => `Привет, ${n}`,
    greetingAfternoon: (n) => `Добрый день, ${n}`,
    greetingEvening: (n) => `Добрый вечер, ${n}`,
    greetingLate: (n) => `Ещё не спишь, ${n}?`,
    moodMorning: 'Лучшее время дня, чтобы узнать что-то новое.',
    moodDay: 'Есть пара минут? Давай сделаем что-нибудь полезное.',
    moodAfternoon: 'Доведи одну задачу до конца. Потом скажешь себе спасибо.',
    moodEvening: 'Тихие часы. Самое то для серьёзных вещей.',
    moodLate: '15 минут сейчас лучше, чем час зубрёжки завтра.',
    onARoll: 'Сегодня ты в ударе',
    today: 'Сегодня',
    daysStreak: (d) => `${d} дней подряд`,
    level: (l) => `Уровень ${l}`,
    topicsMastered: 'тем освоено',
    pickUpLeftOff: 'Продолжи с того места, где остановился',
    thereSuffix: '% освоено',
    continueLesson: 'Продолжить урок',
    freshStart: 'Новый старт',
    nothingOnPlate: 'Пока ничего не запланировано.',
    pickSubject: 'Выбери предмет ниже — начнём с чего-то простого для разогрева.',
    whatSoundsGood: 'Чем займёмся',
    todayItalic: 'сегодня?',
    threeWays: 'Три способа провести следующие 20 минут.',
    worthCloserLook: 'Стоит уделить внимание',
    yourSubjectLove: (s) => `Стоит подтянуть ${s}.`,
    atMastery: (m) => `У тебя ${m}% освоения — давай поднимем.`,
    practiceThis: 'Практиковать',
    warmUpTitle: 'Быстрая разминка по математике',
    warmUpDesc: '5 минут. Лёгкие вопросы, чтобы войти в ритм.',
    quickCheck: 'Быстрая проверка',
    takeQuiz: 'Пройди тест из 10 вопросов.',
    quizDesc: 'Разная сложность. Посмотри, что усвоено, а что нет.',
    startQuiz: 'Начать тест',
    orJust: 'Или просто',
    browseItalic: 'выбери',
    allSubjects: 'Все предметы, твой уровень.',
    startHere: 'Начать здесь',
    topicsStarted: (a, b) => `${a} из ${b} тем начато`,
    workingOn: 'Над чем',
    workingOnItalic: 'работаешь',
    inProgress: 'Все твои текущие курсы.',
    next: 'Дальше:',
    continueBtn: 'Продолжить',
    reviewBtn: 'Повторить',
    pickLevel: 'Выбери свой уровень.',
    pickLevelDesc: 'Чтобы подобрать нужную сложность.',
    nothingMatches: (q) => `Ничего не найдено по запросу «${q}».`,
    quotes: [
      'Приходи, даже когда скучно.',
      'Маленькие победы каждый день.',
      'Не нужна мотивация — просто начни.',
      'Самое сложное — первые 5 минут.',
      'Будущий ты скажет тебе спасибо.',
    ],
  },
  he: {
    greetingMorning: (n) => `בוקר טוב, ${n}`,
    greetingDay: (n) => `היי, ${n}`,
    greetingAfternoon: (n) => `אחר הצהריים טובים, ${n}`,
    greetingEvening: (n) => `ערב טוב, ${n}`,
    greetingLate: (n) => `עוד ער, ${n}?`,
    moodMorning: 'הזמן הכי טוב ביום ללמוד משהו חדש.',
    moodDay: 'יש לך כמה דקות? בוא נעשה משהו שימושי.',
    moodAfternoon: 'תסיים דבר אחד. תודה לעצמך אחר כך.',
    moodEvening: 'שעות שקטות. טוב לדברים העמוקים.',
    moodLate: '15 דקות עכשיו עדיף משעה של דחיסה מחר.',
    onARoll: 'אתה ברצף היום',
    today: 'היום',
    daysStreak: (d) => `${d} ימים ברצף`,
    level: (l) => `שלב ${l}`,
    topicsMastered: 'נושאים שולטו',
    pickUpLeftOff: 'תמשיך מאיפה שעצרת',
    thereSuffix: '% מוכן',
    continueLesson: 'המשך שיעור',
    freshStart: 'התחלה חדשה',
    nothingOnPlate: 'עדיין אין לך כלום על הצלחת.',
    pickSubject: 'בחר מקצוע למטה ונתחיל ממשהו קל.',
    whatSoundsGood: 'מה בא לך',
    todayItalic: 'היום?',
    threeWays: 'שלוש דרכים לבלות את 20 הדקות הבאות.',
    worthCloserLook: 'שווה התעמקות',
    yourSubjectLove: (s) => `${s} שלך זקוק לתשומת לב.`,
    atMastery: (m) => `אתה ב-${m}% שליטה — בוא נעלה את זה.`,
    practiceThis: 'תרגל את זה',
    warmUpTitle: 'חימום מהיר במתמטיקה',
    warmUpDesc: '5 דקות. שאלות קלות להיכנס לקצב.',
    quickCheck: 'בדיקה מהירה',
    takeQuiz: 'עשה חידון של 10 שאלות.',
    quizDesc: 'רמת קושי מעורבת. ראה מה תפס ומה לא.',
    startQuiz: 'התחל חידון',
    orJust: 'או פשוט',
    browseItalic: 'דפדף',
    allSubjects: 'כל המקצועות, ברמה שלך.',
    startHere: 'התחל כאן',
    topicsStarted: (a, b) => `${a} מתוך ${b} נושאים החלו`,
    workingOn: 'על מה אתה',
    workingOnItalic: 'עובד',
    inProgress: 'כל הקורסים הפעילים שלך.',
    next: 'הבא:',
    continueBtn: 'המשך',
    reviewBtn: 'חזור',
    pickLevel: 'בחר את הרמה שלך.',
    pickLevelDesc: 'כדי שנגיש את הקושי הנכון.',
    nothingMatches: (q) => `לא נמצא דבר עבור "${q}".`,
    quotes: [
      'תופיע, גם כשמשעמם.',
      'נצחונות קטנים, כל יום.',
      'אתה לא צריך מוטיבציה — פשוט תתחיל.',
      'הקטע הקשה הוא 5 הדקות הראשונות.',
      'אתה-בעתיד יודה לך.',
    ],
  },
  ar: {
    greetingMorning: (n) => `صباح الخير، ${n}`,
    greetingDay: (n) => `أهلاً، ${n}`,
    greetingAfternoon: (n) => `طاب مساؤك، ${n}`,
    greetingEvening: (n) => `مساء الخير، ${n}`,
    greetingLate: (n) => `لا تزال مستيقظاً، ${n}؟`,
    moodMorning: 'أفضل وقت في اليوم لتعلم شيء جديد.',
    moodDay: 'هل لديك بضع دقائق؟ لنفعل شيئاً مفيداً.',
    moodAfternoon: 'أنجز شيئاً واحداً. ستشكر نفسك لاحقاً.',
    moodEvening: 'ساعات هادئة. مناسبة للأشياء العميقة.',
    moodLate: '15 دقيقة الآن أفضل من ساعة من الحشو غداً.',
    onARoll: 'أنت في انطلاقة اليوم',
    today: 'اليوم',
    daysStreak: (d) => `${d} يوم متواصل`,
    level: (l) => `المستوى ${l}`,
    topicsMastered: 'مواضيع متقنة',
    pickUpLeftOff: 'تابع من حيث توقفت',
    thereSuffix: '٪ منجز',
    continueLesson: 'متابعة الدرس',
    freshStart: 'بداية جديدة',
    nothingOnPlate: 'لا شيء على جدولك بعد.',
    pickSubject: 'اختر مادة أدناه وسنبدأ بشيء سهل للإحماء.',
    whatSoundsGood: 'ما الذي يبدو جيداً',
    todayItalic: 'اليوم؟',
    threeWays: 'ثلاث طرق لقضاء العشرين دقيقة القادمة.',
    worthCloserLook: 'يستحق نظرة أعمق',
    yourSubjectLove: (s) => `تحتاج مادة ${s} لبعض الاهتمام.`,
    atMastery: (m) => `أنت عند ${m}٪ إتقان — لنرفع ذلك.`,
    practiceThis: 'تدرب على هذا',
    warmUpTitle: 'إحماء سريع في الرياضيات',
    warmUpDesc: '5 دقائق. أسئلة سهلة لتدخل في الإيقاع.',
    quickCheck: 'فحص سريع',
    takeQuiz: 'خذ اختباراً من 10 أسئلة.',
    quizDesc: 'صعوبة متنوعة. شاهد ما ترسخ وما لم يترسخ.',
    startQuiz: 'ابدأ الاختبار',
    orJust: 'أو فقط',
    browseItalic: 'تصفح',
    allSubjects: 'جميع المواد، لمستواك.',
    startHere: 'ابدأ هنا',
    topicsStarted: (a, b) => `${a} من ${b} مواضيع بدأت`,
    workingOn: 'ما الذي',
    workingOnItalic: 'تعمل عليه',
    inProgress: 'جميع دوراتك الجارية.',
    next: 'التالي:',
    continueBtn: 'متابعة',
    reviewBtn: 'مراجعة',
    pickLevel: 'اختر مستواك.',
    pickLevelDesc: 'لنقدم لك الصعوبة المناسبة.',
    nothingMatches: (q) => `لا يوجد ما يطابق "${q}".`,
    quotes: [
      'احضر، حتى عندما يكون الأمر مملاً.',
      'انتصارات صغيرة، كل يوم.',
      'لست بحاجة إلى دافع — فقط ابدأ.',
      'الجزء الصعب هو الخمس دقائق الأولى.',
      'سيشكرك "أنت" المستقبلي.',
    ],
  },
};

const LEGACY_GROUPED_GRADES = new Set<GradeLevel>([
  GradeLevel.ELEMENTARY_1_3, GradeLevel.ELEMENTARY_4_6,
  GradeLevel.MIDDLE_7_8, GradeLevel.HIGH_9_10, GradeLevel.HIGH_11_12,
]);

const SUBJECT_CHARACTER: Record<Subject, {
  icon: React.ElementType;
  bg: string; ink: string; bgDark: string; inkDark: string;
  vibeKey: 'logic' | 'science' | 'geography' | 'history' | 'coding' | 'economics';
}> = {
  [Subject.MATH]:      { icon: Calculator,   bg: 'bg-[#EEF1F8]', ink: 'text-[#2D4A7A]', bgDark: 'dark:bg-[#1A2440]', inkDark: 'dark:text-[#A4B8E0]', vibeKey: 'logic' },
  [Subject.SCIENCE]:   { icon: FlaskConical, bg: 'bg-[#EAF2EC]', ink: 'text-[#2D5F3F]', bgDark: 'dark:bg-[#16291E]', inkDark: 'dark:text-[#9CC5A8]', vibeKey: 'science' },
  [Subject.GEOGRAPHY]:  { icon: Globe,        bg: 'bg-[#EAF2F4]', ink: 'text-[#1F5468]', bgDark: 'dark:bg-[#0E2530]', inkDark: 'dark:text-[#9DBED1]', vibeKey: 'geography' },
  [Subject.HISTORY]:   { icon: BookOpen,     bg: 'bg-[#F7EDD9]', ink: 'text-[#8C5A1A]', bgDark: 'dark:bg-[#2A1F0E]', inkDark: 'dark:text-[#D9B57A]', vibeKey: 'history' },
  [Subject.CODING]:    { icon: Laptop,       bg: 'bg-[#E8EFEF]', ink: 'text-[#2A5C5E]', bgDark: 'dark:bg-[#152728]', inkDark: 'dark:text-[#9DC4C5]', vibeKey: 'coding' },
  [Subject.ECONOMICS]: { icon: TrendingUp,   bg: 'bg-[#F7E9E5]', ink: 'text-[#A0492C]', bgDark: 'dark:bg-[#2A1812]', inkDark: 'dark:text-[#E0A38C]', vibeKey: 'economics' },
};

const VIBE_TEXT: Record<LangKey, Record<string, string>> = {
  en: { logic: 'Logic & patterns', science: 'How things work', geography: 'The world around us', history: 'Stories of the past', coding: 'Build with logic', economics: 'Markets & choices' },
  ru: { logic: 'Логика и закономерности', science: 'Как всё устроено', geography: 'Мир вокруг нас', history: 'Истории прошлого', coding: 'Создавай с помощью логики', economics: 'Рынки и решения' },
  he: { logic: 'לוגיקה ודפוסים', science: 'איך דברים עובדים', geography: 'העולם סביבנו', history: 'סיפורי העבר', coding: 'בנה עם לוגיקה', economics: 'שווקים ובחירות' },
  ar: { logic: 'المنطق والأنماط', science: 'كيف تعمل الأشياء', geography: 'العالم من حولنا', history: 'حكايات الماضي', coding: 'بناء بالمنطق', economics: 'الأسواق والخيارات' },
};

function getCopy(language?: Language): typeof COPY['en'] {
  const key = (language && COPY[language as LangKey]) ? (language as LangKey) : 'en';
  return COPY[key];
}

function getGreeting(name: string, language?: Language): { greeting: string; emoji: string; mood: string } {
  const hour = new Date().getHours();
  const firstName = name.split(' ')[0];
  const c = getCopy(language);

  if (hour < 5)  return { greeting: c.greetingLate(firstName),       emoji: '🌙', mood: c.moodLate };
  if (hour < 11) return { greeting: c.greetingMorning(firstName),    emoji: '☕️', mood: c.moodMorning };
  if (hour < 14) return { greeting: c.greetingDay(firstName),        emoji: '👋', mood: c.moodDay };
  if (hour < 18) return { greeting: c.greetingAfternoon(firstName),  emoji: '🌤', mood: c.moodAfternoon };
  if (hour < 22) return { greeting: c.greetingEvening(firstName),    emoji: '🌆', mood: c.moodEvening };
  return         { greeting: c.greetingLate(firstName),              emoji: '🌙', mood: c.moodLate };
}

const Dashboard: React.FC<Props> = ({
  user, courses, translations, searchQuery = '', language,
  onSelectCourse, onResumeTopic, onSelectSubjectGrade, onSetDailyGoal, onOpenAchievements,
  missions = [], onStartQuest, comebackAvailable, onStartComeback
}) => {
  const mc = MISSION_COPY[(MISSION_COPY[language as 'en' | 'ru' | 'he' | 'ar'] ? language : 'en') as 'en' | 'ru' | 'he' | 'ar'];
  const cb = COMEBACK_COPY[(COMEBACK_COPY[language as 'en' | 'ru' | 'he' | 'ar'] ? language : 'en') as 'en' | 'ru' | 'he' | 'ar'];
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [openGradeFolder, setOpenGradeFolder] = useState<string | null>(null);

  const c = getCopy(language);
  const vibes = VIBE_TEXT[(language && VIBE_TEXT[language as LangKey]) ? (language as LangKey) : 'en'];

  const hasSpecificGrade = !LEGACY_GROUPED_GRADES.has(user.gradeLevel);
  const level = Math.floor(user.totalXp / 1000) + 1;

  // ── Daily habit loop ──────────────────────────────────────────────────────
  const todayKey = localDayKey();
  const todayXp = user.lastXpDate === todayKey ? (user.todayXp ?? 0) : 0;
  const dailyGoal = user.dailyXpGoal ?? DEFAULT_DAILY_GOAL;
  const goalMet = todayXp >= dailyGoal;
  const freezes = user.streakFreezes ?? 0;
  const nextAch = useMemo(() => nextAchievement(user), [user]);
  const GOAL_OPTIONS = [20, 30, 50];
  const greeting = getGreeting(user.name, language);

  const handleSubjectClick = (subject: Subject) => {
    if (hasSpecificGrade) onSelectSubjectGrade(subject, user.gradeLevel);
    else setSelectedSubject(subject);
  };

  const gradeFolders = [
    { id: 'kinder',     emoji: '🎒', label: 'Kindergarten',     grades: [GradeLevel.KINDER] },
    { id: 'elementary', emoji: '🏫', label: 'Elementary School', grades: [GradeLevel.GRADE_1, GradeLevel.GRADE_2, GradeLevel.GRADE_3, GradeLevel.GRADE_4, GradeLevel.GRADE_5, GradeLevel.GRADE_6] },
    { id: 'middle',     emoji: '📚', label: 'Middle School',     grades: [GradeLevel.GRADE_7, GradeLevel.GRADE_8, GradeLevel.GRADE_9] },
    { id: 'high',       emoji: '🎓', label: 'High School',       grades: [GradeLevel.GRADE_10, GradeLevel.GRADE_11, GradeLevel.GRADE_12] },
    { id: 'college',    emoji: '🏛', label: 'College',           grades: [GradeLevel.COLLEGE_FRESHMAN, GradeLevel.COLLEGE_ADVANCED] },
  ];

  const getNextTopic = (course: Course): { topic: Topic; unitTitle: string } | null => {
    for (const unit of course.units)
      for (const topic of unit.topics)
        if (!topic.isLocked && topic.mastery < 100) return { topic, unitTitle: unit.title };
    return null;
  };

  const continueLearning = useMemo(() => {
    const pm = user.progressMap || {};
    let best: { course: Course; topic: Topic; unitTitle: string; lastPracticed: string } | null = null;
    for (const course of courses) {
      for (const unit of course.units) {
        for (const topic of unit.topics) {
          const tp = pm[topic.id];
          if (!tp || tp.mastery >= 100) continue;
          if (!best || tp.lastPracticed > best.lastPracticed) {
            best = { course, topic, unitTitle: unit.title, lastPracticed: tp.lastPracticed };
          }
        }
      }
    }
    return best;
  }, [courses, user.progressMap]);

  const activeCourses = useMemo(() => {
    const pm = user.progressMap || {};
    return courses.filter(crs => crs.units.flatMap(u => u.topics.map(t => t.id)).some(id => (pm[id]?.attemptsTotal ?? 0) > 0));
  }, [courses, user.progressMap]);

  const recommendedSubject = useMemo(() => {
    const pm = user.progressMap || {};
    let weakest: { subject: Subject; mastery: number } | null = null;
    for (const subject of Object.values(Subject)) {
      const cc = getCurriculumCourse(subject, user.gradeLevel);
      if (!cc) continue;
      const masteries = cc.units.flatMap(u => u.topics).map(t => pm[t.id]?.mastery ?? 0);
      const attempted = masteries.filter(m => m > 0);
      if (attempted.length === 0) continue;
      const avg = Math.round(attempted.reduce((a, b) => a + b, 0) / attempted.length);
      if (!weakest || avg < weakest.mastery) weakest = { subject, mastery: avg };
    }
    return weakest;
  }, [user.progressMap, user.gradeLevel]);

  const filteredSubjects = searchQuery.trim()
    ? SUBJECTS_DATA.filter(s => translations.subjectsList[s.id].toLowerCase().includes(searchQuery.toLowerCase()))
    : SUBJECTS_DATA;

  const handleGradeSelect = (grade: GradeLevel) => {
    if (selectedSubject) { onSelectSubjectGrade(selectedSubject, grade); setSelectedSubject(null); }
  };

  const totalTopicsDone = (Object.values(user.progressMap || {}) as TopicProgress[]).filter(tp => tp.mastery >= 70).length;
  const studiedToday = user.lastActivityDate ? new Date(user.lastActivityDate).toDateString() === new Date().toDateString() : false;

  // Always-working actions (handle case when user has no progress yet)
  const handlePracticeTop = () => {
    if (recommendedSubject) handleSubjectClick(recommendedSubject.subject);
    else handleSubjectClick(Subject.MATH);
  };
  const handleQuickQuiz = () => {
    if (recommendedSubject) handleSubjectClick(recommendedSubject.subject);
    else handleSubjectClick(Subject.MATH);
  };

  const randomQuote = useMemo(() => c.quotes[Math.floor(Math.random() * c.quotes.length)], [c.quotes]);

  return (
    <div className="px-5 md:px-8 lg:px-12 py-6 md:py-10 max-w-[1280px] mx-auto space-y-12 md:space-y-16">

      {/* ─── Section 1: Editorial greeting ────────────────────────────────── */}
      <header className="fade-in">
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-2xl">{greeting.emoji}</span>
          <span className="text-xs uppercase tracking-[0.2em] font-semibold text-ink-300 dark:text-ink-400">
            {studiedToday ? c.onARoll : c.today}
          </span>
        </div>
        <h1 className="font-display text-[44px] md:text-[64px] leading-[0.95] font-medium text-ink-700 dark:text-ink-100 tracking-tight">
          {greeting.greeting}.
        </h1>
        <p className="mt-3 text-lg md:text-xl text-ink-400 dark:text-ink-400 max-w-2xl leading-relaxed">
          {greeting.mood}
        </p>

      </header>

      {/* ─── Today hero: daily goal ring + streak + next achievement ───────── */}
      <section className="fade-in stagger-1 -mt-6">
        <div className="paper-card p-5 md:p-7 bg-white dark:bg-ink-800 border-ink-100 dark:border-ink-700">
          <div className="flex flex-col sm:flex-row items-center gap-5 md:gap-7">
            <DailyGoalRing value={todayXp} goal={dailyGoal} met={goalMet} />

            <div className="flex-1 w-full min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-xl md:text-2xl font-semibold text-ink-700 dark:text-ink-100 leading-tight">
                    {goalMet ? translations.goalMet : translations.todayProgress}
                  </h3>
                  <p className="text-sm text-ink-400 dark:text-ink-400 mt-0.5">
                    {goalMet ? translations.goalMetDesc : translations.xpToGo(Math.max(0, dailyGoal - todayXp))}
                  </p>
                </div>
                {/* Goal picker */}
                <div className="flex items-center gap-1 shrink-0" title={translations.setGoal}>
                  {GOAL_OPTIONS.map(g => (
                    <button
                      key={g}
                      onClick={() => onSetDailyGoal?.(g)}
                      className={`w-9 h-8 rounded-lg text-xs font-bold transition-colors ${
                        dailyGoal === g
                          ? 'bg-moss-500 text-white'
                          : 'bg-ink-50 dark:bg-ink-700 text-ink-400 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-600'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stat chips */}
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-300 dark:text-ink-400">
                {user.streakDays > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Flame size={14} className="text-clay-400" />
                    <span className="font-semibold text-ink-500 dark:text-ink-300">{c.daysStreak(user.streakDays)}</span>
                    {freezes > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-sky-500" title={translations.freezesLeft(freezes)}>
                        <Snowflake size={12} /> {freezes}
                      </span>
                    )}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-semibold text-ink-500 dark:text-ink-300">{c.level(level)}</span>
                  <span className="text-ink-200 dark:text-ink-400">·</span>
                  <span>{user.totalXp.toLocaleString()} XP</span>
                </span>
                {totalTopicsDone > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Target size={14} className="text-moss-500" />
                    <span className="font-semibold text-ink-500 dark:text-ink-300">{totalTopicsDone}</span>
                    <span>{c.topicsMastered}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Next achievement nudge */}
          {nextAch && (
            <button
              onClick={onOpenAchievements}
              className="mt-5 w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-100 dark:border-amber-900/30 hover:bg-amber-100/70 dark:hover:bg-amber-900/25 transition-colors text-start group"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shrink-0">
                <Award size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">{translations.nextUp}</span>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{Math.round(nextAch.progress * 100)}%</span>
                </div>
                <div className="font-semibold text-ink-700 dark:text-ink-100 truncate">{nextAch.achievement.title[language ?? 'en']}</div>
                <div className="mt-1.5 h-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-700" style={{ width: `${Math.round(nextAch.progress * 100)}%` }} />
                </div>
              </div>
              <ChevronRight size={16} className="text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          )}
        </div>
      </section>

      {/* ─── Two-Minute Comeback (start-of-visit spaced review) ──────────── */}
      {comebackAvailable && onStartComeback && (
        <section className="fade-in stagger-1 -mt-6">
          <button
            onClick={onStartComeback}
            className="w-full text-start paper-card p-5 md:p-6 bg-gradient-to-br from-sky-50 to-moss-50 dark:from-sky-900/20 dark:to-moss-900/10 border-sky-100 dark:border-sky-900/30 hover:shadow-md transition-all duration-200 active:scale-[0.995] group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-moss-500 text-white flex items-center justify-center shadow-moss shrink-0">
                <Brain size={26} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-lg md:text-xl font-semibold text-ink-700 dark:text-ink-100 leading-tight">{cb.title}</h3>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/70 dark:bg-ink-800/70 text-sky-600 dark:text-sky-300">
                    <Clock size={11} /> {cb.badge}
                  </span>
                </div>
                <p className="text-sm text-ink-500 dark:text-ink-300 mt-0.5 line-clamp-2">{cb.sub}</p>
              </div>
              <div className="shrink-0 hidden sm:flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-moss-500 group-hover:bg-moss-600 text-white text-sm font-semibold transition-colors">
                {cb.cta} <ChevronRight size={16} className="rtl:rotate-180" />
              </div>
            </div>
          </button>
        </section>
      )}

      {/* ─── Personal missions (error-repair quests) ─────────────────────── */}
      {missions.length > 0 && onStartQuest && (
        <section className="fade-in stagger-1">
          <div className="mb-4">
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-ink-700 dark:text-ink-100">{mc.header}</h2>
            <p className="text-sm text-ink-400 dark:text-ink-400 mt-1">{mc.sub}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {missions.map(q => {
              const started = (q.stages?.length ?? 0) > 0 && q.stageIndex > 0;
              const totalStages = q.stages?.length || 7;
              return (
                <div key={q.id} className="paper-card p-5 bg-white dark:bg-ink-800 border-ink-100 dark:border-ink-700 flex flex-col">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-moss-50 dark:bg-moss-light/20 flex items-center justify-center text-2xl shrink-0">
                      {q.badgeReward}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-ink-700 dark:text-ink-100 leading-tight break-words">{q.title}</h3>
                      <p className="text-xs text-ink-400 capitalize truncate">{q.skillTag}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-ink-500 dark:text-ink-300 leading-relaxed flex-1">{q.reason}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-semibold text-ink-400">
                    <span className="inline-flex items-center gap-1"><Coffee size={11} />{mc.minutes(q.estimatedMinutes)}</span>
                    <span className="inline-flex items-center gap-0.5" aria-label={`difficulty ${q.difficulty}/5`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < q.difficulty ? 'bg-amber-400' : 'bg-ink-100 dark:bg-ink-700'}`} />
                      ))}
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">{mc.reward}: +{q.xpReward} XP · {q.badgeReward}</span>
                  </div>

                  {started && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-cream-100 dark:bg-ink-700 rounded-full overflow-hidden">
                        <div className="h-full bg-moss-500 rounded-full transition-all duration-500" style={{ width: `${(q.stageIndex / totalStages) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-ink-400 tabular-nums">{mc.stagesDone(q.stageIndex, totalStages)}</span>
                    </div>
                  )}

                  <button
                    onClick={() => onStartQuest(q)}
                    className="mt-4 w-full py-3 bg-moss-500 hover:bg-moss-600 text-white rounded-xl font-semibold text-sm shadow-moss transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 min-h-[46px]"
                  >
                    <PlayCircle size={16} />
                    {started ? mc.continueBtn : mc.start}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Section 2: pick up where you left off ──────────────────────── */}
      {continueLearning ? (
        <section className="fade-in stagger-1">
          <div className="paper-card p-7 md:p-10 relative overflow-hidden bg-moss-50 dark:bg-moss-light border-moss-100 dark:border-moss-light">
            <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-moss-100/40 dark:bg-moss-700/20 pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 dark:bg-ink-700/40 text-moss-600 dark:text-moss-300 text-xs font-semibold uppercase tracking-wider mb-3">
                  <PlayCircle size={11} />
                  {c.pickUpLeftOff}
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-semibold text-ink-700 dark:text-ink-100 mb-1.5 leading-tight">
                  {continueLearning.topic.title}
                </h2>
                <p className="text-sm text-ink-400 dark:text-ink-400">
                  {translations.subjectsList[continueLearning.course.subject]} · {continueLearning.unitTitle}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1 max-w-[200px] h-1.5 bg-white/60 dark:bg-ink-700/40 rounded-full overflow-hidden">
                    <div className="h-full bg-moss-500 rounded-full transition-all duration-700" style={{ width: `${continueLearning.topic.mastery}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-moss-600 dark:text-moss-300">{continueLearning.topic.mastery}{c.thereSuffix}</span>
                </div>
              </div>
              <button
                onClick={() => onResumeTopic(continueLearning.course.id, continueLearning.topic.id)}
                className="btn-moss inline-flex items-center gap-2 self-start md:self-auto whitespace-nowrap"
              >
                {c.continueLesson}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="fade-in stagger-1">
          <div className="paper-card p-7 md:p-10 bg-cream-100 dark:bg-ink-700 border-cream-200 dark:border-ink-600">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 dark:bg-ink-700/40 text-clay-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles size={11} />
              {c.freshStart}
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-ink-700 dark:text-ink-100 mb-2 leading-tight">
              {c.nothingOnPlate}
            </h2>
            <p className="text-base text-ink-400 dark:text-ink-400 mb-5">{c.pickSubject}</p>
          </div>
        </section>
      )}

      {/* ─── Section 3: Quick options ─────────────────────────────────────── */}
      <section className="fade-in stagger-2">
        <h2 className="font-display text-2xl md:text-3xl font-medium text-ink-700 dark:text-ink-100 mb-1">
          {c.whatSoundsGood} <em className="font-display italic text-moss-500">{c.todayItalic}</em>
        </h2>
        <p className="text-ink-400 dark:text-ink-400 text-sm mb-6">{c.threeWays}</p>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-5">
          <button
            onClick={handlePracticeTop}
            className="md:col-span-3 paper-card tactile-card p-7 text-left group min-h-[200px] flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Coffee size={14} className="text-clay-400" />
                <span className="text-xs uppercase tracking-wider font-semibold text-clay-400">{c.worthCloserLook}</span>
              </div>
              <h3 className="font-display text-2xl md:text-[26px] font-semibold text-ink-700 dark:text-ink-100 leading-tight mb-2">
                {recommendedSubject
                  ? c.yourSubjectLove(translations.subjectsList[recommendedSubject.subject])
                  : c.warmUpTitle}
              </h3>
              <p className="text-sm text-ink-400 dark:text-ink-400">
                {recommendedSubject ? c.atMastery(recommendedSubject.mastery) : c.warmUpDesc}
              </p>
            </div>
            <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-moss-500 group-hover:gap-2.5 transition-all">
              {c.practiceThis} <ArrowUpRight size={14} />
            </div>
          </button>

          <button
            onClick={handleQuickQuiz}
            className="md:col-span-3 paper-card tactile-card p-7 text-left group min-h-[200px] flex flex-col justify-between bg-clay-light dark:bg-ink-800 border-clay-100 dark:border-ink-700"
          >
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Pencil size={14} className="text-clay-500" />
                <span className="text-xs uppercase tracking-wider font-semibold text-clay-500">{c.quickCheck}</span>
              </div>
              <h3 className="font-display text-2xl md:text-[26px] font-semibold text-ink-700 dark:text-ink-100 leading-tight mb-2">
                {c.takeQuiz}
              </h3>
              <p className="text-sm text-ink-400 dark:text-ink-400">{c.quizDesc}</p>
            </div>
            <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-clay-500 group-hover:gap-2.5 transition-all">
              {c.startQuiz} <ArrowUpRight size={14} />
            </div>
          </button>
        </div>
      </section>

      {/* ─── Section 4: Subjects ────────────────────────────────────────── */}
      <section className="fade-in stagger-3">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-medium text-ink-700 dark:text-ink-100">
              {c.orJust} <em className="font-display italic text-moss-500">{c.browseItalic}</em>.
            </h2>
            <p className="text-ink-400 dark:text-ink-400 text-sm mt-1">{c.allSubjects}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {filteredSubjects.map((subject) => {
            const Char = SUBJECT_CHARACTER[subject.id as Subject] || SUBJECT_CHARACTER[Subject.MATH];
            const Icon = Char.icon;
            const pm = user.progressMap || {};
            const cc = getCurriculumCourse(subject.id, user.gradeLevel);
            const topicIds = cc?.units.flatMap(u => u.topics.map(t => t.id)) || [];
            const masteries = topicIds.map(id => pm[id]?.mastery ?? 0);
            const avgMastery = masteries.length > 0 ? Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length) : 0;
            const attempted = masteries.filter(m => m > 0).length;

            return (
              <button
                key={subject.id}
                onClick={() => handleSubjectClick(subject.id)}
                className={`paper-card tactile-card p-6 text-left group ${Char.bg} ${Char.bgDark} border-transparent`}
              >
                <div className="flex items-start justify-between mb-5">
                  <div className={`w-11 h-11 rounded-xl bg-white/80 dark:bg-ink-700/30 flex items-center justify-center ${Char.ink} ${Char.inkDark}`}>
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  {avgMastery > 0 && (
                    <span className={`font-display text-2xl font-semibold ${Char.ink} ${Char.inkDark} leading-none`}>
                      {avgMastery}<span className="text-sm opacity-50">%</span>
                    </span>
                  )}
                </div>
                <h3 className="font-display text-xl font-semibold text-ink-700 dark:text-ink-100 mb-1">
                  {translations.subjectsList[subject.id]}
                </h3>
                <p className={`text-xs ${Char.ink} ${Char.inkDark} opacity-80 mb-4`}>
                  {vibes[Char.vibeKey]}
                </p>
                {avgMastery > 0 ? (
                  <div className="space-y-2">
                    <div className="h-1 bg-white/60 dark:bg-ink-700/30 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${Char.ink.replace('text-', 'bg-')}`} style={{ width: `${avgMastery}%` }} />
                    </div>
                    <p className="text-[11px] text-ink-400 dark:text-ink-400">
                      {c.topicsStarted(attempted, topicIds.length)}
                    </p>
                  </div>
                ) : (
                  <div className={`inline-flex items-center gap-1 text-sm font-semibold ${Char.ink} ${Char.inkDark} group-hover:gap-2 transition-all`}>
                    {c.startHere} <ArrowRight size={13} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {filteredSubjects.length === 0 && searchQuery.trim() && (
          <p className="text-center text-ink-300 dark:text-ink-400 py-12 italic font-display">{c.nothingMatches(searchQuery)}</p>
        )}
      </section>

      {/* ─── Section 5: All your active work ──────────────────────────────── */}
      {activeCourses.length > 1 && (
        <section className="fade-in stagger-4">
          <h2 className="font-display text-2xl md:text-3xl font-medium text-ink-700 dark:text-ink-100 mb-1">
            {c.workingOn} <em className="font-display italic text-moss-500">{c.workingOnItalic}</em>.
          </h2>
          <p className="text-ink-400 dark:text-ink-400 text-sm mb-6">{c.inProgress}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {activeCourses.map((course) => {
              const next = getNextTopic(course);
              const Char = SUBJECT_CHARACTER[course.subject as Subject] || SUBJECT_CHARACTER[Subject.MATH];
              const Icon = Char.icon;
              return (
                <div key={course.id} className="paper-card p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-9 h-9 rounded-lg ${Char.bg} ${Char.bgDark} ${Char.ink} ${Char.inkDark} flex items-center justify-center`}>
                      <Icon size={17} strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-ink-700 dark:text-ink-100 text-sm truncate">{course.title}</h3>
                      <p className="text-xs text-ink-300 dark:text-ink-400">{course.progress}%</p>
                    </div>
                  </div>
                  <div className="h-1 bg-ink-100 dark:bg-ink-700 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full ${Char.ink.replace('text-', 'bg-')}`} style={{ width: `${course.progress}%` }} />
                  </div>
                  <p className="text-xs text-ink-400 dark:text-ink-400 line-clamp-1 mb-4">
                    {next ? `${c.next} ${next.topic.title}` : translations.courseCompleted}
                  </p>
                  <button
                    onClick={() => next ? onResumeTopic(course.id, next.topic.id) : onSelectCourse(course.id)}
                    className="text-xs font-semibold text-moss-500 hover:text-moss-600 inline-flex items-center gap-1 group-hover:gap-2 transition-all"
                  >
                    {next ? c.continueBtn : c.reviewBtn} <ArrowRight size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Footer quote ──────────────────────────────────────────────── */}
      <section className="pt-8 pb-16 fade-in stagger-5">
        <div className="text-center max-w-md mx-auto">
          <p className="font-display text-base md:text-lg italic text-ink-300 dark:text-ink-400 leading-relaxed">
            "{randomQuote}"
          </p>
        </div>
      </section>

      {/* ─── Grade picker modal ───────────────────────────────────────── */}
      {selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink-700/40 dark:bg-ink-900/70 backdrop-blur-sm">
          <div className="bg-cream-50 dark:bg-ink-700 rounded-3xl w-full max-w-2xl shadow-lift overflow-hidden border border-ink-100 dark:border-ink-600 animate-pop">
            <div className="p-6 border-b border-ink-100 dark:border-ink-600 flex items-center justify-between">
              <div>
                <h3 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100">{c.pickLevel}</h3>
                <p className="text-sm text-ink-400 dark:text-ink-400 mt-1">{c.pickLevelDesc}</p>
              </div>
              <button onClick={() => setSelectedSubject(null)} className="p-2 rounded-xl hover:bg-cream-100 dark:hover:bg-ink-600 text-ink-400 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2 scrollbar-hide">
              {gradeFolders.map((folder) => {
                const isOpen = openGradeFolder === folder.id;
                return (
                  <div key={folder.id} className="rounded-2xl border border-ink-100 dark:border-ink-600 overflow-hidden">
                    <button
                      onClick={() => setOpenGradeFolder(isOpen ? null : folder.id)}
                      className="w-full flex items-center justify-between px-5 py-3.5 bg-cream-100 dark:bg-ink-600 hover:bg-cream-200 dark:hover:bg-ink-700 transition-colors"
                    >
                      <span className="font-semibold text-sm text-ink-600 dark:text-ink-200">{folder.emoji} {folder.label}</span>
                      <ChevronDown size={16} className={`text-ink-300 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="flex flex-col gap-1 p-3 bg-cream-50 dark:bg-ink-700">
                        {folder.grades.map((grade) => (
                          <button
                            key={grade}
                            onClick={() => handleGradeSelect(grade)}
                            className="w-full text-left px-4 py-2.5 rounded-xl border border-ink-100 dark:border-ink-600 hover:border-moss-400 hover:bg-moss-50 dark:hover:bg-moss-light transition-all flex items-center justify-between group"
                          >
                            <span className="font-medium text-sm text-ink-600 dark:text-ink-200 group-hover:text-moss-600 dark:group-hover:text-moss-300">{translations.grades[grade]}</span>
                            <ChevronRight size={14} className="text-ink-200 group-hover:text-moss-500" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
