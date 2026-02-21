
import React, { useMemo } from 'react';
import { UserProfile, Subject, Translations, Language, GradeLevel, ProgressMap, TopicProgress } from '../types';
import { CURRICULUM, SUBJECTS_DATA } from '../constants';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Flame, Zap, Target, TrendingUp, BookOpen, RotateCcw } from 'lucide-react';

interface Props {
  user: UserProfile;
  translations: Translations;
  language: Language;
  onStartPractice: (subject: Subject, topicId: string | null, topicTitle: string) => void;
}

const SUBJECT_COLORS: Record<Subject, string> = {
  [Subject.MATH]: '#3b82f6',
  [Subject.SCIENCE]: '#22c55e',
  [Subject.LANGUAGE]: '#a855f7',
  [Subject.CODING]: '#f97316',
  [Subject.HISTORY]: '#f59e0b',
  [Subject.ECONOMICS]: '#10b981',
};

const ProgressDashboard: React.FC<Props> = ({ user, translations, language, onStartPractice }) => {
  const progressMap: ProgressMap = user.progressMap || {};

  // Build per-subject mastery from CURRICULUM + progressMap
  const subjectMastery = useMemo(() => {
    return Object.values(Subject).map(subject => {
      const courses = CURRICULUM.filter(c => c.subject === subject);
      const allTopics = courses.flatMap(c => c.units.flatMap(u => u.topics));
      const masteries = allTopics.map(t => progressMap[t.id]?.mastery ?? 0);
      const avg = masteries.length > 0
        ? Math.round(masteries.reduce((s, m) => s + m, 0) / masteries.length)
        : 0;
      const attempted = masteries.filter(m => m > 0).length;
      return { subject, mastery: avg, attempted, total: allTopics.length };
    });
  }, [progressMap]);

  // Weak topics (mastery < 60 and attempted at least once)
  const weakTopics = useMemo(() => {
    return Object.entries(progressMap)
      .filter(([, p]) => p.mastery < 60 && p.attemptsTotal > 0)
      .map(([topicId, p]) => {
        // Find topic in curriculum
        for (const cc of CURRICULUM) {
          for (const unit of cc.units) {
            const topic = unit.topics.find(t => t.id === topicId);
            if (topic) {
              return { topicId, topicTitle: topic.title, subject: cc.subject, mastery: p.mastery };
            }
          }
        }
        return null;
      })
      .filter(Boolean)
      .slice(0, 5) as { topicId: string; topicTitle: string; subject: Subject; mastery: number }[];
  }, [progressMap]);

  // Strong topics (mastery >= 80)
  const strongTopics = useMemo(() => {
    return Object.entries(progressMap)
      .filter(([, p]) => p.mastery >= 80)
      .map(([topicId, p]) => {
        for (const cc of CURRICULUM) {
          for (const unit of cc.units) {
            const topic = unit.topics.find(t => t.id === topicId);
            if (topic) return { topicId, topicTitle: topic.title, subject: cc.subject, mastery: p.mastery };
          }
        }
        return null;
      })
      .filter(Boolean)
      .slice(0, 5) as { topicId: string; topicTitle: string; subject: Subject; mastery: number }[];
  }, [progressMap]);

  const overallMastery = useMemo(() => {
    const vals = subjectMastery.map(s => s.mastery);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }, [subjectMastery]);

  const radarData = subjectMastery.map(s => ({
    subject: translations.subjectsList[s.subject],
    mastery: s.mastery,
    fullMark: 100
  }));

  const barData = subjectMastery.map(s => ({
    name: translations.subjectsList[s.subject].substring(0, 4),
    mastery: s.mastery,
    subject: s.subject
  }));

  const hasAnyProgress = Object.keys(progressMap).length > 0;

  return (
    <div className="p-6 md:p-12 max-w-[1400px] mx-auto space-y-10">
      {/* Header */}
      <header>
        <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">{translations.progress}</h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium">{translations.overallMastery}: {overallMastery}%</p>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: translations.xp, value: user.totalXp, icon: <Zap size={20} className="text-amber-500" />, color: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: translations.streak, value: `${user.streakDays}d`, icon: <Flame size={20} className="text-orange-500" />, color: 'bg-orange-50 dark:bg-orange-900/20' },
          { label: translations.overallMastery, value: `${overallMastery}%`, icon: <Target size={20} className="text-brand-500" />, color: 'bg-brand-50 dark:bg-brand-900/20' },
          { label: translations.topics, value: Object.keys(progressMap).length, icon: <BookOpen size={20} className="text-purple-500" />, color: 'bg-purple-50 dark:bg-purple-900/20' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className={`${color} rounded-3xl p-6 border border-transparent`}>
            <div className="mb-3">{icon}</div>
            <div className="text-3xl font-black text-gray-900 dark:text-white">{value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-1">{label}</div>
          </div>
        ))}
      </div>

      {!hasAnyProgress ? (
        <div className="text-center py-20 space-y-4">
          <TrendingUp size={64} className="text-gray-200 dark:text-gray-700 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-500 dark:text-gray-400">{translations.readyToLearn}</h2>
          <p className="text-gray-400">{translations.exploreLibrary}</p>
        </div>
      ) : (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Radar */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-700 shadow-sm">
              <h2 className="text-lg font-black text-gray-900 dark:text-white mb-6">{translations.subjectsList[Subject.MATH].replace('Mathematics', translations.subjects)}</h2>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fontWeight: 700, fill: '#6b7280' }} />
                  <Radar
                    name="Mastery"
                    dataKey="mastery"
                    stroke="#0ea5e9"
                    fill="#0ea5e9"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Bar chart */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-700 shadow-sm">
              <h2 className="text-lg font-black text-gray-900 dark:text-white mb-6">{translations.mastery} %</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} barSize={32}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val: number) => [`${val}%`, translations.mastery]}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', fontSize: 13, fontWeight: 700 }}
                  />
                  <Bar dataKey="mastery" radius={[8, 8, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={SUBJECT_COLORS[entry.subject]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weak / Strong areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Weak areas */}
            {weakTopics.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">{translations.weakAreas}</h2>
                  <span className="text-xs text-red-400 font-bold uppercase tracking-widest">{translations.reviewWeakness}</span>
                </div>
                <ul className="space-y-4">
                  {weakTopics.map(topic => (
                    <li key={topic.topicId} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate">{topic.topicTitle}</span>
                          <span className="text-xs font-black text-red-500">{topic.mastery}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${topic.mastery}%` }}></div>
                        </div>
                      </div>
                      <button
                        onClick={() => onStartPractice(topic.subject, topic.topicId, topic.topicTitle)}
                        className="p-2 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-xl hover:bg-brand-100 transition-colors flex-shrink-0"
                        title={translations.practiceMore}
                      >
                        <RotateCcw size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Strong areas */}
            {strongTopics.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-700 shadow-sm">
                <h2 className="text-lg font-black text-gray-900 dark:text-white mb-6">{translations.strongAreas}</h2>
                <ul className="space-y-4">
                  {strongTopics.map(topic => (
                    <li key={topic.topicId} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate">{topic.topicTitle}</span>
                          <span className="text-xs font-black text-green-500">{topic.mastery}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${topic.mastery}%` }}></div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Subject detail table */}
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 dark:text-white mb-6">{translations.subjects}</h2>
            <div className="space-y-4">
              {subjectMastery.map(({ subject, mastery, attempted, total }) => {
                const subjectData = SUBJECTS_DATA.find(s => s.id === subject);
                return (
                  <div key={subject} className="flex items-center gap-6">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${subjectData?.color || 'bg-gray-50'}`}>
                      <span className="text-xs font-black">{translations.subjectsList[subject].charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1.5">
                        <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">{translations.subjectsList[subject]}</span>
                        <span className="text-xs text-gray-400 font-bold">{attempted}/{total} {translations.topics}</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${mastery}%`, backgroundColor: SUBJECT_COLORS[subject] }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-lg font-black text-gray-700 dark:text-gray-300 w-14 text-end">{mastery}%</span>
                    <button
                      onClick={() => onStartPractice(subject, null, translations.subjectsList[subject])}
                      className="px-4 py-2 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-xl font-bold text-sm hover:bg-brand-100 transition-colors"
                    >
                      {translations.startPractice}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProgressDashboard;
