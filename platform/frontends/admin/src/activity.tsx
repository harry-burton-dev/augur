import { Button, DateField, Details, Dialog, Select, Table, type SelectOption, type TableColumn, type TableRow } from '@augur/app-kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fullName, type AdminApi, type AuditEntry, type AuditQuery, type CatalogueApp, type Department, type Person } from './api.js';
import { floorTree } from './apps-model.js';
import { Page, Problem } from './parts.js';

const PAGE = 50;
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
      return `${who} added ${names.person(target)}`;
    case 'person.updated': {
      const what = [...new Set(Object.keys(d).map((k) => changedWords[k]).filter(Boolean))];
      return `${who} changed ${names.person(target)}’s ${what.length ? what.join(' and ') : 'details'}`;
    }
    case 'person.enabled':
      return `${who} turned on ${names.person(target)}’s sign-in`;
    case 'person.disabled':
      return `${who} turned off ${names.person(target)}’s sign-in`;
    case 'person.password-reset':
      return `${who} gave ${names.person(target)} a new password`;
    case 'person.left':
      return d.handOverTo ? `${who} marked ${names.person(target)} as a leaver, handing their work to ${names.person(String(d.handOverTo))}` : `${who} marked ${names.person(target)} as a leaver`;
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
      const what = [to.name !== undefined ? 'name' : '', to.timeZone !== undefined ? 'time zone' : '', to.sender !== undefined ? 'email sender' : ''].filter(Boolean);
      return to.name !== undefined && what.length === 1
        ? `${who} renamed the organisation to ${String(to.name)}`
        : `${who} changed the organisation’s ${what.length ? what.join(' and ') : 'settings'}`;
    }
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

export type Period = 'today' | 'week' | 'month' | 'all' | 'custom';

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

const columns: TableColumn[] = [
  { key: 'at', label: 'When', kind: 'date', sortable: true, sortFirst: 'desc' },
  { key: 'what', label: 'What happened', wrap: true },
  { key: 'area', label: 'Where', sortable: true },
];

type Filters = { kind: string; who: string; area: string; floor: string; period: Period; from: string; to: string };

const queryFor = (f: Filters, before?: string): AuditQuery => ({
  ...(f.kind === 'change' || f.kind === 'sign-in' ? { kind: f.kind } : {}),
  // A person's sign-ins are about them, so "who" asks for anything by or about them there.
  ...(f.who !== ANYONE ? (f.kind === 'change' ? { actor: f.who } : { person: f.who }) : {}),
  ...(f.area !== ANYONE ? { app: f.area } : {}),
  ...(f.floor !== ANYONE ? { workspace: f.floor } : {}),
  ...rangeFor(f.period, new Date(), f.from, f.to),
  ...(before ? { before } : {}),
  limit: PAGE,
});

/** The audit log, readable: who did what, where and when, newest first. */
export function Activity({ api }: { api: AdminApi }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [names, setNames] = useState<Names>(() => namesFrom([], [], []));
  const [options, setOptions] = useState<{ people: SelectOption[]; areas: SelectOption[]; floors: SelectOption[] }>({ people: [], areas: [], floors: [] });
  const [filters, setFilters] = useState<Filters>({ kind: 'change', who: ANYONE, area: ANYONE, floor: ANYONE, period: 'week', from: '', to: '' });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string>();
  /** Answers to an older ask are dropped when filters change mid-flight. */
  const ask = useRef(0);
  const key = JSON.stringify(filters);

  // Names for the sentences and the filters. Without them the log still shows, with ids.
  useEffect(() => {
    let live = true;
    void Promise.all([
      api.people().catch(() => [] as Person[]),
      api.departments().catch(() => [] as Department[]),
      api.apps().catch(() => [] as CatalogueApp[]),
      api.org().catch(() => undefined),
    ]).then(([people, departments, apps, org]) => {
      if (!live) return;
      // The org's name reads like a department's in sentences about floors.
      setNames(namesFrom(people, org ? [...departments, { id: org.id, name: org.name, members: [] }] : departments, apps));
      const floors = org ? floorTree(org, departments) : [];
      setOptions({
        people: [{ value: ANYONE, label: 'Anyone' }, ...people.map((p) => ({ value: p.id, label: fullName(p) })).sort((a, b) => a.label.localeCompare(b.label))],
        areas: [
          { value: ANYONE, label: 'Anywhere' },
          { value: 'identity', label: 'People and departments' },
          { value: 'registry', label: 'App catalogue' },
          ...apps.filter((a) => !a.platform).map((a) => ({ value: a.id, label: a.name })),
        ],
        floors: [
          { value: ANYONE, label: 'Any floor' },
          ...floors.map((f) => ({ value: f.id, label: f.path.map((id) => floors.find((x) => x.id === id)?.name ?? '').join(' / '), detail: f.path.length > 1 ? 'and below' : 'everything on a floor' })),
        ],
      });
    });
    return () => {
      live = false;
    };
  }, [api]);

  const load = useCallback(async () => {
    const f = JSON.parse(key) as Filters;
    // Between dates with neither day chosen yet: wait for one.
    if (f.period === 'custom' && !f.from && !f.to) return;
    const mine = ++ask.current;
    setLoading(true);
    setError('');
    setOpen(undefined);
    try {
      const page = await api.audit(queryFor(f));
      if (mine !== ask.current) return;
      setEntries(page);
      setMore(page.length === PAGE);
    } catch (err) {
      if (mine === ask.current) setError((err as Error).message);
    } finally {
      if (mine === ask.current) setLoading(false);
    }
  }, [api, key]);
  useEffect(() => void load(), [load]);

  const loadOlder = async () => {
    const last = entries.at(-1);
    if (!last) return;
    const mine = ask.current;
    setLoadingMore(true);
    try {
      const page = await api.audit(queryFor(filters, last.id));
      if (mine !== ask.current) return;
      setEntries((all) => [...all, ...page]);
      setMore(page.length === PAGE);
    } catch (err) {
      if (mine === ask.current) setError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  const set = (k: keyof Filters) => (value: string) => setFilters((f) => ({ ...f, [k]: value }));

  /** Everything the filters show, not only the pages loaded, as a spreadsheet file. */
  const download = async () => {
    setExporting(true);
    setExportError('');
    try {
      const query = Object.fromEntries(Object.entries(queryFor(filters)).filter(([k]) => k !== 'before' && k !== 'limit')) as Omit<AuditQuery, 'before' | 'limit'>;
      const { blob, filename } = await api.exportAudit(query);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setExporting(false);
    }
  };
  const rows: TableRow[] = entries.map((e) => ({ id: e.id, at: e.at, what: describe(e, names), area: areaName(e.app, names) }));
  const e = entries.find((x) => x.id === open);

  return (
    <Page heading="Activity" summary="Every change made through AUGUR, and every sign-in: who, what, where and when. Nothing here can be edited or removed by hand; entries older than the organisation’s retention period go each night.">
      <div className="admin-filters" data-filters>
        <Select label="Kind" options={kinds} value={filters.kind} onChange={set('kind')} />
        <Select label="Who" options={options.people} value={filters.who} onChange={set('who')} />
        <Select label="Where" options={options.areas} value={filters.area} onChange={set('area')} />
        <Select label="Floor" options={options.floors} value={filters.floor} onChange={set('floor')} />
        <Select label="When" options={periods} value={filters.period} onChange={set('period')} />
        {filters.period === 'custom' ? (
          <>
            <DateField label="From" value={filters.from} onChange={set('from')} quick={[]} />
            <DateField label="To" value={filters.to} onChange={set('to')} quick={[]} />
          </>
        ) : null}
      </div>
      <Table
        noun="changes"
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        empty={filters.kind === 'sign-in' ? 'Nobody signed in in this time.' : 'Nothing was changed in this time.'}
        onOpen={(row) => setOpen(row.id)}
        onRetry={() => void load()}
        actions={
          <Button kind="secondary" size="sm" busy={exporting} busyLabel="Making the file…" disabled={loading || Boolean(error)} reason={error ? 'Activity couldn’t be loaded. Try again first.' : 'Wait for Activity to load.'} onPress={() => void download()}>
            Download CSV
          </Button>
        }
      />
      <Problem>{exportError}</Problem>
      {more && !loading ? (
        <div className="admin-more">
          <Button kind="secondary" size="sm" busy={loadingMore} onPress={() => void loadOlder()}>
            Show older
          </Button>
        </div>
      ) : null}
      {e ? (
        <Dialog open light size="read" eyebrow="Activity" heading={describe(e, names)} summary="Everything recorded about this change. Entries can’t be edited or removed." cancelLabel="Close" onClose={() => setOpen(undefined)}>
          <Details
            limit={0}
            items={[
              { label: 'When', value: new Date(e.at).toLocaleString() },
              { label: 'Who', value: e.actor.kind === 'user' ? names.person(e.actor.id) : `${names.app(e.actor.id)} (a service)` },
              { label: 'Where', value: areaName(e.app, names) },
              { label: 'Action', value: e.action },
              ...(e.target ? [{ label: 'About', value: e.target }] : []),
              ...(e.workspace ? [{ label: 'Floor', value: e.workspace.path.map((id) => names.department(id)).join(' / ') }] : []),
              ...Object.entries(e.detail ?? {}).map(([k, v]) => ({ label: k, value: typeof v === 'string' ? v : JSON.stringify(v) })),
            ]}
          />
        </Dialog>
      ) : null}
    </Page>
  );
}
