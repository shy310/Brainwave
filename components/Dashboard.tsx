
import React, { useState, useMemo } from 'react';
import { UserProfile, Course, Topic, Subject, GradeLevel, Translations } from '../types';
import { ICON_MAP, SUBJECTS_DATA, CURRICULUM, getCurriculumCourse } from '../constants';
import { Play, Flame, BookOpen, X, ChevronRight, ChevronDown, Zap, GraduationCap, BarChart2 } from 'lucide-react';

interface Props {
  user: UserProfile;
  courses: Course[];
  translations: Translations;
  searchQuery?: string;
  onSelectCourse: (courseId: string) => void;
  onResumeTopic: (courseId: string, topicId: string) => void;
  onSelectSubjectGrade: (subject: Subject, grade: GradeLevel) => void;
}

// Grades that are grouped ranges (legacy) — these users still need to pick a specific grade
const LEGACY_GROUPED_GRADES = new Set<GradeLevel>([
  GradeLevel.ELEMENTARY_1_3,
  GradeLevel.ELEMENTARY_4_6,
  GradeLevel.MIDDLE_7_8,
  GradeLevel.HIGH_9_10,
  GradeLevel.HIGH_11_12,
]);

const Dashboard: React.FC<Props> = ({ user, courses, translations, searchQuery = '', onSelectCourse, onResumeTopic, onSelectSubjectGrade }) => {
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [openGradeFolder, setOpenGradeFolder] = useState<string | null>(null);

  // If the user already has a specific grade, skip the picker and start directly
  const hasSpecificGrade = !LEGACY_GROUPED_GRADES.has(user.gradeLevel);

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
    { id: 'college',    emoji: '🏛️', label: 'College',          grades: [GradeLevel.COLLEGE_FRESHMAN, GradeLevel.COLLEGE_ADVANCED] },
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

  // Courses that have any progress (at least one topic attempted)
  const activeCourses = useMemo(() => {
    const progressMap = user.progressMap || {};
    return courses.filter(course => {
      const allTopicIds = course.units.flatMap(u => u.topics.map(t => t.id));
      return allTopicIds.some(id => (progressMap[id]?.attemptsTotal ?? 0) > 0);
    });
  }, [courses, user.progressMap]);

  // Recommended: subjects with low mastery or not yet started
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

  return (
    <div className="p-6 md:p-12 lg:p-16 max-w-full space-y-12 relative h-full overflow-y-auto scrollbar-hide">

      {/* Welcome Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 max-w-[1400px] mx-auto">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-3 tracking-tight">
            {translations.welcome} {user.name}
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 font-medium">
            {translations.readyToLearn}
          </p>
        </div>
        {user.streakDays > 0 && (
          <div className="hidden lg:flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 px-6 py-3 rounded-2xl text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-800 shadow-sm">
            <Flame size={20} fill="currentColor" />
            <span className="font-bold">
              {translations.dayStreakBadge.replace('{days}', user.streakDays.toString())}
            </span>
          </div>
        )}
      </header>

      {/* Continue Learning */}
      {filteredCourses.length > 0 && (
        <section className="max-w-[1400px] mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8 flex items-center gap-3">
            <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
              <Play className="fill-current text-brand-600 rtl:rotate-180" size={20} />
            </div>
            {translations.continueLearning}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCourses.map(course => {
              const next = getNextTopic(course);
              const Icon = ICON_MAP[course.iconName] || BookOpen;
              return (
                <div key={course.id} className="group bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400">
                      <Icon size={32} />
                    </div>
                    <div className="text-sm font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/50 px-3 py-1 rounded-full uppercase tracking-wider">
                      {course.progress}%
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-8 line-clamp-2 h-10">
                    {next ? `${next.unitTitle}: ${next.topic.title}` : translations.courseCompleted}
                  </p>
                  <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-8 overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all duration-700" style={{ width: `${course.progress}%` }}></div>
                  </div>
                  <button
                    onClick={() => next ? onResumeTopic(course.id, next.topic.id) : onSelectCourse(course.id)}
                    className="w-full py-4 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-base hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-lg active:scale-95"
                  >
                    {next ? translations.resume : translations.start}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recommended (for users who have started) */}
      {recommended.length > 0 && activeCourses.length > 0 && (
        <section className="max-w-[1400px] mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8 flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Zap className="fill-current text-amber-600" size={20} />
            </div>
            {translations.recommended}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recommended.map(({ subject, mastery }) => {
              const subjectData = SUBJECTS_DATA.find(s => s.id === subject);
              return (
                <button
                  key={subject}
                  onClick={() => handleSubjectClick(subject)}
                  className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-brand-200 dark:hover:border-brand-800 transition-all text-start group"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${subjectData?.color || ''}`}>
                    <GraduationCap size={24} />
                  </div>
                  <h3 className="font-black text-gray-900 dark:text-white mb-1">{translations.subjectsList[subject]}</h3>
                  <p className="text-xs text-gray-400 mb-3">{mastery}% {translations.mastery}</p>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${mastery}%` }}></div>
                  </div>
                  <p className="text-xs text-brand-600 dark:text-brand-400 font-bold mt-3 group-hover:underline">
                    {mastery < 30 ? translations.startLesson : translations.practiceMore} →
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Browse Subjects */}
      <section className="max-w-[1400px] mx-auto pb-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{translations.selectSubject}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
          {filteredSubjects.map((subject) => {
            const Icon = ICON_MAP[subject.icon] || BookOpen;
            const progressMap = user.progressMap || {};
            const cc = getCurriculumCourse(subject.id, user.gradeLevel);
            const topicIds = cc?.units.flatMap(u => u.topics.map(t => t.id)) || [];
            const masteries = topicIds.map(id => progressMap[id]?.mastery ?? 0);
            const avgMastery = masteries.length > 0
              ? Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length)
              : 0;

            return (
              <div
                key={subject.id}
                onClick={() => handleSubjectClick(subject.id)}
                className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:border-brand-200 dark:hover:border-brand-900 transition-all cursor-pointer group flex flex-col items-center text-center"
              >
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${subject.color}`}>
                  <Icon size={40} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {translations.subjectsList[subject.id]}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {translations.masterFundamentals} {translations.subjectsList[subject.id].toLowerCase()}.
                </p>
                {avgMastery > 0 && (
                  <div className="w-full mb-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                      <span>{translations.mastery}</span>
                      <span>{avgMastery}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${avgMastery}%` }}></div>
                    </div>
                  </div>
                )}
                <div className="mt-auto w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 group-hover:bg-brand-600 group-hover:text-white transition-colors font-bold text-sm text-gray-700 dark:text-gray-300">
                  {avgMastery > 0 ? translations.resume : translations.start}
                  <ChevronRight size={16} className="rtl:rotate-180" />
                </div>
              </div>
            );
          })}
        </div>
        {filteredSubjects.length === 0 && searchQuery.trim() && (
          <p className="text-center text-gray-400 py-12 font-medium">{translations.noActiveCourses}</p>
        )}
      </section>

      {/* Level Selection Modal */}
      {selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="p-8 border-b dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
              <div>
                <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">{translations.selectLevel}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{translations.chooseCurriculumHint}</p>
              </div>
              <button
                onClick={() => setSelectedSubject(null)}
                className="p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {gradeFolders.map((folder) => {
                const isOpen = openGradeFolder === folder.id;
                return (
                  <div key={folder.id} className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                    <button
                      onClick={() => setOpenGradeFolder(isOpen ? null : folder.id)}
                      className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="font-bold text-base text-gray-700 dark:text-gray-200">{folder.emoji} {folder.label}</span>
                      <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="flex flex-col gap-1 p-3 bg-white dark:bg-gray-900">
                        {folder.grades.map((grade) => (
                          <button
                            key={grade}
                            onClick={() => handleGradeSelect(grade)}
                            className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/10 dark:hover:border-brand-700 transition-all flex items-center justify-between group"
                          >
                            <span className="font-bold text-gray-700 dark:text-gray-200 group-hover:text-brand-700 dark:group-hover:text-brand-400">
                              {translations.grades[grade]}
                            </span>
                            <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 transition-colors">
                              <ChevronRight size={16} className="text-gray-400 group-hover:text-brand-600 rtl:rotate-180" />
                            </div>
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
