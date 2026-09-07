import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  AppState,
  Subject,
  GradeLevel,
  UserProfile,
  Attachment,
  SkillAttemptEvent,
  ErrorQuest,
  LearningSession,
  ProgressMap,
  TopicProgress,
  Course,
  TutorMode,
} from "./types";
import {
  TRANSLATIONS,
  CURRICULUM,
  getCurriculumCourse,
  buildCourseFromCurriculum,
} from "./constants";
import {
  DEFAULT_DAILY_GOAL,
  DEFAULT_STREAK_FREEZES,
  localDayKey,
  rolloverDailyXp,
  calculateStreakWithFreeze,
  applyXpGain,
  ACHIEVEMENTS_BY_ID,
} from "./services/engagement";
import { recordAttempt, mergeSkillMaps } from "./services/masteryEngine";
import {
  findQuestCandidates,
  buildQuest,
  scheduleQuestFollowUp,
  recordQuestCompletion,
  MAX_ACTIVE_QUESTS,
} from "./services/questEngine";
import MasteryMap from "./components/MasteryMap";
import ErrorQuestView from "./components/ErrorQuest";
import ComebackView from "./components/ComebackView";
import {
  comebackEligible,
  recordComebackQuestions,
} from "./services/comebackEngine";
import MemoryDungeon from "./components/MemoryDungeon";
import {
  recordDungeonHistory,
  DungeonSkillSeed,
} from "./services/dungeonEngine";
import { buildLearnerSummary } from "./services/learnerMemory";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

import LanguageSelector from "./components/LanguageSelector";
import ExercisePanel from "./components/ExercisePanel";
import StudyHub from "./components/StudyHub";
import StudyProgress from "./components/StudyProgress";
import { ContextTutor } from "./components/StudyTutor";
import { studyCopy } from "./services/studyCopy";
import { applyStudyResults } from "./services/studyEngine";
import "./study.css";
import StudyMaterials from "./components/StudyMaterials";
import FloatingChat from "./components/FloatingChat";
import AuthView from "./components/AuthView";
import LessonView from "./components/LessonView";
import ProgressDashboard from "./components/ProgressDashboard";
import SettingsView from "./components/Settings";
import Logo from "./components/Logo";
import Achievements from "./components/Achievements";
import Leaderboard from "./components/Leaderboard";

import {
  LayoutGrid,
  Library,
  Menu,
  X,
  Moon,
  Sun,
  Search,
  Calculator,
  FlaskConical,
  Globe,
  Laptop,
  BookOpen,
  TrendingUp,
  LogOut,
  BarChart2,
  Settings,
  GraduationCap,
  User as UserIcon,
  Trophy,
  Flame,
  Star,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
  Target,
  Award,
  Map,
  Castle,
} from "lucide-react";
import Confetti from "./components/Confetti";

const SESSION_KEY = "brainwave_session_v2";
const USERS_DB_KEY = "brainwave_users_db";

// Tiny translation map for App.tsx strings (logout modal, level-up toast, profile section)
type AppLangKey = "en" | "ru" | "he" | "ar";
const APP_COPY: Record<
  AppLangKey,
  {
    signOutTitle: string;
    signOutDesc: string;
    cancel: string;
    levelReached: (n: number) => string;
    progressToLevel: (n: number) => string;
    masteryByTopic: string;
  }
> = {
  en: {
    signOutTitle: "Sign out?",
    signOutDesc: "Your progress is saved. You can sign back in anytime.",
    cancel: "Cancel",
    levelReached: (n) => `Level ${n} reached!`,
    progressToLevel: (n) => `Progress to Level ${n}`,
    masteryByTopic: "Mastery by Topic",
  },
  ru: {
    signOutTitle: "Выйти?",
    signOutDesc: "Прогресс сохранён. Можешь вернуться когда угодно.",
    cancel: "Отмена",
    levelReached: (n) => `Достигнут уровень ${n}!`,
    progressToLevel: (n) => `Прогресс до уровня ${n}`,
    masteryByTopic: "Освоение по темам",
  },
  he: {
    signOutTitle: "להתנתק?",
    signOutDesc: "ההתקדמות שלך שמורה. תמיד אפשר לחזור.",
    cancel: "ביטול",
    levelReached: (n) => `הגעת לשלב ${n}!`,
    progressToLevel: (n) => `התקדמות לשלב ${n}`,
    masteryByTopic: "שליטה לפי נושא",
  },
  ar: {
    signOutTitle: "تسجيل الخروج؟",
    signOutDesc: "تقدمك محفوظ. يمكنك العودة في أي وقت.",
    cancel: "إلغاء",
    levelReached: (n) => `وصلت إلى المستوى ${n}!`,
    progressToLevel: (n) => `التقدم إلى المستوى ${n}`,
    masteryByTopic: "الإتقان حسب الموضوع",
  },
};
const getAppCopy = (lang: string) =>
  APP_COPY[(APP_COPY[lang as AppLangKey] ? lang : "en") as AppLangKey];

const GRADE_ORDINAL: Partial<Record<GradeLevel, number>> = {
  [GradeLevel.KINDER]: 0,
  [GradeLevel.GRADE_1]: 1,
  [GradeLevel.GRADE_2]: 2,
  [GradeLevel.GRADE_3]: 3,
  [GradeLevel.ELEMENTARY_1_3]: 2,
  [GradeLevel.GRADE_4]: 4,
  [GradeLevel.GRADE_5]: 5,
  [GradeLevel.GRADE_6]: 6,
  [GradeLevel.ELEMENTARY_4_6]: 5,
  [GradeLevel.GRADE_7]: 7,
  [GradeLevel.GRADE_8]: 8,
  [GradeLevel.MIDDLE_7_8]: 7,
  [GradeLevel.GRADE_9]: 9,
  [GradeLevel.GRADE_10]: 10,
  [GradeLevel.HIGH_9_10]: 9,
  [GradeLevel.GRADE_11]: 11,
  [GradeLevel.GRADE_12]: 12,
  [GradeLevel.HIGH_11_12]: 11,
  [GradeLevel.COLLEGE_FRESHMAN]: 13,
  [GradeLevel.COLLEGE_ADVANCED]: 15,
};

const SUBJECT_ICONS: Record<string, React.ElementType> = {
  [Subject.MATH]: Calculator,
  [Subject.SCIENCE]: FlaskConical,
  [Subject.GEOGRAPHY]: Globe,
  [Subject.CODING]: Laptop,
  [Subject.HISTORY]: BookOpen,
  [Subject.ECONOMICS]: TrendingUp,
};

const DEFAULT_USER: UserProfile = {
  id: "",
  username: "",
  name: "Student",
  gradeLevel: GradeLevel.HIGH_9_10,
  preferredLanguage: "en",
  enrolledCourses: [],
  totalXp: 0,
  streakDays: 0,
  isRegistered: false,
  progressMap: {},
  dailyXpGoal: DEFAULT_DAILY_GOAL,
  todayXp: 0,
  streakFreezes: DEFAULT_STREAK_FREEZES,
  bestStreak: 0,
  dailyGoalsMet: 0,
  unlockedAchievements: [],
  soundEnabled: false,
  skillMap: {},
  activeQuests: [],
  completedQuests: [],
  questBadges: [],
};

const DEFAULT_STATE: AppState = {
  isLoggedIn: false,
  theme: "light",
  language: "en",
  activeView: "dashboard",
  activeCourseId: null,
  activeTopicId: null,
  currentSession: null,
  messages: [],
  currentContext: "Dashboard",
  user: DEFAULT_USER,
};

// ─── PROGRESS HELPERS ──────────────────────────────────────────────────────────

const updateTopicProgress = (
  prev: ProgressMap,
  topicId: string,
  attemptsTotal: number,
  attemptsCorrect: number,
  skillTag?: string,
): ProgressMap => {
  const existing = prev[topicId] || {
    topicId,
    mastery: 0,
    attemptsTotal: 0,
    attemptsCorrect: 0,
    lastPracticed: new Date().toISOString(),
    skills: {},
  };

  const newTotal = existing.attemptsTotal + attemptsTotal;
  const newCorrect = existing.attemptsCorrect + attemptsCorrect;
  const sessionScore =
    attemptsTotal > 0 ? Math.round((attemptsCorrect / attemptsTotal) * 100) : 0;
  const alpha = 0.3;
  const newMastery = Math.round(
    existing.mastery * (1 - alpha) + sessionScore * alpha,
  );

  const updatedSkills = { ...existing.skills };
  if (skillTag) {
    const existingSkill = updatedSkills[skillTag] || {
      skillTag,
      masteryScore: 0,
      lastPracticed: new Date().toISOString(),
      attemptsTotal: 0,
      attemptsCorrect: 0,
    };
    const skillSessionScore =
      attemptsTotal > 0
        ? Math.round((attemptsCorrect / attemptsTotal) * 100)
        : 0;
    updatedSkills[skillTag] = {
      ...existingSkill,
      masteryScore: Math.round(
        existingSkill.masteryScore * (1 - alpha) + skillSessionScore * alpha,
      ),
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
    skills: updatedSkills,
  };

  return { ...prev, [topicId]: updated };
};

// ─── NAV CONFIG ───────────────────────────────────────────────────────────────

type NavView = AppState["activeView"];

interface NavItem {
  view: NavView;
  label: string;
  icon: React.ReactNode;
  section: "learn" | "account";
}

// A celebration-worthy moment surfaced as a toast + confetti burst.
type Celebration =
  | { type: "level"; level: number }
  | { type: "goal" }
  | { type: "achievement"; id: string }
  | { type: "freeze" };

// ─── APP COMPONENT ────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(() => {
    try {
      const sessionData = localStorage.getItem(SESSION_KEY);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.isLoggedIn && session.lastUserId) {
          const usersDb = JSON.parse(
            localStorage.getItem(USERS_DB_KEY) || "{}",
          );
          const user = usersDb[session.lastUserId];
          if (user) {
            if (!user.progressMap) user.progressMap = {};
            return {
              ...DEFAULT_STATE,
              ...session,
              user: { ...DEFAULT_USER, ...user },
              activeView: "dashboard",
            };
          }
        }
        return {
          ...DEFAULT_STATE,
          ...session,
          isLoggedIn: false,
          user: DEFAULT_USER,
        };
      }
    } catch (e) {}
    return DEFAULT_STATE;
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [exerciseSession, setExerciseSession] =
    useState<LearningSession | null>(null);
  const [activeQuest, setActiveQuest] = useState<ErrorQuest | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const serverSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestUserRef = useRef(appState.user);

  // Always-fresh snapshot of the current user, safe to read inside event handlers.
  const userRef = useRef(appState.user);
  userRef.current = appState.user;

  // ── Unified celebration queue (level-up, daily goal, achievements, freeze) ──
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [confettiBurst, setConfettiBurst] = useState(0);
  const celebrationQueueRef = useRef<Celebration[]>([]);
  const celebrationActiveRef = useRef(false);

  const playChime = useCallback(() => {
    if (!userRef.current.soundEnabled) return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * 0.09;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
      setTimeout(() => ctx.close().catch(() => {}), 800);
    } catch {
      /* audio unavailable */
    }
  }, []);

  const showNextCelebration = useCallback(() => {
    if (celebrationActiveRef.current) return;
    const next = celebrationQueueRef.current.shift();
    if (!next) return;
    celebrationActiveRef.current = true;
    setCelebration(next);
    setConfettiBurst((n) => n + 1);
    playChime();
    setTimeout(() => {
      setCelebration(null);
      celebrationActiveRef.current = false;
      showNextCelebration();
    }, 3200);
  }, [playChime]);

  const enqueueCelebration = useCallback(
    (cels: Celebration[]) => {
      if (
        appState.user.celebrationsEnabled === false ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      if (!cels.length) return;
      celebrationQueueRef.current.push(...cels);
      showNextCelebration();
    },
    [showNextCelebration, appState.user.celebrationsEnabled],
  );

  // Build courses
  useEffect(() => {
    if (!appState.isLoggedIn) return;
    const grade = appState.user.gradeLevel;
    const progressMap = appState.user.progressMap || {};

    let filtered = CURRICULUM.filter((cc) => cc.gradeLevel === grade);
    if (filtered.length === 0 && CURRICULUM.length > 0) {
      const userOrd = GRADE_ORDINAL[grade] ?? 9;
      let minDist = Infinity;
      CURRICULUM.forEach((cc) => {
        const d = Math.abs((GRADE_ORDINAL[cc.gradeLevel] ?? 9) - userOrd);
        if (d < minDist) minDist = d;
      });
      filtered = CURRICULUM.filter(
        (cc) =>
          Math.abs((GRADE_ORDINAL[cc.gradeLevel] ?? 9) - userOrd) === minDist,
      );
    }

    const built: Course[] = filtered.map((cc) =>
      buildCourseFromCurriculum(cc, progressMap, appState.language),
    );
    const seen = new Set<string>();
    const deduped = built.filter((c) => {
      if (seen.has(c.subject)) return false;
      seen.add(c.subject);
      return true;
    });
    setCourses(deduped);
  }, [
    appState.language,
    appState.user.gradeLevel,
    appState.user.progressMap,
    appState.isLoggedIn,
  ]);

  // Persistence
  useEffect(() => {
    const session = {
      isLoggedIn: appState.isLoggedIn,
      theme: appState.theme,
      language: appState.language,
      lastUserId: appState.user?.id || null,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    if (appState.isLoggedIn && appState.user?.id) {
      try {
        const usersDb = JSON.parse(localStorage.getItem(USERS_DB_KEY) || "{}");
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
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: u.id, userData: u }),
        }).catch(() => {});
      }, 2000);
    }
  }, [appState.isLoggedIn, appState.user, appState.language]);

  // Theme + RTL/LTR direction
  useEffect(() => {
    if (appState.theme === "dark")
      document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");

    const isRtl = appState.language === "he" || appState.language === "ar";
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.lang = appState.language;
  }, [appState.theme, appState.language]);

  // Daily rollover — zero out today's XP counter when the day changes, so the
  // dashboard ring is correct after midnight. Celebrations for XP/level/goal are
  // fired imperatively from handleExerciseComplete (the single XP choke point).
  useEffect(() => {
    if (!appState.isLoggedIn) return;
    const patch = rolloverDailyXp(appState.user);
    if (Object.keys(patch).length) {
      setAppState((prev) => ({ ...prev, user: { ...prev.user, ...patch } }));
    }
    // Re-check on tab focus (covers long-lived sessions crossing midnight).
    const onFocus = () => {
      const p = rolloverDailyXp(userRef.current);
      if (Object.keys(p).length)
        setAppState((prev) => ({ ...prev, user: { ...prev.user, ...p } }));
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [appState.isLoggedIn]);

  const navigateTo = useCallback((view: AppState["activeView"]) => {
    setViewLoading(true);
    setTimeout(() => {
      setViewLoading(false);
      setAppState((prev) => ({
        ...prev,
        activeView: view,
        activeCourseId: null,
        activeTopicId: null,
        currentSession: null,
      }));
      setActiveSubject(null);
      setMobileMenuOpen(false);
    }, 150);
  }, []);

  const handleLogin = useCallback((userData: Partial<UserProfile>) => {
    const fullUser: UserProfile = {
      ...DEFAULT_USER,
      ...userData,
      progressMap: (userData as any).progressMap || {},
    } as UserProfile;
    const todayKey = localDayKey();
    // Opening the app counts as activity, so the streak (with freeze protection)
    // advances and today's XP counter rolls over to the current day.
    const streak = calculateStreakWithFreeze(fullUser, todayKey);
    const userWithStreak: UserProfile = {
      ...fullUser,
      streakDays: streak.streakDays,
      bestStreak: streak.bestStreak,
      streakFreezes: streak.streakFreezes,
      lastActivityDate: new Date().toISOString(),
      ...rolloverDailyXp(fullUser, todayKey),
    };

    setAppState((prev) => ({
      ...prev,
      isLoggedIn: true,
      user: userWithStreak,
      language: userWithStreak.preferredLanguage || prev.language,
    }));

    if (fullUser.id) {
      fetch(`${API_BASE}/api/user/${fullUser.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((serverData) => {
          if (!serverData) return;
          setAppState((prev) => ({
            ...prev,
            user: {
              ...prev.user,
              progressMap: serverData.progressMap ?? prev.user.progressMap,
              totalXp: serverData.totalXp ?? prev.user.totalXp,
              streakDays: serverData.streakDays ?? prev.user.streakDays,
              dailyXpGoal: serverData.dailyXpGoal ?? prev.user.dailyXpGoal,
              todayXp: serverData.todayXp ?? prev.user.todayXp,
              lastXpDate: serverData.lastXpDate ?? prev.user.lastXpDate,
              lastGoalMetDate:
                serverData.lastGoalMetDate ?? prev.user.lastGoalMetDate,
              streakFreezes:
                serverData.streakFreezes ?? prev.user.streakFreezes,
              bestStreak: serverData.bestStreak ?? prev.user.bestStreak,
              dailyGoalsMet:
                serverData.dailyGoalsMet ?? prev.user.dailyGoalsMet,
              unlockedAchievements:
                serverData.unlockedAchievements ??
                prev.user.unlockedAchievements,
              skillMap: mergeSkillMaps(prev.user.skillMap, serverData.skillMap),
              activeQuests: serverData.activeQuests ?? prev.user.activeQuests,
              completedQuests:
                serverData.completedQuests ?? prev.user.completedQuests,
              questBadges: serverData.questBadges ?? prev.user.questBadges,
            },
          }));
        })
        .catch(() => {});
    }
  }, []);

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    setAppState((prev) => ({
      ...DEFAULT_STATE,
      theme: prev.theme,
      language: prev.language,
    }));
  };

  // ── SESSION HANDLERS ─────────────────────────────────────────────────────

  const handleStartLesson = useCallback(
    (
      subject: Subject,
      grade: GradeLevel,
      topicId: string | null,
      topicTitle: string,
    ) => {
      const session: LearningSession = {
        subject,
        grade,
        topicId,
        topicTitle,
        phase: "lesson",
        lesson: null,
        uploadAnalysis: null,
        studyContext: [],
      };
      setActiveSubject(subject);
      setAppState((prev) => ({
        ...prev,
        activeView: "lesson",
        currentSession: session,
        activeCourseId: null,
        activeTopicId: topicId,
      }));
      setMobileMenuOpen(false);
    },
    [],
  );

  const handleStartExercises = useCallback(
    (
      subject: Subject,
      grade: GradeLevel,
      topicId: string | null,
      topicTitle: string,
      studyContext: Attachment[] = [],
    ) => {
      const session: LearningSession = {
        subject,
        grade,
        topicId,
        topicTitle,
        phase: "exercises",
        lesson: null,
        uploadAnalysis: null,
        studyContext,
      };
      setExerciseSession(null);
      setTimeout(() => setExerciseSession(session), 0);
      setActiveSubject(subject);
      setAppState((prev) => ({
        ...prev,
        activeView: "exercise",
        currentSession: session,
        activeCourseId: null,
        activeTopicId: topicId,
      }));
      setMobileMenuOpen(false);
    },
    [],
  );

  const handleUploadAnalysis = useCallback(
    (attachments: Attachment[]) => {
      const session: LearningSession = {
        subject: Subject.MATH,
        grade: appState.user.gradeLevel,
        topicId: null,
        topicTitle: "Upload Analysis",
        phase: "upload_analysis",
        lesson: null,
        uploadAnalysis: null,
        studyContext: attachments,
      };
      setAppState((prev) => ({
        ...prev,
        activeView: "lesson",
        currentSession: session,
      }));
    },
    [appState.user.gradeLevel],
  );

  // Single XP choke point: updates streak (with freeze protection), topic
  // progress, per-skill mastery records, XP, daily-goal tracking and
  // achievements, then fires celebrations.
  const handleExerciseComplete = useCallback(
    (
      xpEarned: number,
      attemptsTotal: number,
      attemptsCorrect: number,
      topicId?: string | null,
      skillTag?: string,
      skillEvents?: SkillAttemptEvent[],
    ) => {
      const todayKey = localDayKey();
      const cur = userRef.current;

      const streak = calculateStreakWithFreeze(cur, todayKey);
      const newProgressMap = topicId
        ? updateTopicProgress(
            cur.progressMap || {},
            topicId,
            attemptsTotal,
            attemptsCorrect,
            skillTag,
          )
        : cur.progressMap || {};

      // Feed every answered question into the adaptive mastery engine
      let newSkillMap = cur.skillMap || {};
      for (const ev of skillEvents ?? []) {
        newSkillMap = recordAttempt(newSkillMap, ev);
      }

      const base: UserProfile = {
        ...cur,
        streakDays: streak.streakDays,
        bestStreak: streak.bestStreak,
        streakFreezes: streak.streakFreezes,
        lastActivityDate: new Date().toISOString(),
        progressMap: newProgressMap,
        skillMap: newSkillMap,
      };

      const gain = applyXpGain(base, Math.max(0, xpEarned), todayKey);
      userRef.current = gain.user;
      setAppState((prev) => ({ ...prev, user: gain.user }));

      const cels: Celebration[] = [];
      if (streak.freezeUsed) cels.push({ type: "freeze" });
      if (gain.goalJustMet) cels.push({ type: "goal" });
      gain.newlyUnlocked.forEach((id) =>
        cels.push({ type: "achievement", id }),
      );
      if (gain.leveledUpTo)
        cels.push({ type: "level", level: gain.leveledUpTo });
      enqueueCelebration(cels);
    },
    [enqueueCelebration],
  );

  // Record a single answered question into the mastery engine IMMEDIATELY.
  // This must not wait for quiz completion — students who answer three
  // questions and leave still deserve their Mastery Map progress.
  const handleSkillEvent = useCallback((ev: SkillAttemptEvent) => {
    setAppState((prev) => {
      const user = {
        ...prev.user,
        skillMap: recordAttempt(prev.user.skillMap || {}, ev),
      };
      userRef.current = user;
      return { ...prev, user };
    });
  }, []);

  // ── PERSONAL ERROR QUESTS ────────────────────────────────────────────────
  const handleStartQuest = useCallback((quest: ErrorQuest) => {
    setAppState((prev) => {
      const existing = (prev.user.activeQuests ?? []).some(
        (q) => q.id === quest.id,
      );
      const activeQuests = existing
        ? prev.user.activeQuests!
        : [...(prev.user.activeQuests ?? []), quest];
      const user = { ...prev.user, activeQuests };
      userRef.current = user;
      return { ...prev, user, activeView: "quest" as const };
    });
    setActiveQuest(quest);
    setMobileMenuOpen(false);
  }, []);

  const handleQuestUpdate = useCallback((quest: ErrorQuest) => {
    setActiveQuest(quest);
    setAppState((prev) => {
      const activeQuests = (prev.user.activeQuests ?? []).map((q) =>
        q.id === quest.id ? quest : q,
      );
      const user = { ...prev.user, activeQuests };
      userRef.current = user;
      return { ...prev, user };
    });
  }, []);

  const handleQuestComplete = useCallback(
    (quest: ErrorQuest, xpEarned: number, skillEvents: SkillAttemptEvent[]) => {
      // XP, streak, daily goal, achievements + mastery events through the choke point
      handleExerciseComplete(xpEarned, 0, 0, null, undefined, skillEvents);
      // Quest bookkeeping + spaced follow-up so the repair is re-checked later
      setAppState((prev) => {
        const cur = userRef.current;
        const user: UserProfile = {
          ...cur,
          activeQuests: (cur.activeQuests ?? []).filter(
            (q) => q.id !== quest.id,
          ),
          completedQuests: recordQuestCompletion(
            cur.completedQuests ?? [],
            quest,
          ),
          questBadges: (cur.questBadges ?? []).includes(quest.badgeReward)
            ? cur.questBadges!
            : [...(cur.questBadges ?? []), quest.badgeReward],
          skillMap: scheduleQuestFollowUp(cur.skillMap ?? {}, quest.skillTag),
        };
        userRef.current = user;
        return { ...prev, user };
      });
    },
    [handleExerciseComplete],
  );

  // ── TWO-MINUTE COMEBACK ──────────────────────────────────────────────────
  // Mark it "offered" for today (whether done or skipped) so it doesn't nag.
  const handleComebackSkip = useCallback(() => {
    setAppState((prev) => {
      const user = { ...prev.user, lastComebackDate: localDayKey() };
      userRef.current = user;
      return { ...prev, user, activeView: "dashboard" as const };
    });
  }, []);

  // Finished: award modest XP through the choke point (skill events were already
  // recorded live via handleSkillEvent, so DON'T pass them again here), then
  // store the asked questions so the next comeback rotates to fresh examples.
  const handleComebackFinish = useCallback(
    (xpEarned: number, askedQuestions: string[]) => {
      handleExerciseComplete(xpEarned, 0, 0, null);
      setAppState((prev) => {
        const cur = userRef.current;
        const user: UserProfile = {
          ...cur,
          lastComebackDate: localDayKey(),
          comebackHistory: recordComebackQuestions(
            cur.comebackHistory ?? [],
            askedQuestions,
          ),
        };
        userRef.current = user;
        return { ...prev, user };
      });
    },
    [handleExerciseComplete],
  );

  // ── MEMORY DUNGEON ───────────────────────────────────────────────────────
  // Finished a dungeon run: award earned XP through the choke point (skill
  // events already recorded live), bump the cleared count, and store the room
  // questions so the next dungeon uses fresh examples.
  const handleDungeonFinish = useCallback(
    (xpEarned: number, askedTexts: string[], clearedAll: boolean) => {
      handleExerciseComplete(xpEarned, 0, 0, null);
      setAppState((prev) => {
        const cur = userRef.current;
        const user: UserProfile = {
          ...cur,
          dungeonHistory: recordDungeonHistory(
            cur.dungeonHistory ?? [],
            askedTexts,
          ),
          dungeonsCleared: (cur.dungeonsCleared ?? 0) + (clearedAll ? 1 : 0),
        };
        userRef.current = user;
        return { ...prev, user };
      });
    },
    [handleExerciseComplete],
  );

  const startSubjectPractice = useCallback(
    (s: Subject) => {
      const grade = appState.user.gradeLevel;
      const cc = getCurriculumCourse(s, grade);
      const firstTopic = cc?.units[0]?.topics[0];
      handleStartExercises(
        s,
        grade,
        firstTopic?.id || null,
        firstTopic?.title || "General Practice",
      );
    },
    [appState.user.gradeLevel, handleStartExercises],
  );

  const handleMaterialStart = useCallback(
    (s: Subject, attachments: Attachment[]) => {
      const grade = appState.user.gradeLevel;
      if (attachments.length > 0) {
        handleUploadAnalysis(attachments);
      } else {
        // Use the first real topic from the curriculum so the AI gets concrete context
        const cc = getCurriculumCourse(s, grade);
        const firstTopic = cc?.units[0]?.topics[0];
        handleStartExercises(
          s,
          grade,
          firstTopic?.id || null,
          firstTopic?.title || `${s} basics`,
        );
      }
    },
    [appState.user.gradeLevel, handleUploadAnalysis, handleStartExercises],
  );

  const t = TRANSLATIONS[appState.language];
  const ac = getAppCopy(appState.language);
  const isRtl = appState.language === "he" || appState.language === "ar";
  const sidebarHiddenClass = isRtl ? "translate-x-full" : "-translate-x-full";

  // Personal missions for the dashboard: quests already in progress first,
  // then fresh candidates detected from recurring mistakes in the skill map.
  // (Must sit above the logged-out early return — hooks order.)
  const missions = useMemo(() => {
    const active = (appState.user.activeQuests ?? []).filter(
      (q) => !q.completedAt,
    );
    const room = Math.max(0, MAX_ACTIVE_QUESTS - active.length);
    const candidates = findQuestCandidates(
      appState.user.skillMap ?? {},
      active,
      appState.user.completedQuests ?? [],
    )
      .slice(0, room)
      .map((cand) => buildQuest(cand, appState.language));
    return [...active, ...candidates];
  }, [
    appState.user.skillMap,
    appState.user.activeQuests,
    appState.user.completedQuests,
    appState.language,
  ]);

  // Whether to offer the Two-Minute Comeback on the dashboard (once per day,
  // once there's enough practiced history to review).
  const comebackAvailable = useMemo(
    () =>
      comebackEligible(
        appState.user.skillMap ?? {},
        appState.user.lastComebackDate,
      ),
    [appState.user.skillMap, appState.user.lastComebackDate],
  );

  // Compact cross-session learner summary injected into the tutor prompt.
  const learnerSummary = useMemo(
    () => buildLearnerSummary(appState.user),
    [appState.user.skillMap, appState.user.preferredExplanationStyle],
  );

  // Persist the student's preferred help style when they switch tutor modes.
  const handleTutorModeChange = useCallback(
    (mode: TutorMode, customInstruction?: string) => {
      const style =
        mode === "custom" ? customInstruction?.trim() || "custom" : mode;
      setAppState((prev) => {
        if (prev.user.preferredExplanationStyle === style) return prev;
        const user = { ...prev.user, preferredExplanationStyle: style };
        userRef.current = user;
        return { ...prev, user };
      });
    },
    [],
  );

  // Course topics feed the Memory Dungeon when the Mastery Map is still thin.
  const dungeonFallbackTopics = useMemo<DungeonSkillSeed[]>(
    () =>
      courses
        .flatMap((course) =>
          course.units.flatMap((u) =>
            u.topics.map((topic) => ({
              skillTag: topic.title,
              subject: course.subject,
              topicId: topic.id,
            })),
          ),
        )
        .slice(0, 30),
    [courses],
  );

  if (!appState.isLoggedIn) {
    return (
      <AuthView
        language={appState.language}
        translations={t}
        theme={appState.theme}
        onLogin={handleLogin}
        onThemeToggle={() =>
          setAppState((prev) => ({
            ...prev,
            theme: prev.theme === "light" ? "dark" : "light",
          }))
        }
        onLanguageChange={(l) =>
          setAppState((prev) => ({ ...prev, language: l }))
        }
      />
    );
  }

  // ── NAV ITEMS ──────────────────────────────────────────────────────────────

  const sc = studyCopy(appState.language);
  const NAV_ITEMS: NavItem[] = [
    {
      view: "dashboard",
      label: sc.today,
      icon: <LayoutGrid size={19} />,
      section: "learn",
    },
    {
      view: "courses",
      label: sc.library,
      icon: <Library size={19} />,
      section: "learn",
    },
    {
      view: "practice",
      label: sc.practice,
      icon: <Zap size={19} />,
      section: "learn",
    },
    {
      view: "progress",
      label: sc.progress,
      icon: <BarChart2 size={19} />,
      section: "learn",
    },
  ];

  const level = Math.floor(appState.user.totalXp / 1000) + 1;
  const xpInLevel = appState.user.totalXp % 1000;

  return (
    <div className="app-shell flex flex-col bg-cream-50 dark:bg-ink-900 transition-colors duration-300 font-sans overflow-hidden text-ink-700 dark:text-ink-100">
      <header className="bw-header">
        <button
          className="bw-logo"
          onClick={() => navigateTo("dashboard")}
          aria-label="Brainwave"
        >
          <span>
            bw<span className="bw-logo-dot">✦</span>
          </span>
          <strong>brainwave</strong>
        </button>
        <nav className="bw-main-nav" aria-label={sc.today}>
          {NAV_ITEMS.map(({ view, label, icon }) => (
            <button
              key={view}
              aria-current={appState.activeView === view ? "page" : undefined}
              onClick={() => navigateTo(view)}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="bw-header-actions">
          <LanguageSelector
            currentLang={appState.language}
            onChange={(l) => setAppState((p) => ({ ...p, language: l }))}
          />
          <button
            className="bw-icon-button"
            aria-label={t.settings}
            onClick={() =>
              setAppState((p) => ({
                ...p,
                theme: p.theme === "light" ? "dark" : "light",
              }))
            }
          >
            {appState.theme === "light" ? (
              <Moon size={19} />
            ) : (
              <Sun size={19} />
            )}
          </button>
          <details className="bw-account">
            <summary aria-label={sc.account}>
              {appState.user.name.charAt(0).toUpperCase()}
            </summary>
            <div className="bw-account-menu">
              <button onClick={() => navigateTo("profile")}>{t.profile}</button>
              <button onClick={() => navigateTo("settings")}>
                {t.settings}
              </button>
              <button onClick={() => setShowLogoutConfirm(true)}>
                {t.signOut}
              </button>
            </div>
          </details>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide bg-cream-50 dark:bg-ink-900">
          <div className="w-full h-full">
            <div
              style={{
                display: ["dashboard", "courses", "practice"].includes(
                  appState.activeView,
                )
                  ? undefined
                  : "none",
              }}
            >
              <StudyHub
                key={appState.user.id}
                view={
                  appState.activeView === "courses"
                    ? "courses"
                    : appState.activeView === "practice"
                      ? "practice"
                      : "dashboard"
                }
                user={appState.user}
                language={appState.language}
                theme={appState.theme}
                courses={courses}
                translations={t}
                onNavigate={navigateTo}
                onResults={(results) =>
                  setAppState((p) =>
                    p.user.id !== appState.user.id || !p.isLoggedIn
                      ? p
                      : {
                          ...p,
                          user: applyStudyResults(p.user, results),
                        },
                  )
                }
                onToolXp={(xp) =>
                  setAppState((p) =>
                    p.user.id !== appState.user.id || !p.isLoggedIn
                      ? p
                      : {
                          ...p,
                          user: applyXpGain(p.user, xp).user,
                        },
                  )
                }
                onContext={(ctx) =>
                  setAppState((p) =>
                    p.currentContext === ctx
                      ? p
                      : { ...p, currentContext: ctx },
                  )
                }
              />
            </div>

            {appState.activeView === "comeback" && (
              <div className="view-enter">
                <ComebackView
                  user={appState.user}
                  grade={appState.user.gradeLevel}
                  language={appState.language}
                  translations={t}
                  onSkillEvent={handleSkillEvent}
                  onSkip={handleComebackSkip}
                  onFinish={handleComebackFinish}
                  onStartQuest={handleStartQuest}
                  onBack={() =>
                    setAppState((prev) => ({
                      ...prev,
                      activeView: "dashboard",
                    }))
                  }
                />
              </div>
            )}

            {appState.activeView === "dungeon" && (
              <div className="view-enter">
                <MemoryDungeon
                  user={appState.user}
                  grade={appState.user.gradeLevel}
                  language={appState.language}
                  translations={t}
                  fallbackTopics={dungeonFallbackTopics}
                  onSkillEvent={handleSkillEvent}
                  onFinish={handleDungeonFinish}
                  onStartQuest={handleStartQuest}
                  onBack={() =>
                    setAppState((prev) => ({
                      ...prev,
                      activeView: "dashboard",
                    }))
                  }
                />
              </div>
            )}

            {(appState.activeView === "lesson" ||
              appState.activeView === "review") &&
              appState.currentSession && (
                <div className="view-enter">
                  <LessonView
                    key={`${appState.currentSession.subject}-${appState.currentSession.topicId}`}
                    session={appState.currentSession}
                    userGrade={appState.user.gradeLevel}
                    language={appState.language}
                    translations={t}
                    onStartExercises={(
                      studyContext,
                      detectedSubject,
                      selectedTopics,
                    ) => {
                      const s = appState.currentSession!;
                      const subject = detectedSubject ?? s.subject;
                      const topicTitle =
                        selectedTopics && selectedTopics.length > 0
                          ? selectedTopics.join(", ")
                          : detectedSubject
                            ? studyContext.map((a) => a.name).join(", ")
                            : s.topicTitle;
                      handleStartExercises(
                        subject,
                        s.grade,
                        s.topicId,
                        topicTitle,
                        studyContext,
                      );
                    }}
                    onBack={() =>
                      setAppState((prev) => ({
                        ...prev,
                        activeView: "dashboard",
                        currentSession: null,
                      }))
                    }
                    onContextUpdate={(ctx) =>
                      setAppState((p) => ({ ...p, currentContext: ctx }))
                    }
                    onLessonComplete={(xp) =>
                      handleExerciseComplete(xp, 0, 0, null)
                    }
                    onSkillEvent={handleSkillEvent}
                  />
                </div>
              )}

            {exerciseSession && (
              <div
                style={{
                  display:
                    appState.activeView === "exercise" ? undefined : "none",
                }}
                className="view-enter"
              >
                <ExercisePanel
                  key={`${exerciseSession.subject}-${exerciseSession.topicId}-${exerciseSession.grade}`}
                  session={exerciseSession}
                  userGrade={appState.user.gradeLevel}
                  language={appState.language}
                  translations={t}
                  topicMastery={
                    exerciseSession.topicId
                      ? appState.user.progressMap?.[exerciseSession.topicId]
                          ?.mastery
                      : undefined
                  }
                  onSkillEvent={handleSkillEvent}
                  onComplete={handleExerciseComplete}
                  onBack={() => {
                    setExerciseSession(null);
                    setAppState((prev) => ({
                      ...prev,
                      activeView: "dashboard",
                      currentSession: null,
                    }));
                  }}
                  onContextUpdate={(ctx) =>
                    setAppState((p) => ({ ...p, currentContext: ctx }))
                  }
                  onGoToLesson={() =>
                    setAppState((prev) => ({ ...prev, activeView: "lesson" }))
                  }
                  onQuizGenerated={(quiz) =>
                    setExerciseSession((prev) =>
                      prev ? { ...prev, quiz } : null,
                    )
                  }
                />
              </div>
            )}

            {appState.activeView === "progress" && (
              <div className="view-enter">
                <div className="bw-hub bw-progress-links">
                  <button
                    className="bw-button bw-secondary"
                    onClick={() => navigateTo("mastery")}
                  >
                    {t.masteryMap}
                  </button>
                  <button
                    className="bw-button bw-secondary"
                    onClick={() => navigateTo("achievements")}
                  >
                    {t.achievements}
                  </button>
                  <button
                    className="bw-button bw-secondary"
                    onClick={() => navigateTo("leaderboard")}
                  >
                    {t.leaderboard}
                  </button>
                </div>
                <StudyProgress
                  user={appState.user}
                  language={appState.language}
                  onPractice={() => navigateTo("practice")}
                />
                <ProgressDashboard
                  user={appState.user}
                  translations={t}
                  language={appState.language}
                  onStartPractice={(subject, topicId, topicTitle) => {
                    handleStartExercises(
                      subject,
                      appState.user.gradeLevel,
                      topicId,
                      topicTitle,
                    );
                  }}
                />
              </div>
            )}

            {appState.activeView === "quest" && activeQuest && (
              <div className="view-enter">
                <ErrorQuestView
                  key={activeQuest.id}
                  quest={activeQuest}
                  userGrade={appState.user.gradeLevel}
                  language={appState.language}
                  translations={t}
                  onBack={() => {
                    setActiveQuest(null);
                    setAppState((prev) => ({
                      ...prev,
                      activeView: "dashboard",
                    }));
                  }}
                  onQuestUpdate={handleQuestUpdate}
                  onComplete={handleQuestComplete}
                />
              </div>
            )}

            {appState.activeView === "mastery" && (
              <div className="view-enter">
                <MasteryMap
                  user={appState.user}
                  translations={t}
                  language={appState.language}
                  onPractice={(subject, topicId, skillTag) => {
                    handleStartExercises(
                      subject ?? Subject.MATH,
                      appState.user.gradeLevel,
                      topicId ?? null,
                      skillTag,
                    );
                  }}
                />
              </div>
            )}

            {appState.activeView === "achievements" && (
              <div className="view-enter">
                <Achievements
                  user={appState.user}
                  translations={t}
                  language={appState.language}
                />
              </div>
            )}

            {appState.activeView === "leaderboard" && (
              <div className="view-enter">
                <Leaderboard
                  user={appState.user}
                  translations={t}
                  language={appState.language}
                  apiBase={API_BASE}
                />
              </div>
            )}

            {appState.activeView === "profile" && (
              <div className="view-enter p-6 md:p-10 max-w-2xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {t.profile}
                </h1>

                {/* Avatar + name */}
                <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-100 dark:border-ink-800 p-8 flex flex-col sm:flex-row items-center gap-6 shadow-paper">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-moss-500 to-moss-700 flex items-center justify-center text-white text-4xl font-bold shadow-moss ring-4 ring-moss-100 dark:ring-moss-900/30">
                    {appState.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-center sm:text-start">
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                      {appState.user.name}
                    </div>
                    <div className="text-sm text-zinc-400 font-medium">
                      @{appState.user.username}
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-moss-50 dark:bg-moss-light/30 text-moss-600 dark:text-moss-400 rounded-xl text-xs font-bold border border-moss-100 dark:border-moss-light/40">
                      <GraduationCap size={12} />
                      {t.grades[appState.user.gradeLevel]}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    {
                      icon: <Trophy size={22} className="text-yellow-500" />,
                      label: "Level",
                      value: String(level),
                      bg: "bg-yellow-50 dark:bg-yellow-950/20",
                      border: "border-yellow-100 dark:border-yellow-900/30",
                    },
                    {
                      icon: <Star size={22} className="text-moss-500" />,
                      label: t.xp,
                      value: String(appState.user.totalXp),
                      bg: "bg-moss-50 dark:bg-moss-light/20",
                      border: "border-moss-100 dark:border-moss-light/30",
                    },
                    {
                      icon: <Flame size={22} className="text-orange-500" />,
                      label: t.streak,
                      value: `${appState.user.streakDays}d`,
                      bg: "bg-orange-50 dark:bg-orange-950/20",
                      border: "border-orange-100 dark:border-orange-900/30",
                    },
                  ].map(({ icon, label, value, bg, border }) => (
                    <div
                      key={label}
                      className={`${bg} rounded-2xl p-5 flex flex-col items-center gap-2.5 border ${border}`}
                    >
                      {icon}
                      <div className="text-2xl font-bold text-zinc-900 dark:text-white count-in">
                        {value}
                      </div>
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* XP progress */}
                <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 p-6 shadow-paper">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold text-ink-600 dark:text-ink-200">
                      {ac.progressToLevel(level + 1)}
                    </span>
                    <span className="text-xs font-bold text-moss-600">
                      {xpInLevel} / 1000 XP
                    </span>
                  </div>
                  <div className="h-3 bg-cream-100 dark:bg-ink-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-moss-500 to-moss-700 rounded-full transition-all duration-1000"
                      style={{ width: `${xpInLevel / 10}%` }}
                    />
                  </div>
                </div>

                {/* Topic mastery */}
                {Object.keys(appState.user.progressMap || {}).length > 0 && (
                  <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 p-6 shadow-paper">
                    <h3 className="font-bold text-ink-700 dark:text-ink-100 mb-4">
                      {ac.masteryByTopic}
                    </h3>
                    <div className="space-y-4">
                      {(
                        Object.values(
                          appState.user.progressMap,
                        ) as TopicProgress[]
                      )
                        .slice(0, 5)
                        .map((tp) => {
                          let topicTitle = tp.topicId;
                          for (const course of CURRICULUM) {
                            for (const unit of course.units) {
                              const found = unit.topics.find(
                                (t) => t.id === tp.topicId,
                              );
                              if (found) {
                                topicTitle = found.title;
                                break;
                              }
                            }
                            if (topicTitle !== tp.topicId) break;
                          }
                          return (
                            <div key={tp.topicId}>
                              <div className="flex justify-between text-xs font-medium text-zinc-500 mb-2">
                                <span className="truncate">{topicTitle}</span>
                                <span className="font-bold text-moss-600">
                                  {tp.mastery}%
                                </span>
                              </div>
                              <div className="h-2 bg-cream-100 dark:bg-ink-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-moss-500 to-moss-700 rounded-full transition-all"
                                  style={{ width: `${tp.mastery}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {appState.activeView === "settings" && (
              <div className="view-enter">
                <SettingsView
                  user={appState.user}
                  translations={t}
                  theme={appState.theme}
                  language={appState.language}
                  onProfileUpdate={({ name, username }) =>
                    setAppState((prev) => ({
                      ...prev,
                      user: { ...prev.user, name, username },
                    }))
                  }
                  onGradeChange={(grade) =>
                    setAppState((prev) => ({
                      ...prev,
                      user: { ...prev.user, gradeLevel: grade },
                    }))
                  }
                  onThemeToggle={() =>
                    setAppState((prev) => ({
                      ...prev,
                      theme: prev.theme === "light" ? "dark" : "light",
                    }))
                  }
                  onLanguageChange={(l) =>
                    setAppState((prev) => ({ ...prev, language: l }))
                  }
                  onToggleSound={() =>
                    setAppState((prev) => ({
                      ...prev,
                      user: {
                        ...prev.user,
                        soundEnabled: !prev.user.soundEnabled,
                      },
                    }))
                  }
                  onToggleCelebrations={() =>
                    setAppState((prev) => ({
                      ...prev,
                      user: {
                        ...prev.user,
                        celebrationsEnabled:
                          prev.user.celebrationsEnabled === false,
                      },
                    }))
                  }
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {!["dashboard", "courses", "practice"].includes(appState.activeView) && (
        <ContextTutor
          key={appState.user.id + appState.activeView}
          user={appState.user}
          language={appState.language}
          context={appState.currentContext}
        />
      )}
      {/* Logout confirmation */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/60 backdrop-blur-md">
          <div className="bg-white dark:bg-ink-900 rounded-3xl p-8 shadow-xl border border-ink-100 dark:border-ink-800 max-w-sm w-full mx-4 animate-pop">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/30 mx-auto mb-4">
              <LogOut size={24} className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-center text-ink-700 dark:text-ink-100 mb-2">
              {ac.signOutTitle}
            </h3>
            <p className="text-sm text-center text-ink-400 dark:text-ink-300 mb-6">
              {ac.signOutDesc}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-2xl border-2 border-ink-100 dark:border-ink-700 text-sm font-semibold text-ink-500 dark:text-ink-300 hover:border-ink-200 dark:hover:border-ink-600 transition-all"
              >
                {ac.cancel}
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

      {/* Reward confetti — re-fires on each celebration */}
      <Confetti trigger={confettiBurst} />

      {/* Unified celebration toast (level-up, daily goal, achievement, streak freeze) */}
      {celebration &&
        (() => {
          const cel = celebration;
          let icon = <Trophy size={18} />;
          let title = "";
          let subtitle = "";
          let gradient = "from-moss-500 to-moss-700 shadow-moss-500/30";
          if (cel.type === "level") {
            title = ac.levelReached(cel.level);
          } else if (cel.type === "goal") {
            icon = <Target size={18} />;
            title = t.goalMet;
            subtitle = t.goalMetDesc;
            gradient = "from-clay-400 to-clay-500 shadow-clay-400/30";
          } else if (cel.type === "freeze") {
            icon = <Flame size={18} />;
            title = t.streakSaved;
            subtitle = t.freezeUsed;
            gradient = "from-sky-500 to-blue-600 shadow-blue-500/30";
          } else if (cel.type === "achievement") {
            const a = ACHIEVEMENTS_BY_ID[cel.id];
            icon = <Award size={18} />;
            title = t.achievementUnlocked;
            subtitle = a ? a.title[appState.language] : "";
            gradient = "from-amber-400 to-orange-500 shadow-orange-400/30";
          }
          return (
            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-toast-in">
              <div
                className={`flex items-center gap-3 bg-gradient-to-r ${gradient} text-white px-6 py-3.5 rounded-2xl shadow-2xl font-bold border border-white/20`}
              >
                {icon}
                <div className="flex flex-col leading-tight">
                  <span>{title}</span>
                  {subtitle && (
                    <span className="text-xs font-medium text-white/85">
                      {subtitle}
                    </span>
                  )}
                </div>
                <Star size={14} className="fill-white" />
              </div>
            </div>
          );
        })()}
    </div>
  );
};

export default App;
