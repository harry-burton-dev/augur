import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, pollEvery, type UpgradesApi } from './api.js';
import type { AppInstalls, PlatformUpdates, UnitRecord } from './model/types.js';
import { AUGUR } from './units.js';

export interface UpgradesData {
  updates?: PlatformUpdates;
  installs?: AppInstalls;
  /** Each unit's desired-state record, by unit id; absent until the registry has them. */
  records: Record<string, UnitRecord | undefined>;
  /** Why the last read failed, in words. Earlier data stays on screen. */
  error?: string;
  loading: boolean;
  readAt?: Date;
}

const record = async (api: UpgradesApi, id: string): Promise<UnitRecord | undefined> => {
  try {
    return await api.unit(id);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return undefined;
    throw e;
  }
};

/**
 * Everything the Upgrade Centre shows, read from the registry and read again on a
 * timer: every 2 s while a job runs, every 30 s otherwise. A job keeps going on the
 * server whatever this page does, so a reload or another admin sees the same.
 */
export const useUpgrades = (api: UpgradesApi) => {
  const [data, setData] = useState<UpgradesData>({ records: {}, loading: true });
  const alive = useRef(true);

  const read = useCallback(async () => {
    try {
      const [updates, installs] = await Promise.all([api.updates(), api.installs().catch(() => undefined)]);
      const ids = [AUGUR, ...(installs?.installed.map((a) => a.app) ?? [])];
      const records = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await record(api, id).catch(() => undefined)] as const)));
      if (alive.current) setData({ updates, installs, records, loading: false, readAt: new Date() });
    } catch (e) {
      if (alive.current) setData((d) => ({ ...d, loading: false, error: e instanceof Error ? e.message : String(e) }));
    }
  }, [api]);

  const running = Boolean(
    (data.updates?.upgrade && ['requested', 'running'].includes(data.updates.upgrade.state)) ||
      data.installs?.installed.some((a) => a.job && ['requested', 'running'].includes(a.job.state)),
  );

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

  const checkNow = useCallback(async () => {
    const updates = await api.checkNow();
    if (alive.current) setData((d) => ({ ...d, updates, error: undefined, readAt: new Date() }));
  }, [api]);

  return { data, running, reload: read, checkNow };
};
