
import React, { useState, useRef } from 'react';
import { Attachment, Subject, GradeLevel, Translations } from '../types';
import { UploadCloud, FileText, CheckCircle, Brain, ArrowRight, X, ChevronLeft, Trash2 } from 'lucide-react';

interface Props {
  translations: Translations;
  userGrade: GradeLevel;
  onBack: () => void;
  onStartQuiz: (subject: Subject, attachments: Attachment[]) => void;
  onContextUpdate: (ctx: string) => void;
}

const StudyMaterials: React.FC<Props> = ({ translations, userGrade, onBack, onStartQuiz, onContextUpdate }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList | File[]) => {
    const newAttachments: Attachment[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Limit to PDF and Images as per requirement
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        continue; 
      }

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Extract base64 data part
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.readAsDataURL(file);
      });

      newAttachments.push({
        name: file.name,
        mimeType: file.type,
        data: base64
      });
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
    }
  };

  const handleStart = () => {
    if (selectedSubject && attachments.length > 0) {
      onContextUpdate(`Studying custom materials for ${selectedSubject}. Files: ${attachments.map(a => a.name).join(', ')}`);
      onStartQuiz(selectedSubject, attachments);
    }
  };

  const removeAttachment = (index: number) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-y-auto scrollbar-hide view-enter">
      <div className="max-w-[1200px] mx-auto w-full p-8 md:p-16 space-y-12">
        
        {/* Header */}
        <header className="space-y-4">
            <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-brand-600 font-bold transition-all mb-4">
                <ChevronLeft size={20} className="rtl:rotate-180" />
                {translations.backToDashboard}
            </button>
            <h1 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tight">
                {translations.uploadMaterial}
            </h1>
            <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl font-medium">
                {translations.uploadDesc}
            </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Left Column: Upload Zone */}
            <div className="lg:col-span-7 space-y-8">
                <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`bg-white dark:bg-zinc-900 rounded-[2.5rem] border-4 border-dashed p-12 flex flex-col items-center text-center space-y-6 transition-all group relative cursor-pointer ${
                        isDragging 
                        ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/20' 
                        : 'border-zinc-100 dark:border-zinc-800 hover:border-brand-300 dark:hover:border-brand-900'
                    }`}
                >
                    <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center transition-transform group-hover:scale-110 ${
                        isDragging ? 'bg-brand-600 text-white' : 'bg-brand-50 dark:bg-brand-900/20 text-brand-600'
                    }`}>
                        <UploadCloud size={48} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">{translations.dropFiles}</h3>
                        <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">{translations.fileTypeHint}</p>
                    </div>
                    
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileInputChange}
                        className="hidden" 
                        accept="image/*,application/pdf" 
                        multiple 
                    />
                    
                    <button
                        type="button"
                        className="px-8 py-3 btn-brand text-sm"
                    >
                        {translations.upload}
                    </button>
                </div>

                {/* File List */}
                {attachments.length > 0 && (
                    <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                        <h4 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] px-2">{translations.uploadedDocs} ({attachments.length})</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {attachments.map((file, idx) => (
                                <div key={idx} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-between group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-brand-600">
                                            <FileText size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">{file.name}</div>
                                            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{file.mimeType.split('/')[1]}</div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); removeAttachment(idx); }} 
                                        className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column: Subject & Start */}
            <div className="lg:col-span-5 space-y-8">
                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 border border-zinc-100 dark:border-zinc-800 shadow-xl space-y-8">
                    <div className="space-y-2">
                        <h3 className="text-xl font-black text-zinc-900 dark:text-white">{translations.selectSubject}</h3>
                        <p className="text-sm text-zinc-500">{translations.domainChoiceDesc}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {Object.values(Subject).map((s) => (
                            <button 
                                key={s}
                                onClick={() => setSelectedSubject(s)}
                                className={`p-4 rounded-2xl border-2 text-sm font-black transition-all text-center ${selectedSubject === s ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400' : 'border-zinc-50 dark:border-zinc-800 text-zinc-400 hover:border-brand-100 dark:hover:border-brand-900'}`}
                            >
                                {translations.subjectsList[s]}
                            </button>
                        ))}
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={handleStart}
                            disabled={!selectedSubject || attachments.length === 0}
                            className="w-full py-5 btn-brand text-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            <Brain size={24} />
                            {translations.generateQuiz}
                            <ArrowRight size={22} className="rtl:rotate-180" />
                        </button>
                        <p className="text-center text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-4">
                            {translations.genQuizDesc}
                        </p>
                    </div>
                </div>

                {/* Info Card */}
                <div className="bg-brand-600 rounded-[2rem] p-8 text-white space-y-4 shadow-xl shadow-brand-500/20">
                    <div className="flex items-center gap-3">
                        <CheckCircle size={24} />
                        <h4 className="font-black">{translations.howItWorks}</h4>
                    </div>
                    <ul className="space-y-2 text-sm font-medium opacity-90 list-disc list-inside leading-relaxed">
                        {translations.howItWorksSteps.map((step: string, i: number) => (
                            <li key={i}>{step}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default StudyMaterials;
