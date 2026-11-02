import { useCallback, useEffect, useRef, useState } from 'react';
import { useAiError } from '@/lib/useAiError';

/** Run an AI call with loading/error state; cancels on unmount or re-run. */
export const useAiTask = <T,>() => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const toMessage = useAiError();

  useEffect(() => () => abort.current?.abort(), []);

  const run = useCallback(async (fn: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    setError('');
    try {
      const result = await fn(ctrl.signal);
      if (!ctrl.signal.aborted) setData(result);
      return result;
    } catch (err) {
      if (!ctrl.signal.aborted) setError(toMessage(err));
      return null;
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [toMessage]);

  const reset = useCallback(() => { abort.current?.abort(); setData(null); setError(''); setLoading(false); }, []);

  return { data, loading, error, run, reset, setData };
};
