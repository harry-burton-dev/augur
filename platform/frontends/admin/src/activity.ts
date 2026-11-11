import type { RemoteNode } from '@augur/mfe-sdk/sdk3';
import { fullName, type AuditEntry, type AuditQuery, type CatalogueApp, type Department, type Person } from './api.js';
import { floorTree } from './apps-model.js';
import { off } from './common.js';
import { day as shortDay, type SelectOption } from './parts.js';
import { quill } from './quill.js';
import { pathOf } from './routes.js';
import type { Filters, View } from './view.js';

export const PAGE = 50;
const ANYONE = '*';

/** The names Activity writes sentences with, looked up by id. */
export interface Names {
  person(id: string): string;
  department(id: string): string;
  app(id: string): string;
}

export const namesFrom = (people: Person[], departments: Department[], apps: CatalogueApp[]): Names => {
  const p = new Map(people.map((x) => [x.id, fullName(x)]));
  const d = new Map(departments.map((x) => [x.id, x.name]));
  const a = new Map(apps.map((x) => [x.id, x.name]));
  return { person: (id) => p.get(id) ?? id, department: (id) => d.get(id) ?? id, app: (id) => a.get(id) ?? id };
};

/** Where an entry was recorded, in words: the platform's own services by what they look after. */
export const areaName = (app: string, names: Names) => (app === 'identity' ? 'People and departments' : app === 'registry' ? 'App catalogue' : app === 'events' ? 'Activity' : names.app(app));

const changedWords: Record<string, string> = { firstName: 'name', lastName: 'name', email: 'email', roles: 'roles', departments: 'departments', enabled: 'sign-in' };

/** One audit entry as a sentence: "Alex Rivera added Sam Okafor to Finance". */
export const describe = (e: AuditEntry, names: Names): string => {
  const who = e.actor.kind === 'user' ? names.person(e.actor.id) : names.app(e.actor.id);
  const target = e.target ?? '';
  const d = e.detail ?? {};
  switch (e.action) {
    case 'person.added':
      if (d.method === 'federated') return `${names.person(target)} joined through the organisation’s sign-in`;
      return `${who} added ${names.person(target)}`;
    case 'person.updated': {
      const what = [...new Set(Object.keys(d).map((k) => changedWords[k]).filter(Boolean))];
      return `${who} changed ${names.person(target)}’s ${what.length ? what.join(' and ') : 'details'}`;
    }
    case 'person.enabled':
      if (d.outside) return `${names.person(target)}’s sign-in was turned back on in the sign-in service, not in AUGUR`;
      return `${who} turned on ${names.person(target)}’s sign-in`;
    case 'person.disabled':
      if (d.cause === 'idle') return `${names.person(target)}’s sign-in was turned off after ${String(d.days)} days without a sign-in`;
      if (d.outside) return `${names.person(target)}’s sign-in was turned off in the sign-in service, not in AUGUR`;
      return `${who} turned off ${names.person(target)}’s sign-in`;
    case 'person.password-reset':
      return `${who} gave ${names.person(target)} a new password`;
    case 'person.unlocked':
      return `${who} unlocked ${names.person(target)} after repeated wrong passwords`;
    case 'person.leave-scheduled':
      return `${who} set ${names.person(target)} to leave after ${shortDay(`${String(d.lastDay)}T12:00:00`)}${d.handOverTo ? `, handing their work to ${names.person(String(d.handOverTo))}` : ''}`;
    case 'person.leave-cancelled':
      return `${who} cancelled ${names.person(target)}’s leaving`;
    case 'person.left':
      if (d.lastDay) return `${names.person(target)} left after their last day, ${shortDay(`${String(d.lastDay)}T12:00:00`)}${d.handOverTo ? `, handing their work to ${names.person(String(d.handOverTo))}` : ''}`;
      return d.handOverTo ? `${who} marked ${names.person(target)} as a leaver, handing their work to ${names.person(String(d.handOverTo))}` : `${who} marked ${names.person(target)} as a leaver`;
    case 'person.deleted':
      return d.now ? `${who} deleted a leaver’s account; only its id is kept` : 'A leaver’s account was deleted after the organisation’s retention period; only its id is kept';
    case 'sign-in.succeeded':
      return d.method === 'federated' ? `${names.person(target)} signed in through the organisation’s sign-in` : d.method === 'passkey' ? `${names.person(target)} signed in with a passkey` : `${names.person(target)} signed in`;
    case 'sign-in.failed':
      return `Someone failed to sign in as ${names.person(target)}`;
    case 'sign-in.failed-unknown':
      return `${Number(d.count ?? 1) === 1 ? 'Someone' : `${String(d.count)} times, someone`} tried to sign in with a name nobody has`;
    case 'sign-in.locked':
      return `${names.person(target)} was locked out for a while after repeated wrong passwords`;
    case 'sign-in.signed-out':
      return `${names.person(target)} signed out`;
    case 'sign-in.federated-first':
      return `${names.person(target)} signed in through the organisation’s sign-in for the first time`;
    case 'sign-in.linked':
      return `${names.person(target)}’s account was linked to the organisation’s sign-in`;
    case 'account.password-changed':
      return `${names.person(target)} changed their password`;
    case 'account.two-step-added':
      return `${names.person(target)} added a second step to their sign-in`;
    case 'account.two-step-removed':
      return `${names.person(target)} removed a second step from their sign-in`;
    case 'account.email-changed':
      return `${names.person(target)}’s email address changed`;
    case 'account.email-verified':
      return `${names.person(target)} confirmed their email address`;
    case 'audit.exported':
      return `${who} downloaded Activity`;
    case 'audit.pruned':
      return `${String(d.removed)} ${d.removed === 1 ? 'entry' : 'entries'} older than ${String(d.keepDays)} days ${d.removed === 1 ? 'was' : 'were'} removed`;
    case 'audit.redacted':
      return `Personal details of a deleted person were removed from Activity`;
    case 'department.created':
      return `${who} created the ${String(d.name ?? names.department(target))} department`;
    case 'department.renamed':
      return `${who} renamed ${String(d.from)} to ${String(d.to)}`;
    case 'organisation.changed': {
      const to = (d.to ?? {}) as Record<string, unknown>;
      const words: [string, string][] = [
        ['name', 'name'],
        ['timeZone', 'time zone'],
        ['sender', 'email sender'],
        ['idle', 'idle-account days'],
        ['logo', 'logo'],
        ['notice', 'sign-in notice'],
        ['languages', 'languages'],
        ['defaultLanguage', 'default language'],
        ['security', 'security and retention'],
      ];
      const what = words.filter(([k]) => to[k] !== undefined).map(([, w]) => w);
      return to.name !== undefined && what.length === 1
        ? `${who} renamed the organisation to ${String(to.name)}`
        : `${who} changed the organisation’s ${what.length ? what.join(' and ') : 'settings'}`;
    }
    case 'organisation.notice-asked':
      return `${who} asked everyone to accept the sign-in notice again (${String(d.people ?? 0)} people)`;
    case 'department.member-added':
      return `${who} added ${names.person(String(d.person))} to ${names.department(target)}`;
    case 'department.member-removed':
      return `${who} took ${names.person(String(d.person))} out of ${names.department(target)}`;
    case 'app.registered':
      return `${names.app(target)} was registered${d.version ? `, version ${String(d.version)}` : ''}`;
    case 'app.updated':
      return d.heldAt
        ? `${names.app(target)} registered version ${String(d.version)}, kept but not used while it’s held at ${String(d.heldAt)}`
        : `${names.app(target)} was updated${d.version ? ` to version ${String(d.version)}` : ''}`;
    case 'app.pinned':
      return `${who} held ${names.app(target)} at version ${String(d.version)}`;
    case 'app.unpinned':
      return `${who} let ${names.app(target)} follow new versions again, now ${String(d.version)}`;
    case 'app.enabled':
      return `${who} turned ${names.app(target)} on${d.workspace ? ` for ${names.department(String(d.workspace))}` : ''}`;
    case 'app.disabled':
      return `${who} turned ${names.app(target)} off${d.workspace ? ` for ${names.department(String(d.workspace))}` : ''}`;
    case 'app.blocked':
      return `${who} blocked ${names.app(target)} for ${names.department(String(d.workspace))} and every team below it`;
    case 'app.inherited':
      return `${who} let ${names.app(target)} follow the floor above on ${names.department(String(d.workspace))}`;
    case 'app.scopes-granted':
      return d.shipsWithAugur ? `${names.app(target)} may now do what its release asks` : `${who} changed what ${names.app(target)} may do`;
    case 'app.setting-changed': {
      const setting = `“${String(d.label ?? d.setting)}”`;
      return d.value === null
        ? `${who} put ${names.app(target)}’s ${setting} back to its default`
        : `${who} set ${names.app(target)}’s ${setting} to ${String(d.value)}${d.unit ? ` ${String(d.unit)}` : ''}`;
    }
    case 'team-notices.on':
      return `${who} turned on team notices for ${names.department(target)}`;
    case 'team-notices.off':
      return `${who} turned off team notices for ${names.department(target)}`;
    case 'app.removed':
      return `${who} removed ${names.app(target)} from the catalogue`;
    case 'origin.allowed':
      return `${who} let apps load from ${target}`;
    case 'origin.removed':
      return `${who} stopped apps loading from ${target}`;
    case 'platform.upgrade-requested':
      return `${who} asked to upgrade AUGUR from ${String(d.from)} to ${target}`;
    case 'platform.upgrade-cancelled':
      return `${who} cancelled the upgrade to AUGUR ${target}`;
    case 'platform.upgraded':
      return `AUGUR was upgraded from ${String(d.from)} to ${target}`;
    case 'platform.upgrade-rolled-back':
      return `The upgrade to AUGUR ${target} didn’t finish and went back to ${String(d.from)}`;
    case 'platform.upgrade-failed':
      return `The upgrade to AUGUR ${target} stopped partway and needs a person`;
    case 'platform.updates-checked':
      return d.available
        ? `${who} checked for updates: AUGUR ${String(d.available)} is out`
        : d.problem
          ? `${who} checked for updates, but the release feed couldn’t be read`
          : `${who} checked for updates: AUGUR ${target} is the newest`;
    default:
      return `${who}: ${e.action}${target ? ` (${target})` : ''}`;
  }
};

export type Period = Filters['period'];

/** The time range a period covers, ending now; a custom range runs from the start of `from` to the end of `to`. */
export const rangeFor = (period: Period, now: Date, from = '', to = ''): Pick<AuditQuery, 'since' | 'until'> => {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysAgo = (n: number) => new Date(startOfDay(now).getTime() - n * 86_400_000).toISOString();
  switch (period) {
    case 'today':
      return { since: startOfDay(now).toISOString() };
    case 'week':
      return { since: daysAgo(6) };
    case 'month':
      return { since: daysAgo(29) };
    case 'custom': {
      const day = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : undefined);
      const a = day(from);
      const b = day(to);
      return { ...(a ? { since: a.toISOString() } : {}), ...(b ? { until: new Date(b.getTime() + 86_400_000).toISOString() } : {}) };
    }
    default:
      return {};
  }
};

const periods: SelectOption[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'all', label: 'Any time' },
  { value: 'custom', label: 'Between dates' },
];

const kinds: SelectOption[] = [
  { value: 'change', label: 'Changes' },
  { value: 'sign-in', label: 'Sign-ins' },
  { value: ANYONE, label: 'Everything' },
];

/** What Activity's filters start at: this week's changes, by anyone, anywhere. */
export const FIRST_FILTERS: Filters = { kind: 'change', who: ANYONE, area: ANYONE, floor: ANYONE, period: 'week', from: '', to: '' };

/** The audit query for the filters, from the start or before an entry. */
export const queryFor = (f: Filters, before?: string, now = new Date()): AuditQuery => ({
  ...(f.kind === 'change' || f.kind === 'sign-in' ? { kind: f.kind } : {}),
  // A person's sign-ins are about them, so "who" asks for anything by or about them there.
  ...(f.who !== ANYONE ? (f.kind === 'change' ? { actor: f.who } : { person: f.who }) : {}),
  ...(f.area !== ANYONE ? { app: f.area } : {}),
  ...(f.floor !== ANYONE ? { workspace: f.floor } : {}),
  ...rangeFor(f.period, now, f.from, f.to),
  ...(before ? { before } : {}),
  limit: PAGE,
});

/** Whether the filters are ready to ask: between dates waits for one of them. */
export const ready = (f: Filters) => f.period !== 'custom' || Boolean(f.from || f.to);

/** The names Activity writes with, from what's been read; ids stand in until they are. */
const namesOf = (v: View): Names => {
  const org = v.r.floor.value;
  const departments = v.r.departments.value ?? [];
  return namesFrom(v.r.people.value ?? [], org ? [...departments, { id: org.id, name: org.name, members: [] }] : departments, v.r.apps.value ?? []);
};

/** The audit log, readable: who did what, where and when, newest first. Each entry opens its own page. */
export const activityPage = (v: View): RemoteNode => {
  const a = v.ui.activity;
  const f = a.filters;
  const names = namesOf(v);
  const people = v.r.people.value ?? [];
  const apps = v.r.apps.value ?? [];
  const floors = v.r.floor.value && v.r.departments.value ? floorTree(v.r.floor.value, v.r.departments.value) : [];
  const set = (key: keyof Filters) => (value: string) => {
    a.filters = { ...a.filters, [key]: value } as Filters;
    v.on.audit();
  };
  const select = (label: string, key: keyof Filters, options: SelectOption[]) => quill('quill-select', { label, options, value: f[key], onChange: set(key) });
  const rows = (a.entries ?? []).map((e) => ({ id: e.id, at: e.at, what: describe(e, names), area: areaName(e.app, names) }));
  return [
    quill('quill-notice', { tone: 'info' }, 'Every change made through AUGUR, and every sign-in: who, what, where and when. Nothing here can be edited or removed by hand; entries older than the organisation’s retention period go each night.'),
    quill('quill-grid', { label: 'Filters' }, [
      select('Kind', 'kind', kinds),
      select('Who', 'who', [{ value: ANYONE, label: 'Anyone' }, ...people.map((p) => ({ value: p.id, label: fullName(p) })).sort((x, y) => x.label.localeCompare(y.label))]),
      select('Where', 'area', [
        { value: ANYONE, label: 'Anywhere' },
        { value: 'identity', label: 'People and departments' },
        { value: 'registry', label: 'App catalogue' },
        ...apps.filter((x) => !x.platform).map((x) => ({ value: x.id, label: x.name })),
      ]),
      select('Floor', 'floor', [
        { value: ANYONE, label: 'Any floor' },
        ...floors.map((fl) => ({ value: fl.id, label: fl.path.map((id) => floors.find((x) => x.id === id)?.name ?? '').join(' / '), detail: fl.path.length > 1 ? 'and below' : 'everything on a floor' })),
      ]),
      select('When', 'period', periods),
      f.period === 'custom' ? quill('quill-date-field', { label: 'From', value: f.from, quick: [], onChange: set('from') }) : null,
      f.period === 'custom' ? quill('quill-date-field', { label: 'To', value: f.to, quick: [], onChange: set('to') }) : null,
    ]),
    !ready(f)
      ? quill('quill-state', { kind: 'empty', heading: 'Choose a day to start or end at', size: 'region' })
      : quill(
          'quill-table',
          {
            label: 'Activity',
            noun: 'changes',
            columns: [
              { key: 'at', label: 'When', kind: 'date', sortable: true, sortFirst: 'desc' },
              { key: 'what', label: 'What happened', wrap: true },
              { key: 'area', label: 'Where', sortable: true },
            ],
            rows,
            loading: Boolean(a.loading),
            ...(a.error ? { error: a.error } : {}),
            empty: f.kind === 'sign-in' ? 'Nobody signed in in this time.' : 'Nothing was changed in this time.',
            onOpen: (id: string) => v.on.go(pathOf({ page: 'entry', id })),
            onRetry: () => v.on.audit(),
          },
          [
            quill('quill-button', {
              slot: 'actions',
              label: 'Download CSV',
              kind: 'secondary',
              size: 'sm',
              busy: Boolean(a.exporting),
              busyLabel: 'Making the file',
              ...off((a.loading && 'Wait for Activity to load.') || (a.error && 'Activity couldn’t be loaded. Try again first.')),
              onPress: () => v.on.exportAudit(),
            }),
          ],
        ),
    a.exportError ? quill('quill-notice', { tone: 'refused' }, a.exportError) : null,
    a.more && !a.loading ? quill('quill-more', { shown: rows.length, total: rows.length + 1, noun: 'changes', step: PAGE, busy: Boolean(a.older), onMore: () => v.on.audit(true) }) : null,
  ];
};

/** One entry, on a page of its own: everything recorded about it. */
export const entryPage = (v: View, id: string): RemoteNode => {
  const e = v.ui.activity.entries?.find((x) => x.id === id);
  if (!e)
    return quill('quill-state', {
      kind: 'empty',
      heading: v.ui.activity.loading ? 'Reading Activity' : 'That entry isn’t among those shown',
      body: 'Open it from Activity, with the filters it’s under.',
      action: 'Open Activity',
      size: 'page',
      onAction: () => v.on.go(pathOf({ page: 'activity' })),
    });
  const names = namesOf(v);
  return [
    quill('quill-notice', { tone: 'info', heading: describe(e, names) }, 'Everything recorded about this change. Entries can’t be edited or removed.'),
    quill('quill-details', {
      limit: 0,
      items: [
        { label: 'When', value: new Date(e.at).toLocaleString() },
        { label: 'Who', value: e.actor.kind === 'user' ? names.person(e.actor.id) : `${names.app(e.actor.id)} (a service)` },
        { label: 'Where', value: areaName(e.app, names) },
        { label: 'Action', value: e.action },
        ...(e.target ? [{ label: 'About', value: e.target }] : []),
        ...(e.workspace ? [{ label: 'Floor', value: e.workspace.path.map((x) => names.department(x)).join(' / ') }] : []),
        ...Object.entries(e.detail ?? {}).map(([k, val]) => ({ label: k, value: typeof val === 'string' ? val : JSON.stringify(val) })),
      ],
    }),
  ];
};
