import React, { useState } from 'react';
import { GradeLevel, Language, UserProfile, Translations } from '../types';
import {
  ArrowRight, User, Lock, AlignLeft, AlertCircle, ChevronDown,
  Moon, Sun, Globe, Check, Zap, Brain, FileText, Gamepad2,
  BookOpen, BarChart2, Sparkles
} from 'lucide-react';
import Logo from './Logo';

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

const FEATURES = [
  { icon: Brain, label: 'AI-Powered Tutoring', desc: 'Personalized lessons that adapt to your level', color: 'text-blue-400' },
  { icon: FileText, label: 'Smart Notes', desc: 'Generate rich notes from YouTube, text, or any topic', color: 'text-violet-400' },
  { icon: Gamepad2, label: 'Educational Games', desc: 'Learn through fun, interactive challenges', color: 'text-emerald-400' },
  { icon: BarChart2, label: 'Progress Tracking', desc: 'Visualize mastery across all subjects', color: 'text-amber-400' },
  { icon: Zap, label: 'Math Solver & Graphs', desc: 'Step-by-step solutions with graph generation', color: 'text-rose-400' },
  { icon: BookOpen, label: 'Curriculum-Aligned', desc: 'Content for Kindergarten through College', color: 'text-cyan-400' },
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

  const gradeFolders = [
    { id: 'kinder',     emoji: '🎒', label: 'Kindergarten',    grades: [GradeLevel.KINDER] },
    { id: 'elementary', emoji: '🏫', label: 'Elementary School', grades: [GradeLevel.GRADE_1, GradeLevel.GRADE_2, GradeLevel.GRADE_3, GradeLevel.GRADE_4, GradeLevel.GRADE_5, GradeLevel.GRADE_6] },
    { id: 'middle',     emoji: '📚', label: 'Middle School',    grades: [GradeLevel.GRADE_7, GradeLevel.GRADE_8, GradeLevel.GRADE_9] },
    { id: 'high',       emoji: '🎓', label: 'High School',      grades: [GradeLevel.GRADE_10, GradeLevel.GRADE_11, GradeLevel.GRADE_12] },
    { id: 'college',    emoji: '🏛', label: 'College',          grades: [GradeLevel.COLLEGE_FRESHMAN, GradeLevel.COLLEGE_ADVANCED] },
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
      setError("Please fill in all fields");
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
          setError(translations.authError);
        }
      } else {
        const exists = Object.values(usersDb).some((u) => u.username === username);
        if (exists) { setError(translations.userExists); return; }

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
      setError("Something went wrong. Please try again.");
      console.error("Auth error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">

      {/* ── Left panel — features showcase ────────────────────────────────── */}
      <div className="hidden lg:flex w-[55%] flex-col bg-gradient-to-br from-gray-950 via-brand-950 to-gray-900 relative overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/2 -right-20 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute -bottom-20 left-1/3 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-5">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="dotgrid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.5" fill="white"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dotgrid)"/>
            </svg>
          </div>
        </div>

        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-lg">
              <Sparkles size={20} className="text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">BrainWave</span>
          </div>

          {/* Hero text */}
          <div className="mb-10">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Learn Smarter with
              <span className="block bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent">
                AI at your side
              </span>
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed">
              Personalized tutoring, AI-generated notes, interactive games, and math solver — all in one platform.
            </p>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-2 gap-4 mb-auto">
            {FEATURES.map(({ icon: Icon, label, desc, color }) => (
              <div key={label} className="flex items-start gap-3 group">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-colors">
                  <Icon size={17} className={color} />
                </div>
                <div>
                  <div className="text-white text-sm font-semibold leading-tight mb-0.5">{label}</div>
                  <div className="text-gray-500 text-xs leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom stat strip */}
          <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-6">
            {[
              { value: '5M+', label: 'Students' },
              { value: '50+', label: 'Subjects' },
              { value: '∞', label: 'AI Lessons' },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — auth form ───────────────────────────────────────── */}
      <div className="flex-1 lg:w-[45%] flex items-center justify-center p-6 relative">
        {/* Top controls */}
        <div className="absolute top-5 end-5 flex items-center gap-2 z-10">
          <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2 shadow-sm">
            <Globe size={13} className="text-gray-400" />
            <select
              value={language}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onLanguageChange(e.target.value as Language)}
              className="bg-transparent border-none text-sm font-semibold text-gray-700 dark:text-gray-200 focus:ring-0 cursor-pointer"
            >
              <option value="en">English</option>
              <option value="ru">Русский</option>
              <option value="he">עברית</option>
              <option value="ar">العربية</option>
            </select>
          </div>
          <button
            onClick={onThemeToggle}
            className="p-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-gray-500 dark:text-gray-300 hover:text-brand-600 transition-all shadow-sm"
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </div>

        {/* Form card */}
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-white">BrainWave</span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {mode === 'login' ? 'Sign in to continue your learning journey' : 'Join millions of students using BrainWave'}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-2 text-sm rounded-lg font-semibold transition-all duration-150 ${
                mode === 'login'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {translations.signIn}
            </button>
            <button
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 py-2 text-sm rounded-lg font-semibold transition-all duration-150 ${
                mode === 'register'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {translations.register}
            </button>
          </div>

          <div className="space-y-4">
            {/* Username */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{translations.username}</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-gray-900 dark:text-white placeholder-gray-400"
                  placeholder="your_username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{translations.password}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-gray-900 dark:text-white placeholder-gray-400"
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                />
              </div>
            </div>

            {/* Register extras */}
            {mode === 'register' && (
              <div className="space-y-4 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{translations.name} (optional)</label>
                  <div className="relative">
                    <AlignLeft className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-gray-900 dark:text-white placeholder-gray-400"
                      placeholder="Alex Student"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{translations.selectGrade}</label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-hide">
                    {gradeFolders.map((folder) => {
                      const isOpen = openFolder === folder.id;
                      const hasSelected = folder.grades.includes(grade);
                      return (
                        <div key={folder.id} className={`rounded-xl border overflow-hidden transition-all duration-150 ${hasSelected ? 'border-brand-400 dark:border-brand-600' : 'border-gray-200 dark:border-gray-700'}`}>
                          <button
                            onClick={() => setOpenFolder(isOpen ? null : folder.id)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold transition-all ${
                              hasSelected
                                ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{folder.emoji}</span>
                              <span>{folder.label}</span>
                              {hasSelected && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                            </span>
                            <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {isOpen && (
                            <div className="flex flex-col gap-1 p-2 bg-white dark:bg-gray-900">
                              {folder.grades.map((g) => (
                                <button
                                  key={g}
                                  onClick={() => setGrade(g)}
                                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-between ${
                                    grade === g
                                      ? 'bg-brand-500 border-brand-500 text-white'
                                      : 'border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-brand-400 hover:text-brand-600'
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

            {/* Error */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleAuth}
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white rounded-xl font-bold shadow-brand transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              ) : (
                <>
                  {mode === 'login' ? translations.signIn : translations.finish}
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Guest */}
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
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all font-medium py-1"
            >
              {translations.continueAsGuest}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
