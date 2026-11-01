import type { MountContext } from '@augur/mfe-sdk';
import { isRefusal, type Refusal } from './model/roles.js';
import type { AppInstalls, PlatformUpdates, UnitRecord } from './model/types.js';

/** A call the platform turned down, with the refusal when it explained itself. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly refusal?: Refusal,
  ) {
    super(message);
  }
}

const REGISTRY = '/api/registry/v1';

/**
 * The Upgrade Centre's calls, all to the registry through the gateway with `ctx.fetch`.
 * Upgrades and settings never call the updater directly: the registry queues the work
 * and the updater picks it up, so a job keeps going when the page closes.
 */
export const upgradesApi = (ctx: Pick<MountContext, 'fetch'>) => {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    let res: Response;
    try {
      res = await ctx.fetch(`${REGISTRY}${path}`, {
        method,
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('AUGUR can’t be reached. Check your connection; nothing was changed.', 0);
    }
    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const refusal = isRefusal(data) ? data : undefined;
      const message = (data as { message?: string }).message ?? `That didn’t work (${res.status}). Nothing was changed.`;
      throw new ApiError(message, res.status, refusal);
    }
    return data as T;
  };
  const unit = (id: string) => `/platform/units/${encodeURIComponent(id)}`;
  return {
    updates: () => call<PlatformUpdates>('GET', '/platform/updates'),
    checkNow: () => call<PlatformUpdates>('POST', '/platform/updates/check'),
    upgrade: (version: string, settings: Record<string, string> = {}) =>
      call<PlatformUpdates>('PUT', '/platform/upgrade', Object.keys(settings).length ? { version, settings } : { version }),
    goBack: (version: string) => call<PlatformUpdates>('PUT', '/platform/go-back', { version }),
    cancel: () => call<PlatformUpdates>('DELETE', '/platform/upgrade'),
    installs: () => call<AppInstalls>('GET', '/app-runner/apps'),
    checkApps: () => call<AppInstalls>('POST', '/app-runner/check'),
    install: (app: string, version: string) => call('POST', '/app-runner/jobs', { action: 'install', app, version }),
    remove: (app: string) => call('POST', '/app-runner/jobs', { action: 'remove', app }),
    /** The desired-state record (ADR 0020). Until the registry has it, the call answers 404 and the model shows offers as available. */
    unit: (id: string) => call<UnitRecord>('GET', unit(id)),
    setUnit: (id: string, record: Partial<UnitRecord>) => call<UnitRecord>('PUT', unit(id), record),
  };
};

export type UpgradesApi = ReturnType<typeof upgradesApi>;

/** How often to ask again: every 2 s while something runs, every 30 s otherwise. */
export const pollEvery = (running: boolean): number => (running ? 2_000 : 30_000);
