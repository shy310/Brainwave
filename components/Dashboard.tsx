import React, { useState, useMemo } from 'react';
import { UserProfile, Course, Topic, Subject, GradeLevel, Translations, TopicProgress } from '../types';
import { ICON_MAP, SUBJECTS_DATA, CURRICULUM, getCurriculumCourse } from '../constants';
import {
  Play, Flame, BookOpen, X, ChevronRight, ChevronDown, Zap, GraduationCap,
  TrendingUp, Calculator, FlaskConical, Globe, Laptop,
  ArrowRight, Sparkles, Trophy, Star, Target, BarChart2
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
  GradeLevel.ELEMENTARY_1_3,
  GradeLevel.ELEMENTARY_4_6,
  GradeLevel.MIDDLE_7_8,
  GradeLevel.HIGH_9_10,
  GradeLevel.HIGH_11_12,
]);

const SUBJECT_COLOR_MAP: Record<Subject, { grad: string; bg: string; border: string; text: string }> = {
  [Subject.MATH]:      { grad: 'from-blue-500 to-indigo-600',    bg: 'bg-blue-50 dark:bg-blue-950/20',    border: 'border-blue-100 dark:border-blue-900/30',    text: 'text-blue-600 dark:text-blue-400' },
  [Subject.SCIENCE]:   { grad: 'from-emerald-500 to-teal-600',   bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-100 dark:border-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400' },
  [Subject.LANGUAGE]:  { grad: 'from-violet-500 to-purple-600',  bg: 'bg-violet-50 dark:bg-violet-950/20',  border: 'border-violet-100 dark:border-violet-900/30',  text: 'text-violet-600 dark:text-violet-400' },
  [Subject.HISTORY]:   { grad: 'from-amber-500 to-orange-500',   bg: 'bg-amber-50 dark:bg-amber-950/20',   border: 'border-amber-100 dark:border-amber-900/30',   text: 'text-amber-600 dark:text-amber-400' },
  [Subject.CODING]:    { grad: 'from-cyan-500 to-blue-600',      bg: 'bg-cyan-50 dark:bg-cyan-950/20',     border: 'border-cyan-100 dark:border-cyan-900/30',     text: 'text-cyan-600 dark:text-cyan-400' },
  [Subject.ECONOMICS]: { grad: 'from-rose-500 to-pink-600',      bg: 'bg-rose-50 dark:bg-rose-950/20',     border: 'border-rose-100 dark:border-rose-900/30',     text: 'text-rose-600 dark:text-rose-400' },
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
  onSelectCourse, onResumeTopic, onSelectSubjectGrade
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
    { id: 'kinder',     emoji: '🎒', label: 'Kindergarten',      grades: [GradeLevel.KINDER] },
    { id: 'elementary', emoji: '🏫', label: 'Elementary School',  grades: [GradeLevel.GRADE_1, GradeLevel.GRADE_2, GradeLevel.GRADE_3, GradeLevel.GRADE_4, GradeLevel.GRADE_5, GradeLevel.GRADE_6] },
    { id: 'middle',     emoji: '📚', label: 'Middle School',      grades: [GradeLevel.GRADE_7, GradeLevel.GRADE_8, GradeLevel.GRADE_9] },
    { id: 'high',       emoji: '🎓', label: 'High School',        grades: [GradeLevel.GRADE_10, GradeLevel.GRADE_11, GradeLevel.GRADE_12] },
    { id: 'college',    emoji: '🏛', label: 'College',            grades: [GradeLevel.COLLEGE_FRESHMAN, GradeLevel.COLLEGE_ADVANCED] },
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

  // Progress ring SVG helper
  const ProgressRing = ({ progress, size = 44, stroke = 3.5, color = 'text-brand-500' }: { progress: number; size?: number; stroke?: number; color?: string }) => {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;
    return (
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-zinc-100 dark:text-zinc-800" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke}
          className={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
    );
  };

  return (
    <div className="view-enter p-5 md:p-8 lg:p-10 max-w-full space-y-8 overflow-y-auto scrollbar-hide min-h-full">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto">
        <div className="relative overflow-hidden gradient-mesh rounded-3xl p-8 text-white shadow-xl shadow-brand-500/10">
          {/* Floating orbs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/5 rounded-full orb-slow" />
            <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-white/5 rounded-full orb-medium" />
            <div className="absolute top-8 right-32 w-3 h-3 bg-white/20 rounded-full orb-fast" />
            <div className="absolute bottom-12 right-20 w-2 h-2 bg-white/30 rounded-full orb-fast" style={{ animationDelay: '2s' }} />
            <div className="absolute top-1/2 left-1/3 w-1.5 h-1.5 bg-white/15 rounded-full orb-slow" style={{ animationDelay: '4s' }} />
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-brand-200" />
                <span className="text-brand-200 text-[11px] font-bold uppercase tracking-[0.2em]">BrainWave</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1.5 leading-tight">
                {translations.welcome}, {user.name}!
              </h1>
              <p className="text-brand-200/80 text-sm">{translations.readyToLearn}</p>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {user.streakDays > 0 && (
                  <span className="bg-white/10 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border border-white/10">
                    <Flame size={11} fill="currentColor" className="text-orange-300" />
                    {translations.dayStreakBadge.replace('{days}', user.streakDays.toString())}
                  </span>
                )}
                <span className="bg-white/10 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border border-white/10">
                  <Trophy size={11} className="text-yellow-300" />
                  Level {level}
                </span>
                {totalTopicsDone > 0 && (
                  <span className="bg-white/10 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border border-white/10">
                    <Star size={11} fill="currentColor" className="text-yellow-300" />
                    {totalTopicsDone} topics mastered
                  </span>
                )}
              </div>
            </div>

            {/* XP Ring */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 min-w-[150px] flex flex-col items-center border border-white/10">
              <div className="relative mb-2">
                <ProgressRing progress={xpInLevel / 10} size={56} stroke={4} color="text-white" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap size={18} className="text-white" />
                </div>
              </div>
              <div className="text-xl font-bold text-white">{user.totalXp}</div>
              <div className="text-brand-200/70 text-[10px] font-medium uppercase tracking-wider mt-0.5">Total XP</div>
              <div className="text-brand-200/50 text-[10px] mt-1">{xpInLevel}/1000 to Lv.{level + 1}</div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Level', value: String(level), icon: <Trophy size={16} className="text-yellow-500" />, bg: 'bg-yellow-50 dark:bg-yellow-950/20', border: 'border-yellow-100 dark:border-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' },
            { label: 'XP Earned', value: String(user.totalXp), icon: <Zap size={16} className="text-brand-500" />, bg: 'bg-brand-50 dark:bg-brand-950/20', border: 'border-brand-100 dark:border-brand-900/30', text: 'text-brand-600 dark:text-brand-400' },
            { label: 'Day Streak', value: `${user.streakDays}d`, icon: <Flame size={16} className="text-orange-500" />, bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-100 dark:border-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
            { label: 'Mastered', value: String(totalTopicsDone), icon: <Target size={16} className="text-emerald-500" />, bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-100 dark:border-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400' },
          ].map(({ label, value, icon, bg, border, text }, idx) => (
            <div key={label} className={`stagger-item stagger-${idx + 1} ${bg} rounded-2xl p-4 flex items-center gap-3 border ${border}`}>
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center shadow-sm">{icon}</div>
              <div>
                <div className={`text-xl font-bold ${text} count-in`}>{value}</div>
                <div className="text-[11px] text-zinc-400 font-medium">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Continue Learning ────────────────────────────────────────────────── */}
      {filteredCourses.length > 0 && (
        <section className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Play size={16} className="fill-brand-500 text-brand-500" />
              {translations.continueLearning}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCourses.map((course, idx) => {
              const next = getNextTopic(course);
              const Icon = ICON_MAP[course.iconName] || BookOpen;
              const colors = SUBJECT_COLOR_MAP[course.subject as Subject] || { grad: 'from-brand-500 to-brand-700', bg: '', border: '', text: '' };
              return (
                <div key={course.id} className={`stagger-item stagger-${(idx % 6) + 1} group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800/80 p-5 card-hover`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${colors.grad} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300`}>
                      <Icon size={20} className="text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      <ProgressRing progress={course.progress} size={36} stroke={3} />
                      <span className="text-xs font-bold text-zinc-400">{course.progress}%</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors text-sm">
                    {course.title}
                  </h3>
                  <p className="text-xs text-zinc-500 mb-4 line-clamp-2">
                    {next ? `Next: ${next.unitTitle} → ${next.topic.title}` : translations.courseCompleted}
                  </p>
                  <button
                    onClick={() => next ? onResumeTopic(course.id, next.topic.id) : onSelectCourse(course.id)}
                    className="w-full py-2.5 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-gradient-to-r hover:from-brand-500 hover:to-violet-500 hover:text-white text-zinc-600 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-1.5 border border-zinc-100 dark:border-zinc-800 hover:border-transparent hover:shadow-brand"
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

      {/* ── Recommended ──────────────────────────────────────────────────────── */}
      {recommended.length > 0 && (
        <section className="max-w-[1400px] mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-amber-500" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{translations.recommended}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommended.map(({ subject, mastery }, idx) => {
              const Icon = SUBJECT_ICON_MAP[subject];
              const colors = SUBJECT_COLOR_MAP[subject];
              return (
                <button
                  key={subject}
                  onClick={() => handleSubjectClick(subject)}
                  className={`stagger-item stagger-${idx + 1} bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800/80 card-hover text-start group`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${colors.grad} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300`}>
                      <Icon size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{translations.subjectsList[subject]}</h3>
                      <p className="text-xs text-zinc-400">{mastery}% {translations.mastery}</p>
                    </div>
                  </div>
                  <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-4">
                    <div className={`h-full bg-gradient-to-r ${colors.grad} rounded-full transition-all duration-1000`} style={{ width: `${mastery}%` }} />
                  </div>
                  <p className={`text-xs font-bold ${colors.text} group-hover:underline flex items-center gap-1`}>
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
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{translations.selectSubject}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {filteredSubjects.map((subject, idx) => {
            const Icon = ICON_MAP[subject.icon] || BookOpen;
            const progressMap = user.progressMap || {};
            const cc = getCurriculumCourse(subject.id, user.gradeLevel);
            const topicIds = cc?.units.flatMap(u => u.topics.map(t => t.id)) || [];
            const masteries = topicIds.map(id => progressMap[id]?.mastery ?? 0);
            const avgMastery = masteries.length > 0
              ? Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length)
              : 0;
            const colors = SUBJECT_COLOR_MAP[subject.id as Subject] || { grad: 'from-brand-500 to-brand-700', bg: '', border: '', text: '' };

            return (
              <div
                key={subject.id}
                onClick={() => handleSubjectClick(subject.id)}
                className={`stagger-item stagger-${(idx % 6) + 1} bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800/80 p-5 card-hover cursor-pointer group flex flex-col items-center text-center`}
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${colors.grad} flex items-center justify-center mb-3 shadow-md group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                  <Icon size={24} className="text-white" />
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-1 text-sm">
                  {translations.subjectsList[subject.id]}
                </h3>
                {avgMastery > 0 && (
                  <>
                    <p className="text-[11px] text-zinc-400 mb-2">{avgMastery}% mastered</p>
                    <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${colors.grad} rounded-full transition-all duration-700`} style={{ width: `${avgMastery}%` }} />
                    </div>
                  </>
                )}
                <div className={`mt-auto pt-3 w-full flex items-center justify-center gap-1 py-2 rounded-xl border border-zinc-100 dark:border-zinc-800 group-hover:bg-gradient-to-r group-hover:${colors.grad} group-hover:text-white group-hover:border-transparent transition-all duration-300 font-bold text-xs text-zinc-500 dark:text-zinc-400`}>
                  {avgMastery > 0 ? translations.resume : translations.start}
                  <ChevronRight size={12} />
                </div>
              </div>
            );
          })}
        </div>
        {filteredSubjects.length === 0 && searchQuery.trim() && (
          <p className="text-center text-zinc-400 py-12 font-medium">{translations.noActiveCourses}</p>
        )}
      </section>

      {/* ── Level Selection Modal ──────────────────────────────────────────── */}
      {selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 animate-pop">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{translations.selectLevel}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">{translations.chooseCurriculumHint}</p>
              </div>
              <button
                onClick={() => setSelectedSubject(null)}
                className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2 scrollbar-hide">
              {gradeFolders.map((folder) => {
                const isOpen = openGradeFolder === folder.id;
                return (
                  <div key={folder.id} className="rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                    <button
                      onClick={() => setOpenGradeFolder(isOpen ? null : folder.id)}
                      className="w-full flex items-center justify-between px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <span className="font-bold text-sm text-zinc-700 dark:text-zinc-200">{folder.emoji} {folder.label}</span>
                      <ChevronDown size={16} className={`text-zinc-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="flex flex-col gap-1 p-3 bg-white dark:bg-zinc-900">
                        {folder.grades.map((grade) => (
                          <button
                            key={grade}
                            onClick={() => handleGradeSelect(grade)}
                            className="w-full text-left px-4 py-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/20 dark:hover:border-brand-700 transition-all flex items-center justify-between group"
                          >
                            <span className="font-semibold text-sm text-zinc-700 dark:text-zinc-200 group-hover:text-brand-700 dark:group-hover:text-brand-400">
                              {translations.grades[grade]}
                            </span>
                            <ChevronRight size={14} className="text-zinc-400 group-hover:text-brand-600" />
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
