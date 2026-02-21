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
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header with improved desktop presence */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-8 md:p-12 lg:p-16">
        <div className="max-w-[1400px] mx-auto">
            <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white mb-8 text-base font-bold transition-all rtl:flex-row-reverse group">
                <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 group-hover:text-brand-600 transition-colors">
                    <ChevronLeft size={20} className="rtl:rotate-180" /> 
                </div>
                <span>{translations.backToDashboard}</span>
            </button>
            
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-10">
                <div className="hidden lg:flex w-32 h-32 bg-brand-100 dark:bg-brand-900/30 rounded-[2.5rem] items-center justify-center text-brand-600 dark:text-brand-400 shadow-xl shadow-brand-500/10">
                    <Icon size={64} />
                </div>
                <div className="flex-1">
                    <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4 tracking-tight leading-tight">{course.title}</h1>
                    <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl leading-relaxed font-medium">{course.description}</p>
                    <div className="flex flex-wrap items-center gap-6 mt-8">
                        <span className="text-sm font-black uppercase tracking-[0.2em] text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-4 py-1.5 rounded-full">{gradeLabel}</span>
                        <div className="flex items-center gap-4">
                            <div className="h-2.5 w-48 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 transition-all duration-1000 ease-out" style={{width: `${course.progress}%`}}></div>
                            </div>
                            <span className="font-black text-green-600 dark:text-green-400">{course.progress}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Units & Topics List Optimized for Wide Screens */}
      <div className="flex-1 overflow-y-auto p-8 md:p-12 lg:p-16 space-y-12">
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 gap-12">
            {course.units.map((unit, uIdx) => (
                <div key={unit.id} className="space-y-6">
                    <div className="flex items-center gap-4 px-2">
                        <div className="w-10 h-10 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl flex items-center justify-center font-black text-xl">
                            {uIdx + 1}
                        </div>
                        <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 tracking-tight">{unit.title}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
                        {unit.topics.map((topic, tIdx) => (
                            <div 
                              key={topic.id} 
                              onClick={() => !topic.isLocked && onSelectTopic(topic.id)}
                              className={`p-6 flex items-center justify-between group transition-all duration-300 rounded-[1.75rem] border border-gray-100 dark:border-gray-800 ${topic.isLocked ? 'opacity-50 cursor-not-allowed bg-gray-50/50 dark:bg-gray-900/30' : 'cursor-pointer bg-white dark:bg-gray-800 hover:shadow-xl hover:border-brand-200 dark:hover:border-brand-900 hover:-translate-y-0.5'}`}
                            >
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-2 transition-all ${
                                        topic.mastery === 100 ? 'bg-green-100 dark:bg-green-900/20 border-green-500 text-green-600 shadow-lg shadow-green-500/10' :
                                        topic.isLocked ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400' :
                                        'bg-white dark:bg-gray-900 border-brand-500 text-brand-600 group-hover:bg-brand-600 group-hover:text-white'
                                    }`}>
                                        {topic.mastery === 100 ? <CheckCircle size={28} /> : 
                                         topic.isLocked ? <Lock size={24} /> : 
                                         <span className="font-black text-lg">{tIdx + 1}</span>}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-xl text-gray-900 dark:text-white group-hover:text-brand-600 transition-colors">{topic.title}</h4>
                                        <p className="text-base text-gray-500 dark:text-gray-400 font-medium">{topic.description}</p>
                                    </div>
                                </div>
                                
                                {!topic.isLocked && (
                                    <button className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-black group-hover:bg-brand-600 group-hover:text-white transition-all shadow-sm active:scale-95">
                                        {translations.start}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
          </div>
      </div>
    </div>
  );
};

export default CourseLibrary;