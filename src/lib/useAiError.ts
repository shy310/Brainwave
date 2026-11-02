import { useCallback } from 'react';
import { useT } from '@/i18n';
import { ApiError } from './api';

/** Turn an AI call failure into a friendly message in the student's language. */
export const useAiError = () => {
  const t = useT();
  return useCallback((err: unknown): string => {
    if (err instanceof DOMException && err.name === 'AbortError') return '';
    if (err instanceof TypeError) return t.errors.offline;
    if (err instanceof ApiError) {
      if (err.status === 429) return t.errors.rateLimit;
      if (err.status === 401) return t.errors.signedOut;
      if (err.status === 503) return t.errors.unavailable;
      if (err.status === 402) return t.errors.credits;
      return `${t.errors.ai} (${err.code ?? err.status})`;
    }
    return t.errors.ai;
  }, [t]);
};
