import { defineApp, type AppContext, type RemoteNode } from '@augur/mfe-sdk/sdk3';
import { ApiError, upgradesApi } from '../api.js';
import { reasonProblem } from '../model/halted.js';
import type { DesiredState, PlatformUpdates } from '../model/types.js';
import { AUGUR } from '../units.js';
import { reader, type Data } from './data.js';
import { quill } from './quill.js';
import { pathOf, PLACES, routeFor, type Route } from './routes.js';
import { draftOf, settingsPage, type Draft, type SettingsData, type SettingsView } from './settings.js';
import { appPage, augurPage } from './unit.js';
import { appsPage, HISTORY_STEP, overviewPage, rowsOf, staleNotice, type Actions, type Ui } from './view.js';

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
    case 'settings':
      return 'Settings';
    case 'app':
      return data.overview?.units.find((u) => u.unit === route.app)?.name ?? data.installs?.installed.find((a) => a.app === route.app)?.name ?? route.app;
  }
};

/** The screen for a view: what's loading or failed, else the route's page. */
export const screen = (v: SettingsView): RemoteNode => {
  if (v.data.loading && !v.data.overview) return quill('quill-state', { kind: 'loading', heading: 'Reading what this deployment runs', size: 'page' });
  if (!v.data.overview || !v.data.updates)
    return quill('quill-state', { kind: 'error', heading: 'The registry isn’t answering', body: `${v.data.error ?? ''} Nothing can be shown or changed here until it does. Check it with \`pc logs registry\`.`.trim(), size: 'page' });
  const page =
    v.route.page === 'overview'
      ? overviewPage(v)
      : v.route.page === 'augur'
        ? augurPage(v, v.route.ask)
        : v.route.page === 'apps'
          ? appsPage(v)
          : v.route.page === 'settings'
            ? settingsPage(v, v.route.edit)
            : appPage(v, v.route.app, v.route.install);
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
  // The Settings page's own reads, its draft and how saving and exporting went.
  let settings: SettingsData = { missing: [] };
  let settingsRead = false;
  let draft: { unit: string; draft: Draft } | undefined;
  let saving: SettingsView['saving'];
  let saved: string | undefined;
  let exporting: SettingsView['exporting'];

  const view = (): SettingsView => ({
    route: routeFor(path),
    data: data.data,
    ui,
    on,
    now: new Date(),
    zone: data.data.overview?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    may: data.data.overview?.you?.deploymentAdmin ?? false,
    nameOf: (id, given) => given ?? (id === ctx.person.id ? ctx.person.name : id),
    settings,
    ...(draftFor() ? { draft: draftFor() } : {}),
    saving,
    saved,
    exporting,
    act,
  });

  /** The draft for the unit the address edits, started from its saved settings the first time. */
  const draftFor = (): Draft | undefined => {
    const r = routeFor(path);
    if (r.page !== 'settings' || !r.edit) return undefined;
    if (draft?.unit === r.edit) return draft.draft;
    const unit = data.data.overview?.units.find((u) => u.unit === r.edit);
    if (!unit) return undefined;
    draft = { unit: r.edit, draft: draftOf(unit) };
    return draft.draft;
  };

  /** Reads each unit's settings history and the reporting view, once the Settings page opens and the units are known. */
  const readSettings = async () => {
    const o = data.data.overview;
    if (settingsRead || !o || routeFor(path).page !== 'settings') return;
    settingsRead = true;
    const missing: string[] = [];
    const [history, report] = await Promise.all([
      Promise.all(o.units.map((u) => api.desiredHistory(u.unit).then((h) => [u.unit, h] as const, () => (missing.push(u.unit), [u.unit, [] as DesiredState[]] as const)))),
      o.reporting ? api.reporting().then((r) => ({ r }), (e: unknown) => ({ e: words(e) })) : Promise.resolve(undefined),
    ]);
    settings = { history: Object.fromEntries(history), missing, ...(report && 'r' in report ? { reporting: report.r } : {}), ...(report && 'e' in report ? { reportingError: report.e } : {}) };
    draw();
  };

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

  const data = reader(api, () => {
    draw();
    void readSettings();
  });

  const moveTo = (to: string) => {
    const was = routeFor(path);
    path = to;
    ui.dialog = {};
    ui.problem = undefined;
    const now = routeFor(to);
    if (now.page !== 'settings' || now.edit !== (was.page === 'settings' ? was.edit : undefined)) {
      draft = undefined;
      saving = undefined;
    }
    if (now.page !== 'settings') {
      saved = undefined;
      exporting = undefined;
      settingsRead = false;
    }
    draw();
    void readSettings();
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

  const act: SettingsView['act'] = {
    edit: (next) => {
      if (draft) draft = { ...draft, draft: next };
      draw();
    },
    save: (unit, next) => {
      saving = { busy: true };
      draw();
      const { pin, ...rest } = next;
      api.setDesired(unit, pin ? { ...rest, pin } : rest).then(
        (overview) => {
          data.took({ overview });
          go(pathOf({ page: 'settings' }));
          saved = unit;
          settingsRead = false;
          void readSettings();
          draw();
        },
        (e: unknown) => {
          if (e instanceof ApiError && e.code === 'sign_in_again') return ctx.signInAgain();
          saving = { error: words(e) };
          draw();
        },
      );
    },
    exportRecord: () => {
      exporting = { busy: true };
      draw();
      ctx.files.download('/api/registry/v1/platform/reporting/export', { save: true }).then(
        () => {
          exporting = undefined;
          draw();
        },
        (e: unknown) => {
          exporting = { error: `The export didn’t work: ${words(e)}` };
          draw();
        },
      );
    },
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
