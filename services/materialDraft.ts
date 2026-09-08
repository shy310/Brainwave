import type { Language } from '../types';

export interface MaterialDraft {
  kind: 'topic' | 'text' | 'transcript';
  title: string;
  body: string;
  language?: Language;
}
const key = (ownerId: string) => `brainwave-material-draft-v1:${ownerId}`;

export function loadMaterialDraft(ownerId: string): MaterialDraft | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key(ownerId)) ?? 'null');
    if (!draft || !['topic', 'text', 'transcript'].includes(draft.kind) ||
      typeof draft.title !== 'string' || draft.title.length > 160 ||
      typeof draft.body !== 'string' || draft.body.length > 60000) return null;
    return {kind: draft.kind, title: draft.title, body: draft.body,
      ...(['en', 'he', 'ar', 'ru'].includes(draft.language) ? {language: draft.language} : {})};
  } catch { return null; }
}

export function saveMaterialDraft(ownerId: string, draft: MaterialDraft): boolean {
  try {
    if (!draft.title && !draft.body) sessionStorage.removeItem(key(ownerId));
    else sessionStorage.setItem(key(ownerId), JSON.stringify(draft));
    return true;
  } catch { return false; }
}

export function clearMaterialDraft(ownerId: string): boolean {
  return saveMaterialDraft(ownerId, {kind: 'topic', title: '', body: ''});
}
