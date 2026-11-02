import { useCallback, useEffect, useRef, useState } from 'react';
import { pollEvery, type UpgradesApi } from './api.js';
import type { AppInstalls, Overview, PlatformUpdates } from './model/types.js';

export interface UpgradesData {
  /** Every unit and what needs an admin, from the registry (the source Backstage reads too). */
  overview?: Overview;
  /** AUGUR's releases, go-back targets and history. */
  updates?: PlatformUpdates;
  /** Installed apps' releases and jobs. */
  installs?: AppInstalls;
  /** Why the last read failed, in words. Earlier data stays on screen. */
  error?: string;
  loading: boolean;
  readAt?: Date;
}

/**
 * Everything the Upgrade Centre shows, read from the registry and read again on a
 * timer: every 2 s while a job runs, every 30 s otherwise. A job keeps going on the
 * server whatever this page does, so a reload or another admin sees the same.
 */
export const useUpgrades = (api: UpgradesApi) => {
  const [data, setData] = useState<UpgradesData>({ loading: true });
  const alive = useRef(true);

  const read = useCallback(async () => {
    try {
      const [overview, updates, installs] = await Promise.all([api.overview(), api.updates(), api.installs().catch(() => undefined)]);
      if (alive.current) setData({ overview, updates, installs, loading: false, readAt: new Date() });
    } catch (e) {
      if (alive.current) setData((d) => ({ ...d, loading: false, error: e instanceof Error ? e.message : String(e) }));
    }
  }, [api]);

  const running = Boolean(data.overview?.units.some((u) => u.open));

  useEffect(() => {
    alive.current = true;
    void read();
    return () => {
      alive.current = false;
    };
  }, [read]);

  useEffect(() => {
    const timer = setInterval(() => void read(), pollEvery(running));
    return () => clearInterval(timer);
  }, [read, running]);

  /** Takes the overview a change answered with, so the page shows it at once. */
  const took = useCallback((overview: Overview) => {
    if (alive.current) setData((d) => ({ ...d, overview, error: undefined, readAt: new Date() }));
  }, []);

  const checkNow = useCallback(async () => {
    const updates = await api.checkNow();
    if (alive.current) setData((d) => ({ ...d, updates, error: undefined, readAt: new Date() }));
    void read();
  }, [api, read]);

  return { data, running, reload: read, checkNow, took };
};
