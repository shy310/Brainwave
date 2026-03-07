
import React, { useState } from 'react';
import { GradeLevel, Language, UserProfile, Translations } from '../types';
import { ChevronDown, Save, Globe, Moon, Sun, Check, User, AtSign, AlertCircle } from 'lucide-react';

interface Props {
  user: UserProfile;
  translations: Translations;
  theme: 'light' | 'dark';
  language: Language;
  onProfileUpdate: (updates: { name: string; username: string }) => void;
  onGradeChange: (grade: GradeLevel) => void;
  onThemeToggle: () => void;
  onLanguageChange: (lang: Language) => void;
}

const USERS_DB_KEY = 'brainwave_users_db';

const Settings: React.FC<Props> = ({
  user, translations, theme, language,
  onProfileUpdate, onGradeChange, onThemeToggle, onLanguageChange
}) => {
  // Profile fields
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  // Grade picker
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(user.gradeLevel);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [gradeSaved, setGradeSaved] = useState(false);

  const gradeFolders = [
    { id: 'kinder',     emoji: '🎒', label: 'Kindergarten',     grades: [GradeLevel.KINDER] },
    { id: 'elementary', emoji: '🏫', label: 'Elementary School', grades: [GradeLevel.GRADE_1, GradeLevel.GRADE_2, GradeLevel.GRADE_3, GradeLevel.GRADE_4, GradeLevel.GRADE_5, GradeLevel.GRADE_6] },
    { id: 'middle',     emoji: '📚', label: 'Middle School',     grades: [GradeLevel.GRADE_7, GradeLevel.GRADE_8, GradeLevel.GRADE_9] },
    { id: 'high',       emoji: '🎓', label: 'High School',       grades: [GradeLevel.GRADE_10, GradeLevel.GRADE_11, GradeLevel.GRADE_12] },
    { id: 'college',    emoji: '🏛️', label: 'College',           grades: [GradeLevel.COLLEGE_FRESHMAN, GradeLevel.COLLEGE_ADVANCED] },
  ];

  const profileDirty = name.trim() !== user.name || username.trim() !== user.username;

  const handleProfileSave = () => {
    setProfileError(null);
    const trimmedName = name.trim();
    const trimmedUsername = username.trim();

    if (!trimmedName || !trimmedUsername) {
      setProfileError('Name and username cannot be empty.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      setProfileError('Username can only contain letters, numbers, and underscores.');
      return;
    }

    // Check username uniqueness (only if it changed)
    if (trimmedUsername !== user.username) {
      try {
        const usersDb = JSON.parse(localStorage.getItem(USERS_DB_KEY) || '{}');
        const taken = Object.values(usersDb).some(
          (u: any) => u.username === trimmedUsername && u.id !== user.id
        );
        if (taken) {
          setProfileError(translations.userExists);
          return;
        }
      } catch {
        // If DB read fails, proceed anyway
      }
    }

    onProfileUpdate({ name: trimmedName, username: trimmedUsername });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  const handleGradeSave = () => {
    onGradeChange(selectedGrade);
    setGradeSaved(true);
    setTimeout(() => setGradeSaved(false), 2500);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 view-enter overflow-y-auto h-full scrollbar-hide pb-20">

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          {translations.settings}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
          Manage your profile and learning preferences.
        </p>
      </header>

      {/* ── Profile Section ── */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-card mb-4 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center text-white font-bold text-2xl shadow-brand shrink-0">
            {(name.trim() || user.name).charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</div>
            <div className="text-sm text-gray-400 font-medium">@{user.username}</div>
            <div className="text-xs text-brand-600 dark:text-brand-400 font-bold mt-0.5">
              {translations.grades[user.gradeLevel]}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-brand-600">{user.totalXp}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-3 mt-1">{translations.xp}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">{user.streakDays}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-3 mt-1">{translations.streak}</div>
          </div>
        </div>

        <div className="border-t dark:border-gray-800 pt-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Edit Profile</h2>

          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Display Name
            </label>
            <div className="relative group">
              <User
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-600 transition-colors"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setProfileError(null); setProfileSaved(false); }}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-bold text-gray-900 dark:text-white"
                placeholder="Your name"
              />
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Username
            </label>
            <div className="relative group">
              <AtSign
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-600 transition-colors"
              />
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setProfileError(null); setProfileSaved(false); }}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-bold text-gray-900 dark:text-white"
                placeholder="student_123"
              />
            </div>
            <p className="text-[11px] text-gray-400 ml-1">Letters, numbers, and underscores only.</p>
          </div>

          {/* Error */}
          {profileError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-bold">
              <AlertCircle size={16} />
              {profileError}
            </div>
          )}

          <button
            onClick={handleProfileSave}
            disabled={!profileDirty}
            className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold shadow-brand transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed w-full"
          >
            {profileSaved ? (
              <><Check size={18} /> Profile saved!</>
            ) : (
              <><Save size={18} /> Save Profile</>
            )}
          </button>
        </div>
      </section>

      {/* ── Grade Level ── */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-card mb-4 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">{translations.selectGrade}</h2>
          <p className="text-sm text-gray-400 font-medium mt-1">
            Currently: <span className="text-brand-600 dark:text-brand-400 font-bold">{translations.grades[user.gradeLevel]}</span>
          </p>
        </div>

        <div className="space-y-2">
          {gradeFolders.map((folder) => {
            const isOpen = openFolder === folder.id;
            const hasSelected = folder.grades.includes(selectedGrade);
            return (
              <div
                key={folder.id}
                className={`rounded-xl border-2 overflow-hidden transition-all ${hasSelected ? 'border-brand-400 dark:border-brand-600' : 'border-gray-100 dark:border-gray-800'}`}
              >
                <button
                  onClick={() => setOpenFolder(isOpen ? null : folder.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold transition-colors ${
                    hasSelected
                      ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>{folder.emoji} {folder.label}</span>
                  <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="flex flex-col gap-1 p-2 bg-white dark:bg-gray-900">
                    {folder.grades.map((g) => (
                      <button
                        key={g}
                        onClick={() => setSelectedGrade(g)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                          selectedGrade === g
                            ? 'border-brand-500 bg-brand-500 text-white shadow-brand'
                            : 'px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:border-brand-400 transition-all'
                        }`}
                      >
                        <span>{translations.grades[g]}</span>
                        {selectedGrade === g && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={handleGradeSave}
          disabled={selectedGrade === user.gradeLevel}
          className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold shadow-brand transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed w-full"
        >
          {gradeSaved ? (
            <><Check size={18} /> Grade saved!</>
          ) : (
            <><Save size={18} /> Save Grade</>
          )}
        </button>
      </section>

      {/* ── Appearance ── */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-card mb-4 space-y-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {translations.theme} &amp; {translations.language}
        </h2>

        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{translations.theme}</span>
          <button
            onClick={onThemeToggle}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            {theme === 'light' ? 'Light' : 'Dark'}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{translations.language}</span>
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2">
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
        </div>
      </section>

    </div>
  );
};

export default Settings;
