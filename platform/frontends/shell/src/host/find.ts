import type { AppManifestEntry, SearchResult } from '@augur/mfe-sdk';
import type { ShellFindGroup, ShellFindResult } from '@augur/shell-kit';
import { APP_HEADER, isWorkerApp } from './apps3.js';

/** How long Find waits for any one app before saying it didn't answer in time. */
export const SEARCH_BUDGET_MS = 1500;
/** At most this many results from one app. */
export const RESULTS_PER_APP = 10;
/** Shorter queries don't go to apps: one letter matches everything and helps no one. */
export const MIN_QUERY = 2;

/** Where a result from an app opens: the app, the path in it, and the floor it's on. */
export interface FoundIn {
  app: AppManifestEntry;
  path?: string;
  workspace?: string;
}

export interface FindUpdate {
  results: ShellFindResult[];
  groups: ShellFindGroup[];
}

/** One app's answer, as far as the shell can trust it: well-formed results only, at most ten. */
export const readAnswer = (body: unknown): SearchResult[] => {
  const results = (body as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter(
      (r): r is SearchResult =>
        !!r && typeof r === 'object' && typeof r.id === 'string' && typeof r.title === 'string' && !!r.title && (r.path === undefined || (typeof r.path === 'string' && r.path.startsWith('/'))),
    )
    .slice(0, RESULTS_PER_APP);
};

/**
 * Find over apps' own content. Every app the person can open on this floor
 * that declares `search` is asked at once, through the gateway on the current
 * floor; each answer fills its app's group as it arrives, so a slow app never
 * holds up the others, and one that takes longer than the budget is let go.
 * A new query cancels whatever the last one was still waiting for.
 */
export class AppSearch {
  private controller?: AbortController;
  private readonly found = new Map<string, FoundIn>();

  constructor(
    /** `fetch` on the gateway for the current floor: the person's token and `X-Workspace-Id` added. */
    private readonly fetchOnFloor: (path: string, init?: RequestInit) => Promise<Response>,
    private readonly opts: { budgetMs?: number; floorName?: (id: string) => string | undefined } = {},
  ) {}

  /** Where a result Find showed opens; undefined for one that isn't from an app's content. */
  foundIn(id: string): FoundIn | undefined {
    return this.found.get(id);
  }

  stop() {
    this.controller?.abort();
    this.controller = undefined;
  }

  /**
   * Asks every app that searches. `onUpdate` is called at once with each
   * group looking, then again as each app answers, fails or runs out of time.
   * Resolves when every app has.
   */
  async run(apps: AppManifestEntry[], q: string, here: string, onUpdate: (update: FindUpdate) => void): Promise<void> {
    this.stop();
    this.found.clear();
    const searching = apps.filter((a) => a.search);
    const query = q.trim();
    if (query.length < MIN_QUERY || !searching.length) return onUpdate({ results: [], groups: [] });
    const controller = (this.controller = new AbortController());
    const groups = new Map<string, ShellFindGroup>(searching.map((a) => [a.id, { name: a.name, state: 'looking' }]));
    const results = new Map<string, ShellFindResult[]>();
    const report = () => {
      if (controller.signal.aborted) return;
      onUpdate({ results: searching.flatMap((a) => results.get(a.id) ?? []), groups: searching.map((a) => groups.get(a.id)!) });
    };
    report();
    await Promise.all(
      searching.map(async (app) => {
        const ask = new AbortController();
        const giveUp = () => ask.abort();
        controller.signal.addEventListener('abort', giveUp);
        let late = false;
        const timer = setTimeout(() => {
          late = true;
          ask.abort();
        }, this.opts.budgetMs ?? SEARCH_BUDGET_MS);
        let state: ShellFindGroup['state'] = 'done';
        try {
          // An app on the contract is asked as itself: the gateway checks the call against its grants (spec 8.5).
          const headers: Record<string, string> = { accept: 'application/json', ...(isWorkerApp(app) ? { [APP_HEADER]: app.id } : {}) };
          const res = await this.fetchOnFloor(`/api/${app.id}/v1/search?q=${encodeURIComponent(query)}`, { signal: ask.signal, headers });
          if (!res.ok) throw new Error(String(res.status));
          results.set(app.id, this.toShell(app, readAnswer(await res.json()), here));
        } catch {
          state = late ? 'late' : 'failed';
        } finally {
          clearTimeout(timer);
          controller.signal.removeEventListener('abort', giveUp);
        }
        groups.set(app.id, { name: app.name, state });
        report();
      }),
    );
  }

  /** Results on the floor asked from (or on none) first, then the rest, each tagged with its floor. */
  private toShell(app: AppManifestEntry, found: SearchResult[], here: string): ShellFindResult[] {
    const ordered = [...found.filter((r) => !r.workspace || r.workspace === here), ...found.filter((r) => r.workspace && r.workspace !== here)];
    return ordered.map((r) => {
      const id = `${app.id}:${r.id}`;
      this.found.set(id, { app, path: r.path, workspace: r.workspace && r.workspace !== here ? r.workspace : undefined });
      const elsewhere = r.workspace && r.workspace !== here ? this.opts.floorName?.(r.workspace) : undefined;
      return { id, title: r.title, detail: [elsewhere && `On ${elsewhere}`, r.detail].filter(Boolean).join(' · ') || app.name, kind: 'content', group: app.name };
    });
  }
}
