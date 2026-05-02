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

const TESTIMONIALS = [
  { text: "Finally, a study app that doesn't feel like homework.", who: 'Maya · 11th grade' },
  { text: "I actually understand quadratic equations now.", who: 'Daniel · 9th grade' },
  { text: "The AI tutor explains things how my teacher should.", who: 'Aria · 10th grade' },
];

const AuthView: React.FC<Props> = ({ language, translations, theme, onLogin, onThemeToggle, onLanguageChange }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<GradeLevel>(GradeLevel.HIGH_9_10);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testimonialIdx, setTestimonialIdx] = useState(() => Math.floor(Math.random() * TESTIMONIALS.length));

  const gradeFolders = [
    { id: 'kinder',     emoji: '🎒', label: 'Kindergarten',      grades: [GradeLevel.KINDER] },
    { id: 'elementary', emoji: '🏫', label: 'Elementary',         grades: [GradeLevel.GRADE_1, GradeLevel.GRADE_2, GradeLevel.GRADE_3, GradeLevel.GRADE_4, GradeLevel.GRADE_5, GradeLevel.GRADE_6] },
    { id: 'middle',     emoji: '📚', label: 'Middle school',      grades: [GradeLevel.GRADE_7, GradeLevel.GRADE_8, GradeLevel.GRADE_9] },
    { id: 'high',       emoji: '🎓', label: 'High school',        grades: [GradeLevel.GRADE_10, GradeLevel.GRADE_11, GradeLevel.GRADE_12] },
    { id: 'college',    emoji: '🏛', label: 'College',            grades: [GradeLevel.COLLEGE_FRESHMAN, GradeLevel.COLLEGE_ADVANCED] },
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
      setError("Hold up — fill in both fields.");
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
          setError("That doesn't match. Try again?");
        }
      } else {
        const exists = Object.values(usersDb).some((u) => u.username === username);
        if (exists) { setError("Username taken. Try a different one."); return; }

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
      setError("Something broke. Try again in a sec.");
      console.error("Auth error:", err);
    } finally {
      setLoading(false);
    }
  };

  const testimonial = TESTIMONIALS[testimonialIdx];

  return (
    <div className="min-h-screen flex bg-cream-50 dark:bg-ink-50">

      {/* ── Left: editorial brand panel ──────────────────────────────────── */}
      <div className="hidden lg:flex w-[52%] flex-col relative overflow-hidden bg-cream-100 dark:bg-ink-100 border-e border-ink-100/50 dark:border-ink-200">
        {/* Soft decorative shape */}
        <div className="absolute top-[8%] right-[8%] w-72 h-72 rounded-full bg-moss-100/60 dark:bg-moss-light/30 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[15%] left-[5%] w-96 h-96 rounded-full bg-clay-100/40 dark:bg-clay-light/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full p-12 xl:p-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-auto">
            <div className="w-9 h-9 rounded-lg bg-moss-500 flex items-center justify-center">
              <span className="font-display font-bold text-white text-xl leading-none">B</span>
            </div>
            <span className="font-display font-semibold text-xl text-ink-700 dark:text-ink-700 tracking-tight">BrainWave</span>
          </div>

          {/* Headline */}
          <div className="my-auto py-12">
            <p className="text-xs uppercase tracking-[0.2em] text-clay-500 font-semibold mb-5">For students, by people who get it</p>
            <h1 className="font-display text-5xl xl:text-6xl 2xl:text-7xl leading-[0.95] font-medium text-ink-700 dark:text-ink-700 tracking-tight mb-6">
              Study like<br/>
              you actually <em className="italic text-moss-500">care</em>.
            </h1>
            <p className="font-display text-xl text-ink-400 dark:text-ink-400 max-w-md leading-relaxed">
              An AI tutor that explains things until they click. Quizzes that adapt. Lessons made for the way you actually think.
            </p>

            {/* Testimonial */}
            <div className="mt-12 pl-5 border-l-2 border-moss-300 max-w-md">
              <p className="font-display italic text-xl text-ink-600 dark:text-ink-600 leading-snug">
                "{testimonial.text}"
              </p>
              <p className="text-sm text-ink-300 dark:text-ink-400 mt-2">— {testimonial.who}</p>
            </div>
          </div>

          {/* Bottom marks */}
          <div className="flex items-baseline gap-8 text-sm text-ink-400 dark:text-ink-400">
            <span>K through college</span>
            <span className="w-1 h-1 rounded-full bg-ink-200 dark:bg-ink-300" />
            <span>4 languages</span>
            <span className="w-1 h-1 rounded-full bg-ink-200 dark:bg-ink-300" />
            <span>No ads, ever</span>
          </div>
        </div>
      </div>

      {/* ── Right: form ───────────────────────────────────────────────────── */}
      <div className="flex-1 lg:w-[48%] flex items-center justify-center p-6 relative">
        {/* Top controls */}
        <div className="absolute top-5 end-5 flex items-center gap-2 z-10">
          <div className="flex items-center gap-1.5 bg-cream-100 dark:bg-ink-100 border border-ink-100 dark:border-ink-200 rounded-lg px-2.5 py-1.5">
            <Globe size={12} className="text-ink-300" />
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as Language)}
              className="bg-transparent border-none text-sm font-medium text-ink-600 dark:text-ink-600 focus:ring-0 cursor-pointer outline-none"
            >
              <option value="en">English</option>
              <option value="ru">Русский</option>
              <option value="he">עברית</option>
              <option value="ar">العربية</option>
            </select>
          </div>
          <button
            onClick={onThemeToggle}
            className="p-2 bg-cream-100 dark:bg-ink-100 border border-ink-100 dark:border-ink-200 rounded-lg text-ink-400 hover:text-ink-700 transition-colors"
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
            <span className="font-display font-semibold text-xl text-ink-700 dark:text-ink-700 tracking-tight">BrainWave</span>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-3xl md:text-4xl font-medium text-ink-700 dark:text-ink-700 leading-tight mb-2">
              {mode === 'login' ? <>Welcome back.</> : <>Let's get you set up.</>}
            </h2>
            <p className="text-base text-ink-400 dark:text-ink-400">
              {mode === 'login' ? 'Pick up right where you left off.' : 'Takes about 30 seconds. No email needed.'}
            </p>
          </div>

          {/* Mode toggle — minimalist */}
          <div className="inline-flex bg-cream-100 dark:bg-ink-100 rounded-lg p-1 mb-7 border border-ink-100 dark:border-ink-200">
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`px-5 py-1.5 text-sm rounded-md font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-white dark:bg-ink-200 text-ink-700 dark:text-ink-700 shadow-sm'
                  : 'text-ink-400 hover:text-ink-600'
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => { setMode('register'); setError(null); }}
              className={`px-5 py-1.5 text-sm rounded-md font-semibold transition-all ${
                mode === 'register'
                  ? 'bg-white dark:bg-ink-200 text-ink-700 dark:text-ink-700 shadow-sm'
                  : 'text-ink-400 hover:text-ink-600'
              }`}
            >
              Sign up
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-ink-400 dark:text-ink-400 block mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-cream-50 dark:bg-ink-100 border border-ink-100 dark:border-ink-200 rounded-lg text-base outline-none focus:border-moss-400 focus:ring-2 focus:ring-moss-100 dark:focus:ring-moss-light transition-all text-ink-700 dark:text-ink-700 placeholder-ink-300"
                placeholder="pick anything you'll remember"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink-400 dark:text-ink-400 block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-cream-50 dark:bg-ink-100 border border-ink-100 dark:border-ink-200 rounded-lg text-base outline-none focus:border-moss-400 focus:ring-2 focus:ring-moss-100 dark:focus:ring-moss-light transition-all text-ink-700 dark:text-ink-700 placeholder-ink-300"
                placeholder="••••••••"
                onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              />
            </div>

            {mode === 'register' && (
              <div className="space-y-4 animate-slide-up">
                <div>
                  <label className="text-xs font-medium text-ink-400 dark:text-ink-400 block mb-1.5">Your first name <span className="text-ink-300 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-cream-50 dark:bg-ink-100 border border-ink-100 dark:border-ink-200 rounded-lg text-base outline-none focus:border-moss-400 focus:ring-2 focus:ring-moss-100 dark:focus:ring-moss-light transition-all text-ink-700 dark:text-ink-700 placeholder-ink-300"
                    placeholder="What should we call you?"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-ink-400 dark:text-ink-400 block mb-1.5">What grade are you in?</label>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-hide">
                    {gradeFolders.map((folder) => {
                      const isOpen = openFolder === folder.id;
                      const hasSelected = folder.grades.includes(grade);
                      return (
                        <div key={folder.id} className={`rounded-lg border overflow-hidden transition-all ${hasSelected ? 'border-moss-300' : 'border-ink-100 dark:border-ink-200'}`}>
                          <button
                            onClick={() => setOpenFolder(isOpen ? null : folder.id)}
                            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium transition-colors ${
                              hasSelected
                                ? 'bg-moss-50 dark:bg-moss-light text-moss-600 dark:text-moss-300'
                                : 'bg-cream-50 dark:bg-ink-100 text-ink-500 dark:text-ink-500 hover:bg-cream-100 dark:hover:bg-ink-200'
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
                            <div className="flex flex-col gap-1 p-2 bg-cream-50 dark:bg-ink-100">
                              {folder.grades.map((g) => (
                                <button
                                  key={g}
                                  onClick={() => setGrade(g)}
                                  className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center justify-between ${
                                    grade === g
                                      ? 'bg-moss-500 text-white'
                                      : 'text-ink-500 dark:text-ink-500 hover:bg-cream-100 dark:hover:bg-ink-200'
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
                  {mode === 'login' ? "Let's go" : 'Create account'}
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
              className="w-full text-center text-sm text-ink-300 dark:text-ink-400 hover:text-ink-500 dark:hover:text-ink-600 transition-colors font-medium py-2"
            >
              or just look around →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
