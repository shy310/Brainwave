
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

type SetLangKey = 'en' | 'ru' | 'he' | 'ar';
const SET_COPY: Record<SetLangKey, {
  manageDesc: string; editProfile: string; displayName: string; namePlaceholder: string; usernamePlaceholder: string;
  rules: string; usernameInvalid: string; nameEmpty: string;
  saveProfile: string; profileSaved: string; saveGrade: string; gradeSaved: string;
  currently: string; light: string; dark: string;
  kinder: string; elementary: string; middle: string; high: string; college: string;
}> = {
  en: {
    manageDesc: 'Manage your profile and learning preferences.',
    editProfile: 'Edit Profile', displayName: 'Display Name',
    namePlaceholder: 'Your name', usernamePlaceholder: 'student_123',
    rules: 'Letters, numbers, and underscores only.',
    usernameInvalid: 'Username can only contain letters, numbers, and underscores.',
    nameEmpty: 'Name and username cannot be empty.',
    saveProfile: 'Save Profile', profileSaved: 'Profile saved!',
    saveGrade: 'Save Grade', gradeSaved: 'Grade saved!',
    currently: 'Currently:', light: 'Light', dark: 'Dark',
    kinder: 'Kindergarten', elementary: 'Elementary School', middle: 'Middle School', high: 'High School', college: 'College',
  },
  ru: {
    manageDesc: 'Управляй профилем и настройками обучения.',
    editProfile: 'Редактировать профиль', displayName: 'Имя для отображения',
    namePlaceholder: 'Твоё имя', usernamePlaceholder: 'ученик_123',
    rules: 'Только буквы, цифры и подчёркивания.',
    usernameInvalid: 'Имя может содержать только буквы, цифры и подчёркивания.',
    nameEmpty: 'Имя и имя пользователя не могут быть пустыми.',
    saveProfile: 'Сохранить профиль', profileSaved: 'Профиль сохранён!',
    saveGrade: 'Сохранить класс', gradeSaved: 'Класс сохранён!',
    currently: 'Сейчас:', light: 'Светлая', dark: 'Тёмная',
    kinder: 'Детский сад', elementary: 'Начальная школа', middle: 'Средняя школа', high: 'Старшая школа', college: 'Колледж',
  },
  he: {
    manageDesc: 'נהל את הפרופיל והעדפות הלמידה שלך.',
    editProfile: 'ערוך פרופיל', displayName: 'שם תצוגה',
    namePlaceholder: 'השם שלך', usernamePlaceholder: 'תלמיד_123',
    rules: 'אותיות, מספרים וקווים תחתונים בלבד.',
    usernameInvalid: 'שם משתמש יכול להכיל רק אותיות, מספרים וקווים תחתונים.',
    nameEmpty: 'שם ושם משתמש אינם יכולים להיות ריקים.',
    saveProfile: 'שמור פרופיל', profileSaved: 'הפרופיל נשמר!',
    saveGrade: 'שמור כיתה', gradeSaved: 'הכיתה נשמרה!',
    currently: 'כרגע:', light: 'בהיר', dark: 'כהה',
    kinder: 'גן', elementary: 'יסודי', middle: 'חטיבת ביניים', high: 'תיכון', college: 'קולג׳',
  },
  ar: {
    manageDesc: 'أدر ملفك الشخصي وتفضيلات التعلم.',
    editProfile: 'تحرير الملف الشخصي', displayName: 'اسم العرض',
    namePlaceholder: 'اسمك', usernamePlaceholder: 'طالب_123',
    rules: 'الأحرف والأرقام والشرطات السفلية فقط.',
    usernameInvalid: 'يمكن أن يحتوي اسم المستخدم على أحرف وأرقام وشرطات سفلية فقط.',
    nameEmpty: 'الاسم واسم المستخدم لا يمكن أن يكونا فارغين.',
    saveProfile: 'حفظ الملف الشخصي', profileSaved: 'تم حفظ الملف الشخصي!',
    saveGrade: 'حفظ الصف', gradeSaved: 'تم حفظ الصف!',
    currently: 'حالياً:', light: 'فاتح', dark: 'داكن',
    kinder: 'الروضة', elementary: 'الابتدائي', middle: 'الإعدادي', high: 'الثانوي', college: 'الجامعة',
  },
};

const Settings: React.FC<Props> = ({
  user, translations, theme, language,
  onProfileUpdate, onGradeChange, onThemeToggle, onLanguageChange
}) => {
  const c = SET_COPY[(SET_COPY[language as SetLangKey] ? language : 'en') as SetLangKey];
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
    { id: 'kinder',     emoji: '🎒', label: c.kinder,     grades: [GradeLevel.KINDER] },
    { id: 'elementary', emoji: '🏫', label: c.elementary, grades: [GradeLevel.GRADE_1, GradeLevel.GRADE_2, GradeLevel.GRADE_3, GradeLevel.GRADE_4, GradeLevel.GRADE_5, GradeLevel.GRADE_6] },
    { id: 'middle',     emoji: '📚', label: c.middle,     grades: [GradeLevel.GRADE_7, GradeLevel.GRADE_8, GradeLevel.GRADE_9] },
    { id: 'high',       emoji: '🎓', label: c.high,       grades: [GradeLevel.GRADE_10, GradeLevel.GRADE_11, GradeLevel.GRADE_12] },
    { id: 'college',    emoji: '🏛️', label: c.college,    grades: [GradeLevel.COLLEGE_FRESHMAN, GradeLevel.COLLEGE_ADVANCED] },
  ];

  const profileDirty = name.trim() !== user.name || username.trim() !== user.username;

  const handleProfileSave = () => {
    setProfileError(null);
    const trimmedName = name.trim();
    const trimmedUsername = username.trim();

    if (!trimmedName || !trimmedUsername) {
      setProfileError(c.nameEmpty);
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      setProfileError(c.usernameInvalid);
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
        <h1 className="text-2xl font-bold text-ink-700 dark:text-ink-100 mb-6">
          {translations.settings}
        </h1>
        <p className="text-ink-400 dark:text-ink-400 mt-2 font-medium">
          {c.manageDesc}
        </p>
      </header>

      {/* ── Profile Section ── */}
      <section className="bg-white dark:bg-ink-800 rounded-2xl border border-ink-100 dark:border-ink-700 p-6 shadow-sm mb-4 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-moss-600 flex items-center justify-center text-white font-bold text-2xl shadow-moss shrink-0">
            {(name.trim() || user.name).charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-xl font-bold text-ink-700 dark:text-white">{user.name}</div>
            <div className="text-sm text-ink-400 font-medium">@{user.username}</div>
            <div className="text-xs text-moss-600 dark:text-moss-400 font-bold mt-0.5">
              {translations.grades[user.gradeLevel]}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-cream-50 dark:bg-ink-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-moss-600">{user.totalXp}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-400 mb-3 mt-1">{translations.xp}</div>
          </div>
          <div className="bg-cream-50 dark:bg-ink-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">{user.streakDays}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-400 mb-3 mt-1">{translations.streak}</div>
          </div>
        </div>

        <div className="border-t dark:border-ink-700 pt-5 space-y-4">
          <h2 className="text-base font-semibold text-ink-700 dark:text-ink-100 mb-4">{c.editProfile}</h2>

          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink-400 uppercase tracking-wide mb-1.5">
              {c.displayName}
            </label>
            <div className="relative group">
              <User
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 group-focus-within:text-moss-600 transition-colors"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setProfileError(null); setProfileSaved(false); }}
                className="w-full pl-11 pr-4 py-3 bg-cream-50 dark:bg-ink-800 border border-ink-100 dark:border-ink-700 rounded-xl text-sm outline-none focus:border-moss-500 focus:ring-2 focus:ring-moss-500/20 transition-all font-bold text-ink-700 dark:text-white"
                placeholder={c.namePlaceholder}
              />
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink-400 uppercase tracking-wide mb-1.5">
              {translations.username}
            </label>
            <div className="relative group">
              <AtSign
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 group-focus-within:text-moss-600 transition-colors"
              />
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setProfileError(null); setProfileSaved(false); }}
                className="w-full pl-11 pr-4 py-3 bg-cream-50 dark:bg-ink-800 border border-ink-100 dark:border-ink-700 rounded-xl text-sm outline-none focus:border-moss-500 focus:ring-2 focus:ring-moss-500/20 transition-all font-bold text-ink-700 dark:text-white"
                placeholder={c.usernamePlaceholder}
              />
            </div>
            <p className="text-[11px] text-ink-400 ml-1">{c.rules}</p>
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
            className="px-5 py-2.5 bg-moss-500 hover:bg-moss-600 text-white rounded-xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed w-full"
          >
            {profileSaved ? (
              <><Check size={18} /> {c.profileSaved}</>
            ) : (
              <><Save size={18} /> {c.saveProfile}</>
            )}
          </button>
        </div>
      </section>

      {/* ── Grade Level ── */}
      <section className="bg-white dark:bg-ink-800 rounded-2xl border border-ink-100 dark:border-ink-700 p-6 shadow-sm mb-4 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-ink-700 dark:text-ink-100 mb-4">{translations.selectGrade}</h2>
          <p className="text-sm text-ink-400 font-medium mt-1">
            {c.currently} <span className="text-moss-600 dark:text-moss-400 font-bold">{translations.grades[user.gradeLevel]}</span>
          </p>
        </div>

        <div className="space-y-2">
          {gradeFolders.map((folder) => {
            const isOpen = openFolder === folder.id;
            const hasSelected = folder.grades.includes(selectedGrade);
            return (
              <div
                key={folder.id}
                className={`rounded-xl border-2 overflow-hidden transition-all ${hasSelected ? 'border-moss-400 dark:border-moss-600' : 'border-ink-100 dark:border-ink-700'}`}
              >
                <button
                  onClick={() => setOpenFolder(isOpen ? null : folder.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold transition-colors ${
                    hasSelected
                      ? 'bg-moss-50 dark:bg-moss-light/30 text-moss-700 dark:text-moss-400'
                      : 'bg-cream-50 dark:bg-ink-800 text-ink-500 dark:text-ink-400 hover:bg-cream-100 dark:hover:bg-ink-800'
                  }`}
                >
                  <span>{folder.emoji} {folder.label}</span>
                  <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="flex flex-col gap-1 p-2 bg-white dark:bg-ink-800">
                    {folder.grades.map((g) => (
                      <button
                        key={g}
                        onClick={() => setSelectedGrade(g)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                          selectedGrade === g
                            ? 'border-moss-500 bg-moss-500 text-white shadow-moss'
                            : 'px-3 py-2 rounded-xl border border-ink-100 dark:border-ink-700 text-sm font-medium text-ink-500 dark:text-ink-400 hover:border-moss-400 transition-all'
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
          className="px-5 py-2.5 bg-moss-500 hover:bg-moss-600 text-white rounded-xl font-semibold shadow-moss transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed w-full"
        >
          {gradeSaved ? (
            <><Check size={18} /> {c.gradeSaved}</>
          ) : (
            <><Save size={18} /> {c.saveGrade}</>
          )}
        </button>
      </section>

      {/* ── Appearance ── */}
      <section className="bg-white dark:bg-ink-800 rounded-2xl border border-ink-100 dark:border-ink-700 p-6 shadow-sm mb-4 space-y-5">
        <h2 className="text-base font-semibold text-ink-700 dark:text-ink-100 mb-4">
          {translations.theme} &amp; {translations.language}
        </h2>

        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-ink-500 dark:text-ink-400">{translations.theme}</span>
          <button
            onClick={onThemeToggle}
            className="flex items-center gap-2 px-4 py-2.5 bg-cream-100 dark:bg-ink-800 rounded-xl text-sm font-bold text-ink-500 dark:text-ink-400 hover:text-moss-600 dark:hover:text-moss-400 transition-colors"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            {theme === 'light' ? c.light : c.dark}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-ink-500 dark:text-ink-400">{translations.language}</span>
          <div className="flex items-center gap-2 bg-cream-100 dark:bg-ink-800 rounded-xl px-3 py-2">
            <Globe size={14} className="text-ink-400" />
            <select
              value={language}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onLanguageChange(e.target.value as Language)}
              className="bg-transparent border-none text-sm font-bold text-ink-500 dark:text-ink-400 focus:ring-0 cursor-pointer"
            >
              <option value="en" className="bg-white dark:bg-ink-800">English</option>
              <option value="ru" className="bg-white dark:bg-ink-800">Русский</option>
              <option value="he" className="bg-white dark:bg-ink-800">עברית</option>
              <option value="ar" className="bg-white dark:bg-ink-800">العربية</option>
            </select>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Settings;
