import React, { useState, useMemo } from 'react';
import { UserProfile, Course, Topic, Subject, GradeLevel, Translations, TopicProgress } from '../types';
import { ICON_MAP, SUBJECTS_DATA, CURRICULUM, getCurriculumCourse } from '../constants';
import {
  ArrowRight, ArrowUpRight, BookOpen, Calculator, FlaskConical, Globe,
  Laptop, TrendingUp, Flame, Sparkles, ChevronDown, ChevronRight, X,
  Clock, PlayCircle, Coffee, Pencil, BookMarked, Target
} from 'lucide-react';

interface Props {
  user: UserProfile;
  courses: Course[];
  translations: Translations;
  searchQuery?: string;
  onSelectCourse: (courseId: string) => void;
  onResumeTopic: (courseId: string, topicId: string) => void;
  onSelectSubjectGrade: (subject: Subject, grade: GradeLevel) => void;
}

const LEGACY_GROUPED_GRADES = new Set<GradeLevel>([
  GradeLevel.ELEMENTARY_1_3, GradeLevel.ELEMENTARY_4_6,
  GradeLevel.MIDDLE_7_8, GradeLevel.HIGH_9_10, GradeLevel.HIGH_11_12,
]);

// Subject identity — each subject has a distinct, sophisticated character
// (not the rainbow gradient soup of typical SaaS dashboards)
const SUBJECT_CHARACTER: Record<Subject, {
  icon: React.ElementType;
  emoji: string;
  bg: string;        // soft tinted background
  ink: string;       // accent text color
  bgDark: string;    // dark mode background
  inkDark: string;   // dark mode text
  vibe: string;      // 1-2 word descriptor for the subject's personality
}> = {
  [Subject.MATH]: {
    icon: Calculator, emoji: '∫',
    bg: 'bg-[#EEF1F8]', ink: 'text-[#2D4A7A]',
    bgDark: 'dark:bg-[#1A2440]', inkDark: 'dark:text-[#A4B8E0]',
    vibe: 'Logic & patterns'
  },
  [Subject.SCIENCE]: {
    icon: FlaskConical, emoji: '⚗',
    bg: 'bg-[#EAF2EC]', ink: 'text-[#2D5F3F]',
    bgDark: 'dark:bg-[#16291E]', inkDark: 'dark:text-[#9CC5A8]',
    vibe: 'How things work'
  },
  [Subject.LANGUAGE]: {
    icon: BookMarked, emoji: '✍',
    bg: 'bg-[#F2EAEE]', ink: 'text-[#6B3F62]',
    bgDark: 'dark:bg-[#2A1B26]', inkDark: 'dark:text-[#C9A8C0]',
    vibe: 'Words & meaning'
  },
  [Subject.HISTORY]: {
    icon: BookOpen, emoji: '⏳',
    bg: 'bg-[#F7EDD9]', ink: 'text-[#8C5A1A]',
    bgDark: 'dark:bg-[#2A1F0E]', inkDark: 'dark:text-[#D9B57A]',
    vibe: 'Stories of the past'
  },
  [Subject.CODING]: {
    icon: Laptop, emoji: '⌨',
    bg: 'bg-[#E8EFEF]', ink: 'text-[#2A5C5E]',
    bgDark: 'dark:bg-[#152728]', inkDark: 'dark:text-[#9DC4C5]',
    vibe: 'Build with logic'
  },
  [Subject.ECONOMICS]: {
    icon: TrendingUp, emoji: '⬈',
    bg: 'bg-[#F7E9E5]', ink: 'text-[#A0492C]',
    bgDark: 'dark:bg-[#2A1812]', inkDark: 'dark:text-[#E0A38C]',
    vibe: 'Markets & choices'
  },
};

// Time-of-day greeting (more human than "Welcome back")
function getGreeting(name: string): { greeting: string; emoji: string; mood: string } {
  const hour = new Date().getHours();
  const firstName = name.split(' ')[0];

  if (hour < 5) return {
    greeting: `Up late, ${firstName}?`, emoji: '🌙',
    mood: 'Burning the midnight oil. Keep it focused.'
  };
  if (hour < 11) return {
    greeting: `Morning, ${firstName}`, emoji: '☕️',
    mood: 'Best time of day to learn something new.'
  };
  if (hour < 14) return {
    greeting: `Hey, ${firstName}`, emoji: '👋',
    mood: 'Got a few minutes? Let\'s do something useful.'
  };
  if (hour < 18) return {
    greeting: `Afternoon, ${firstName}`, emoji: '🌤',
    mood: 'Power through one thing. You\'ll thank yourself later.'
  };
  if (hour < 22) return {
    greeting: `Evening, ${firstName}`, emoji: '🌆',
    mood: 'Quiet hours. Good for the deep stuff.'
  };
  return {
    greeting: `Night owl, ${firstName}?`, emoji: '🌙',
    mood: '15 minutes now beats an hour of cramming tomorrow.'
  };
}

const Dashboard: React.FC<Props> = ({
  user, courses, translations, searchQuery = '',
  onSelectCourse, onResumeTopic, onSelectSubjectGrade
}) => {
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [openGradeFolder, setOpenGradeFolder] = useState<string | null>(null);

  const hasSpecificGrade = !LEGACY_GROUPED_GRADES.has(user.gradeLevel);
  const level = Math.floor(user.totalXp / 1000) + 1;
  const xpInLevel = user.totalXp % 1000;
  const xpPercent = Math.round(xpInLevel / 10);

  const greeting = getGreeting(user.name);

  const handleSubjectClick = (subject: Subject) => {
    if (hasSpecificGrade) onSelectSubjectGrade(subject, user.gradeLevel);
    else setSelectedSubject(subject);
  };

  const gradeFolders = [
    { id: 'kinder',     emoji: '🎒', label: 'Kindergarten',     grades: [GradeLevel.KINDER] },
    { id: 'elementary', emoji: '🏫', label: 'Elementary School', grades: [GradeLevel.GRADE_1, GradeLevel.GRADE_2, GradeLevel.GRADE_3, GradeLevel.GRADE_4, GradeLevel.GRADE_5, GradeLevel.GRADE_6] },
    { id: 'middle',     emoji: '📚', label: 'Middle School',     grades: [GradeLevel.GRADE_7, GradeLevel.GRADE_8, GradeLevel.GRADE_9] },
    { id: 'high',       emoji: '🎓', label: 'High School',       grades: [GradeLevel.GRADE_10, GradeLevel.GRADE_11, GradeLevel.GRADE_12] },
    { id: 'college',    emoji: '🏛', label: 'College',           grades: [GradeLevel.COLLEGE_FRESHMAN, GradeLevel.COLLEGE_ADVANCED] },
  ];

  const getNextTopic = (course: Course): { topic: Topic; unitTitle: string } | null => {
    for (const unit of course.units)
      for (const topic of unit.topics)
        if (!topic.isLocked && topic.mastery < 100) return { topic, unitTitle: unit.title };
    return null;
  };

  // The "pick up where you left off" — most recent active course
  const continueLearning = useMemo(() => {
    const pm = user.progressMap || {};
    let best: { course: Course; topic: Topic; unitTitle: string; lastPracticed: string } | null = null;
    for (const course of courses) {
      for (const unit of course.units) {
        for (const topic of unit.topics) {
          const tp = pm[topic.id];
          if (!tp || tp.mastery >= 100) continue;
          if (!best || tp.lastPracticed > best.lastPracticed) {
            best = { course, topic, unitTitle: unit.title, lastPracticed: tp.lastPracticed };
          }
        }
      }
    }
    return best;
  }, [courses, user.progressMap]);

  const activeCourses = useMemo(() => {
    const pm = user.progressMap || {};
    return courses.filter(c => c.units.flatMap(u => u.topics.map(t => t.id)).some(id => (pm[id]?.attemptsTotal ?? 0) > 0));
  }, [courses, user.progressMap]);

  const recommendedSubject = useMemo(() => {
    const pm = user.progressMap || {};
    let weakest: { subject: Subject; mastery: number } | null = null;
    for (const subject of Object.values(Subject)) {
      const cc = getCurriculumCourse(subject, user.gradeLevel);
      if (!cc) continue;
      const masteries = cc.units.flatMap(u => u.topics).map(t => pm[t.id]?.mastery ?? 0);
      const attempted = masteries.filter(m => m > 0);
      if (attempted.length === 0) continue;
      const avg = Math.round(attempted.reduce((a, b) => a + b, 0) / attempted.length);
      if (!weakest || avg < weakest.mastery) weakest = { subject, mastery: avg };
    }
    return weakest;
  }, [user.progressMap, user.gradeLevel]);

  const filteredSubjects = searchQuery.trim()
    ? SUBJECTS_DATA.filter(s => translations.subjectsList[s.id].toLowerCase().includes(searchQuery.toLowerCase()))
    : SUBJECTS_DATA;

  const handleGradeSelect = (grade: GradeLevel) => {
    if (selectedSubject) { onSelectSubjectGrade(selectedSubject, grade); setSelectedSubject(null); }
  };

  const totalTopicsDone = (Object.values(user.progressMap || {}) as TopicProgress[]).filter(tp => tp.mastery >= 70).length;
  const studiedToday = user.lastActivityDate ? new Date(user.lastActivityDate).toDateString() === new Date().toDateString() : false;

  return (
    <div className="px-5 md:px-8 lg:px-12 py-6 md:py-10 max-w-[1280px] mx-auto space-y-12 md:space-y-16">

      {/* ─── Section 1: Editorial greeting ────────────────────────────────── */}
      <header className="fade-in">
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-2xl">{greeting.emoji}</span>
          <span className="text-xs uppercase tracking-[0.2em] font-semibold text-ink-300 dark:text-ink-400">
            {studiedToday ? 'You\'re on a roll today' : 'Today'}
          </span>
        </div>
        <h1 className="font-display text-[44px] md:text-[64px] leading-[0.95] font-medium text-ink-700 dark:text-ink-100 tracking-tight">
          {greeting.greeting}.
        </h1>
        <p className="mt-3 text-lg md:text-xl text-ink-400 dark:text-ink-400 max-w-2xl leading-relaxed">
          {greeting.mood}
        </p>

        {/* Inline stats — tasteful, not gamified */}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-300 dark:text-ink-400">
          {user.streakDays > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Flame size={13} className="text-clay-400" />
              <span className="font-semibold text-ink-500 dark:text-ink-400">{user.streakDays}-day streak</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="font-semibold text-ink-500 dark:text-ink-400">Level {level}</span>
            <span className="text-ink-200 dark:text-ink-400">·</span>
            <span>{user.totalXp.toLocaleString()} XP</span>
          </span>
          {totalTopicsDone > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Target size={13} className="text-moss-500" />
              <span className="font-semibold text-ink-500 dark:text-ink-400">{totalTopicsDone}</span>
              <span>topics mastered</span>
            </span>
          )}
        </div>
      </header>

      {/* ─── Section 2: The "pick up where you left off" hero card ──────── */}
      {continueLearning ? (
        <section className="fade-in stagger-1">
          <div className="paper-card p-7 md:p-10 relative overflow-hidden bg-moss-50 dark:bg-moss-light border-moss-100 dark:border-moss-light">
            {/* Decoration: soft circle */}
            <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-moss-100/40 dark:bg-moss-700/20 pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 dark:bg-ink-700/40 text-moss-600 dark:text-moss-300 text-xs font-semibold uppercase tracking-wider mb-3">
                  <PlayCircle size={11} />
                  Pick up where you left off
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-semibold text-ink-700 dark:text-ink-100 mb-1.5 leading-tight">
                  {continueLearning.topic.title}
                </h2>
                <p className="text-sm text-ink-400 dark:text-ink-400">
                  {translations.subjectsList[continueLearning.course.subject]} · {continueLearning.unitTitle}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1 max-w-[200px] h-1.5 bg-white/60 dark:bg-ink-700/40 rounded-full overflow-hidden">
                    <div className="h-full bg-moss-500 rounded-full transition-all duration-700" style={{ width: `${continueLearning.topic.mastery}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-moss-600 dark:text-moss-300">{continueLearning.topic.mastery}% there</span>
                </div>
              </div>
              <button
                onClick={() => onResumeTopic(continueLearning.course.id, continueLearning.topic.id)}
                className="btn-moss inline-flex items-center gap-2 self-start md:self-auto whitespace-nowrap"
              >
                Continue lesson
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="fade-in stagger-1">
          <div className="paper-card p-7 md:p-10 bg-cream-100 dark:bg-ink-700 border-cream-200 dark:border-ink-600">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 dark:bg-ink-700/40 text-clay-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles size={11} />
              Fresh start
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-ink-700 dark:text-ink-100 mb-2 leading-tight">
              Nothing on your plate yet.
            </h2>
            <p className="text-base text-ink-400 dark:text-ink-400 mb-5">
              Pick a subject below and we'll start with something easy to warm up.
            </p>
          </div>
        </section>
      )}

      {/* ─── Section 3: Quick options (bento) ─────────────────────────────── */}
      <section className="fade-in stagger-2">
        <h2 className="font-display text-2xl md:text-3xl font-medium text-ink-700 dark:text-ink-100 mb-1">
          What sounds good <em className="font-display italic text-moss-500">today?</em>
        </h2>
        <p className="text-ink-400 dark:text-ink-400 text-sm mb-6">Three ways to spend the next 20 minutes.</p>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-5">
          {/* Big card — Recommended weakness focus */}
          {recommendedSubject ? (
            <button
              onClick={() => handleSubjectClick(recommendedSubject.subject)}
              className="md:col-span-3 paper-card tactile-card p-7 text-left group min-h-[200px] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Coffee size={14} className="text-clay-400" />
                  <span className="text-xs uppercase tracking-wider font-semibold text-clay-400">Worth a closer look</span>
                </div>
                <h3 className="font-display text-2xl md:text-[26px] font-semibold text-ink-700 dark:text-ink-100 leading-tight mb-2">
                  Your {translations.subjectsList[recommendedSubject.subject]} could use some love.
                </h3>
                <p className="text-sm text-ink-400 dark:text-ink-400">
                  You're at {recommendedSubject.mastery}% mastery — let's nudge that up.
                </p>
              </div>
              <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-moss-500 group-hover:gap-2.5 transition-all">
                Practice this <ArrowUpRight size={14} />
              </div>
            </button>
          ) : (
            <button
              onClick={() => onSelectSubjectGrade(Subject.MATH, user.gradeLevel)}
              className="md:col-span-3 paper-card tactile-card p-7 text-left group min-h-[200px]"
            >
              <Sparkles size={20} className="text-moss-500 mb-3" />
              <h3 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100 mb-2">
                Try a quick math warm-up
              </h3>
              <p className="text-sm text-ink-400 dark:text-ink-400">5 minutes. Easy questions to get you in the zone.</p>
            </button>
          )}

          {/* Medium card — Quiz */}
          <button
            onClick={() => recommendedSubject && handleSubjectClick(recommendedSubject.subject)}
            className="md:col-span-3 paper-card tactile-card p-7 text-left group min-h-[200px] flex flex-col justify-between bg-clay-light dark:bg-ink-800 border-clay-100 dark:border-ink-700"
          >
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Pencil size={14} className="text-clay-500" />
                <span className="text-xs uppercase tracking-wider font-semibold text-clay-500">Quick check</span>
              </div>
              <h3 className="font-display text-2xl md:text-[26px] font-semibold text-ink-700 dark:text-ink-100 leading-tight mb-2">
                Take a 10-question quiz.
              </h3>
              <p className="text-sm text-ink-400 dark:text-ink-400">
                Mixed difficulty. See what's stuck and what isn't.
              </p>
            </div>
            <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-clay-500 group-hover:gap-2.5 transition-all">
              Start quiz <ArrowUpRight size={14} />
            </div>
          </button>
        </div>
      </section>

      {/* ─── Section 4: Subjects (asymmetric, editorial) ──────────────────── */}
      <section className="fade-in stagger-3">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-medium text-ink-700 dark:text-ink-100">
              Or just <em className="font-display italic text-moss-500">browse</em>.
            </h2>
            <p className="text-ink-400 dark:text-ink-400 text-sm mt-1">All subjects, your level.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {filteredSubjects.map((subject) => {
            const Char = SUBJECT_CHARACTER[subject.id as Subject] || SUBJECT_CHARACTER[Subject.MATH];
            const Icon = Char.icon;
            const pm = user.progressMap || {};
            const cc = getCurriculumCourse(subject.id, user.gradeLevel);
            const topicIds = cc?.units.flatMap(u => u.topics.map(t => t.id)) || [];
            const masteries = topicIds.map(id => pm[id]?.mastery ?? 0);
            const avgMastery = masteries.length > 0 ? Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length) : 0;
            const attempted = masteries.filter(m => m > 0).length;

            return (
              <button
                key={subject.id}
                onClick={() => handleSubjectClick(subject.id)}
                className={`paper-card tactile-card p-6 text-left group ${Char.bg} ${Char.bgDark} border-transparent`}
              >
                <div className="flex items-start justify-between mb-5">
                  <div className={`w-11 h-11 rounded-xl bg-white/80 dark:bg-ink-700/30 flex items-center justify-center ${Char.ink} ${Char.inkDark}`}>
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  {avgMastery > 0 && (
                    <span className={`font-display text-2xl font-semibold ${Char.ink} ${Char.inkDark} leading-none`}>
                      {avgMastery}<span className="text-sm opacity-50">%</span>
                    </span>
                  )}
                </div>
                <h3 className="font-display text-xl font-semibold text-ink-700 dark:text-ink-100 mb-1">
                  {translations.subjectsList[subject.id]}
                </h3>
                <p className={`text-xs ${Char.ink} ${Char.inkDark} opacity-80 mb-4`}>
                  {Char.vibe}
                </p>
                {avgMastery > 0 ? (
                  <div className="space-y-2">
                    <div className="h-1 bg-white/60 dark:bg-ink-700/30 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${Char.ink.replace('text-', 'bg-')}`} style={{ width: `${avgMastery}%` }} />
                    </div>
                    <p className="text-[11px] text-ink-400 dark:text-ink-400">
                      {attempted} of {topicIds.length} topics started
                    </p>
                  </div>
                ) : (
                  <div className={`inline-flex items-center gap-1 text-sm font-semibold ${Char.ink} ${Char.inkDark} group-hover:gap-2 transition-all`}>
                    Start here <ArrowRight size={13} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {filteredSubjects.length === 0 && searchQuery.trim() && (
          <p className="text-center text-ink-300 dark:text-ink-400 py-12 italic font-display">Nothing matches "{searchQuery}".</p>
        )}
      </section>

      {/* ─── Section 5: All your active work (if user has multiple courses) ─ */}
      {activeCourses.length > 1 && (
        <section className="fade-in stagger-4">
          <h2 className="font-display text-2xl md:text-3xl font-medium text-ink-700 dark:text-ink-100 mb-1">
            What you're <em className="font-display italic text-moss-500">working on</em>.
          </h2>
          <p className="text-ink-400 dark:text-ink-400 text-sm mb-6">All your in-progress courses.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {activeCourses.map((course) => {
              const next = getNextTopic(course);
              const Char = SUBJECT_CHARACTER[course.subject as Subject] || SUBJECT_CHARACTER[Subject.MATH];
              const Icon = Char.icon;
              return (
                <div key={course.id} className="paper-card p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-9 h-9 rounded-lg ${Char.bg} ${Char.bgDark} ${Char.ink} ${Char.inkDark} flex items-center justify-center`}>
                      <Icon size={17} strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-ink-700 dark:text-ink-100 text-sm truncate">{course.title}</h3>
                      <p className="text-xs text-ink-300 dark:text-ink-400">{course.progress}% complete</p>
                    </div>
                  </div>
                  <div className="h-1 bg-ink-100 dark:bg-ink-700 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full ${Char.ink.replace('text-', 'bg-')}`} style={{ width: `${course.progress}%` }} />
                  </div>
                  <p className="text-xs text-ink-400 dark:text-ink-400 line-clamp-1 mb-4">
                    {next ? `Next: ${next.topic.title}` : 'Course complete!'}
                  </p>
                  <button
                    onClick={() => next ? onResumeTopic(course.id, next.topic.id) : onSelectCourse(course.id)}
                    className="text-xs font-semibold text-moss-500 hover:text-moss-600 inline-flex items-center gap-1 group-hover:gap-2 transition-all"
                  >
                    {next ? 'Continue' : 'Review'} <ArrowRight size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Footer / encouragement ────────────────────────────────────────── */}
      <section className="pt-8 pb-16 fade-in stagger-5">
        <div className="text-center max-w-md mx-auto">
          <p className="font-display text-base md:text-lg italic text-ink-300 dark:text-ink-400 leading-relaxed">
            "{[
              'Show up, even when it\'s boring.',
              'Small wins, every day.',
              'You don\'t need motivation — just start.',
              'The hard part is the first 5 minutes.',
              'Future-you will thank you.',
            ][Math.floor(Math.random() * 5)]}"
          </p>
        </div>
      </section>

      {/* ─── Grade picker modal ───────────────────────────────────────────── */}
      {selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink-700/40 dark:bg-ink-900/70 backdrop-blur-sm">
          <div className="bg-cream-50 dark:bg-ink-800 rounded-3xl w-full max-w-2xl shadow-lift overflow-hidden border border-ink-100 dark:border-ink-700 animate-pop">
            <div className="p-6 border-b border-ink-100 dark:border-ink-700 flex items-center justify-between">
              <div>
                <h3 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100">Pick your level.</h3>
                <p className="text-sm text-ink-400 dark:text-ink-400 mt-1">So we serve the right difficulty.</p>
              </div>
              <button onClick={() => setSelectedSubject(null)} className="p-2 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-700 text-ink-400 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2 scrollbar-hide">
              {gradeFolders.map((folder) => {
                const isOpen = openGradeFolder === folder.id;
                return (
                  <div key={folder.id} className="rounded-2xl border border-ink-100 dark:border-ink-700 overflow-hidden">
                    <button
                      onClick={() => setOpenGradeFolder(isOpen ? null : folder.id)}
                      className="w-full flex items-center justify-between px-5 py-3.5 bg-cream-100 dark:bg-ink-700 hover:bg-cream-200 dark:hover:bg-ink-700 transition-colors"
                    >
                      <span className="font-semibold text-sm text-ink-600 dark:text-ink-400">{folder.emoji} {folder.label}</span>
                      <ChevronDown size={16} className={`text-ink-300 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="flex flex-col gap-1 p-3 bg-cream-50 dark:bg-ink-800">
                        {folder.grades.map((grade) => (
                          <button
                            key={grade}
                            onClick={() => handleGradeSelect(grade)}
                            className="w-full text-left px-4 py-2.5 rounded-xl border border-ink-100 dark:border-ink-700 hover:border-moss-300 hover:bg-moss-50 dark:hover:bg-moss-light transition-all flex items-center justify-between group"
                          >
                            <span className="font-medium text-sm text-ink-600 dark:text-ink-400 group-hover:text-moss-600 dark:group-hover:text-moss-300">{translations.grades[grade]}</span>
                            <ChevronRight size={14} className="text-ink-200 group-hover:text-moss-500" />
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
    </div>
  );
};

export default Dashboard;
