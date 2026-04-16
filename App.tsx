import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppState, Subject, GradeLevel, UserProfile, Attachment,
  LearningSession, ProgressMap, TopicProgress, Course
} from './types';
import { TRANSLATIONS, CURRICULUM, getCurriculumCourse, buildCourseFromCurriculum } from './constants';

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

import {
  LayoutGrid, Library, Menu, X, Moon, Sun, Search,
  Calculator, FlaskConical, Globe, Laptop, BookOpen, TrendingUp,
  LogOut, BarChart2, Settings,
  GraduationCap, User as UserIcon, Trophy, Flame, Star,
  ChevronLeft, ChevronRight, Sparkles, Zap
} from 'lucide-react';

const SESSION_KEY = 'brainwave_session_v2';
const USERS_DB_KEY = 'brainwave_users_db';

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

const calculateStreak = (currentStreak: number, lastActivityDate?: string): number => {
  if (!lastActivityDate) return 1;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const last = new Date(lastActivityDate).toDateString();
  if (last === today) return currentStreak;
  if (last === yesterday) return currentStreak + 1;
  return 1;
};

// ─── NAV CONFIG ───────────────────────────────────────────────────────────────

type NavView = AppState['activeView'];

interface NavItem {
  view: NavView;
  label: string;
  icon: React.ReactNode;
  section: 'learn' | 'account';
}

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
  const [exerciseSession, setExerciseSession] = useState<LearningSession | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [levelUpToast, setLevelUpToast] = useState<number | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const prevXpRef = useRef(appState.user.totalXp);
  const serverSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestUserRef = useRef(appState.user);

  // Build courses
  useEffect(() => {
    if (!appState.isLoggedIn) return;
    const grade = appState.user.gradeLevel;
    const progressMap = appState.user.progressMap || {};

    let filtered = CURRICULUM.filter(cc => cc.gradeLevel === grade);
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
    const seen = new Set<string>();
    const deduped = built.filter(c => {
      if (seen.has(c.subject)) return false;
      seen.add(c.subject);
      return true;
    });
    setCourses(deduped);
  }, [appState.language, appState.user.gradeLevel, appState.user.progressMap, appState.isLoggedIn]);

  // Persistence
  useEffect(() => {
    const session = {
      isLoggedIn: appState.isLoggedIn,
      theme: appState.theme,
      language: appState.language,
      lastUserId: appState.user?.id || null
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    if (appState.isLoggedIn && appState.user?.id) {
      try {
        const usersDb = JSON.parse(localStorage.getItem(USERS_DB_KEY) || '{}');
        const existing = usersDb[appState.user.id] || {};
        usersDb[appState.user.id] = { ...existing, ...appState.user };
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(usersDb));
      } catch (e) {
        console.error("Failed to save user data to localStorage", e);
      }
      latestUserRef.current = appState.user;
      if (serverSyncTimerRef.current) clearTimeout(serverSyncTimerRef.current);
      serverSyncTimerRef.current = setTimeout(() => {
        const u = latestUserRef.current;
        fetch(`${API_BASE}/api/user/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: u.id, userData: u }),
        }).catch(() => {});
      }, 2000);
    }
  }, [appState.isLoggedIn, appState.user, appState.language]);

  // Theme + RTL/LTR direction
  useEffect(() => {
    if (appState.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    const isRtl = appState.language === 'he' || appState.language === 'ar';
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = appState.language;
  }, [appState.theme, appState.language]);

  // Level-up detection
  useEffect(() => {
    const newXp = appState.user.totalXp;
    const prevXp = prevXpRef.current;
    if (Math.floor(newXp / 1000) > Math.floor(prevXp / 1000)) {
      const newLevel = Math.floor(newXp / 1000) + 1;
      setLevelUpToast(newLevel);
      const timer = setTimeout(() => setLevelUpToast(null), 3000);
      prevXpRef.current = newXp;
      return () => clearTimeout(timer);
    }
    prevXpRef.current = newXp;
  }, [appState.user.totalXp]);

  const navigateTo = useCallback((view: AppState['activeView']) => {
    setViewLoading(true);
    setTimeout(() => {
      setViewLoading(false);
      setAppState(prev => ({ ...prev, activeView: view, activeCourseId: null, activeTopicId: null, currentSession: null }));
      setActiveSubject(null);
      setMobileMenuOpen(false);
    }, 150);
  }, []);

  const handleLogin = useCallback((userData: Partial<UserProfile>) => {
    const fullUser: UserProfile = { ...DEFAULT_USER, ...userData, progressMap: (userData as any).progressMap || {} } as UserProfile;
    const updatedStreak = calculateStreak(fullUser.streakDays, fullUser.lastActivityDate);
    const userWithStreak = { ...fullUser, streakDays: updatedStreak };

    setAppState(prev => ({
      ...prev,
      isLoggedIn: true,
      user: userWithStreak,
      language: userWithStreak.preferredLanguage || prev.language
    }));

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
  }, []);

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    setAppState(prev => ({ ...DEFAULT_STATE, theme: prev.theme, language: prev.language }));
  };

  // ── SESSION HANDLERS ─────────────────────────────────────────────────────

  const handleStartLesson = useCallback((subject: Subject, grade: GradeLevel, topicId: string | null, topicTitle: string) => {
    const session: LearningSession = {
      subject, grade, topicId, topicTitle,
      phase: 'lesson', lesson: null, uploadAnalysis: null, studyContext: []
    };
    setActiveSubject(subject);
    setAppState(prev => ({ ...prev, activeView: 'lesson', currentSession: session, activeCourseId: null, activeTopicId: topicId }));
    setMobileMenuOpen(false);
  }, []);

  const handleStartExercises = useCallback((subject: Subject, grade: GradeLevel, topicId: string | null, topicTitle: string, studyContext: Attachment[] = []) => {
    const session: LearningSession = {
      subject, grade, topicId, topicTitle,
      phase: 'exercises', lesson: null, uploadAnalysis: null, studyContext
    };
    setExerciseSession(null);
    setTimeout(() => setExerciseSession(session), 0);
    setActiveSubject(subject);
    setAppState(prev => ({ ...prev, activeView: 'exercise', currentSession: session, activeCourseId: null, activeTopicId: topicId }));
    setMobileMenuOpen(false);
  }, []);

  const handleUploadAnalysis = useCallback((attachments: Attachment[]) => {
    const session: LearningSession = {
      subject: Subject.MATH,
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

  const startSubjectPractice = useCallback((s: Subject) => {
    const grade = appState.user.gradeLevel;
    const cc = getCurriculumCourse(s, grade);
    const firstTopic = cc?.units[0]?.topics[0];
    handleStartExercises(s, grade, firstTopic?.id || null, firstTopic?.title || 'General Practice');
  }, [appState.user.gradeLevel, handleStartExercises]);

  const handleMaterialStart = useCallback((s: Subject, attachments: Attachment[]) => {
    const grade = appState.user.gradeLevel;
    if (attachments.length > 0) {
      handleUploadAnalysis(attachments);
    } else {
      handleStartExercises(s, grade, null, 'General Practice');
    }
  }, [appState.user.gradeLevel, handleUploadAnalysis, handleStartExercises]);

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

  // ── NAV ITEMS ──────────────────────────────────────────────────────────────

  const NAV_ITEMS: NavItem[] = [
    { view: 'dashboard', label: t.dashboard, icon: <LayoutGrid size={18} />, section: 'learn' },
    { view: 'courses', label: t.courses ?? 'Study Materials', icon: <Library size={18} />, section: 'learn' },
    { view: 'progress', label: t.progress, icon: <BarChart2 size={18} />, section: 'learn' },
    { view: 'profile', label: t.profile, icon: <UserIcon size={18} />, section: 'account' },
    { view: 'settings', label: t.settings, icon: <Settings size={18} />, section: 'account' },
  ];

  const level = Math.floor(appState.user.totalXp / 1000) + 1;
  const xpInLevel = appState.user.totalXp % 1000;

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300 font-sans overflow-hidden text-zinc-900 dark:text-zinc-100">

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 bg-zinc-950 flex flex-col transform transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${mobileMenuOpen ? 'translate-x-0' : sidebarHiddenClass}
          ${sidebarCollapsed ? 'md:w-[72px]' : 'md:w-[240px]'}
          md:translate-x-0 w-[240px]`}
      >
        {/* Logo area */}
        <div className={`flex items-center h-[60px] border-b border-white/[0.06] flex-shrink-0 ${sidebarCollapsed ? 'px-3 justify-center' : 'px-4 justify-between'}`}>
          {!sidebarCollapsed ? (
            <>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Sparkles size={15} className="text-white" />
                </div>
                <span className="font-bold text-base tracking-tight text-white">BrainWave</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="md:hidden text-zinc-500 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="hidden md:flex text-zinc-500 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  title="Collapse sidebar"
                >
                  <ChevronLeft size={15} />
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30"
              title="Expand sidebar"
            >
              <Sparkles size={15} className="text-white" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto sidebar-scroll px-2.5">
          {/* LEARN section */}
          {!sidebarCollapsed && (
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 px-2.5 mb-2">
              {t.learning}
            </div>
          )}
          <div className="space-y-0.5 mb-4">
            {NAV_ITEMS.filter(i => i.section === 'learn').map(({ view, label, icon }) => {
              const isActive = appState.activeView === view;
              return (
                <button
                  key={view}
                  onClick={() => navigateTo(view)}
                  title={sidebarCollapsed ? label : undefined}
                  className={`w-full flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-200
                    ${sidebarCollapsed ? 'px-2.5 py-2.5 justify-center' : 'px-3 py-2.5'}
                    ${isActive
                      ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/10 text-white'
                      : 'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300'
                    }`}
                >
                  <span className={`flex-shrink-0 ${isActive ? 'text-indigo-400' : ''}`}>{icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{label}</span>}
                  {isActive && !sidebarCollapsed && (
                    <span className="ms-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Subjects quick access */}
          {!sidebarCollapsed && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 px-2.5 mb-2 mt-3">
                {t.subjects}
              </div>
              <div className="space-y-0.5 mb-4">
                {Object.values(Subject).map(s => {
                  const Icon = SUBJECT_ICONS[s];
                  const isActive = activeSubject === s && (appState.activeView === 'exercise' || appState.activeView === 'lesson');
                  return (
                    <button
                      key={s}
                      onClick={() => startSubjectPractice(s)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/10 text-white'
                          : 'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300'
                      }`}
                    >
                      <Icon size={15} />
                      <span className="truncate">{t.subjectsList[s]}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Divider */}
          {sidebarCollapsed ? (
            <div className="h-px bg-white/[0.06] my-3 mx-2" />
          ) : (
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 px-2.5 mb-2 mt-3">
              Account
            </div>
          )}

          {/* Account section */}
          <div className="space-y-0.5">
            {NAV_ITEMS.filter(i => i.section === 'account').map(({ view, label, icon }) => {
              const isActive = appState.activeView === view;
              return (
                <button
                  key={view}
                  onClick={() => navigateTo(view)}
                  title={sidebarCollapsed ? label : undefined}
                  className={`w-full flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-200
                    ${sidebarCollapsed ? 'px-2.5 py-2.5 justify-center' : 'px-3 py-2.5'}
                    ${isActive
                      ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/10 text-white'
                      : 'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300'
                    }`}
                >
                  <span className="flex-shrink-0">{icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{label}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        {/* User card */}
        <div className={`border-t border-white/[0.06] py-3 flex-shrink-0 ${sidebarCollapsed ? 'px-2.5' : 'px-3'}`}>
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm font-bold flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                {appState.user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate leading-tight">{appState.user.name}</div>
                <div className="text-[10px] text-zinc-500 leading-tight mt-0.5 flex items-center gap-1">
                  <Zap size={9} className="text-indigo-400" />
                  Lv.{level} · {appState.user.totalXp} XP
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <LanguageSelector currentLang={appState.language} onChange={(l) => setAppState(prev => ({ ...prev, language: l }))} disabled={appState.activeView === 'exercise' || appState.activeView === 'lesson'} />
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                  title={t.signOut}
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm font-bold flex items-center justify-center shadow-lg shadow-indigo-500/20">
                {appState.user.name.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* ── MAIN ─────────────────────────────────────────────────────────────── */}
      <main className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        ${sidebarCollapsed ? 'md:ms-[72px]' : 'md:ms-[240px]'}`}
      >
        {/* HEADER */}
        <header className="sticky top-0 h-[56px] glass border-b border-zinc-100 dark:border-zinc-800/80 z-30 px-4 flex items-center justify-between flex-shrink-0">
          {viewLoading && (
            <div className="absolute bottom-0 start-0 end-0 h-[2px] bg-brand-100 dark:bg-brand-900/40 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-500 to-violet-500 animate-nav-loading rounded-full" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.innerWidth >= 768) setSidebarCollapsed(c => !c);
                else setMobileMenuOpen(m => !m);
              }}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200"
            >
              <Menu size={18} />
            </button>
            <div className="hidden lg:flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 rounded-xl px-3.5 py-2 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
              <Search size={14} className="text-zinc-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.search}
                className="bg-transparent border-none text-sm w-52 outline-none text-zinc-700 dark:text-zinc-200 placeholder-zinc-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Streak badge */}
            {appState.user.streakDays > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 px-3 py-1.5 rounded-xl text-xs font-bold border border-orange-100 dark:border-orange-900/40 transition-all">
                <Flame size={12} fill="currentColor" />
                <span>{appState.user.streakDays}d</span>
              </div>
            )}
            {/* XP badge */}
            <div className="hidden sm:flex items-center gap-1.5 bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 px-3 py-1.5 rounded-xl text-xs font-bold border border-brand-100 dark:border-brand-900/40 transition-all">
              <Trophy size={12} />
              <span>Lv.{level}</span>
              <span className="text-brand-400 dark:text-brand-500">·</span>
              <span>{appState.user.totalXp} XP</span>
            </div>
            {/* XP mini progress */}
            <div className="hidden md:flex items-center gap-1.5 w-20">
              <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-brand-500 to-violet-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${xpInLevel / 10}%` }} />
              </div>
            </div>
            {/* Theme toggle */}
            <button
              onClick={() => setAppState(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }))}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200"
            >
              {appState.theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            {/* Avatar */}
            <button
              onClick={() => navigateTo('profile')}
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white text-sm font-bold flex items-center justify-center shadow-brand hover:shadow-glow transition-shadow duration-300"
            >
              {appState.user.name.charAt(0).toUpperCase()}
            </button>
          </div>
        </header>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto scrollbar-hide bg-zinc-50 dark:bg-zinc-950">
          <div className="max-w-[1600px] mx-auto w-full h-full">

            {appState.activeView === 'dashboard' && (
              <div className="view-enter">
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
                />
              </div>
            )}

            {appState.activeView === 'courses' && (
              <div className="view-enter">
                <StudyMaterials
                  translations={t}
                  userGrade={appState.user.gradeLevel}
                  onBack={() => setAppState(prev => ({ ...prev, activeView: 'dashboard', activeCourseId: null }))}
                  onStartQuiz={handleMaterialStart}
                  onContextUpdate={(ctx) => setAppState(p => ({ ...p, currentContext: ctx }))}
                />
              </div>
            )}

            {(appState.activeView === 'lesson' || appState.activeView === 'review') && appState.currentSession && (
              <div className="view-enter">
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
              </div>
            )}

            {exerciseSession && (
              <div style={{ display: appState.activeView === 'exercise' ? undefined : 'none' }} className="view-enter">
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
              <div className="view-enter">
                <ProgressDashboard
                  user={appState.user}
                  translations={t}
                  language={appState.language}
                  onStartPractice={(subject, topicId, topicTitle) => {
                    handleStartExercises(subject, appState.user.gradeLevel, topicId, topicTitle);
                  }}
                />
              </div>
            )}

            {appState.activeView === 'profile' && (
              <div className="view-enter p-6 md:p-10 max-w-2xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t.profile}</h1>

                {/* Avatar + name */}
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 p-8 flex flex-col sm:flex-row items-center gap-6 shadow-card">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-4xl font-bold shadow-brand ring-4 ring-brand-100 dark:ring-brand-900/30">
                    {appState.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-center sm:text-start">
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">{appState.user.name}</div>
                    <div className="text-sm text-zinc-400 font-medium">@{appState.user.username}</div>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 rounded-xl text-xs font-bold border border-brand-100 dark:border-brand-900/40">
                      <GraduationCap size={12} />
                      {t.grades[appState.user.gradeLevel]}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { icon: <Trophy size={22} className="text-yellow-500" />, label: 'Level', value: String(level), bg: 'bg-yellow-50 dark:bg-yellow-950/20', border: 'border-yellow-100 dark:border-yellow-900/30' },
                    { icon: <Star size={22} className="text-brand-500" />, label: t.xp, value: String(appState.user.totalXp), bg: 'bg-brand-50 dark:bg-brand-950/20', border: 'border-brand-100 dark:border-brand-900/30' },
                    { icon: <Flame size={22} className="text-orange-500" />, label: t.streak, value: `${appState.user.streakDays}d`, bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-100 dark:border-orange-900/30' },
                  ].map(({ icon, label, value, bg, border }) => (
                    <div key={label} className={`${bg} rounded-2xl p-5 flex flex-col items-center gap-2.5 border ${border}`}>
                      {icon}
                      <div className="text-2xl font-bold text-zinc-900 dark:text-white count-in">{value}</div>
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</div>
                    </div>
                  ))}
                </div>

                {/* XP progress */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-6 shadow-card">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Progress to Level {level + 1}</span>
                    <span className="text-xs font-bold text-brand-600">{xpInLevel} / 1000 XP</span>
                  </div>
                  <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand-500 to-violet-500 rounded-full transition-all duration-1000" style={{ width: `${xpInLevel / 10}%` }} />
                  </div>
                </div>

                {/* Topic mastery */}
                {Object.keys(appState.user.progressMap || {}).length > 0 && (
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-6 shadow-card">
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-4">{t.mastery} by Topic</h3>
                    <div className="space-y-4">
                      {(Object.values(appState.user.progressMap) as TopicProgress[]).slice(0, 5).map(tp => {
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
                            <div className="flex justify-between text-xs font-medium text-zinc-500 mb-2">
                              <span className="truncate">{topicTitle}</span>
                              <span className="font-bold text-brand-600">{tp.mastery}%</span>
                            </div>
                            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-brand-500 to-violet-500 rounded-full transition-all" style={{ width: `${tp.mastery}%` }} />
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
              <div className="view-enter">
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
              </div>
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

      {/* Logout confirmation */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/60 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-xl border border-zinc-100 dark:border-zinc-800 max-w-sm w-full mx-4 animate-pop">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/30 mx-auto mb-4">
              <LogOut size={24} className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-center text-zinc-900 dark:text-white mb-2">Sign out?</h3>
            <p className="text-sm text-center text-zinc-500 dark:text-zinc-400 mb-6">Your progress is saved. You can sign back in anytime.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                {t.signOut}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Level-up toast */}
      {levelUpToast !== null && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-toast-in">
          <div className="flex items-center gap-3 bg-gradient-to-r from-brand-500 to-violet-500 text-white px-6 py-3.5 rounded-2xl shadow-2xl shadow-brand-500/30 font-bold border border-white/20">
            <Trophy size={18} />
            <span>Level {levelUpToast} reached!</span>
            <Star size={14} className="fill-white" />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
