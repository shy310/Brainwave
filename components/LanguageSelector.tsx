
import React from 'react';
import { Language } from '../types';
import { Globe } from 'lucide-react';

interface Props {
  currentLang: Language;
  onChange: (lang: Language) => void;
  disabled?: boolean;
}

const LanguageSelector: React.FC<Props> = ({ currentLang, onChange, disabled }) => {
  return (
    <div className={`flex items-center gap-2 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`} title={disabled ? 'Cannot change language during a lesson or exercise' : undefined}>
      <Globe className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      <select
        value={currentLang}
        onChange={(e) => onChange(e.target.value as Language)}
        disabled={disabled}
        className="bg-transparent border-none text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-0 disabled:cursor-not-allowed"
      >
        <option value="en" className="bg-white dark:bg-gray-800">English</option>
        <option value="ru" className="bg-white dark:bg-gray-800">Русский</option>
        <option value="he" className="bg-white dark:bg-gray-800">עברית</option>
        <option value="ar" className="bg-white dark:bg-gray-800">العربية</option>
      </select>
    </div>
  );
};

export default LanguageSelector;
