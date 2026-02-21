
import React, { useState } from 'react';
import { Sparkles, Image, Video, ArrowRight, Loader2, Wand2, Globe } from 'lucide-react';
import { GradeLevel, Translations } from '../types';

interface ToolCardProps {
    icon: React.ElementType;
    title: string;
    description: string;
    launchLabel: string;
    onClick: () => void;
}

const ToolCard: React.FC<ToolCardProps> = ({ icon: Icon, title, description, launchLabel, onClick }) => (
    <button
        onClick={onClick}
        className="flex flex-col items-start p-8 bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-start group"
    >
        <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/20 text-brand-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Icon size={32} />
        </div>
        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-8 flex-1">{description}</p>
        <div className="mt-auto flex items-center gap-2 text-brand-600 font-bold text-sm">
            {launchLabel}
            <ArrowRight size={16} />
        </div>
    </button>
);

interface Props {
    translations: Translations;
    userGrade: GradeLevel;
    language: string;
}

const AITools: React.FC<Props> = ({ translations, userGrade, language }) => {
    const [activeTool, setActiveTool] = useState<string | null>(null);

    return (
        <div className="p-8 md:p-12 lg:p-16 max-w-7xl mx-auto space-y-12">
            {!activeTool ? (
                <>
                    <header className="space-y-4 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-xs font-black uppercase tracking-widest">
                            <Sparkles size={14} fill="currentColor" />
                            {translations.aiTools}
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight">{translations.toolsHeader}</h1>
                        <p className="text-xl text-gray-500 dark:text-gray-400 leading-relaxed font-medium">{translations.toolsDesc}</p>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-8">
                        <ToolCard
                            icon={Image}
                            title={translations.imageGen}
                            description={translations.imageGenDesc}
                            launchLabel={translations.launchTool}
                            onClick={() => setActiveTool('image-gen')}
                        />
                        <ToolCard
                            icon={Wand2}
                            title={translations.imageEdit}
                            description={translations.imageEditDesc}
                            launchLabel={translations.launchTool}
                            onClick={() => setActiveTool('image-edit')}
                        />
                        <ToolCard
                            icon={Video}
                            title={translations.videoAnalysis}
                            description={translations.videoAnalysisDesc}
                            launchLabel={translations.launchTool}
                            onClick={() => setActiveTool('video')}
                        />
                        <ToolCard
                            icon={Globe}
                            title={translations.searchGrounding}
                            description={translations.searchGroundingDesc}
                            launchLabel={translations.launchTool}
                            onClick={() => setActiveTool('search')}
                        />
                    </div>
                </>
            ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <button
                        onClick={() => setActiveTool(null)}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white font-bold transition-colors"
                    >
                        <ArrowRight size={18} className="rotate-180" />
                        {translations.backToLab}
                    </button>

                    <div className="bg-white dark:bg-gray-800 p-12 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-xl flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
                        <div className="w-20 h-20 bg-brand-50 dark:bg-brand-900/20 text-brand-600 rounded-3xl flex items-center justify-center animate-pulse">
                            <Loader2 size={40} className="animate-spin" />
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white">{translations.connectingToAI}</h2>
                        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                            {translations.grades[userGrade]}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AITools;
