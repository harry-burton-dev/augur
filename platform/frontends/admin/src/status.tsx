import { Details, Dialog, Notice, Section, Status as StatusMark, Table, type Detail, type StatusName, type TableColumn, type TableRow } from '@augur/app-kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminApi, BackupStatus, ComponentStatus, PlatformUpdates, PublicAccess } from './api.js';
import { Page } from './parts.js';

/** How often the screen asks the gateway again while it is open. The gateway itself checks every 30 seconds. */
export const REFRESH_MS = 15_000;

const kindWords: Record<ComponentStatus['kind'], string> = { gateway: 'AUGUR', service: 'AUGUR', app: 'App', 'sign-in': 'Sign-in' };

/** A component's state as a status mark and its word. */
export const stateOf = (c: Pick<ComponentStatus, 'state'>): { status: StatusName; label: string } =>
  c.state === 'up'
    ? { status: 'done', label: 'Running' }
    : c.state === 'slow'
      ? { status: 'warning', label: 'Slow' }
      : c.state === 'checking'
        ? { status: 'running', label: 'Checking' }
        : { status: 'failed', label: 'Down' };

/** The heading: everything's fine, or how many parts need a look, then backups. */
export const headline = (components: ComponentStatus[], backups?: BackupStatus): { heading: string; summary: string } => {
  const down = components.filter((c) => c.state === 'down').length;
  const slow = components.filter((c) => c.state === 'slow').length;
  if (!components.length) return { heading: 'Status', summary: 'Whether every part of AUGUR is answering.' };
  if (down) return { heading: `${down === 1 ? '1 part is' : `${down} parts are`} down`, summary: 'People may not be able to use what depends on it. Open a row to see what to check.' };
  if (slow) return { heading: `${slow === 1 ? '1 part is' : `${slow} parts are`} slow`, summary: 'Everything is answering, but not all of it quickly.' };
  if (backups?.state === 'attention') return { heading: 'Backups need a look', summary: backups.problem ?? 'Everything is running, but backups can’t be relied on right now.' };
  return { heading: 'Everything is running', summary: 'Every part of AUGUR answered its last check.' };
};

/** What to try for a part that's down, by kind. */
const advice = (c: ComponentStatus) =>
  c.kind === 'sign-in'
    ? 'Nobody can sign in while this is down. Check the sign-in service’s container and its database.'
    : c.kind === 'app'
      ? `People can’t use ${c.name} while its service is down; the rest of AUGUR is unaffected. Check its container.`
      : `Check the ${c.name} container and its logs. Other parts that depend on it may fail too.`;

const columns: TableColumn[] = [
  { key: 'name', label: 'Part', sortable: true },
  { key: 'kind', label: 'Kind', sortable: true },
  { key: 'version', label: 'Version', sortable: true },
  { key: 'state', label: 'Status', kind: 'status', sortable: true, format: (v, row) => <StatusMark status={row.stateStatus as StatusName} label={String(v)} />, text: (v) => String(v) },
  { key: 'seenAt', label: 'Last answered', kind: 'date', sortable: true },
];

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never');
const size = (bytes?: number) => (bytes === undefined ? '' : bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Whether every part of the platform is answering, from the gateway's last checks. */
export function Status({ api, openUpgrades }: { api: AdminApi; openUpgrades: () => void }) {
  const [components, setComponents] = useState<ComponentStatus[]>([]);
  const [backups, setBackups] = useState<BackupStatus>();
  const [publicAccess, setPublicAccess] = useState<PublicAccess>();
  const [updates, setUpdates] = useState<PlatformUpdates>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string>();
  const had = useRef(0);

  /** A quiet reload keeps the table as it is while it asks, and keeps the last answer if the ask fails. */
  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setLoading(true);
        setError('');
      }
      try {
        const s = await api.status();
        setComponents(s.components);
        had.current = s.components.length;
        setBackups(s.backups);
        setPublicAccess(s.publicAccess);
        setError('');
      } catch (err) {
        if (!quiet || !had.current) setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );
  useEffect(() => {
    void load();
    // Only to say an update is out; Status works the same without it.
    api.updates().then(setUpdates, () => undefined);
    const timer = setInterval(() => void load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [api, load]);

  const rows: TableRow[] = components.map((c) => {
    const s = stateOf(c);
    return { id: c.name, name: c.name, kind: kindWords[c.kind], version: c.version ?? '', state: s.label, stateStatus: s.status, seenAt: c.seenAt ?? '' };
  });
  const { heading, summary } = error ? { heading: 'Status', summary: 'Whether every part of AUGUR is answering.' } : headline(components, backups);
  const c = components.find((x) => x.name === open);
  const out = updates?.available?.version;

  return (
    <Page heading={heading} summary={summary}>
      {publicAccess?.open ? (
        <Notice tone="warning" heading={publicAccess.until ? `Open to the internet until ${new Date(publicAccess.until).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.` : 'Open to the internet.'}>
          <span data-public>
            Anyone with AUGUR’s address can reach its sign-in page, not only your tailnet. It closes by itself then; to close it now, run <code>infra/deploy/public.sh off</code> on the server.
          </span>
        </Notice>
      ) : null}
      {out && updates ? (
        <Notice tone="needs" heading={`AUGUR ${out} is out.`} action="Open the Upgrade Centre" onAction={openUpgrades}>
          <span data-update>
            You’re on {updates.running.version}
            {updates.running.build === 'source' ? ' (built from source)' : ''}.
          </span>
        </Notice>
      ) : null}
      <Table noun="parts" columns={columns} rows={rows} loading={loading} error={error} empty="Nothing has been checked yet." onOpen={(row) => setOpen(row.id)} onRetry={() => void load()} />
      {backups ? (
        <Section label="Backups" count={-1} limit={0}>
          <StatusMark status={backups.state === 'ok' ? 'done' : 'warning'} label={backups.state === 'ok' ? 'Backups restore cleanly' : 'Backups need a look'} />
          <Details
            limit={0}
            items={[
              { label: 'Last backup', value: backups.lastBackup ? (backups.lastBackup.ok ? when(backups.lastBackup.at) : 'Failed') : 'Never' },
              ...(backups.lastBackup?.ok && backups.lastBackup.bytes !== undefined ? [{ label: 'Size', value: size(backups.lastBackup.bytes) }] : []),
              {
                label: 'Copy off the server',
                value: backups.offsite ? (backups.offsite.ok ? `${when(backups.offsite.at)}, ${backups.offsite.keepDays ?? 30} days kept` : 'Failed') : 'Not set up',
              },
              ...(backups.pointInTime
                ? [
                    {
                      label: 'Point in time',
                      value: !backups.pointInTime.ok ? 'Needs a look' : backups.pointInTime.earliest ? `Any moment since ${when(backups.pointInTime.earliest)}` : 'Not yet',
                    },
                    {
                      label: 'Last replay test',
                      value: backups.pointInTime.lastTest ? (backups.pointInTime.lastTest.ok ? when(backups.pointInTime.lastTest.at) : 'Failed') : 'Never',
                    },
                  ]
                : []),
              { label: 'Last restore test', value: backups.lastRestoreTest ? when(backups.lastRestoreTest.at) : 'Never' },
              ...(backups.lastRestoreTest
                ? [
                    {
                      label: 'Result',
                      value: backups.lastRestoreTest.ok
                        ? `Restored ${backups.lastRestoreTest.from === 'offsite' ? 'from the copy off the server' : 'from this server'}, ${backups.lastRestoreTest.people ?? 0} people`
                        : 'Failed',
                    },
                  ]
                : []),
            ]}
          />
          {backups.problem ? <p className="admin-flat">{backups.problem}</p> : null}
        </Section>
      ) : null}
      {c ? (
        <Dialog open light size="glance" eyebrow={kindWords[c.kind]} heading={c.name} summary={c.problem ?? (c.state === 'slow' ? 'It answered, but took more than 2 seconds.' : '')} cancelLabel="Close" onClose={() => setOpen(undefined)}>
          <Details
            limit={0}
            items={
              [
                { label: 'Status', value: stateOf(c).label },
                c.version ? { label: 'Version', value: c.version } : undefined,
                c.api ? { label: 'API', value: c.api } : undefined,
                c.latencyMs !== undefined ? { label: 'Answered in', value: `${c.latencyMs} ms` } : undefined,
                c.seenAt ? { label: 'Last answered', value: new Date(c.seenAt).toLocaleString() } : undefined,
                c.checkedAt ? { label: 'Last checked', value: new Date(c.checkedAt).toLocaleString() } : undefined,
              ].filter(Boolean) as Detail[]
            }
          />
          {c.state === 'down' ? <p>{advice(c)}</p> : null}
        </Dialog>
      ) : null}
    </Page>
  );
}
