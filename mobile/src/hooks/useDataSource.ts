/**
 * useDataSource — fetches and caches data from a backend data source.
 *
 * Cache-first: returns cached data immediately, then refreshes in background.
 * Polls every 30s. Cleans up on unmount.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import type { SDUIDataBinding } from '@/types/sdui';

const POLL_INTERVAL_MS = 30_000;

interface DataSourceResult {
  data: Record<string, any>[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const NOOP_RESULT: DataSourceResult = {
  data: null,
  loading: false,
  error: null,
  refresh: () => {},
};

// Module-level cache keyed by dataSourceId + serialized query
const dataSourceCache = new Map<string, Record<string, any>[]>();

function cacheKey(binding: SDUIDataBinding): string {
  const queryPart = binding.query ? JSON.stringify(binding.query) : '';
  return `${binding.dataSourceId}:${queryPart}`;
}

export function useDataSource(binding?: SDUIDataBinding): DataSourceResult {
  const { token, serverUrl } = useAuthStore();
  const [data, setData] = useState<Record<string, any>[] | null>(() => {
    if (!binding) return null;
    return dataSourceCache.get(cacheKey(binding)) ?? null;
  });
  const [loading, setLoading] = useState(!!binding);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(() => {
    if (!binding || !token || !serverUrl) return;

    const key = cacheKey(binding);
    const url = `${serverUrl}/api/data-sources/${encodeURIComponent(binding.dataSourceId)}/query`;

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(binding.query ?? {}),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Data source fetch failed: ${res.status}`);
        return res.json();
      })
      .then((result) => {
        if (!mountedRef.current) return;
        const rows = result.data ?? [];
        dataSourceCache.set(key, rows);
        setData(rows);
        setError(null);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!mountedRef.current) return;
        setError(err.message);
        setLoading(false);
      });
  }, [binding?.dataSourceId, binding?.query, token, serverUrl]);

  useEffect(() => {
    mountedRef.current = true;
    if (!binding) return;

    // Return cached immediately if available
    const key = cacheKey(binding);
    const cached = dataSourceCache.get(key);
    if (cached) {
      setData(cached);
      setLoading(false);
    }

    // Fetch fresh in background
    fetchData();

    // Poll
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [binding?.dataSourceId, fetchData]);

  if (!binding) return NOOP_RESULT;

  return { data, loading, error, refresh: fetchData };
}

/** Clear the data source cache for a specific id, or all if no id provided. */
export function clearDataSourceCache(dataSourceId?: string): void {
  if (dataSourceId) {
    for (const key of dataSourceCache.keys()) {
      if (key.startsWith(`${dataSourceId}:`)) {
        dataSourceCache.delete(key);
      }
    }
  } else {
    dataSourceCache.clear();
  }
}
