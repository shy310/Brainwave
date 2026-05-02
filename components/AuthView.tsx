import React, { useState } from 'react';
import { GradeLevel, Language, UserProfile, Translations } from '../types';
import {
  ArrowRight, AlertCircle, ChevronDown, Moon, Sun, Globe, Check
} from 'lucide-react';

interface UserDbEntry extends UserProfile {
  _passwordHash?: string;
}

interface Props {
  language: Language;
  translations: Translations;
  theme: 'light' | 'dark';
  onLogin: (user: Partial<UserProfile>) => void;
  onThemeToggle: () => void;
  onLanguageChange: (lang: Language) => void;
}

type AuthLangKey = 'en' | 'ru' | 'he' | 'ar';

const AUTH_COPY: Record<AuthLangKey, {
  testimonials: { text: string; who: string }[];
  tagline: string;
  headline1: string;
  headline2: string;
  headlineEm: string;
  subhead: string;
  marks: string[];
  welcomeBack: string;
  letsSetUp: string;
  pickUp: string;
  takesSeconds: string;
  signIn: string;
  signUp: string;
  username: string;
  password: string;
  firstName: string;
  optional: string;
  gradeLabel: string;
  usernamePlaceholder: string;
  namePlaceholder: string;
  letsGo: string;
  createAccount: string;
  lookAround: string;
  errFill: string;
  errMatch: string;
  errTaken: string;
  errBroken: string;
  kinder: string; elementary: string; middle: string; high: string; college: string;
}> = {
  en: {
    testimonials: [
      { text: "Finally, a study app that doesn't feel like homework.", who: 'Maya · 11th grade' },
      { text: 'I actually understand quadratic equations now.', who: 'Daniel · 9th grade' },
      { text: 'The AI tutor explains things how my teacher should.', who: 'Aria · 10th grade' },
    ],
    tagline: 'For students, by people who get it',
    headline1: 'Study like', headline2: 'you actually', headlineEm: 'care',
    subhead: 'An AI tutor that explains things until they click. Quizzes that adapt. Lessons made for the way you actually think.',
    marks: ['K through college', '4 languages', 'No ads, ever'],
    welcomeBack: 'Welcome back.',
    letsSetUp: "Let's get you set up.",
    pickUp: 'Pick up right where you left off.',
    takesSeconds: 'Takes about 30 seconds. No email needed.',
    signIn: 'Sign in', signUp: 'Sign up',
    username: 'Username', password: 'Password',
    firstName: 'Your first name', optional: '(optional)',
    gradeLabel: 'What grade are you in?',
    usernamePlaceholder: "pick anything you'll remember",
    namePlaceholder: 'What should we call you?',
    letsGo: "Let's go", createAccount: 'Create account',
    lookAround: 'or just look around →',
    errFill: 'Hold up — fill in both fields.',
    errMatch: "That doesn't match. Try again?",
    errTaken: 'Username taken. Try a different one.',
    errBroken: 'Something broke. Try again in a sec.',
    kinder: 'Kindergarten', elementary: 'Elementary', middle: 'Middle school', high: 'High school', college: 'College',
  },
  ru: {
    testimonials: [
      { text: 'Наконец-то приложение для учёбы, которое не похоже на домашку.', who: 'Майя · 11 класс' },
      { text: 'Я наконец-то понимаю квадратные уравнения.', who: 'Даниил · 9 класс' },
      { text: 'Этот ИИ-репетитор объясняет так, как должен учитель.', who: 'Ария · 10 класс' },
    ],
    tagline: 'Для учеников, от тех, кто понимает',
    headline1: 'Учись так,', headline2: 'будто тебе и правда', headlineEm: 'не всё равно',
    subhead: 'ИИ-репетитор, который объясняет, пока не дойдёт. Тесты, которые подстраиваются. Уроки под то, как ты на самом деле думаешь.',
    marks: ['От садика до колледжа', '4 языка', 'Никакой рекламы'],
    welcomeBack: 'С возвращением.',
    letsSetUp: 'Давай тебя оформим.',
    pickUp: 'Продолжи с того места, где остановился.',
    takesSeconds: 'Займёт около 30 секунд. Email не нужен.',
    signIn: 'Войти', signUp: 'Регистрация',
    username: 'Имя пользователя', password: 'Пароль',
    firstName: 'Твоё имя', optional: '(не обязательно)',
    gradeLabel: 'В каком ты классе?',
    usernamePlaceholder: 'выбери любое, которое запомнишь',
    namePlaceholder: 'Как тебя называть?',
    letsGo: 'Поехали', createAccount: 'Создать аккаунт',
    lookAround: 'или просто осмотрись →',
    errFill: 'Стоп — заполни оба поля.',
    errMatch: 'Не совпадает. Попробуешь ещё раз?',
    errTaken: 'Имя занято. Выбери другое.',
    errBroken: 'Что-то сломалось. Попробуй через секунду.',
    kinder: 'Детский сад', elementary: 'Начальная школа', middle: 'Средняя школа', high: 'Старшая школа', college: 'Колледж',
  },
  he: {
    testimonials: [
      { text: 'סוף סוף אפליקציה ללימודים שלא מרגישה כמו שיעורי בית.', who: 'מיה · כיתה י״א' },
      { text: 'אני באמת מבין משוואות ריבועיות עכשיו.', who: 'דניאל · כיתה ט׳' },
      { text: 'המורה הדיגיטלי מסביר דברים כמו שהמורה שלי צריך.', who: 'אריה · כיתה י׳' },
    ],
    tagline: 'לתלמידים, מאנשים שמבינים',
    headline1: 'תלמדו כאילו', headline2: 'באמת', headlineEm: 'אכפת לכם',
    subhead: 'מורה AI שמסביר דברים עד שהם נופלים לראש. חידונים שמתאימים את עצמם. שיעורים שעובדים עם איך שאתם באמת חושבים.',
    marks: ['מגן ועד קולג׳', '4 שפות', 'בלי פרסומות, אף פעם'],
    welcomeBack: 'ברוך שובך.',
    letsSetUp: 'בוא נסדר אותך.',
    pickUp: 'תמשיך בדיוק מאיפה שעצרת.',
    takesSeconds: 'לוקח בערך 30 שניות. לא צריך אימייל.',
    signIn: 'התחבר', signUp: 'הרשמה',
    username: 'שם משתמש', password: 'סיסמה',
    firstName: 'השם הפרטי שלך', optional: '(לא חובה)',
    gradeLabel: 'באיזו כיתה אתה?',
    usernamePlaceholder: 'בחר משהו שתזכור',
    namePlaceholder: 'איך לקרוא לך?',
    letsGo: 'יאללה', createAccount: 'יצירת חשבון',
    lookAround: 'או פשוט תסתובב לראות ←',
    errFill: 'רגע — מלא את שני השדות.',
    errMatch: 'לא תואם. ננסה שוב?',
    errTaken: 'שם משתמש תפוס. בחר אחר.',
    errBroken: 'משהו נשבר. נסה שוב בעוד שנייה.',
    kinder: 'גן', elementary: 'יסודי', middle: 'חטיבת ביניים', high: 'תיכון', college: 'קולג׳',
  },
  ar: {
    testimonials: [
      { text: 'أخيراً تطبيق دراسة لا يشعر مثل الواجبات المنزلية.', who: 'مايا · الصف ١١' },
      { text: 'صرت أفهم المعادلات التربيعية فعلاً.', who: 'دانيال · الصف ٩' },
      { text: 'المعلم الذكي يشرح الأشياء كما يجب على معلمي أن يشرحها.', who: 'آريا · الصف ١٠' },
    ],
    tagline: 'للطلاب، من أناس يفهمونهم',
    headline1: 'ادرس كأنك', headline2: 'فعلاً', headlineEm: 'مهتم',
    subhead: 'معلم ذكي يشرح الأشياء حتى تفهمها. اختبارات تتكيف معك. دروس مصممة لطريقة تفكيرك.',
    marks: ['من الروضة إلى الجامعة', '٤ لغات', 'بدون إعلانات أبداً'],
    welcomeBack: 'مرحباً بعودتك.',
    letsSetUp: 'لنجهزك.',
    pickUp: 'تابع من حيث توقفت بالضبط.',
    takesSeconds: 'يستغرق حوالي ٣٠ ثانية. بدون بريد إلكتروني.',
    signIn: 'تسجيل دخول', signUp: 'إنشاء حساب',
    username: 'اسم المستخدم', password: 'كلمة المرور',
    firstName: 'اسمك الأول', optional: '(اختياري)',
    gradeLabel: 'في أي صف أنت؟',
    usernamePlaceholder: 'اختر أي شيء تتذكره',
    namePlaceholder: 'بماذا نناديك؟',
    letsGo: 'هيا بنا', createAccount: 'إنشاء حساب',
    lookAround: 'أو فقط ألق نظرة ←',
    errFill: 'لحظة — املأ الحقلين.',
    errMatch: 'غير متطابق. حاول مرة أخرى؟',
    errTaken: 'اسم المستخدم مأخوذ. جرب آخر.',
    errBroken: 'حدث خطأ. حاول بعد ثانية.',
    kinder: 'الروضة', elementary: 'الابتدائي', middle: 'الإعدادي', high: 'الثانوي', college: 'الجامعة',
  },
};

const AuthView: React.FC<Props> = ({ language, translations, theme, onLogin, onThemeToggle, onLanguageChange }) => {
  const c = AUTH_COPY[(AUTH_COPY[language as AuthLangKey] ? language : 'en') as AuthLangKey];

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<GradeLevel>(GradeLevel.HIGH_9_10);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testimonialIdx] = useState(() => Math.floor(Math.random() * c.testimonials.length));

  const gradeFolders = [
    { id: 'kinder',     emoji: '🎒', label: c.kinder,     grades: [GradeLevel.KINDER] },
    { id: 'elementary', emoji: '🏫', label: c.elementary, grades: [GradeLevel.GRADE_1, GradeLevel.GRADE_2, GradeLevel.GRADE_3, GradeLevel.GRADE_4, GradeLevel.GRADE_5, GradeLevel.GRADE_6] },
    { id: 'middle',     emoji: '📚', label: c.middle,     grades: [GradeLevel.GRADE_7, GradeLevel.GRADE_8, GradeLevel.GRADE_9] },
    { id: 'high',       emoji: '🎓', label: c.high,       grades: [GradeLevel.GRADE_10, GradeLevel.GRADE_11, GradeLevel.GRADE_12] },
    { id: 'college',    emoji: '🏛', label: c.college,    grades: [GradeLevel.COLLEGE_FRESHMAN, GradeLevel.COLLEGE_ADVANCED] },
  ];

  const USERS_DB_KEY = 'brainwave_users_db';

  const hashPassword = async (plain: string): Promise<string> => {
    if (crypto?.subtle) {
      const encoded = new TextEncoder().encode(plain);
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    let hash = 5381;
    for (let i = 0; i < plain.length; i++) {
      hash = ((hash << 5) + hash) ^ plain.charCodeAt(i);
      hash = hash & hash;
    }
    return (hash >>> 0).toString(16).padStart(8, '0') + plain.length.toString(16);
  };

  const handleAuth = async () => {
    setError(null);
    if (!username || !password) {
      setError(c.errFill);
      return;
    }
    setLoading(true);
    try {
      const hashedPassword = await hashPassword(password);
      const usersDb: Record<string, UserDbEntry> = JSON.parse(localStorage.getItem(USERS_DB_KEY) || '{}');

      if (mode === 'login') {
        const entry = Object.values(usersDb).find(
          (u) => u.username === username && u._passwordHash === hashedPassword
        );
        if (entry) {
          const { _passwordHash: _ph, ...safeUser } = entry;
          if (!safeUser.progressMap) safeUser.progressMap = {};
          onLogin(safeUser);
        } else {
          setError(c.errMatch);
        }
      } else {
        const exists = Object.values(usersDb).some((u) => u.username === username);
        if (exists) { setError(c.errTaken); return; }

        const newUser: UserProfile = {
          id: crypto.randomUUID(),
          username,
          name: name || username,
          gradeLevel: grade,
          isRegistered: true,
          preferredLanguage: language,
          enrolledCourses: [],
          totalXp: 0,
          streakDays: 1,
          progressMap: {},
          lastActivityDate: new Date().toISOString()
        };

        const dbEntry: UserDbEntry = { ...newUser, _passwordHash: hashedPassword };
        usersDb[newUser.id] = dbEntry;
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(usersDb));
        onLogin(newUser);
      }
    } catch (err) {
      setError(c.errBroken);
      console.error("Auth error:", err);
    } finally {
      setLoading(false);
    }
  };

  const testimonial = c.testimonials[testimonialIdx];

  return (
    <div className="min-h-screen flex bg-cream-50 dark:bg-ink-900">

      {/* ── Left: editorial brand panel ──────────────────────────────────── */}
      <div className="hidden lg:flex w-[52%] flex-col relative overflow-hidden bg-cream-100 dark:bg-ink-800 border-e border-ink-100/50 dark:border-ink-700">
        {/* Soft decorative shape */}
        <div className="absolute top-[8%] right-[8%] w-72 h-72 rounded-full bg-moss-100/60 dark:bg-moss-light/30 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[15%] left-[5%] w-96 h-96 rounded-full bg-clay-100/40 dark:bg-clay-light/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full p-12 xl:p-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-auto">
            <div className="w-9 h-9 rounded-lg bg-moss-500 flex items-center justify-center">
              <span className="font-display font-bold text-white text-xl leading-none">B</span>
            </div>
            <span className="font-display font-semibold text-xl text-ink-700 dark:text-ink-100 tracking-tight">BrainWave</span>
          </div>

          {/* Headline */}
          <div className="my-auto py-12">
            <p className="text-xs uppercase tracking-[0.2em] text-clay-500 font-semibold mb-5">{c.tagline}</p>
            <h1 className="font-display text-5xl xl:text-6xl 2xl:text-7xl leading-[0.95] font-medium text-ink-700 dark:text-ink-100 tracking-tight mb-6">
              {c.headline1}<br/>
              {c.headline2} <em className="italic text-moss-500">{c.headlineEm}</em>.
            </h1>
            <p className="font-display text-xl text-ink-400 dark:text-ink-400 max-w-md leading-relaxed">
              {c.subhead}
            </p>

            {/* Testimonial */}
            <div className="mt-12 pl-5 border-l-2 border-moss-300 max-w-md">
              <p className="font-display italic text-xl text-ink-600 dark:text-ink-400 leading-snug">
                "{testimonial.text}"
              </p>
              <p className="text-sm text-ink-300 dark:text-ink-400 mt-2">— {testimonial.who}</p>
            </div>
          </div>

          {/* Bottom marks */}
          <div className="flex items-baseline gap-8 text-sm text-ink-400 dark:text-ink-400">
            <span>{c.marks[0]}</span>
            <span className="w-1 h-1 rounded-full bg-ink-200 dark:bg-ink-600" />
            <span>{c.marks[1]}</span>
            <span className="w-1 h-1 rounded-full bg-ink-200 dark:bg-ink-600" />
            <span>{c.marks[2]}</span>
          </div>
        </div>
      </div>

      {/* ── Right: form ───────────────────────────────────────────────────── */}
      <div className="flex-1 lg:w-[48%] flex items-center justify-center p-6 relative">
        {/* Top controls */}
        <div className="absolute top-5 end-5 flex items-center gap-2 z-10">
          <div className="flex items-center gap-1.5 bg-cream-100 dark:bg-ink-800 border border-ink-100 dark:border-ink-700 rounded-lg px-2.5 py-1.5">
            <Globe size={12} className="text-ink-300" />
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as Language)}
              className="bg-transparent border-none text-sm font-medium text-ink-600 dark:text-ink-400 focus:ring-0 cursor-pointer outline-none"
            >
              <option value="en">English</option>
              <option value="ru">Русский</option>
              <option value="he">עברית</option>
              <option value="ar">العربية</option>
            </select>
          </div>
          <button
            onClick={onThemeToggle}
            className="p-2 bg-cream-100 dark:bg-ink-800 border border-ink-100 dark:border-ink-700 rounded-lg text-ink-400 hover:text-ink-700 transition-colors"
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-lg bg-moss-500 flex items-center justify-center">
              <span className="font-display font-bold text-white text-xl leading-none">B</span>
            </div>
            <span className="font-display font-semibold text-xl text-ink-700 dark:text-ink-100 tracking-tight">BrainWave</span>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-3xl md:text-4xl font-medium text-ink-700 dark:text-ink-100 leading-tight mb-2">
              {mode === 'login' ? c.welcomeBack : c.letsSetUp}
            </h2>
            <p className="text-base text-ink-400 dark:text-ink-400">
              {mode === 'login' ? c.pickUp : c.takesSeconds}
            </p>
          </div>

          {/* Mode toggle — minimalist */}
          <div className="inline-flex bg-cream-100 dark:bg-ink-800 rounded-lg p-1 mb-7 border border-ink-100 dark:border-ink-700">
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`px-5 py-1.5 text-sm rounded-md font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-white dark:bg-ink-700 text-ink-700 dark:text-ink-100 shadow-sm'
                  : 'text-ink-400 hover:text-ink-600'
              }`}
            >
              {c.signIn}
            </button>
            <button
              onClick={() => { setMode('register'); setError(null); }}
              className={`px-5 py-1.5 text-sm rounded-md font-semibold transition-all ${
                mode === 'register'
                  ? 'bg-white dark:bg-ink-700 text-ink-700 dark:text-ink-100 shadow-sm'
                  : 'text-ink-400 hover:text-ink-600'
              }`}
            >
              {c.signUp}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-ink-400 dark:text-ink-400 block mb-1.5">{c.username}</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-cream-50 dark:bg-ink-800 border border-ink-100 dark:border-ink-700 rounded-lg text-base outline-none focus:border-moss-400 focus:ring-2 focus:ring-moss-100 dark:focus:ring-moss-light transition-all text-ink-700 dark:text-ink-100 placeholder-ink-300"
                placeholder={c.usernamePlaceholder}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink-400 dark:text-ink-400 block mb-1.5">{c.password}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-cream-50 dark:bg-ink-800 border border-ink-100 dark:border-ink-700 rounded-lg text-base outline-none focus:border-moss-400 focus:ring-2 focus:ring-moss-100 dark:focus:ring-moss-light transition-all text-ink-700 dark:text-ink-100 placeholder-ink-300"
                placeholder="••••••••"
                onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              />
            </div>

            {mode === 'register' && (
              <div className="space-y-4 animate-slide-up">
                <div>
                  <label className="text-xs font-medium text-ink-400 dark:text-ink-400 block mb-1.5">{c.firstName} <span className="text-ink-300 font-normal">{c.optional}</span></label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-cream-50 dark:bg-ink-800 border border-ink-100 dark:border-ink-700 rounded-lg text-base outline-none focus:border-moss-400 focus:ring-2 focus:ring-moss-100 dark:focus:ring-moss-light transition-all text-ink-700 dark:text-ink-100 placeholder-ink-300"
                    placeholder={c.namePlaceholder}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-ink-400 dark:text-ink-400 block mb-1.5">{c.gradeLabel}</label>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-hide">
                    {gradeFolders.map((folder) => {
                      const isOpen = openFolder === folder.id;
                      const hasSelected = folder.grades.includes(grade);
                      return (
                        <div key={folder.id} className={`rounded-lg border overflow-hidden transition-all ${hasSelected ? 'border-moss-300' : 'border-ink-100 dark:border-ink-700'}`}>
                          <button
                            onClick={() => setOpenFolder(isOpen ? null : folder.id)}
                            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium transition-colors ${
                              hasSelected
                                ? 'bg-moss-50 dark:bg-moss-light text-moss-600 dark:text-moss-300'
                                : 'bg-cream-50 dark:bg-ink-800 text-ink-500 dark:text-ink-400 hover:bg-cream-100 dark:hover:bg-ink-700'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{folder.emoji}</span>
                              <span>{folder.label}</span>
                              {hasSelected && <span className="w-1.5 h-1.5 rounded-full bg-moss-500" />}
                            </span>
                            <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {isOpen && (
                            <div className="flex flex-col gap-1 p-2 bg-cream-50 dark:bg-ink-800">
                              {folder.grades.map((g) => (
                                <button
                                  key={g}
                                  onClick={() => setGrade(g)}
                                  className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center justify-between ${
                                    grade === g
                                      ? 'bg-moss-500 text-white'
                                      : 'text-ink-500 dark:text-ink-400 hover:bg-cream-100 dark:hover:bg-ink-700'
                                  }`}
                                >
                                  {translations.grades[g]}
                                  {grade === g && <Check size={12} />}
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

            {error && (
              <div className="bg-clay-light dark:bg-clay-light text-clay-500 text-sm rounded-lg px-4 py-3 flex items-center gap-2 animate-shake">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              onClick={handleAuth}
              disabled={loading}
              className="w-full py-3.5 btn-moss text-base flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white typing-dot" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white typing-dot" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white typing-dot" />
                </span>
              ) : (
                <>
                  {mode === 'login' ? c.letsGo : c.createAccount}
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <button
              onClick={() => onLogin({
                id: `guest-${Date.now()}`,
                username: 'guest',
                name: 'Guest',
                gradeLevel: GradeLevel.HIGH_9_10,
                isRegistered: false,
                preferredLanguage: language,
                enrolledCourses: [],
                totalXp: 0,
                streakDays: 0,
                progressMap: {},
              })}
              className="w-full text-center text-sm text-ink-300 dark:text-ink-400 hover:text-ink-500 dark:hover:text-ink-200 transition-colors font-medium py-2"
            >
              {c.lookAround}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
