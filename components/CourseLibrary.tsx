import React, { useEffect } from 'react';
import { Course, Translations } from '../types';
import { ICON_MAP } from '../constants';
import { CheckCircle, Lock, ChevronLeft } from 'lucide-react';

interface Props {
  course: Course;
  translations: Translations;
  onBack: () => void;
  onSelectTopic: (topicId: string) => void;
  onContextUpdate: (ctx: string) => void;
}

const CourseLibrary: React.FC<Props> = ({ course, translations, onBack, onSelectTopic, onContextUpdate }) => {
  const Icon = ICON_MAP[course.iconName];
  const gradeLabel = translations.grades[course.gradeLevel] || course.gradeLevel;

  useEffect(() => {
    onContextUpdate(`Viewing Course: ${course.title}\nDescription: ${course.description}\nUnits: ${course.units.map(u => u.title).join(', ')}`);
  }, [course, onContextUpdate]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 view-enter">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 mb-6 transition-colors"
      >
        <ChevronLeft size={16} className="rtl:rotate-180" />
        <span>{translations.backToDashboard}</span>
      </button>

      {/* Course header */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-card mb-6">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
        >
          <Icon size={28} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{course.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{course.description}</p>

        <div className="flex flex-wrap items-center gap-4 mt-4">
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
            {gradeLabel}
          </span>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-36 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 transition-all duration-1000 ease-out" style={{ width: `${course.progress}%` }} />
            </div>
            <span className="font-bold text-sm text-green-600 dark:text-green-400">{course.progress}%</span>
          </div>
        </div>
      </div>

      {/* Units & Topics */}
      <div className="space-y-8">
        {course.units.map((unit, uIdx) => (
          <div key={unit.id}>
            {/* Unit header */}
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="w-8 h-8 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                {uIdx + 1}
              </div>
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{unit.title}</h3>
            </div>

            {/* Topics list */}
            <div className="space-y-3">
              {unit.topics.map((topic, tIdx) => {
                const masteryColor =
                  topic.mastery >= 80
                    ? 'bg-green-500'
                    : topic.mastery >= 50
                    ? 'bg-amber-500'
                    : 'bg-red-500';

                return (
                  <div
                    key={topic.id}
                    onClick={() => !topic.isLocked && onSelectTopic(topic.id)}
                    className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all duration-150 ${
                      topic.isLocked
                        ? 'opacity-50 pointer-events-none'
                        : 'cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Badge */}
                      {topic.mastery === 100 ? (
                        <div className="w-10 h-10 rounded-xl bg-green-500 border-green-500 text-white font-bold flex items-center justify-center shrink-0">
                          <CheckCircle size={20} />
                        </div>
                      ) : topic.isLocked ? (
                        <div className="w-10 h-10 rounded-xl border-2 border-gray-300 dark:border-gray-700 text-gray-400 font-bold flex items-center justify-center shrink-0">
                          <Lock size={16} />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl border-2 border-brand-500 text-brand-600 font-bold flex items-center justify-center shrink-0">
                          <span className="font-bold text-sm">{tIdx + 1}</span>
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">{topic.title}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{topic.description}</p>
                        {!topic.isLocked && topic.mastery > 0 && (
                          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-2">
                            <div
                              className={`h-full rounded-full ${masteryColor} transition-all duration-500`}
                              style={{ width: `${topic.mastery}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Action button */}
                      {!topic.isLocked && (
                        <button className="bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 hover:bg-brand-500 hover:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ml-auto shrink-0">
                          {translations.start}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CourseLibrary;
