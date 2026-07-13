import React, { useState } from 'react';
import { SolutionStep, GradeLevel, Translations } from '../types';
import { generateSolutionSteps } from '../services/aiService';
import { ListOrdered, ChevronDown, HelpCircle, CheckCircle, Lightbulb } from 'lucide-react';
import MathText from './MathText';

interface Props {
  problem: string;
  grade: GradeLevel;
  language: string;
  translations: Translations;
  context?: string;
}

/**
 * Progressive worked-solution reveal. Steps are fetched on demand and shown one
 * at a time ("Next step"); each step names the rule, renders KaTeX, and can
 * expand its "why". Before revealing a step the student can ask for a hint.
 */
const StepReveal: React.FC<Props> = ({ problem, grade, language, translations, context }) => {
  const [steps, setSteps] = useState<SolutionStep[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(0);          // how many steps are revealed
  const [hintFor, setHintFor] = useState(-1);     // index whose hint is peeked
  const [whyOpen, setWhyOpen] = useState<Record<number, boolean>>({});

  const start = async () => {
    setLoading(true);
    const s = await generateSolutionSteps(problem, grade, language, context);
    setSteps(s);
    setShown(s.length ? 1 : 0);
    setLoading(false);
  };

  if (!steps && !loading) {
    return (
      <button
        onClick={start}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-moss-50 dark:bg-moss-light/20 text-moss-700 dark:text-moss-300 font-semibold text-sm hover:bg-moss-100 dark:hover:bg-moss-light/30 transition-colors min-h-[44px]"
      >
        <ListOrdered size={16} /> {translations.stepByStep}
      </button>
    );
  }

  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-3 text-sm text-ink-400">
        <div className="w-4 h-4 border-2 border-moss-400 border-t-transparent rounded-full animate-spin" />
        {translations.loadingSteps}
      </div>
    );
  }

  if (!steps || steps.length === 0) return null;
  const allShown = shown >= steps.length;

  return (
    <div className="mt-4 space-y-3">
      {steps.slice(0, shown).map((step, i) => (
        <div key={i} className="rounded-2xl border border-ink-100 dark:border-ink-700 bg-white dark:bg-ink-800 p-4 animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-lg bg-moss-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
            {step.rule && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-moss-50 dark:bg-moss-light/20 text-moss-700 dark:text-moss-300">{step.rule}</span>}
          </div>
          <div className="text-sm text-ink-700 dark:text-ink-100 leading-relaxed"><MathText>{step.statement}</MathText></div>
          {step.detail && (
            <>
              <button
                onClick={() => setWhyOpen(w => ({ ...w, [i]: !w[i] }))}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
              >
                <ChevronDown size={13} className={`transition-transform ${whyOpen[i] ? 'rotate-180' : ''}`} />
                {whyOpen[i] ? translations.hideWhy : translations.showWhy}
              </button>
              {whyOpen[i] && (
                <div className="mt-2 text-xs text-ink-500 dark:text-ink-300 leading-relaxed bg-cream-50 dark:bg-ink-900/40 rounded-xl p-3 animate-slide-up">
                  <MathText>{step.detail}</MathText>
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {/* Peeked hint for the next, still-hidden step */}
      {!allShown && hintFor === shown && steps[shown]?.hint && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 text-sm text-amber-800 dark:text-amber-200 animate-slide-up">
          <Lightbulb size={15} className="shrink-0 mt-0.5 text-amber-500" />
          <MathText>{steps[shown].hint}</MathText>
        </div>
      )}

      {allShown ? (
        <div className="flex items-center gap-2 text-sm font-semibold text-moss-600 dark:text-moss-400 pt-1">
          <CheckCircle size={16} /> {translations.stepsComplete}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setShown(s => s + 1); setHintFor(-1); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-moss-500 hover:bg-moss-600 text-white font-semibold text-sm transition-colors min-h-[44px]"
          >
            {translations.nextStep} <ChevronDown size={15} />
          </button>
          {steps[shown]?.hint && hintFor !== shown && (
            <button
              onClick={() => setHintFor(shown)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/15 text-amber-700 dark:text-amber-300 font-semibold text-sm hover:bg-amber-100 dark:hover:bg-amber-900/25 transition-colors min-h-[44px]"
            >
              <HelpCircle size={15} /> {translations.revealHint}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default StepReveal;
