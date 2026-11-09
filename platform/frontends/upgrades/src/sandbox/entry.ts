import { defineApp, type AppContext, type RemoteNode } from '@augur/mfe-sdk/sdk3';
import { ApiError, upgradesApi } from '../api.js';
import { reasonProblem } from '../model/halted.js';
import type { PlatformUpdates } from '../model/types.js';
import { AUGUR } from '../units.js';
import { reader, type Data } from './data.js';
import { quill } from './quill.js';
import { pathOf, PLACES, routeFor, type Route } from './routes.js';
import { appPage, augurPage } from './unit.js';
import { appsPage, HISTORY_STEP, overviewPage, rowsOf, staleNotice, type Actions, type Ui, type View } from './view.js';

/** The commands and places Deployment handles: each is declared in its manifest, which the shell draws from. */
export const COMMANDS = { check: 'deployment.check' } as const;
export const PLACE_APPS = 'apps';

const words = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The pane's heading for a route. */
const titleOf = (route: Route, data: Data): string => {
  switch (route.page) {
    case 'overview':
      return 'Overview';
    case 'augur':
      return 'AUGUR';
    case 'apps':
      return 'Apps';
    case 'app':
      return data.overview?.units.find((u) => u.unit === route.app)?.name ?? data.installs?.installed.find((a) => a.app === route.app)?.name ?? route.app;
  }
};

/** The screen for a view: what's loading or failed, else the route's page. */
export const screen = (v: View): RemoteNode => {
  if (v.data.loading && !v.data.overview) return quill('quill-state', { kind: 'loading', heading: 'Reading what this deployment runs', size: 'page' });
  if (!v.data.overview || !v.data.updates)
    return quill('quill-state', { kind: 'error', heading: 'The registry isn’t answering', body: `${v.data.error ?? ''} Nothing can be shown or changed here until it does. Check it with \`pc logs registry\`.`.trim(), size: 'page' });
  const page =
    v.route.page === 'overview' ? overviewPage(v) : v.route.page === 'augur' ? augurPage(v, v.route.ask) : v.route.page === 'apps' ? appsPage(v) : appPage(v, v.route.app, v.route.install);
  return [staleNotice(v), page];
};

/**
 * Deployment (the platform app at `/upgrades`, ADR 0030): what this deployment runs, what's available,
 * and upgrading, rolling back and installing, for AUGUR and each app. It runs in the shell's worker
 * (contract 3) and reaches only the registry, through the gateway. A change the registry asks the
 * password again for has a path of its own, so signing in again comes back to the same question.
 */
export default defineApp((ctx: AppContext) => {
  const api = upgradesApi(ctx);
  let path = ctx.path || PLACES.overview;
  const ui: Ui = { shown: {}, dialog: {} };
  let under = '';

  const view = (): View => ({
    route: routeFor(path),
    data: data.data,
    ui,
    on,
    now: new Date(),
    zone: data.data.overview?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    may: data.data.overview?.you?.deploymentAdmin ?? false,
    nameOf: (id, given) => given ?? (id === ctx.person.id ? ctx.person.name : id),
  });

  const draw = () => {
    const v = view();
    ctx.frame.set({ title: titleOf(v.route, v.data), busy: v.data.loading && Boolean(v.data.overview), width: 'wide', actions: [{ command: COMMANDS.check, ...(v.data.overview?.feed === 'off' ? { unavailable: 'The release feed is off on this deployment (RELEASE_FEED_URL=off).' } : {}) }] });
    ctx.frame.screen.render(screen(v));
    // Each installed app sits under Apps in the rail.
    const items = rowsOf(v)
      .filter((r) => r.id !== AUGUR)
      .map((r) => ({ label: r.name, icon: 'blocks', detail: r.state === 'up-to-date' ? r.running : `${r.running} · ${r.offered ?? ''}`.replace(/ · $/, ''), path: pathOf({ page: 'app', app: r.id }) }));
    const key = JSON.stringify(items);
    if (key !== under) {
      under = key;
      ctx.frame.under(PLACE_APPS, items);
    }
  };

  const data = reader(api, draw);

  const moveTo = (to: string) => {
    path = to;
    ui.dialog = {};
    ui.problem = undefined;
    draw();
  };
  const go = (to: string) => {
    ctx.navigate(to);
    moveTo(to);
  };

  /** Runs a change from an open question: busy while it works; done, it closes; turned down, it says why, or asks the password again. */
  const answer = async (back: string, change: () => Promise<PlatformUpdates | void>) => {
    ui.dialog = { busy: true };
    draw();
    try {
      const updates = await change();
      if (updates) data.took({ updates });
      go(back);
      void data.again();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'sign_in_again') {
        ctx.signInAgain();
        return;
      }
      ui.dialog = { error: words(e) };
      draw();
    }
  };

  /** Runs a change pressed on a page, saying why where it was pressed if it doesn't work. */
  const press = async (where: NonNullable<Ui['problem']>['where'], change: () => Promise<unknown>) => {
    ui.problem = undefined;
    try {
      await change();
      void data.again();
    } catch (e) {
      ui.problem = { where, words: words(e) };
      draw();
    }
  };

  const augur = pathOf({ page: 'augur' });
  const on: Actions = {
    go,
    checkNow: () => {
      ui.checking = true;
      draw();
      void press('check', async () => data.took({ updates: await api.checkNow() })).finally(() => {
        ui.checking = false;
        draw();
      });
    },
    markSeen: (kind, id) => void press('seen', async () => data.took({ overview: await api.markSeen(kind, id) })),
    cancel: () => void press('cancel', async () => data.took({ updates: await api.cancel() })),
    more: (unit) => {
      ui.shown[unit] = (ui.shown[unit] ?? HISTORY_STEP) + HISTORY_STEP;
      draw();
    },
    upgrade: (version, settings) => {
      const given = Object.fromEntries(Object.entries(settings).map(([k, val]) => [k, val.trim()]).filter(([, val]) => val));
      void answer(augur, () => api.upgrade(version, given));
    },
    rollBack: (version) => void answer(augur, () => api.goBack(version)),
    test: (version, reason) => {
      const problem = reasonProblem(reason);
      if (problem) {
        ui.dialog = { error: problem };
        draw();
        return;
      }
      void answer(augur, () => api.installHalted(version, reason.trim()));
    },
    install: (app, version) => void answer(pathOf({ page: 'app', app }), async () => void (await api.install(app, version))),
    closeDialog: (back) => go(back),
  };

  ctx.frame.onCommand(COMMANDS.check, () => on.checkNow());
  const stopNavigating = ctx.onNavigate(moveTo);
  draw();
  void data.start();
  return () => {
    stopNavigating();
    data.stop();
  };
});
