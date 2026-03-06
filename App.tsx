
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppState, Subject, GradeLevel, UserProfile, Attachment,
  LearningSession, ProgressMap, TopicProgress, Course
} from './types';
import { TRANSLATIONS, CURRICULUM, getCurriculumCourse, buildCourseFromCurriculum } from './constants';

// In production (Railway), frontend + backend share the same origin — relative URL is used.
// In Capacitor or when VITE_API_URL is set, use that base.
const API_BASE = import.meta.env.VITE_API_URL ?? '';
import LanguageSelector from './components/LanguageSelector';
import ExercisePanel from './components/ExercisePanel';
import Dashboard from './components/Dashboard';
import StudyMaterials from './components/StudyMaterials';
import FloatingChat from './components/FloatingChat';
import AuthView from './components/AuthView';
import LessonView from './components/LessonView';
import ProgressDashboard from './components/ProgressDashboard';
import SettingsView from './components/Settings';
import Logo from './components/Logo';
import PresentationView from './components/PresentationView';
import CodeLab from './components/CodeLab';
import EducationalGames from './components/EducationalGames';
import DebateArena from './components/DebateArena';
import StoryEngine from './components/StoryEngine';
import SqlDetective from './components/SqlDetective';
import MathTutorView from './components/MathTutorView';

import {
  LayoutGrid, Library, Menu, X, Moon, Sun, Search,
  Calculator, FlaskConical, Globe, Laptop, BookOpen, TrendingUp, LogOut, BarChart2, Settings,
  Presentation as PresentationIcon, Code2, Gamepad2, Swords, Feather, DatabaseIcon,
  User as UserIcon, Trophy, Flame, Star
} from 'lucide-react';

const SESSION_KEY = 'brainwave_session_v2';
const USERS_DB_KEY = 'brainwave_users_db';

// Ordinal values for grade-level proximity matching (Fix 8)
const GRADE_ORDINAL: Partial<Record<GradeLevel, number>> = {
  [GradeLevel.KINDER]: 0,
  [GradeLevel.GRADE_1]: 1,   [GradeLevel.GRADE_2]: 2,   [GradeLevel.GRADE_3]: 3,
  [GradeLevel.ELEMENTARY_1_3]: 2,
  [GradeLevel.GRADE_4]: 4,   [GradeLevel.GRADE_5]: 5,   [GradeLevel.GRADE_6]: 6,
  [GradeLevel.ELEMENTARY_4_6]: 5,
  [GradeLevel.GRADE_7]: 7,   [GradeLevel.GRADE_8]: 8,
  [GradeLevel.MIDDLE_7_8]: 7,
  [GradeLevel.GRADE_9]: 9,   [GradeLevel.GRADE_10]: 10,
  [GradeLevel.HIGH_9_10]: 9,
  [GradeLevel.GRADE_11]: 11, [GradeLevel.GRADE_12]: 12,
  [GradeLevel.HIGH_11_12]: 11,
  [GradeLevel.COLLEGE_FRESHMAN]: 13,
  [GradeLevel.COLLEGE_ADVANCED]: 15,
};

const SUBJECT_ICONS: Record<string, React.ElementType> = {
  [Subject.MATH]: Calculator,
  [Subject.SCIENCE]: FlaskConical,
  [Subject.LANGUAGE]: Globe,
  [Subject.CODING]: Laptop,
  [Subject.HISTORY]: BookOpen,
  [Subject.ECONOMICS]: TrendingUp
};

const DEFAULT_USER: UserProfile = {
  id: '',
  username: '',
  name: 'Student',
  gradeLevel: GradeLevel.HIGH_9_10,
  preferredLanguage: 'en',
  enrolledCourses: [],
  totalXp: 0,
  streakDays: 0,
  isRegistered: false,
  progressMap: {}
};

const DEFAULT_STATE: AppState = {
  isLoggedIn: false,
  theme: 'light',
  language: 'en',
  activeView: 'dashboard',
  activeCourseId: null,
  activeTopicId: null,
  currentSession: null,
  messages: [],
  currentContext: 'Dashboard',
  user: DEFAULT_USER
};

// ─── PROGRESS HELPERS ──────────────────────────────────────────────────────────

const updateTopicProgress = (
  prev: ProgressMap,
  topicId: string,
  attemptsTotal: number,
  attemptsCorrect: number,
  skillTag?: string
): ProgressMap => {
  const existing = prev[topicId] || {
    topicId,
    mastery: 0,
    attemptsTotal: 0,
    attemptsCorrect: 0,
    lastPracticed: new Date().toISOString(),
    skills: {}
  };

  const newTotal = existing.attemptsTotal + attemptsTotal;
  const newCorrect = existing.attemptsCorrect + attemptsCorrect;

  // Exponential moving average for mastery (alpha = 0.3)
  const sessionScore = attemptsTotal > 0 ? Math.round((attemptsCorrect / attemptsTotal) * 100) : 0;
  const alpha = 0.3;
  const newMastery = Math.round(existing.mastery * (1 - alpha) + sessionScore * alpha);

  const updatedSkills = { ...existing.skills };
  if (skillTag) {
    const existingSkill = updatedSkills[skillTag] || {
      skillTag, masteryScore: 0, lastPracticed: new Date().toISOString(), attemptsTotal: 0, attemptsCorrect: 0
    };
    const skillSessionScore = attemptsTotal > 0 ? Math.round((attemptsCorrect / attemptsTotal) * 100) : 0;
    updatedSkills[skillTag] = {
      ...existingSkill,
      masteryScore: Math.round(existingSkill.masteryScore * (1 - alpha) + skillSessionScore * alpha),
      lastPracticed: new Date().toISOString(),
      attemptsTotal: existingSkill.attemptsTotal + attemptsTotal,
      attemptsCorrect: existingSkill.attemptsCorrect + attemptsCorrect,
    };
  }

  const updated: TopicProgress = {
    ...existing,
    mastery: newMastery,
    attemptsTotal: newTotal,
    attemptsCorrect: newCorrect,
    lastPracticed: new Date().toISOString(),
    skills: updatedSkills
  };

  return { ...prev, [topicId]: updated };
};

// Returns the new streak value (not a delta).
const calculateStreak = (currentStreak: number, lastActivityDate?: string): number => {
  if (!lastActivityDate) return 1;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const last = new Date(lastActivityDate).toDateString();
  if (last === today) return currentStreak;       // already practiced today — no change
  if (last === yesterday) return currentStreak + 1; // consecutive day — extend streak
  return 1;                                        // gap — reset to 1
};

// ─── APP COMPONENT ────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(() => {
    try {
      const sessionData = localStorage.getItem(SESSION_KEY);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.isLoggedIn && session.lastUserId) {
          const usersDb = JSON.parse(localStorage.getItem(USERS_DB_KEY) || '{}');
          const user = usersDb[session.lastUserId];
          if (user) {
            // Migrate old users without progressMap
            if (!user.progressMap) user.progressMap = {};
            return { ...DEFAULT_STATE, ...session, user, activeView: 'dashboard' };
          }
        }
        return { ...DEFAULT_STATE, ...session, isLoggedIn: false, user: DEFAULT_USER };
      }
    } catch (e) {}
    return DEFAULT_STATE;
  });

  const [courses, setCourses] = useState<Course[]>([]);
  // Kept separate from currentSession so ExercisePanel stays mounted (CSS-hidden)
  // across language changes and sidebar navigation, preserving quiz state.
  const [exerciseSession, setExerciseSession] = useState<LearningSession | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false); // Fix 4
  const [levelUpToast, setLevelUpToast] = useState<number | null>(null); // Fix 5
  const [viewLoading, setViewLoading] = useState(false); // Fix 9
  const prevXpRef = useRef(appState.user.totalXp); // Fix 5 — track previous XP

  // Build courses from CURRICULUM + user progress (Fix 8: two-pass grade filter)
  useEffect(() => {
    if (!appState.isLoggedIn) return;
    const grade = appState.user.gradeLevel;
    const progressMap = appState.user.progressMap || {};

    // Pass 1: exact grade match
    let filtered = CURRICULUM.filter(cc => cc.gradeLevel === grade);

    // Pass 2: closest grade by ordinal distance (never falls back to "show all")
    if (filtered.length === 0 && CURRICULUM.length > 0) {
      const userOrd = GRADE_ORDINAL[grade] ?? 9;
      let minDist = Infinity;
      CURRICULUM.forEach(cc => {
        const d = Math.abs((GRADE_ORDINAL[cc.gradeLevel] ?? 9) - userOrd);
        if (d < minDist) minDist = d;
      });
      filtered = CURRICULUM.filter(cc =>
        Math.abs((GRADE_ORDINAL[cc.gradeLevel] ?? 9) - userOrd) === minDist
      );
    }

    const built: Course[] = filtered.map(cc =>
      buildCourseFromCurriculum(cc, progressMap, appState.language)
    );
    // Deduplicate by subject — keep first (best-matching) grade entry
    const seen = new Set<string>();
    const deduped = built.filter(c => {
      if (seen.has(c.subject)) return false;
      seen.add(c.subject);
      return true;
    });
    setCourses(deduped);
  }, [appState.language, appState.user.gradeLevel, appState.user.progressMap, appState.isLoggedIn]);

  // Persistence effect — localStorage + server sync (Fix 1)
  useEffect(() => {
    const session = {
      isLoggedIn: appState.isLoggedIn,
      theme: appState.theme,
      language: appState.language,
      lastUserId: appState.user?.id || null
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    if (appState.isLoggedIn && appState.user?.id) {
      // Preserve existing _passwordHash in DB entry — never overwrite with profile that lacks it
      try {
        const usersDb = JSON.parse(localStorage.getItem(USERS_DB_KEY) || '{}');
        const existing = usersDb[appState.user.id] || {};
        usersDb[appState.user.id] = { ...existing, ...appState.user };
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(usersDb));
      } catch (e) {
        console.error("Failed to save user data to localStorage", e);
      }
      // Sync to server — fail silently so app works offline
      fetch(`${API_BASE}/api/user/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: appState.user.id, userData: appState.user }),
      }).catch(() => {});
    }

    if (appState.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    const isRtl = appState.language === 'he' || appState.language === 'ar';
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = appState.language;
  }, [appState.theme, appState.language, appState.user, appState.isLoggedIn]);

  // Level-up detection (Fix 5)
  useEffect(() => {
    const newXp = appState.user.totalXp;
    const prevXp = prevXpRef.current;
    if (Math.floor(newXp / 1000) > Math.floor(prevXp / 1000)) {
      const newLevel = Math.floor(newXp / 1000) + 1;
      setLevelUpToast(newLevel);
      setTimeout(() => setLevelUpToast(null), 3000);
    }
    prevXpRef.current = newXp;
  }, [appState.user.totalXp]);

  // Fix 9: view navigation with brief loading bar
  const navigateTo = useCallback((view: AppState['activeView']) => {
    setViewLoading(true);
    setTimeout(() => {
      setViewLoading(false);
      setAppState(prev => ({ ...prev, activeView: view, activeCourseId: null, activeTopicId: null, currentSession: null }));
      setActiveSubject(null);
      setMobileMenuOpen(false);
    }, 150);
  }, []);

  const toggleSidebar = () => {
    if (window.innerWidth >= 768) setDesktopSidebarOpen(d => !d);
    else setMobileMenuOpen(m => !m);
  };

  const handleLogin = (userData: Partial<UserProfile>) => {
    const fullUser: UserProfile = { ...DEFAULT_USER, ...userData, progressMap: (userData as any).progressMap || {} } as UserProfile;
    // Fix 2: recalculate streak immediately on login
    const updatedStreak = calculateStreak(fullUser.streakDays, fullUser.lastActivityDate);
    const userWithStreak = { ...fullUser, streakDays: updatedStreak };

    setAppState(prev => ({
      ...prev,
      isLoggedIn: true,
      user: userWithStreak,
      language: userWithStreak.preferredLanguage || prev.language
    }));

    // Fix 2: merge server-side progress data (fail-silent, runs after login)
    if (fullUser.id) {
      fetch(`${API_BASE}/api/user/${fullUser.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(serverData => {
          if (!serverData) return;
          setAppState(prev => ({
            ...prev,
            user: {
              ...prev.user,
              progressMap: serverData.progressMap ?? prev.user.progressMap,
              totalXp: serverData.totalXp ?? prev.user.totalXp,
              streakDays: serverData.streakDays ?? prev.user.streakDays,
            }
          }));
        })
        .catch(() => {});
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    setAppState(prev => ({ ...DEFAULT_STATE, theme: prev.theme, language: prev.language }));
  };

  // ── SESSION HANDLERS ─────────────────────────────────────────────────────

  const handleStartLesson = useCallback((subject: Subject, grade: GradeLevel, topicId: string | null, topicTitle: string) => {
    const session: LearningSession = {
      subject,
      grade,
      topicId,
      topicTitle,
      phase: 'lesson',
      lesson: null,
      uploadAnalysis: null,
      studyContext: []
    };
    setActiveSubject(subject);
    setAppState(prev => ({ ...prev, activeView: 'lesson', currentSession: session, activeCourseId: null, activeTopicId: topicId }));
    setMobileMenuOpen(false);
  }, []);

  const handleStartExercises = useCallback((subject: Subject, grade: GradeLevel, topicId: string | null, topicTitle: string, studyContext: Attachment[] = []) => {
    const session: LearningSession = {
      subject,
      grade,
      topicId,
      topicTitle,
      phase: 'exercises',
      lesson: null,
      uploadAnalysis: null,
      studyContext
    };
    // Fix 3: unmount ExercisePanel first so it remounts fresh with new session
    setExerciseSession(null);
    setTimeout(() => setExerciseSession(session), 0);
    setActiveSubject(subject);
    setAppState(prev => ({ ...prev, activeView: 'exercise', currentSession: session, activeCourseId: null, activeTopicId: topicId }));
    setMobileMenuOpen(false);
  }, []);

  const handleUploadAnalysis = useCallback((attachments: Attachment[]) => {
    const session: LearningSession = {
      subject: Subject.MATH, // placeholder; overridden by analysis result
      grade: appState.user.gradeLevel,
      topicId: null,
      topicTitle: 'Upload Analysis',
      phase: 'upload_analysis',
      lesson: null,
      uploadAnalysis: null,
      studyContext: attachments
    };
    setAppState(prev => ({ ...prev, activeView: 'lesson', currentSession: session }));
  }, [appState.user.gradeLevel]);

  const handleExerciseComplete = useCallback((xpEarned: number, attemptsTotal: number, attemptsCorrect: number, topicId?: string | null, skillTag?: string) => {
    setAppState(prev => {
      const today = new Date().toISOString();
      const newStreak = calculateStreak(prev.user.streakDays, prev.user.lastActivityDate);
      const newProgressMap = topicId
        ? updateTopicProgress(prev.user.progressMap || {}, topicId, attemptsTotal, attemptsCorrect, skillTag)
        : prev.user.progressMap || {};

      return {
        ...prev,
        user: {
          ...prev.user,
          totalXp: prev.user.totalXp + xpEarned,
          streakDays: newStreak,
          lastActivityDate: today,
          progressMap: newProgressMap
        }
      };
    });
  }, []);

  const handleCodeLabXp = useCallback((xp: number) => {
    handleExerciseComplete(xp, 1, 1, null, 'coding');
  }, [handleExerciseComplete]);

  const handleGamesXp = useCallback((xp: number) => {
    handleExerciseComplete(xp, 1, 1, null, 'games');
  }, [handleExerciseComplete]);

  const startSubjectPractice = (s: Subject) => {
    const grade = appState.user.gradeLevel;
    const cc = getCurriculumCourse(s, grade);
    const firstTopic = cc?.units[0]?.topics[0];
    handleStartExercises(s, grade, firstTopic?.id || null, firstTopic?.title || 'General Practice');
  };

  const handleMaterialStart = (s: Subject, attachments: Attachment[]) => {
    const grade = appState.user.gradeLevel;
    if (attachments.length > 0) {
      handleUploadAnalysis(attachments);
    } else {
      handleStartExercises(s, grade, null, 'General Practice');
    }
  };

  const t = TRANSLATIONS[appState.language];
  const isRtl = appState.language === 'he' || appState.language === 'ar';
  const sidebarHiddenClass = isRtl ? 'translate-x-full' : '-translate-x-full';

  if (!appState.isLoggedIn) {
    return (
      <AuthView
        language={appState.language}
        translations={t}
        theme={appState.theme}
        onLogin={handleLogin}
        onThemeToggle={() => setAppState(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }))}
        onLanguageChange={(l) => setAppState(prev => ({ ...prev, language: l }))}
      />
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300 font-sans overflow-hidden text-gray-900 dark:text-gray-100">

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 w-72 md:w-80 bg-white dark:bg-gray-900 border-e dark:border-gray-800 flex flex-col transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : sidebarHiddenClass}
        ${desktopSidebarOpen ? 'md:translate-x-0' : `md:${sidebarHiddenClass}`}`}
      >
        <div className="p-8">
          <Logo showText={true} size={48} layout="horizontal" />
          <button onClick={() => setMobileMenuOpen(false)} className="absolute top-8 end-6 md:hidden text-gray-500 p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>

        <nav className="flex-1 px-6 space-y-6 overflow-y-auto scrollbar-hide">
          <div>
            <h4 className="px-4 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">{t.learning}</h4>
            <div className="space-y-1">
              {[
                { view: 'dashboard' as const, label: t.dashboard, icon: <LayoutGrid size={18} /> },
                { view: 'courses' as const, label: t.courses, icon: <Library size={18} /> },
                { view: 'progress' as const, label: t.progress, icon: <BarChart2 size={18} /> },
                { view: 'profile' as const, label: t.profile, icon: <UserIcon size={18} /> },
                { view: 'settings' as const, label: t.settings, icon: <Settings size={18} /> },
                { view: 'presentation' as const, label: t.presentationGenerator, icon: <PresentationIcon size={18} /> },
                { view: 'codelab' as const, label: t.codeLab, icon: <Code2 size={18} /> },
                { view: 'games' as const, label: t.educationalGames, icon: <Gamepad2 size={18} /> },
                { view: 'debate' as const, label: t.debateArena, icon: <Swords size={18} /> },
                { view: 'story' as const, label: t.storyEngine, icon: <Feather size={18} /> },
                { view: 'sql-detective' as const, label: t.sqlDetective, icon: <DatabaseIcon size={18} /> },
                { view: 'math-tutor' as const, label: t.mathTutor ?? 'Math Tutor', icon: <span className="font-black text-base">∑</span> },
              ].map(({ view, label, icon }) => (
                <button
                  key={view}
                  onClick={() => navigateTo(view)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${appState.activeView === view ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  {icon}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="px-4 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">{t.subjects}</h4>
            <div className="space-y-1">
              {Object.values(Subject).map(s => {
                const Icon = SUBJECT_ICONS[s];
                const isActive = activeSubject === s && (appState.activeView === 'exercise' || appState.activeView === 'lesson');
                return (
                  <button
                    key={s}
                    onClick={() => startSubjectPractice(s)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-bold text-sm ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                  >
                    <Icon size={16} />
                    <span className="truncate">{t.subjectsList[s]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="p-6 border-t dark:border-gray-800 space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setAppState(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }))}
              className="p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-500 dark:text-gray-300 hover:text-brand-600 transition-colors"
            >
              {appState.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <LanguageSelector currentLang={appState.language} onChange={(l) => setAppState(prev => ({ ...prev, language: l }))} disabled={appState.activeView === 'exercise' || appState.activeView === 'lesson'} />
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-[1.5rem] border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-black shadow-lg">
                {appState.user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black truncate">{appState.user.name}</div>
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t.grades[appState.user.gradeLevel]}</div>
              </div>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest transition-all"
            >
              <LogOut size={12} /> {t.signOut}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      {/* MAIN */}
      <main className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out ${desktopSidebarOpen ? 'md:ms-80' : 'md:ms-0'}`}>
        <header className="sticky top-0 h-20 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b dark:border-gray-800 z-30 px-6 flex items-center justify-between">
          {/* Fix 9: loading bar */}
          {viewLoading && <div className="absolute bottom-0 start-0 end-0 h-0.5 bg-brand-200 dark:bg-brand-900 overflow-hidden"><div className="h-full bg-brand-600 animate-nav-loading" /></div>}
          <div className="flex items-center gap-6">
            <button onClick={toggleSidebar} className="p-2.5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl bg-white dark:bg-gray-900 border dark:border-gray-700 shadow-sm transition-all">
              <Menu size={20} />
            </button>
            <div className="hidden lg:flex items-center gap-3 bg-gray-100 dark:bg-gray-800 border border-transparent px-4 py-2 rounded-xl w-[400px] shadow-sm">
              <Search size={16} className="text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.search}
                className="bg-transparent border-none focus:ring-0 text-sm w-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end px-4 border-e dark:border-gray-700">
              <div className="flex items-center gap-1.5">
                <Trophy size={11} className="text-brand-500" />
                <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">
                  Lv.{Math.floor(appState.user.totalXp / 1000) + 1} · {appState.user.totalXp} XP
                </span>
              </div>
              <div className="h-1 w-28 bg-gray-100 dark:bg-gray-800 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-brand-500 transition-all duration-1000" style={{ width: `${Math.min(100, (appState.user.totalXp % 1000) / 10)}%` }}></div>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-black shadow-lg shadow-brand-500/30">
              {appState.user.name.charAt(0)}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-hide bg-white dark:bg-gray-950">
          <div className="max-w-[1600px] mx-auto w-full h-full">

            {appState.activeView === 'dashboard' && (
              <Dashboard
                user={appState.user}
                courses={courses}
                translations={t}
                searchQuery={searchQuery}
                onSelectCourse={(id) => setAppState(prev => ({ ...prev, activeCourseId: id, activeView: 'courses' }))}
                onResumeTopic={(courseId, topicId) => {
                  const course = courses.find(c => c.id === courseId);
                  const topic = course?.units.flatMap(u => u.topics).find(t => t.id === topicId);
                  if (course && topic) handleStartLesson(course.subject, appState.user.gradeLevel, topicId, topic.title);
                }}
                onSelectSubjectGrade={(s, g) => {
                  setAppState(prev => ({ ...prev, user: { ...prev.user, gradeLevel: g } }));
                  handleStartLesson(s, g, null, 'General Practice');
                }}
                onNavigate={(view) => setAppState(prev => ({ ...prev, activeView: view }))}
              />
            )}

            {appState.activeView === 'courses' && (
              <StudyMaterials
                translations={t}
                userGrade={appState.user.gradeLevel}
                onBack={() => setAppState(prev => ({ ...prev, activeView: 'dashboard', activeCourseId: null }))}
                onStartQuiz={handleMaterialStart}
                onContextUpdate={(ctx) => setAppState(p => ({ ...p, currentContext: ctx }))}
              />
            )}

            {(appState.activeView === 'lesson' || appState.activeView === 'review') && appState.currentSession && (
              <LessonView
                key={`${appState.currentSession.subject}-${appState.currentSession.topicId}`}
                session={appState.currentSession}
                userGrade={appState.user.gradeLevel}
                language={appState.language}
                translations={t}
                onStartExercises={(studyContext, detectedSubject, selectedTopics) => {
                  const s = appState.currentSession!;
                  const subject = detectedSubject ?? s.subject;
                  const topicTitle = selectedTopics && selectedTopics.length > 0
                    ? selectedTopics.join(', ')
                    : detectedSubject
                      ? studyContext.map(a => a.name).join(', ')
                      : s.topicTitle;
                  handleStartExercises(subject, s.grade, s.topicId, topicTitle, studyContext);
                }}
                onBack={() => setAppState(prev => ({ ...prev, activeView: 'dashboard', currentSession: null }))}
                onContextUpdate={(ctx) => setAppState(p => ({ ...p, currentContext: ctx }))}
              />
            )}

            {exerciseSession && (
              <div style={{ display: appState.activeView === 'exercise' ? undefined : 'none' }}>
                <ExercisePanel
                  key={`${exerciseSession.subject}-${exerciseSession.topicId}-${exerciseSession.grade}`}
                  session={exerciseSession}
                  userGrade={appState.user.gradeLevel}
                  language={appState.language}
                  translations={t}
                  onComplete={handleExerciseComplete}
                  onBack={() => {
                    setExerciseSession(null);
                    setAppState(prev => ({ ...prev, activeView: 'dashboard', currentSession: null }));
                  }}
                  onContextUpdate={(ctx) => setAppState(p => ({ ...p, currentContext: ctx }))}
                  onGoToLesson={() => setAppState(prev => ({ ...prev, activeView: 'lesson' }))}
                  onQuizGenerated={(quiz) => setExerciseSession(prev => prev ? { ...prev, quiz } : null)}
                />
              </div>
            )}

            {appState.activeView === 'progress' && (
              <ProgressDashboard
                user={appState.user}
                translations={t}
                language={appState.language}
                onStartPractice={(subject, topicId, topicTitle) => {
                  handleStartExercises(subject, appState.user.gradeLevel, topicId, topicTitle);
                }}
              />
            )}

            {/* Fix 10: Profile view */}
            {appState.activeView === 'profile' && (
              <div className="p-8 max-w-2xl mx-auto space-y-8">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white">{t.profile}</h1>

                {/* Avatar + name */}
                <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 flex flex-col sm:flex-row items-center gap-6 shadow-sm">
                  <div className="w-20 h-20 rounded-2xl bg-brand-600 flex items-center justify-center text-white text-4xl font-black shadow-lg shadow-brand-500/30">
                    {appState.user.name.charAt(0)}
                  </div>
                  <div className="text-center sm:text-start">
                    <div className="text-2xl font-black text-gray-900 dark:text-white">{appState.user.name}</div>
                    <div className="text-sm text-gray-400 font-bold">@{appState.user.username}</div>
                    <div className="mt-1 text-xs text-brand-600 font-black uppercase tracking-widest">{t.grades[appState.user.gradeLevel]}</div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { icon: <Trophy size={20} className="text-yellow-500" />, label: 'Level', value: String(Math.floor(appState.user.totalXp / 1000) + 1) },
                    { icon: <Star size={20} className="text-brand-500" />, label: t.xp, value: String(appState.user.totalXp) },
                    { icon: <Flame size={20} className="text-orange-500" />, label: t.streak, value: `${appState.user.streakDays}d` },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 flex flex-col items-center gap-2 shadow-sm">
                      {icon}
                      <div className="text-2xl font-black text-gray-900 dark:text-white">{value}</div>
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</div>
                    </div>
                  ))}
                </div>

                {/* XP progress to next level */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-black text-gray-700 dark:text-gray-200">Progress to Level {Math.floor(appState.user.totalXp / 1000) + 2}</span>
                    <span className="text-xs font-black text-brand-600">{appState.user.totalXp % 1000} / 1000 XP</span>
                  </div>
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all duration-1000" style={{ width: `${(appState.user.totalXp % 1000) / 10}%` }} />
                  </div>
                </div>

                {/* Enrolled courses */}
                {Object.keys(appState.user.progressMap || {}).length > 0 && (
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
                    <h3 className="font-black text-gray-900 dark:text-white mb-4">{t.mastery} by Topic</h3>
                    <div className="space-y-3">
                      {(Object.values(appState.user.progressMap) as import('./types').TopicProgress[]).slice(0, 5).map(tp => {
                        // Look up topic title from CURRICULUM
                        let topicTitle = tp.topicId;
                        for (const course of CURRICULUM) {
                          for (const unit of course.units) {
                            const found = unit.topics.find(t => t.id === tp.topicId);
                            if (found) { topicTitle = found.title; break; }
                          }
                          if (topicTitle !== tp.topicId) break;
                        }
                        return (
                        <div key={tp.topicId}>
                          <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                            <span className="truncate">{topicTitle}</span>
                            <span>{tp.mastery}%</span>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${tp.mastery}%` }} />
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {appState.activeView === 'settings' && (
              <SettingsView
                user={appState.user}
                translations={t}
                theme={appState.theme}
                language={appState.language}
                onProfileUpdate={({ name, username }) =>
                  setAppState(prev => ({ ...prev, user: { ...prev.user, name, username } }))
                }
                onGradeChange={(grade) => setAppState(prev => ({ ...prev, user: { ...prev.user, gradeLevel: grade } }))}
                onThemeToggle={() => setAppState(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }))}
                onLanguageChange={(l) => setAppState(prev => ({ ...prev, language: l }))}
              />
            )}

            {appState.activeView === 'presentation' && (
              <PresentationView
                userGrade={appState.user.gradeLevel}
                language={appState.language}
                translations={t}
                theme={appState.theme}
                onBack={() => setAppState(prev => ({ ...prev, activeView: 'dashboard' }))}
                onContextUpdate={(ctx) => setAppState(p => ({ ...p, currentContext: ctx }))}
              />
            )}

            {appState.activeView === 'codelab' && (
              <CodeLab
                userGrade={appState.user.gradeLevel}
                language={appState.language}
                translations={t}
                theme={appState.theme}
                onBack={() => setAppState(prev => ({ ...prev, activeView: 'dashboard' }))}
                onXpEarned={handleCodeLabXp}
                onContextUpdate={(ctx) => setAppState(p => ({ ...p, currentContext: ctx }))}
              />
            )}

            {appState.activeView === 'games' && (
              <EducationalGames
                userGrade={appState.user.gradeLevel}
                language={appState.language}
                translations={t}
                onBack={() => setAppState(prev => ({ ...prev, activeView: 'dashboard' }))}
                onXpEarned={handleGamesXp}
                onContextUpdate={(ctx) => setAppState(p => ({ ...p, currentContext: ctx }))}
              />
            )}

            {appState.activeView === 'debate' && (
              <DebateArena
                userGrade={appState.user.gradeLevel}
                language={appState.language}
                translations={t}
                onBack={() => setAppState(prev => ({ ...prev, activeView: 'dashboard' }))}
                onXpEarned={(xp) => handleExerciseComplete(xp, 1, 1, null, 'debate')}
                onContextUpdate={(ctx) => setAppState(p => ({ ...p, currentContext: ctx }))}
              />
            )}

            {appState.activeView === 'story' && (
              <StoryEngine
                userGrade={appState.user.gradeLevel}
                language={appState.language}
                translations={t}
                onBack={() => setAppState(prev => ({ ...prev, activeView: 'dashboard' }))}
                onXpEarned={(xp) => handleExerciseComplete(xp, 1, 1, null, 'story')}
                onContextUpdate={(ctx) => setAppState(p => ({ ...p, currentContext: ctx }))}
              />
            )}

            {appState.activeView === 'sql-detective' && (
              <SqlDetective
                userGrade={appState.user.gradeLevel}
                language={appState.language}
                translations={t}
                onBack={() => setAppState(prev => ({ ...prev, activeView: 'dashboard' }))}
                onXpEarned={(xp) => handleExerciseComplete(xp, 1, 1, null, 'sql-detective')}
                onContextUpdate={(ctx) => setAppState(p => ({ ...p, currentContext: ctx }))}
              />
            )}

            {appState.activeView === 'math-tutor' && (
              <MathTutorView
                userGrade={appState.user.gradeLevel}
                language={appState.language}
                translations={t}
                theme={appState.theme}
                onBack={() => setAppState(prev => ({ ...prev, activeView: 'dashboard' }))}
                onXpEarned={(xp) => handleExerciseComplete(xp, 1, 1, null, 'math')}
                onContextUpdate={(ctx) => setAppState(p => ({ ...p, currentContext: ctx }))}
              />
            )}

          </div>
        </div>
      </main>

      <FloatingChat
        userGrade={appState.user.gradeLevel}
        language={appState.language}
        context={appState.currentContext}
        translations={t}
        activeView={appState.activeView}
        currentSession={appState.currentSession}
      />

      {/* Fix 4: Logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl border border-gray-100 dark:border-gray-800 max-w-sm w-full mx-4 animate-in slide-in-from-bottom-4 fade-in duration-200">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 mx-auto mb-4">
              <LogOut size={24} className="text-red-500" />
            </div>
            <h3 className="text-xl font-black text-center text-gray-900 dark:text-white mb-2">Sign out?</h3>
            <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">Your progress is saved. You can sign back in anytime.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-sm font-black text-gray-600 dark:text-gray-300 hover:border-gray-300 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-black hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                {t.signOut}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fix 5: Level-up toast */}
      {levelUpToast !== null && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-toast-in">
          <div className="flex items-center gap-3 bg-brand-600 text-white px-6 py-3 rounded-2xl shadow-2xl shadow-brand-500/30 font-black">
            <Trophy size={20} />
            <span>Level {levelUpToast} reached!</span>
            <Star size={16} className="fill-white" />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
