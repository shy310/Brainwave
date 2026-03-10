import React, { useState, useMemo } from 'react';
import { UserProfile, Course, Topic, Subject, GradeLevel, Translations, TopicProgress } from '../types';
import { ICON_MAP, SUBJECTS_DATA, CURRICULUM, getCurriculumCourse } from '../constants';
import {
  Play, Flame, BookOpen, X, ChevronRight, ChevronDown, Zap, GraduationCap,
  BarChart2, Presentation, Code2, Gamepad2, Swords, Feather, DatabaseIcon,
  Trophy, Star, FileText, Brain, TrendingUp, Calculator, FlaskConical,
  Globe, Laptop, ArrowRight, Sparkles
} from 'lucide-react';

interface Props {
  user: UserProfile;
  courses: Course[];
  translations: Translations;
  searchQuery?: string;
  onSelectCourse: (courseId: string) => void;
  onResumeTopic: (courseId: string, topicId: string) => void;
  onSelectSubjectGrade: (subject: Subject, grade: GradeLevel) => void;
  onNavigate: (view: string) => void;
}

const LEGACY_GROUPED_GRADES = new Set<GradeLevel>([
  GradeLevel.ELEMENTARY_1_3,
  GradeLevel.ELEMENTARY_4_6,
  GradeLevel.MIDDLE_7_8,
  GradeLevel.HIGH_9_10,
  GradeLevel.HIGH_11_12,
]);

const SUBJECT_COLOR_MAP: Record<Subject, string> = {
  [Subject.MATH]: 'from-blue-500 to-indigo-600',
  [Subject.SCIENCE]: 'from-emerald-500 to-teal-600',
  [Subject.LANGUAGE]: 'from-violet-500 to-purple-600',
  [Subject.HISTORY]: 'from-amber-500 to-orange-500',
  [Subject.CODING]: 'from-cyan-500 to-blue-600',
  [Subject.ECONOMICS]: 'from-rose-500 to-pink-600',
};

const SUBJECT_ICON_MAP: Record<Subject, React.ElementType> = {
  [Subject.MATH]: Calculator,
  [Subject.SCIENCE]: FlaskConical,
  [Subject.LANGUAGE]: Globe,
  [Subject.HISTORY]: BookOpen,
  [Subject.CODING]: Laptop,
  [Subject.ECONOMICS]: TrendingUp,
};

const Dashboard: React.FC<Props> = ({
  user, courses, translations, searchQuery = '',
  onSelectCourse, onResumeTopic, onSelectSubjectGrade, onNavigate
}) => {
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [openGradeFolder, setOpenGradeFolder] = useState<string | null>(null);

  const hasSpecificGrade = !LEGACY_GROUPED_GRADES.has(user.gradeLevel);
  const level = Math.floor(user.totalXp / 1000) + 1;
  const xpInLevel = user.totalXp % 1000;

  const handleSubjectClick = (subject: Subject) => {
    if (hasSpecificGrade) {
      onSelectSubjectGrade(subject, user.gradeLevel);
    } else {
      setSelectedSubject(subject);
    }
  };

  const gradeFolders = [
    { id: 'kinder',     emoji: '🎒', label: 'Kindergarten',    grades: [GradeLevel.KINDER] },
    { id: 'elementary', emoji: '🏫', label: 'Elementary School', grades: [GradeLevel.GRADE_1, GradeLevel.GRADE_2, GradeLevel.GRADE_3, GradeLevel.GRADE_4, GradeLevel.GRADE_5, GradeLevel.GRADE_6] },
    { id: 'middle',     emoji: '📚', label: 'Middle School',    grades: [GradeLevel.GRADE_7, GradeLevel.GRADE_8, GradeLevel.GRADE_9] },
    { id: 'high',       emoji: '🎓', label: 'High School',      grades: [GradeLevel.GRADE_10, GradeLevel.GRADE_11, GradeLevel.GRADE_12] },
    { id: 'college',    emoji: '🏛', label: 'College',          grades: [GradeLevel.COLLEGE_FRESHMAN, GradeLevel.COLLEGE_ADVANCED] },
  ];

  const getNextTopic = (course: Course): { topic: Topic; unitTitle: string } | null => {
    for (const unit of course.units) {
      for (const topic of unit.topics) {
        if (!topic.isLocked && topic.mastery < 100) {
          return { topic, unitTitle: unit.title };
        }
      }
    }
    return null;
  };

  const activeCourses = useMemo(() => {
    const progressMap = user.progressMap || {};
    return courses.filter(course => {
      const allTopicIds = course.units.flatMap(u => u.topics.map(t => t.id));
      return allTopicIds.some(id => (progressMap[id]?.attemptsTotal ?? 0) > 0);
    });
  }, [courses, user.progressMap]);

  const recommended = useMemo(() => {
    const progressMap = user.progressMap || {};
    return Object.values(Subject).map(subject => {
      const cc = getCurriculumCourse(subject, user.gradeLevel);
      if (!cc) return null;
      const allTopics = cc.units.flatMap(u => u.topics);
      const masteries = allTopics.map(t => progressMap[t.id]?.mastery ?? 0);
      const avg = masteries.length > 0
        ? Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length)
        : 0;
      return { subject, mastery: avg };
    })
      .filter(Boolean)
      .sort((a, b) => a!.mastery - b!.mastery)
      .slice(0, 3) as { subject: Subject; mastery: number }[];
  }, [courses, user.progressMap, user.gradeLevel]);

  const filteredSubjects = searchQuery.trim()
    ? SUBJECTS_DATA.filter(s => translations.subjectsList[s.id].toLowerCase().includes(searchQuery.toLowerCase()))
    : SUBJECTS_DATA;

  const filteredCourses = searchQuery.trim()
    ? activeCourses.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : activeCourses;

  const handleGradeSelect = (grade: GradeLevel) => {
    if (selectedSubject) {
      onSelectSubjectGrade(selectedSubject, grade);
      setSelectedSubject(null);
    }
  };

  const totalTopicsDone = (Object.values(user.progressMap || {}) as TopicProgress[]).filter(tp => tp.mastery >= 70).length;

  const AI_TOOLS = [
    { view: 'notes', icon: FileText, label: 'AI Notes', desc: 'Generate notes from any topic or YouTube', grad: 'from-violet-500 to-purple-600' },
    { view: 'math-tutor', icon: Brain, label: 'Math Tutor', desc: 'AI tutor, solver & graph generator', grad: 'from-blue-500 to-indigo-600' },
    { view: 'presentation', icon: Presentation, label: 'Presentations', desc: 'AI slide generator', grad: 'from-pink-500 to-rose-500' },
    { view: 'codelab', icon: Code2, label: 'Code Lab', desc: 'AI coding challenges', grad: 'from-orange-500 to-red-500' },
    { view: 'games', icon: Gamepad2, label: 'Games', desc: 'Educational mini-games', grad: 'from-emerald-500 to-teal-600' },
    { view: 'debate', icon: Swords, label: 'Debate', desc: 'Practice argumentation', grad: 'from-rose-500 to-red-600' },
    { view: 'story', icon: Feather, label: 'Stories', desc: 'Collaborative storytelling', grad: 'from-violet-500 to-purple-600' },
    { view: 'sql-detective', icon: DatabaseIcon, label: 'SQL Detective', desc: 'Solve database mysteries', grad: 'from-cyan-500 to-teal-600' },
  ];

  return (
    <div className="view-enter p-5 md:p-8 lg:p-10 max-w-full space-y-8 overflow-y-auto scrollbar-hide min-h-full">

      {/* ── Hero + Stats ────────────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto">
        {/* Hero greeting */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-violet-600 rounded-3xl p-7 text-white mb-6 shadow-brand">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-8 -right-8 w-48 h-48 bg-white/5 rounded-full" />
            <div className="absolute -bottom-12 -left-6 w-36 h-36 bg-white/5 rounded-full" />
            <div className="absolute top-4 right-24 w-3 h-3 bg-white/20 rounded-full" />
            <div className="absolute bottom-6 right-16 w-2 h-2 bg-white/30 rounded-full" />
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={14} className="text-brand-200" />
                <span className="text-brand-200 text-xs font-semibold uppercase tracking-widest">BrainWave AI</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {translations.welcome}, {user.name}!
              </h1>
              <p className="text-brand-200 text-sm">{translations.readyToLearn}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {user.streakDays > 0 && (
                  <span className="bg-white/15 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5">
                    <Flame size={11} fill="currentColor" />
                    {translations.dayStreakBadge.replace('{days}', user.streakDays.toString())}
                  </span>
                )}
                <span className="bg-white/15 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5">
                  <Trophy size={11} />
                  Level {level}
                </span>
                {totalTopicsDone > 0 && (
                  <span className="bg-white/15 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5">
                    <Star size={11} fill="currentColor" />
                    {totalTopicsDone} topics mastered
                  </span>
                )}
              </div>
            </div>
            {/* XP progress */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 min-w-[140px] text-center">
              <div className="text-2xl font-bold text-white mb-1">{user.totalXp}</div>
              <div className="text-brand-200 text-xs mb-2">Total XP</div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${xpInLevel / 10}%` }} />
              </div>
              <div className="text-brand-200 text-[10px] mt-1">{xpInLevel}/1000 to Level {level + 1}</div>
            </div>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Level', value: String(level), icon: <Trophy size={16} className="text-yellow-500" />, bg: 'bg-yellow-50 dark:bg-yellow-900/10', text: 'text-yellow-600 dark:text-yellow-400' },
            { label: 'XP Earned', value: String(user.totalXp), icon: <Zap size={16} className="text-brand-500" />, bg: 'bg-brand-50 dark:bg-brand-900/10', text: 'text-brand-600 dark:text-brand-400' },
            { label: 'Day Streak', value: `${user.streakDays}d`, icon: <Flame size={16} className="text-orange-500" />, bg: 'bg-orange-50 dark:bg-orange-900/10', text: 'text-orange-600 dark:text-orange-400' },
            { label: 'Mastered', value: String(totalTopicsDone), icon: <Star size={16} className="text-emerald-500" />, bg: 'bg-emerald-50 dark:bg-emerald-900/10', text: 'text-emerald-600 dark:text-emerald-400' },
          ].map(({ label, value, icon, bg, text }) => (
            <div key={label} className={`${bg} rounded-2xl p-4 flex items-center gap-3`}>
              <div className={`w-9 h-9 rounded-xl bg-white dark:bg-gray-900 flex items-center justify-center shadow-sm`}>{icon}</div>
              <div>
                <div className={`text-xl font-bold ${text}`}>{value}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Continue Learning ────────────────────────────────────────────────── */}
      {filteredCourses.length > 0 && (
        <section className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Play size={16} className="fill-brand-500 text-brand-500" />
              {translations.continueLearning}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCourses.map(course => {
              const next = getNextTopic(course);
              const Icon = ICON_MAP[course.iconName] || BookOpen;
              const grad = SUBJECT_COLOR_MAP[course.subject as Subject] || 'from-brand-500 to-brand-700';
              return (
                <div key={course.id} className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 card-hover">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm`}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${course.progress}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-400">{course.progress}%</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors text-sm">
                    {course.title}
                  </h3>
                  <p className="text-xs text-gray-500 mb-4 line-clamp-2">
                    {next ? `Next: ${next.unitTitle} → ${next.topic.title}` : translations.courseCompleted}
                  </p>
                  <button
                    onClick={() => next ? onResumeTopic(course.id, next.topic.id) : onSelectCourse(course.id)}
                    className="w-full py-2 bg-gray-50 dark:bg-gray-800 hover:bg-brand-500 hover:text-white text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5"
                  >
                    {next ? translations.resume : translations.start}
                    <ArrowRight size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── AI Tools ─────────────────────────────────────────────────────────── */}
      <section className="max-w-[1400px] mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-violet-500" />
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{translations.tools ?? 'AI Tools'}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {AI_TOOLS.map(({ view, icon: Icon, label, desc, grad }) => (
            <button
              key={view}
              onClick={() => onNavigate(view)}
              className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex flex-col items-center gap-2.5 hover:border-brand-200 dark:hover:border-brand-800 hover:shadow-md transition-all duration-150 cursor-pointer text-center"
            >
              <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-150`}>
                <Icon size={20} className="text-white" />
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Recommended ──────────────────────────────────────────────────────── */}
      {recommended.length > 0 && (
        <section className="max-w-[1400px] mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-amber-500" />
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{translations.recommended}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommended.map(({ subject, mastery }) => {
              const Icon = SUBJECT_ICON_MAP[subject];
              const grad = SUBJECT_COLOR_MAP[subject] || 'from-brand-500 to-brand-700';
              return (
                <button
                  key={subject}
                  onClick={() => handleSubjectClick(subject)}
                  className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 hover:shadow-md hover:-translate-y-0.5 hover:border-brand-200 dark:hover:border-brand-800 transition-all duration-200 text-start group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm`}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{translations.subjectsList[subject]}</h3>
                      <p className="text-xs text-gray-400">{mastery}% {translations.mastery}</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-3">
                    <div className={`h-full bg-gradient-to-r ${grad} rounded-full transition-all`} style={{ width: `${mastery}%` }} />
                  </div>
                  <p className="text-xs text-brand-600 dark:text-brand-400 font-bold group-hover:underline flex items-center gap-1">
                    {mastery < 30 ? translations.startLesson : translations.practiceMore}
                    <ArrowRight size={11} />
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Browse Subjects ───────────────────────────────────────────────────── */}
      <section className="max-w-[1400px] mx-auto pb-12">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap size={16} className="text-brand-500" />
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{translations.selectSubject}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {filteredSubjects.map((subject) => {
            const Icon = ICON_MAP[subject.icon] || BookOpen;
            const progressMap = user.progressMap || {};
            const cc = getCurriculumCourse(subject.id, user.gradeLevel);
            const topicIds = cc?.units.flatMap(u => u.topics.map(t => t.id)) || [];
            const masteries = topicIds.map(id => progressMap[id]?.mastery ?? 0);
            const avgMastery = masteries.length > 0
              ? Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length)
              : 0;
            const grad = SUBJECT_COLOR_MAP[subject.id as Subject] || 'from-brand-500 to-brand-700';

            return (
              <div
                key={subject.id}
                onClick={() => handleSubjectClick(subject.id)}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md hover:-translate-y-0.5 hover:border-brand-200 dark:hover:border-brand-800 transition-all duration-200 cursor-pointer group card-hover flex flex-col items-center text-center"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform duration-150`}>
                  <Icon size={22} className="text-white" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1 text-sm">
                  {translations.subjectsList[subject.id]}
                </h3>
                {avgMastery > 0 && (
                  <>
                    <p className="text-xs text-gray-400 mb-2">{avgMastery}% mastered</p>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${grad} rounded-full`} style={{ width: `${avgMastery}%` }} />
                    </div>
                  </>
                )}
                <div className="mt-auto pt-3 w-full flex items-center justify-center gap-1 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 group-hover:bg-brand-500 group-hover:text-white transition-all duration-150 font-bold text-xs text-gray-600 dark:text-gray-300">
                  {avgMastery > 0 ? translations.resume : translations.start}
                  <ChevronRight size={12} />
                </div>
              </div>
            );
          })}
        </div>
        {filteredSubjects.length === 0 && searchQuery.trim() && (
          <p className="text-center text-gray-400 py-12 font-medium">{translations.noActiveCourses}</p>
        )}
      </section>

      {/* ── Level Selection Modal ──────────────────────────────────────────── */}
      {selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/50 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 animate-slide-up">
            <div className="p-6 border-b dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{translations.selectLevel}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{translations.chooseCurriculumHint}</p>
              </div>
              <button
                onClick={() => setSelectedSubject(null)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2">
              {gradeFolders.map((folder) => {
                const isOpen = openGradeFolder === folder.id;
                return (
                  <div key={folder.id} className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <button
                      onClick={() => setOpenGradeFolder(isOpen ? null : folder.id)}
                      className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                    >
                      <span className="font-bold text-sm text-gray-700 dark:text-gray-200">{folder.emoji} {folder.label}</span>
                      <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="flex flex-col gap-1 p-3 bg-white dark:bg-gray-900">
                        {folder.grades.map((grade) => (
                          <button
                            key={grade}
                            onClick={() => handleGradeSelect(grade)}
                            className="w-full text-left px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/10 dark:hover:border-brand-700 transition-all flex items-center justify-between group"
                          >
                            <span className="font-semibold text-sm text-gray-700 dark:text-gray-200 group-hover:text-brand-700 dark:group-hover:text-brand-400">
                              {translations.grades[grade]}
                            </span>
                            <ChevronRight size={14} className="text-gray-400 group-hover:text-brand-600" />
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
