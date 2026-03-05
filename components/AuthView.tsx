
import React, { useState } from 'react';
import { GradeLevel, Language, UserProfile, Translations } from '../types';
import { ArrowRight, User, Lock, AlignLeft, AlertCircle, ChevronDown, Moon, Sun, Globe } from 'lucide-react';
import Logo from './Logo';

// DB entries carry the hashed password for local auth only.
// UserProfile (and app state) never includes the password field.
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

const AuthView: React.FC<Props> = ({ language, translations, theme, onLogin, onThemeToggle, onLanguageChange }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Form State
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
    { id: 'college',    emoji: '🏛️', label: 'College',          grades: [GradeLevel.COLLEGE_FRESHMAN, GradeLevel.COLLEGE_ADVANCED] },
  ];

  // Constants for Local Storage
  const USERS_DB_KEY = 'brainwave_users_db';

  const hashPassword = async (plain: string): Promise<string> => {
    // crypto.subtle requires a secure context (localhost or HTTPS)
    if (crypto?.subtle) {
      const encoded = new TextEncoder().encode(plain);
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    // Fallback for non-secure contexts (accessed via IP address)
    let hash = 5381;
    for (let i = 0; i < plain.length; i++) {
      hash = ((hash << 5) + hash) ^ plain.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit int
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
          // Strip _passwordHash — never put password in app state or server sync
          const { _passwordHash: _ph, ...safeUser } = entry;
          if (!safeUser.progressMap) safeUser.progressMap = {};
          onLogin(safeUser);
        } else {
          setError(translations.authError);
        }
      } else {
        const exists = Object.values(usersDb).some((u) => u.username === username);
        if (exists) {
          setError(translations.userExists);
          return;
        }

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

        // Store with hash in local DB, call onLogin without it
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      {/* Top-right controls */}
      <div className="fixed top-5 end-5 flex items-center gap-2 z-10">
        <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-3 py-2 shadow-sm">
          <Globe size={14} className="text-gray-400" />
          <select
            value={language}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onLanguageChange(e.target.value as Language)}
            className="bg-transparent border-none text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-0 cursor-pointer"
          >
            <option value="en" className="bg-white dark:bg-gray-800">English</option>
            <option value="ru" className="bg-white dark:bg-gray-800">Русский</option>
            <option value="he" className="bg-white dark:bg-gray-800">עברית</option>
            <option value="ar" className="bg-white dark:bg-gray-800">العربية</option>
          </select>
        </div>
        <button
          onClick={onThemeToggle}
          className="p-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-gray-500 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors shadow-sm"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>

      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-[3rem] p-8 md:p-12 shadow-2xl border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-8 duration-500">
          <div className="space-y-8">
              <header className="space-y-4 text-center">
                  <div className="flex justify-center mb-6">
                      <Logo size={60} showText={false} layout="vertical" />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 dark:text-white">
                      {mode === 'login' ? translations.signIn : translations.register}
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">
                      {translations.welcomeSubtitle}
                  </p>
              </header>

              <div className="space-y-5">
                  {/* Username Field */}
                  <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">{translations.username}</label>
                      <div className="relative group">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-600 transition-colors" size={20} />
                          <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-brand-500 rounded-2xl outline-none font-bold text-gray-900 dark:text-white transition-all"
                            placeholder="student_123"
                          />
                      </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">{translations.password}</label>
                      <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-600 transition-colors" size={20} />
                          <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-brand-500 rounded-2xl outline-none font-bold text-gray-900 dark:text-white transition-all"
                            placeholder="••••••••"
                            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                          />
                      </div>
                  </div>

                  {/* Register-Only Fields */}
                  {mode === 'register' && (
                    <div className="space-y-5 animate-in slide-in-from-top-4 fade-in">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">{translations.name}</label>
                            <div className="relative group">
                                <AlignLeft className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-600 transition-colors" size={20} />
                                <input 
                                    type="text" 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-brand-500 rounded-2xl outline-none font-bold text-gray-900 dark:text-white transition-all"
                                    placeholder="Alex Student"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">{translations.selectGrade}</label>
                            <div className="space-y-2">
                                {gradeFolders.map((folder) => {
                                    const isOpen = openFolder === folder.id;
                                    const hasSelected = folder.grades.includes(grade);
                                    return (
                                        <div key={folder.id} className={`rounded-xl border-2 overflow-hidden transition-all ${hasSelected ? 'border-brand-400 dark:border-brand-600' : 'border-gray-100 dark:border-gray-800'}`}>
                                            <button
                                                onClick={() => setOpenFolder(isOpen ? null : folder.id)}
                                                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold transition-colors ${hasSelected ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                            >
                                                <span>{folder.emoji} {folder.label}</span>
                                                <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                            {isOpen && (
                                                <div className="flex flex-col gap-1 p-2 bg-white dark:bg-gray-900">
                                                    {folder.grades.map((g) => (
                                                        <button
                                                            key={g}
                                                            onClick={() => setGrade(g)}
                                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${grade === g ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600'}`}
                                                        >
                                                            {translations.grades[g]}
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
                  
                  {/* Error Message */}
                  {error && (
                      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
                          <AlertCircle size={18} />
                          {error}
                      </div>
                  )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-4 pt-2">
                  <button 
                    onClick={handleAuth}
                    disabled={loading}
                    className="w-full py-5 bg-brand-600 text-white rounded-2xl font-black text-lg hover:bg-brand-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-brand-500/20 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                      {loading ? (
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{animationDelay:'0ms'}}></span><span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{animationDelay:'150ms'}}></span><span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{animationDelay:'300ms'}}></span></span>
                      ) : (
                          <>
                            {mode === 'login' ? translations.signIn : translations.finish} 
                            <ArrowRight size={22} className="rtl:rotate-180" />
                          </>
                      )}
                  </button>
                  
                  <button
                    onClick={() => {
                        setMode(mode === 'login' ? 'register' : 'login');
                        setError(null);
                    }}
                    className="w-full text-sm font-bold text-gray-400 hover:text-brand-600 transition-colors"
                  >
                      {mode === 'login' ? translations.noAccount : translations.hasAccount}
                  </button>

                  <button
                    onClick={() => {
                      onLogin({
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
                      });
                    }}
                    className="w-full text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors pt-1"
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
