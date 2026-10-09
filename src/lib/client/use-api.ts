'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';

export interface ApiState<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (fn: T | ((cur: T | undefined) => T | undefined)) => void;
}

/** Load JSON from a GET route. `url = null` pauses loading. Keeps old data while reloading. */
export function useApi<T>(url: string | null, opts: { headers?: Record<string, string> } = {}): ApiState<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(url));
  const seq = useRef(0);
  const headersKey = JSON.stringify(opts.headers ?? {});

  const reload = useCallback(async () => {
    if (!url) return;
    const my = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>(url, { headers: JSON.parse(headersKey) });
      if (my === seq.current) {
        setDataState(d);
        setError(null);
      }
    } catch (e) {
      if (my === seq.current) setError(e instanceof ApiError ? e : new ApiError(0, 'NETWORK', 'Something went wrong.'));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [url, headersKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setData = useCallback((fn: T | ((cur: T | undefined) => T | undefined)) => {
    setDataState((cur) => (typeof fn === 'function' ? (fn as (c: T | undefined) => T | undefined)(cur) : fn));
  }, []);

  return { data, error, loading, reload, setData };
}
