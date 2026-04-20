/**
 * useResource — thin generic hook for async data fetching.
 * Eliminates the repeated useState/useEffect/try-catch/setLoading boilerplate
 * that appears across every CRUD page.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useResource(() => api.get('/api/templates'), []);
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useResource<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep a stable ref to the fetcher so refetch() doesn't need it in its dep array
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-run whenever deps change (mirrors the useCallback([...deps]) pattern)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, [...deps, run]);

  return { data, loading, error, refetch: run };
}
