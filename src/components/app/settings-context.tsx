'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from '@/lib/client/toast';
import { api, ApiError } from '@/lib/client/api';
import { emit } from '@/lib/client/events';
import { browserTimeZone } from '@/lib/time';
import type { Settings } from '@/lib/types';

interface Ctx {
  settings: Settings | null;
  tz: string;
  error: ApiError | null;
  reload: () => Promise<void>;
  /** Save on change; reverts and shows the error toast if the save fails. */
  update: (patch: Partial<Settings> & { example_notice_dismissed?: true }) => Promise<boolean>;
}

const SettingsCtx = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const confirmedOnce = useRef(false);

  const reload = useCallback(async () => {
    try {
      const s = await api<Settings>('/api/settings');
      setSettings(s);
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const update = useCallback(
    async (patch: Partial<Settings> & { example_notice_dismissed?: true }) => {
      const prev = settings;
      if (prev) {
        const { example_notice_dismissed, ...rest } = patch;
        setSettings({
          ...prev,
          ...rest,
          ...(example_notice_dismissed ? { example_notice_dismissed_at: new Date().toISOString() } : {}),
        });
      }
      try {
        const s = await api<Settings>('/api/settings', { method: 'PATCH', body: patch });
        setSettings(s);
        emit('settings-changed');
        return true;
      } catch (e) {
        if (prev) setSettings(prev);
        if (!(e instanceof ApiError && e.status === 401)) toast.error("Couldn't save that change. Try again.");
        return false;
      }
    },
    [settings],
  );

  // F1 step 8: apply the browser's zone once, on the first signed-in load.
  useEffect(() => {
    if (!settings || settings.time_zone_confirmed || confirmedOnce.current) return;
    confirmedOnce.current = true;
    const zone = browserTimeZone();
    void (async () => {
      try {
        const s = await api<Settings>('/api/settings', { method: 'PATCH', body: { time_zone: zone, time_zone_confirmed: true } });
        setSettings(s);
        emit('settings-changed');
        toast.success(`Using your time zone: ${s.time_zone}. Change it in Settings.`);
      } catch {
        /* the mismatch notice and Settings still let the owner pick */
      }
    })();
  }, [settings]);

  return (
    <SettingsCtx.Provider value={{ settings, tz: settings?.time_zone ?? 'America/New_York', error, reload, update }}>
      {children}
    </SettingsCtx.Provider>
  );
}

export function useSettings(): Ctx {
  const c = useContext(SettingsCtx);
  if (!c) throw new Error('SettingsProvider missing');
  return c;
}
