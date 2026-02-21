
import React, { useState, useEffect, useCallback } from 'react';
import {
  AppState, Subject, GradeLevel, UserProfile, Attachment,
  LearningSession, ProgressMap, TopicProgress, Course
} from './types';
import { TRANSLATIONS, CURRICULUM, getCurriculumCourse, buildCourseFromCurriculum } from './constants';
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
  Calculator, FlaskConical, Globe, Laptop, BookOpen, TrendingUp, LogOut, BarChart2, Settings
} from 'lucide-react';

const SESSION_KEY = 'brainwave_session_v2';
const USERS_DB_KEY = 'brainwave_users_db';

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

  // Build courses from CURRICULUM + user progress
  useEffect(() => {
    if (!appState.isLoggedIn) return;
    const grade = appState.user.gradeLevel;
    const progressMap = appState.user.progressMap || {};
    const built: Course[] = CURRICULUM
      .filter(cc => cc.gradeLevel === grade || CURRICULUM.every(c => c.gradeLevel !== grade))
      .map(cc => buildCourseFromCurriculum(cc, progressMap, appState.language));
    // Deduplicate by subject — keep best-matching grade
    const seen = new Set<string>();
    const deduped = built.filter(c => {
      if (seen.has(c.subject)) return false;
      seen.add(c.subject);
      return true;
    });
    setCourses(deduped);
  }, [appState.language, appState.user.gradeLevel, appState.user.progressMap, appState.isLoggedIn]);

  // Persistence effect
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
        usersDb[appState.user.id] = appState.user;
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(usersDb));
      } catch (e) {
        console.error("Failed to save user data", e);
      }
    }

    if (appState.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    const isRtl = appState.language === 'he' || appState.language === 'ar';
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = appState.language;
  }, [appState.theme, appState.language, appState.user, appState.isLoggedIn]);

  const toggleSidebar = () => {
    if (window.innerWidth >= 768) setDesktopSidebarOpen(d => !d);
    else setMobileMenuOpen(m => !m);
  };

  const handleLogin = (userData: Partial<UserProfile>) => {
    const fullUser: UserProfile = { ...DEFAULT_USER, ...userData, progressMap: (userData as any).progressMap || {} } as UserProfile;
    setAppState(prev => ({
      ...prev,
      isLoggedIn: true,
      user: fullUser,
      language: fullUser.preferredLanguage || prev.language
    }));
  };

  const handleLogout = () => {
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
    setExerciseSession(session);
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
                { view: 'settings' as const, label: t.settings, icon: <Settings size={18} /> },
              ].map(({ view, label, icon }) => (
                <button
                  key={view}
                  onClick={() => { setAppState(prev => ({ ...prev, activeView: view, activeCourseId: null, activeTopicId: null, currentSession: null })); setActiveSubject(null); setMobileMenuOpen(false); }}
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
              onClick={handleLogout}
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
              <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{appState.user.totalXp} XP</span>
              <div className="h-1 w-24 bg-gray-100 dark:bg-gray-800 rounded-full mt-1 overflow-hidden">
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
                onStartExercises={(studyContext) => {
                  const s = appState.currentSession!;
                  handleStartExercises(s.subject, s.grade, s.topicId, s.topicTitle, studyContext);
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


          </div>
        </div>
      </main>

      <FloatingChat
        userGrade={appState.user.gradeLevel}
        language={appState.language}
        context={appState.currentContext}
        translations={t}
        activeView={appState.activeView}
      />
    </div>
  );
};

export default App;
