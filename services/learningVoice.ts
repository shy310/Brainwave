import type { Language } from '../types';

/** Content guidance only: never translate identifiers, source quotations or code. */
export function learningVoice(language: Language) {
  const local = {
    en: 'Use natural, direct English.',
    he: 'Use natural modern Hebrew, not literal English translations. Prefer short neutral/plural instructions. Keep equations and code in their original notation.',
    ar: 'Use clear, natural Modern Standard Arabic. Avoid literal English phrasing and unnecessary formal wording. Keep equations and code in their original notation.',
    ru: 'Use natural conversational Russian. Avoid bureaucratic wording and literal English translations. Keep equations and code in their original notation.',
  }[language];
  return `${local} Keep each prompt focused on one idea. Prefer short sentences, concrete examples and brief steps over long paragraphs. Be warm, not babyish. Avoid forced slang, hype and shame. Keep technical accuracy and necessary detail; offer deeper explanation when requested. Preserve source quotations exactly and explain them in the learning language.`;
}
