import { defineApp, type AppContext, type RemoteNode } from '@augur/mfe-sdk/sdk3';
import { activityPage, entryPage, FIRST_FILTERS, queryFor, ready } from './activity.js';
import { adminApi, ApiError, fullName } from './api.js';
import { appPage, appsPage, DEPLOYMENT_APP } from './apps.js';
import { departmentPage, departmentsPage } from './departments.js';
import { organisationPage } from './organisation.js';
import { DEPLOYMENT_ADMIN, personPage, peoplePage } from './people.js';
import { rolePage, rolesPage } from './roles.js';
import { routeFor, sectionOf, type Route, type Section } from './routes.js';
import type { ReadKey, Reads, Slot, Ui, View } from './view.js';
import { words } from './view.js';

/** Each section's heading, as its place in the manifest names it. */
const TITLES: Record<Section, string> = { people: 'People', departments: 'Departments', roles: 'Roles', organisation: 'Organisation', apps: 'Apps', activity: 'Activity' };

/** The pane's heading for a route: the section, or the person, department or app the page is about. */
const titleOf = (v: View): string => {
  const r = v.route;
  if (r.page === 'person') {
    const p = v.r.people.value?.find((x) => x.id === r.id);
    return p ? fullName(p) : TITLES.people;
  }
  if (r.page === 'department') return v.r.departments.value?.find((x) => x.id === r.id)?.name ?? TITLES.departments;
  if (r.page === 'role') return v.r.role(r.id).value?.role.name ?? TITLES.roles;
  if (r.page === 'role-new') return 'New role';
  if (r.page === 'app') return v.r.apps.value?.find((x) => x.id === r.id)?.name ?? TITLES.apps;
  if (r.page === 'person-new') return 'Add a person';
  if (r.page === 'department-new') return 'New department';
  return TITLES[sectionOf(r)];
};

/** The screen for a view. */
export const screen = (v: View): RemoteNode => {
  const r = v.route;
  switch (r.page) {
    case 'people':
      return peoplePage(v);
    case 'person-new':
      return peoplePage(v, true);
    case 'person':
      return personPage(v, r.id, r.ask);
    case 'departments':
      return departmentsPage(v);
    case 'department-new':
      return departmentsPage(v, true);
    case 'department':
      return departmentPage(v, r.id);
    case 'roles':
      return rolesPage(v);
    case 'role-new':
      return rolesPage(v, true);
    case 'role':
      return rolePage(v, r.id, r.takeBack);
    case 'organisation':
      return organisationPage(v, r.ask);
    case 'apps':
      return appsPage(v);
    case 'app':
      return appPage(v, r.id);
    case 'activity':
      return activityPage(v);
    case 'entry':
      return entryPage(v, r.id);
  }
};

/** The pages that are a list to look through, as wide as the pane; the rest are read at reading width. */
const WIDE = new Set<Route['page']>(['people', 'person-new', 'departments', 'department-new', 'roles', 'role-new', 'apps', 'activity']);

/**
 * Admin: people, departments, the organisation's settings, apps and activity, so nobody needs the sign-in
 * service's own console or the command line. It runs in the shell's worker (contract 3) and reaches identity,
 * the registry and events only through the gateway, which lets each call through for Admin's platform scopes
 * (ADR 0083); each service still checks the person is an admin and records the change in Activity. Each
 * person, department, app and entry has a page of its own, and every simple setting is changed where it's shown.
 */
export default defineApp((ctx: AppContext) => {
  const api = adminApi((path, init) => ctx.fetch(path, init));
  let path = ctx.path || '/';
  const ui: Ui = { dialog: {}, draft: {}, activity: { filters: FIRST_FILTERS } };
  let stopped = false;
  let keep = false;

  // Each read is asked for once, the first time a page needs it, and redrawn when it comes back.
  const slots = new Map<string, Slot<unknown>>();
  const slot = <T>(key: string, load: () => Promise<T>): Slot<T> => {
    let s = slots.get(key) as Slot<T> | undefined;
    if (s) return s;
    s = {};
    slots.set(key, s);
    load().then(
      (value) => {
        if (slots.get(key) !== s) return;
        s!.value = value;
        draw();
      },
      (e: unknown) => {
        if (slots.get(key) !== s) return;
        s!.error = words(e);
        draw();
      },
    );
    return s;
  };
  const LOADS: { [K in ReadKey]: () => Promise<NonNullable<Reads[K]['value']>> } = {
    people: api.people,
    departments: api.departments,
    roles: api.roles,
    // Who asked to leave is a hint for the leaver flow, and whether invites can be emailed; People works without either.
    leaving: () => api.leaveRequests().catch(() => []),
    lifecycle: () => api.lifecycle().catch(() => ({ email: false })),
    levels: api.levels,
    organisation: api.organisation,
    // Without the lists the values in force are still offered.
    zones: () => api.timeZones().catch(() => []),
    languages: () => api.signInLanguages().catch(() => []),
    apps: api.apps,
    floor: api.org,
    // The org's roles, then each department's: a department whose roles can't be read is left out, not the whole list.
    madeRoles: async () => {
      const [org, departments] = await Promise.all([api.madeRoles('org:this'), api.departments()]);
      const floors = await Promise.all(departments.map((d) => api.madeRoles(`floor:${d.id}`).catch(() => [])));
      return [...org, ...floors.flat()];
    },
  };
  const reads: Reads = {
    get people() { return slot('people', LOADS.people); },
    get departments() { return slot('departments', LOADS.departments); },
    get roles() { return slot('roles', LOADS.roles); },
    get leaving() { return slot('leaving', LOADS.leaving); },
    get lifecycle() { return slot('lifecycle', LOADS.lifecycle); },
    get levels() { return slot('levels', LOADS.levels); },
    get organisation() { return slot('organisation', LOADS.organisation); },
    get zones() { return slot('zones', LOADS.zones); },
    get languages() { return slot('languages', LOADS.languages); },
    get apps() { return slot('apps', LOADS.apps); },
    get floor() { return slot('floor', LOADS.floor); },
    get madeRoles() { return slot('madeRoles', LOADS.madeRoles); },
    role: (id) => slot(`role:${id}`, () => api.madeRole(id)),
    floors: (app) => slot(`floors:${app}`, () => api.appFloors(app)),
    settings: (app) => slot(`settings:${app}`, () => api.appSettings(app)),
    previews: (app) => slot(`previews:${app}`, () => api.featurePreviews(app)),
  };

  const view = (): View => {
    const people = reads.people.value;
    return {
      route: routeFor(path),
      me: ctx.person.id,
      deploymentAdmin: Boolean(people?.find((p) => p.id === ctx.person.id)?.roles.includes(DEPLOYMENT_ADMIN)),
      r: reads,
      ui,
      api,
      on,
    };
  };

  /** What each page needs besides what it reads as it draws: the leaver flow's hints, the lists Organisation offers. */
  const prefetch = (r: Route) => {
    const s = sectionOf(r);
    if (s === 'people') void [reads.roles, reads.leaving, reads.lifecycle];
    if (s === 'departments') void [reads.levels, reads.people];
    if (s === 'roles') void [reads.people, reads.departments, reads.floor];
    if (s === 'organisation') void [reads.people, reads.zones, reads.languages];
    if (s === 'apps' && r.page === 'app') void [reads.floor, reads.departments];
    if (s === 'activity') void [reads.people, reads.departments, reads.apps, reads.floor];
    if (r.page === 'activity' && !ui.activity.entries && !ui.activity.loading && !ui.activity.error) on.audit();
  };

  const draw = () => {
    if (stopped) return;
    const v = view();
    ctx.frame.set({ title: titleOf(v), layout: 'focus', width: WIDE.has(v.route.page) ? 'wide' : 'read' });
    ctx.frame.screen.render(screen(v));
  };

  const moveTo = (to: string) => {
    const was = routeFor(path);
    path = to;
    const now = routeFor(to);
    ui.dialog = {};
    ui.problem = undefined;
    // What a question did is said on the page it comes back to; any other move clears it.
    if (!keep) ui.done = undefined;
    keep = false;
    // What's typed on a person's or a role's page stays while a question on that page opens and closes.
    const samePage = (was.page === 'person' && now.page === 'person' && was.id === now.id) || (was.page === 'role' && now.page === 'role' && was.id === now.id);
    if (!samePage) ui.draft = {};
    if (now.page !== 'person' && now.page !== 'people') ui.shown = undefined;
    prefetch(now);
    draw();
  };
  const go = (to: string) => {
    ctx.navigate(to);
    moveTo(to);
  };

  /** Puts a read back, or forgets it so the next draw reads it again. */
  const put = (key: string, value: unknown) => {
    slots.set(key, { value });
  };

  let asked = 0;
  const on: View['on'] = {
    go,
    draw,
    act: (where, change) => {
      ui.problem = undefined;
      ui.done = undefined;
      draw();
      change().then(draw, (e: unknown) => {
        if (e instanceof ApiError && e.code === 'sign_in_again') return ctx.signInAgain();
        ui.problem = { where, words: words(e) };
        draw();
      });
    },
    answer: (back, change) => {
      ui.dialog = { busy: true };
      draw();
      change().then(
        () => {
          keep = true;
          go(typeof back === 'string' ? back : back());
        },
        (e: unknown) => {
          // Signing in again comes back to this path, with the question open.
          if (e instanceof ApiError && e.code === 'sign_in_again') return ctx.signInAgain();
          ui.dialog = { error: words(e) };
          draw();
        },
      );
    },
    put: (key, value) => put(key, value),
    again: (key) => void slots.delete(key),
    putApp: (kind, app, value) => put(`${kind}:${app}`, value),
    audit: (older = false) => {
      const a = ui.activity;
      if (!ready(a.filters)) return draw();
      const last = older ? a.entries?.at(-1)?.id : undefined;
      if (older && !last) return;
      const mine = ++asked;
      if (older) a.older = true;
      else Object.assign(a, { loading: true, error: undefined, exportError: undefined });
      draw();
      api.audit(queryFor(a.filters, last)).then(
        (page) => {
          if (mine !== asked) return;
          ui.activity = { ...a, entries: older ? [...(a.entries ?? []), ...page] : page, more: page.length === queryFor(a.filters).limit, loading: false, older: false };
          draw();
        },
        (e: unknown) => {
          if (mine !== asked) return;
          ui.activity = { ...a, loading: false, older: false, error: words(e) };
          draw();
        },
      );
    },
    exportAudit: () => {
      const a = ui.activity;
      const { before: _b, limit: _l, ...query } = queryFor(a.filters);
      a.exporting = true;
      a.exportError = undefined;
      draw();
      ctx.files.download(api.exportPath(query), { save: true }).then(
        () => {
          a.exporting = false;
          draw();
        },
        (e: unknown) => {
          a.exporting = false;
          a.exportError = `The export didn’t work: ${words(e)}`;
          draw();
        },
      );
    },
    open: async (app) => {
      try {
        await ctx.raise({ type: DEPLOYMENT_APP, payload: app ? { app } : {} });
      } catch (e) {
        ui.problem = { where: 'deployment', words: `Deployment couldn’t be opened: ${words(e)}` };
        draw();
      }
    },
  };

  // The logo, chosen with Organisation's file button: only a PNG goes, and identity says why when it can't be one.
  const stopDrops = ctx.files.onDrop(async (files) => {
    const file = files[0];
    if (!file || routeFor(path).page !== 'organisation') return;
    if (file.type && file.type !== 'image/png') {
      ui.problem = { where: 'logo', words: 'That isn’t a PNG. Save the logo as a PNG and try again.' };
      return draw();
    }
    on.act('logo', async () => {
      const logo = await api.setLogo(file);
      const now = reads.organisation.value;
      if (now) put('organisation', { ...now, logo });
    });
  });

  const stopNavigating = ctx.onNavigate(moveTo);
  prefetch(routeFor(path));
  draw();
  return () => {
    stopped = true;
    stopNavigating();
    stopDrops();
  };
});
