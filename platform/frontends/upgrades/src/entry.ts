import { defineApp, type AppContext, type RemoteNode } from '@augur/mfe-sdk/sdk3';
import { ApiError, upgradesApi } from './api.js';
import { reasonProblem } from './model/halted.js';
import type { DesiredState, PlatformUpdates } from './model/types.js';
import { AUGUR } from './units.js';
import { reader, type Data } from './data.js';
import { channelPage } from './channel.js';
import { backupsPage, healthPage } from './health.js';
import { quill } from './quill.js';
import { pathOf, PLACES, routeFor, type Route } from './routes.js';
import { draftOf, settingsPage, type Draft, type SettingsData, type SettingsView } from './settings.js';
import { givenFrom } from './install.js';
import { settingChange } from './model/app-settings.js';
import { appPage, augurPage } from './unit-page.js';
import { appsPage, overviewPage, rowsOf, staleNotice, type Actions, type Ui } from './view.js';

/** The commands and places Deployment handles: each is declared in its manifest, which the shell draws from. */
export const COMMANDS = { check: 'deployment.check' } as const;
export const PLACE_APPS = 'apps';

/** The pages that show the settings history: Settings itself, and Release channel's channel changes. */
const HISTORY_PAGES = new Set<Route['page']>(['settings', 'channel']);

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
    case 'health':
      return 'Health';
    case 'backups':
      return 'Backups';
    case 'channel':
      return 'Release channel';
    case 'settings':
      return 'Settings';
    case 'app':
      if (route.install && !data.installs?.installed.some((a) => a.app === route.app)) return 'Apps';
      return data.overview?.units.find((u) => u.unit === route.app)?.name ?? data.installs?.installed.find((a) => a.app === route.app)?.name ?? route.app;
  }
};

/** The screen for a view: what's loading or failed, else the route's page. */
export const screen = (v: SettingsView): RemoteNode => {
  if (v.data.loading && !v.data.overview) return quill('quill-state', { kind: 'loading', heading: 'Reading what this deployment runs', size: 'page' });
  if (!v.data.overview || !v.data.updates)
    return quill('quill-state', { kind: 'error', heading: 'The registry isn’t answering', body: `${v.data.error ?? ''} Nothing can be shown or changed here until it does. Check it with \`pc logs registry\`.`.trim(), size: 'page' });
  const r = v.route;
  const page =
    r.page === 'overview'
      ? overviewPage(v)
      : r.page === 'augur'
        ? augurPage(v, r.ask)
        : r.page === 'apps'
          ? appsPage(v)
          : r.page === 'health'
            ? healthPage(v)
            : r.page === 'backups'
              ? backupsPage(v)
              : r.page === 'channel'
                ? channelPage(v)
                : r.page === 'settings'
                  ? settingsPage(v, r.edit)
                  : // An app that isn't installed yet is installed over Apps.
                    r.install && !v.data.installs?.installed.some((a) => a.app === r.app) && !v.data.overview.units.some((u) => u.unit === r.app)
                    ? appsPage(v)
                    : appPage(v, r.app, r.install, r.ask);
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
  const ui: Ui = { dialog: {} };
  let under = '';
  // The Settings page's own reads, its draft and how saving and exporting went.
  let settings: SettingsData = { missing: [] };
  let settingsRead = false;
  let draft: { unit: string; draft: Draft } | undefined;
  let saving: SettingsView['saving'];
  let saved: string | undefined;
  let exporting: SettingsView['exporting'];
  let quick: SettingsView['quick'];

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
    quick,
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

  /** Reads each unit's settings history and the reporting view, once Settings or Release channel opens and the units are known. */
  const readSettings = async () => {
    const o = data.data.overview;
    if (settingsRead || !o || !HISTORY_PAGES.has(routeFor(path).page)) return;
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
      .map((r) => ({ label: r.name, icon: 'apps', detail: r.state === 'up-to-date' ? r.running : `${r.running} · ${r.offered ?? ''}`.replace(/ · $/, ''), path: pathOf({ page: 'app', app: r.id }) }));
    const key = JSON.stringify(items);
    if (key !== under) {
      under = key;
      ctx.frame.under(PLACE_APPS, items);
    }
  };

  /** Reads the sites apps may load from, once Apps opens. */
  let originsRead = false;
  const readOrigins = () => {
    if (originsRead || routeFor(path).page !== 'apps') return;
    originsRead = true;
    ui.origins = {};
    api.origins().then(
      (list) => {
        ui.origins = { ...ui.origins, list };
        draw();
      },
      (e: unknown) => {
        ui.origins = { ...ui.origins, error: `The sites apps may load from couldn’t be read: ${words(e)}` };
        draw();
      },
    );
  };
  /** Names the developers of the app the page shows, once, from the directory. */
  const naming = new Set<string>();
  const readNames = () => {
    const r = routeFor(path);
    if (r.page !== 'app') return;
    const ids = (data.data.installs?.installed.find((a) => a.app === r.app)?.developers ?? []).filter((id) => !ui.names?.[id] && !naming.has(id));
    if (!ids.length) return;
    ids.forEach((id) => naming.add(id));
    api.people({ ids }).then(
      (people) => {
        ui.names = { ...ui.names, ...Object.fromEntries(people.map((p) => [p.id, p.name])) };
        draw();
      },
      // Unnamed, a developer shows by id; nothing else depends on it.
      () => undefined,
    );
  };
  const reads = () => {
    void readSettings();
    readOrigins();
    readNames();
  };

  const data = reader(api, () => {
    draw();
    reads();
  });

  const moveTo = (to: string) => {
    const was = routeFor(path);
    path = to;
    ui.dialog = {};
    ui.problem = undefined;
    quick = undefined;
    const now = routeFor(to);
    if (now.page !== 'apps' || now.address === undefined) ui.pasted = undefined;
    if (now.page !== 'settings' || now.edit !== (was.page === 'settings' ? was.edit : undefined)) {
      draft = undefined;
      saving = undefined;
    }
    if (now.page !== 'settings') {
      saved = undefined;
      exporting = undefined;
    }
    if (!HISTORY_PAGES.has(now.page)) settingsRead = false;
    if (now.page !== 'apps') originsRead = false;
    if (now.page !== 'app' || now.ask?.kind !== 'new-sign-in') ui.issued = undefined;
    ui.found = undefined;
    draw();
    reads();
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
    install: (app, version, fill = [], values = {}) => {
      const given = givenFrom(fill, values);
      if ('problem' in given) {
        ui.dialog = { error: given.problem };
        draw();
        return;
      }
      const installed = data.data.installs?.installed.some((a) => a.app === app);
      void answer(installed ? pathOf({ page: 'app', app }) : pathOf({ page: 'apps' }), async () => void (await api.install(app, version, given.given)));
    },
    checkApps: () => {
      ui.checkingApps = true;
      draw();
      void press('apps', async () => data.took({ installs: await api.checkApps() })).finally(() => {
        ui.checkingApps = false;
        draw();
      });
    },
    readAddress: (url) => {
      if (!/^https:\/\//.test(url)) {
        ui.dialog = { error: 'Give the release file’s https address.' };
        draw();
        return;
      }
      ui.dialog = { busy: true };
      draw();
      api.readRelease(url).then(
        (read) => {
          if (read.refusals.length) {
            ui.dialog = { error: `It can’t install here: ${read.refusals.join(' ')}` };
          } else {
            ui.pasted = { url, read };
            ui.dialog = {};
          }
          // The address is in the path, so signing in again comes back to it.
          const to = pathOf({ page: 'apps', address: url });
          if (to !== path) {
            ctx.navigate(to);
            path = to;
          }
          draw();
        },
        (e: unknown) => {
          if (e instanceof ApiError && e.code === 'sign_in_again') {
            const to = pathOf({ page: 'apps', address: url });
            ctx.navigate(to);
            path = to;
            ui.dialog = {};
            draw();
            ctx.signInAgain();
            return;
          }
          ui.dialog = { error: words(e) };
          draw();
        },
      );
    },
    installPasted: (fill, values) => {
      const pasted = ui.pasted;
      if (!pasted) return;
      const given = givenFrom(fill, values);
      if ('problem' in given) {
        ui.dialog = { error: given.problem };
        draw();
        return;
      }
      void answer(pathOf({ page: 'apps' }), async () => {
        await api.installRelease(pasted.read.release, given.given);
        ui.pasted = undefined;
      });
    },
    closeDialog: (back) => go(back),
    removeApp: (app) => void answer(pathOf({ page: 'apps' }), async () => void (await api.remove(app))),
    setInternet: (app, allowed) => void answer(pathOf({ page: 'app', app }), async () => void data.took({ installs: await api.setInternet(app, allowed) })),
    issueSignIn: (app) => {
      ui.dialog = { busy: true };
      draw();
      api.issueSignIn(app).then(
        (issued) => {
          ui.issued = { app, ...issued };
          ui.dialog = {};
          draw();
        },
        (e: unknown) => {
          if (e instanceof ApiError && e.code === 'sign_in_again') return ctx.signInAgain();
          ui.dialog = { error: words(e) };
          draw();
        },
      );
    },
    saveSetting: (app, id, raw) => {
      const installed = data.data.installs?.installed.find((a) => a.app === app);
      const setting = installed?.settings?.find((x) => x.id === id);
      const change = setting && settingChange(setting, raw);
      if (!installed || !setting || !change) return;
      if ('problem' in change) {
        ui.problem = { where: 'server', words: change.problem };
        draw();
        return;
      }
      ui.problem = undefined;
      api.setSetting(app, id, change.value).then(
        (installs) => {
          data.took({ installs });
        },
        (e: unknown) => {
          // Signing in again comes back to this page; a secret is typed again there.
          if (e instanceof ApiError && e.code === 'sign_in_again') return ctx.signInAgain();
          ui.problem = { where: 'server', words: `${setting.label} wasn’t changed: ${words(e)}` };
          draw();
        },
      );
    },
    findPeople: (query) => {
      ui.found = { query };
      draw();
      api.people({ q: query }).then(
        (items) => {
          if (ui.found?.query !== query) return;
          ui.found = { query, items };
          ui.names = { ...ui.names, ...Object.fromEntries(items.map((p) => [p.id, p.name])) };
          draw();
        },
        (e: unknown) => {
          if (ui.found?.query !== query) return;
          ui.found = { query, error: words(e) };
          draw();
        },
      );
    },
    setDevelopers: (app, people) => {
      ui.names = { ...ui.names, ...Object.fromEntries(people.map((p) => [p.id, p.name])) };
      ui.problem = undefined;
      api.setDevelopers(
        app,
        people.map((p) => p.id),
      ).then(
        (installs) => data.took({ installs }),
        (e: unknown) => {
          ui.problem = { where: 'server', words: `The developers weren’t changed: ${words(e)}` };
          draw();
        },
      );
    },
    allowOrigin: (origin) => {
      ui.origins = { ...ui.origins, busy: true, typed: origin, problem: undefined };
      draw();
      api.allowOrigin(origin).then(
        (added) => {
          ui.origins = { list: [...(ui.origins?.list ?? []).filter((o) => o.origin !== added.origin), added], typed: '' };
          // An app registered from it before is offered again.
          void data.again();
          draw();
        },
        (e: unknown) => {
          ui.origins = { ...ui.origins, busy: false, problem: words(e) };
          draw();
        },
      );
    },
    askRemoveOrigin: (origin) => {
      ui.origins = { ...ui.origins, removing: origin, problem: undefined };
      draw();
    },
    removeOrigin: (origin) => {
      ui.origins = { ...ui.origins, busy: true, problem: undefined };
      draw();
      api.removeOrigin(origin).then(
        () => {
          ui.origins = { list: (ui.origins?.list ?? []).filter((o) => o.origin !== origin) };
          draw();
        },
        (e: unknown) => {
          ui.origins = { ...ui.origins, busy: false, removing: undefined, problem: `${origin} wasn’t removed: ${words(e)}` };
          draw();
        },
      );
    },
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
    quick: (unit, patch) => {
      quick = { unit: unit.unit, busy: true };
      saved = undefined;
      draw();
      const { pin, ...rest } = { ...draftOf(unit), ...patch };
      api.setDesired(unit.unit, pin ? { ...rest, pin } : rest).then(
        (overview) => {
          quick = undefined;
          saved = unit.unit;
          data.took({ overview });
          settingsRead = false;
          void readSettings();
        },
        (e: unknown) => {
          // Signing in again comes back to this page; the choice is made again there.
          if (e instanceof ApiError && e.code === 'sign_in_again') return ctx.signInAgain();
          quick = { unit: unit.unit, error: `${unit.name} wasn’t changed: ${words(e)}` };
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
  readOrigins();
  void data.start();
  return () => {
    stopNavigating();
    data.stop();
  };
});
