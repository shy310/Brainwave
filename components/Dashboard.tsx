import React, { useState, useMemo } from 'react';
import { UserProfile, Course, Topic, Subject, GradeLevel, Translations, TopicProgress } from '../types';
import { ICON_MAP, SUBJECTS_DATA, CURRICULUM, getCurriculumCourse } from '../constants';
import {
  Play, Flame, BookOpen, X, ChevronRight, ChevronDown, Zap, GraduationCap,
  TrendingUp, Calculator, FlaskConical, Globe, Laptop,
  ArrowRight, Sparkles, Trophy, Star, Target, Clock, ArrowUpRight
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

const SUBJECT_STYLES: Record<Subject, { grad: string; icon: string; bg: string; ring: string }> = {
  [Subject.MATH]:      { grad: 'from-blue-500 to-blue-700',      icon: '📐', bg: 'bg-blue-500',      ring: 'ring-blue-200 dark:ring-blue-900' },
  [Subject.SCIENCE]:   { grad: 'from-emerald-500 to-emerald-700', icon: '🔬', bg: 'bg-emerald-500',   ring: 'ring-emerald-200 dark:ring-emerald-900' },
  [Subject.LANGUAGE]:  { grad: 'from-violet-500 to-violet-700',  icon: '📝', bg: 'bg-violet-500',    ring: 'ring-violet-200 dark:ring-violet-900' },
  [Subject.HISTORY]:   { grad: 'from-amber-500 to-amber-700',    icon: '🏛️', bg: 'bg-amber-500',     ring: 'ring-amber-200 dark:ring-amber-900' },
  [Subject.CODING]:    { grad: 'from-cyan-500 to-cyan-700',      icon: '💻', bg: 'bg-cyan-500',      ring: 'ring-cyan-200 dark:ring-cyan-900' },
  [Subject.ECONOMICS]: { grad: 'from-rose-500 to-rose-700',      icon: '📊', bg: 'bg-rose-500',      ring: 'ring-rose-200 dark:ring-rose-900' },
};

const SUBJECT_ICON_MAP: Record<Subject, React.ElementType> = {
  [Subject.MATH]: Calculator, [Subject.SCIENCE]: FlaskConical, [Subject.LANGUAGE]: Globe,
  [Subject.HISTORY]: BookOpen, [Subject.CODING]: Laptop, [Subject.ECONOMICS]: TrendingUp,
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
  const xpPercent = Math.round(xpInLevel / 10);

  const handleSubjectClick = (subject: Subject) => {
    if (hasSpecificGrade) onSelectSubjectGrade(subject, user.gradeLevel);
    else setSelectedSubject(subject);
  };

  const gradeFolders = [
    { id: 'kinder',     emoji: '🎒', label: 'Kindergarten',      grades: [GradeLevel.KINDER] },
    { id: 'elementary', emoji: '🏫', label: 'Elementary School',  grades: [GradeLevel.GRADE_1, GradeLevel.GRADE_2, GradeLevel.GRADE_3, GradeLevel.GRADE_4, GradeLevel.GRADE_5, GradeLevel.GRADE_6] },
    { id: 'middle',     emoji: '📚', label: 'Middle School',      grades: [GradeLevel.GRADE_7, GradeLevel.GRADE_8, GradeLevel.GRADE_9] },
    { id: 'high',       emoji: '🎓', label: 'High School',        grades: [GradeLevel.GRADE_10, GradeLevel.GRADE_11, GradeLevel.GRADE_12] },
    { id: 'college',    emoji: '🏛', label: 'College',            grades: [GradeLevel.COLLEGE_FRESHMAN, GradeLevel.COLLEGE_ADVANCED] },
  ];

  const getNextTopic = (course: Course): { topic: Topic; unitTitle: string } | null => {
    for (const unit of course.units)
      for (const topic of unit.topics)
        if (!topic.isLocked && topic.mastery < 100) return { topic, unitTitle: unit.title };
    return null;
  };

  const activeCourses = useMemo(() => {
    const pm = user.progressMap || {};
    return courses.filter(c => c.units.flatMap(u => u.topics.map(t => t.id)).some(id => (pm[id]?.attemptsTotal ?? 0) > 0));
  }, [courses, user.progressMap]);

  const recommended = useMemo(() => {
    const pm = user.progressMap || {};
    return Object.values(Subject).map(subject => {
      const cc = getCurriculumCourse(subject, user.gradeLevel);
      if (!cc) return null;
      const masteries = cc.units.flatMap(u => u.topics).map(t => pm[t.id]?.mastery ?? 0);
      const avg = masteries.length > 0 ? Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length) : 0;
      return { subject, mastery: avg };
    }).filter(Boolean).sort((a, b) => a!.mastery - b!.mastery).slice(0, 3) as { subject: Subject; mastery: number }[];
  }, [courses, user.progressMap, user.gradeLevel]);

  const filteredSubjects = searchQuery.trim()
    ? SUBJECTS_DATA.filter(s => translations.subjectsList[s.id].toLowerCase().includes(searchQuery.toLowerCase()))
    : SUBJECTS_DATA;

  const filteredCourses = searchQuery.trim()
    ? activeCourses.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : activeCourses;

  const handleGradeSelect = (grade: GradeLevel) => {
    if (selectedSubject) { onSelectSubjectGrade(selectedSubject, grade); setSelectedSubject(null); }
  };

  const totalTopicsDone = (Object.values(user.progressMap || {}) as TopicProgress[]).filter(tp => tp.mastery >= 70).length;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8 overflow-y-auto scrollbar-hide min-h-full">

      {/* ── HERO SECTION ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 md:p-10">
        {/* Decorative elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-50%] right-[-20%] w-[500px] h-[500px] rounded-full bg-white/[0.07] blur-3xl" />
          <div className="absolute bottom-[-30%] left-[-10%] w-[400px] h-[400px] rounded-full bg-purple-400/[0.1] blur-3xl" />
          <div className="absolute top-10 right-10 w-20 h-20 rounded-full border border-white/10" />
          <div className="absolute bottom-10 right-[30%] w-8 h-8 rounded-full border border-white/10" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            {/* Left: greeting */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-white/80 text-xs font-semibold border border-white/10">
                <Sparkles size={12} />
                BrainWave Learning Platform
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-[1.1] tracking-tight">
                {translations.welcome},<br />
                <span className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">{user.name}!</span>
              </h1>
              <p className="text-white/50 text-sm md:text-base max-w-md">{translations.readyToLearn}</p>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                {user.streakDays > 0 && (
                  <div className="flex items-center gap-1.5 bg-orange-500/20 border border-orange-400/30 text-orange-200 px-3 py-1.5 rounded-full text-xs font-bold">
                    <Flame size={12} className="text-orange-400" />
                    {user.streakDays} day streak
                  </div>
                )}
                <div className="flex items-center gap-1.5 bg-yellow-500/20 border border-yellow-400/30 text-yellow-200 px-3 py-1.5 rounded-full text-xs font-bold">
                  <Trophy size={12} className="text-yellow-400" />
                  Level {level}
                </div>
                {totalTopicsDone > 0 && (
                  <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 px-3 py-1.5 rounded-full text-xs font-bold">
                    <Star size={12} className="text-emerald-400" />
                    {totalTopicsDone} mastered
                  </div>
                )}
              </div>
            </div>

            {/* Right: stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:max-w-[520px] w-full">
              {[
                { label: 'Level', value: level, icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
                { label: 'Total XP', value: user.totalXp.toLocaleString(), icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/20' },
                { label: 'Day Streak', value: `${user.streakDays}d`, icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/20' },
                { label: 'Mastered', value: totalTopicsDone, icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-white/[0.08] backdrop-blur-sm rounded-2xl p-4 border border-white/[0.08] text-center">
                  <div className={`w-8 h-8 ${bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                    <Icon size={15} className={color} />
                  </div>
                  <div className="text-xl md:text-2xl font-black text-white">{value}</div>
                  <div className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* XP Progress bar */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40 font-semibold">Level {level} Progress</span>
              <span className="text-xs text-white/60 font-bold">{xpInLevel} / 1,000 XP</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-white/80 to-purple-300 rounded-full transition-all duration-1000 ease-out" style={{ width: `${xpPercent}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTINUE LEARNING ──────────────────────────────────────────── */}
      {filteredCourses.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
              <Play size={14} className="text-brand-600 dark:text-brand-400 fill-current" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{translations.continueLearning}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCourses.map((course) => {
              const next = getNextTopic(course);
              const Icon = ICON_MAP[course.iconName] || BookOpen;
              const styles = SUBJECT_STYLES[course.subject as Subject] || SUBJECT_STYLES[Subject.MATH];
              return (
                <div key={course.id} className="group relative bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 p-5 hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-zinc-900/50 hover:-translate-y-1 transition-all duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${styles.grad} flex items-center justify-center shadow-lg ring-4 ${styles.ring} group-hover:scale-105 transition-transform duration-300`}>
                      <Icon size={22} className="text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-zinc-900 dark:text-white">{course.progress}%</div>
                      <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Complete</div>
                    </div>
                  </div>
                  <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-3 overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${styles.grad} rounded-full transition-all duration-700`} style={{ width: `${course.progress}%` }} />
                  </div>
                  <h3 className="font-bold text-zinc-900 dark:text-white text-sm mb-1">{course.title}</h3>
                  <p className="text-xs text-zinc-400 mb-4 line-clamp-1">
                    {next ? `${next.unitTitle} → ${next.topic.title}` : translations.courseCompleted}
                  </p>
                  <button
                    onClick={() => next ? onResumeTopic(course.id, next.topic.id) : onSelectCourse(course.id)}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-1.5 bg-gradient-to-r ${styles.grad} text-white shadow-lg opacity-90 hover:opacity-100 hover:shadow-xl active:scale-[0.98]`}
                  >
                    {next ? translations.resume : translations.start}
                    <ArrowRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── RECOMMENDED FOR YOU ─────────────────────────────────────────── */}
      {recommended.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <TrendingUp size={14} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{translations.recommended}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommended.map(({ subject, mastery }) => {
              const styles = SUBJECT_STYLES[subject];
              const Icon = SUBJECT_ICON_MAP[subject];
              return (
                <button
                  key={subject}
                  onClick={() => handleSubjectClick(subject)}
                  className="group text-left bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 p-5 hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-zinc-900/50 hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${styles.grad} flex items-center justify-center shadow-lg ring-4 ${styles.ring} group-hover:scale-105 transition-transform duration-300`}>
                      <Icon size={22} className="text-white" />
                    </div>
                    <span className="text-3xl font-black text-zinc-900 dark:text-white">{mastery}<span className="text-base text-zinc-300 dark:text-zinc-600">%</span></span>
                  </div>
                  <h3 className="font-bold text-zinc-900 dark:text-white mb-1">{translations.subjectsList[subject]}</h3>
                  <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-3 overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${styles.grad} rounded-full`} style={{ width: `${mastery}%` }} />
                  </div>
                  <span className="text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                    {mastery < 30 ? translations.startLesson : translations.practiceMore}
                    <ArrowUpRight size={12} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── CHOOSE STUDY DOMAIN ────────────────────────────────────────── */}
      <section className="pb-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <GraduationCap size={14} className="text-violet-600 dark:text-violet-400" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{translations.selectSubject}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {filteredSubjects.map((subject) => {
            const Icon = ICON_MAP[subject.icon] || BookOpen;
            const pm = user.progressMap || {};
            const cc = getCurriculumCourse(subject.id, user.gradeLevel);
            const topicIds = cc?.units.flatMap(u => u.topics.map(t => t.id)) || [];
            const masteries = topicIds.map(id => pm[id]?.mastery ?? 0);
            const avgMastery = masteries.length > 0 ? Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length) : 0;
            const styles = SUBJECT_STYLES[subject.id as Subject] || SUBJECT_STYLES[Subject.MATH];

            return (
              <button
                key={subject.id}
                onClick={() => handleSubjectClick(subject.id)}
                className="group relative bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 p-5 hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-zinc-900/50 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center"
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${styles.grad} flex items-center justify-center mb-3 shadow-lg ring-4 ${styles.ring} group-hover:scale-110 transition-all duration-300`}>
                  <Icon size={28} className="text-white" />
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-white text-sm mb-1">
                  {translations.subjectsList[subject.id]}
                </h3>
                {avgMastery > 0 ? (
                  <p className="text-xs text-zinc-400 mb-2">{avgMastery}% mastered</p>
                ) : (
                  <p className="text-xs text-zinc-400 mb-2">Start learning</p>
                )}
                {avgMastery > 0 && (
                  <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-2">
                    <div className={`h-full bg-gradient-to-r ${styles.grad} rounded-full`} style={{ width: `${avgMastery}%` }} />
                  </div>
                )}
                <div className={`w-full py-2 rounded-xl text-xs font-bold transition-all duration-300 mt-auto bg-gradient-to-r ${styles.grad} text-white opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 flex items-center justify-center gap-1`}>
                  {avgMastery > 0 ? translations.resume : translations.start}
                  <ChevronRight size={12} />
                </div>
                <div className="w-full py-2 rounded-xl text-xs font-bold text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 group-hover:hidden flex items-center justify-center gap-1 mt-auto">
                  {avgMastery > 0 ? translations.resume : translations.start}
                  <ChevronRight size={12} />
                </div>
              </button>
            );
          })}
        </div>
        {filteredSubjects.length === 0 && searchQuery.trim() && (
          <p className="text-center text-zinc-400 py-12 font-medium">{translations.noActiveCourses}</p>
        )}
      </section>

      {/* ── GRADE SELECTION MODAL ──────────────────────────────────────── */}
      {selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-pop">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white">{translations.selectLevel}</h3>
                <p className="text-zinc-400 text-sm mt-0.5">{translations.chooseCurriculumHint}</p>
              </div>
              <button onClick={() => setSelectedSubject(null)} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors">
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
                      className="w-full flex items-center justify-between px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
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
                            className="w-full text-left px-4 py-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-all flex items-center justify-between group"
                          >
                            <span className="font-semibold text-sm text-zinc-700 dark:text-zinc-200 group-hover:text-brand-600">{translations.grades[grade]}</span>
                            <ChevronRight size={14} className="text-zinc-300 group-hover:text-brand-600" />
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
