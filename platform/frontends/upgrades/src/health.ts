import type { RemoteNode } from '@augur/mfe-sdk/sdk3';
import type { BackupStatus, ComponentStatus, EmailStatus, EventDelivery } from './model/types.js';
import { quill } from './quill.js';
import { paged, when, type View } from './view.js';

type Tone = 'ok' | 'needs' | 'problem' | 'info';

const KIND: Record<ComponentStatus['kind'], string> = { gateway: 'AUGUR', service: 'AUGUR', app: 'App', 'sign-in': 'Sign-in' };
const STATE: Record<ComponentStatus['state'], string> = { up: 'Healthy', slow: 'Slow', down: 'Down', checking: 'Checking' };

/** What to try for a part that isn't healthy, by kind. */
const advice = (c: ComponentStatus) =>
  c.state === 'slow'
    ? 'It answered, but took more than 2 seconds.'
    : c.kind === 'sign-in'
      ? 'Nobody can sign in while this is down. Check the sign-in service’s container and its database.'
      : c.kind === 'app'
        ? `People can’t use ${c.name} while its service is down; the rest of AUGUR is unaffected. Check its container.`
        : `Check the ${c.name} container and its logs (\`pc logs ${c.name}\`). Parts that depend on it may fail too.`;

/** "9 of 9 parts healthy", or how many need a look: the overview's line and Health's heading. */
export const healthLine = (components: ComponentStatus[]): { words: string; tone: Tone } => {
  const down = components.filter((c) => c.state === 'down').length;
  const slow = components.filter((c) => c.state === 'slow').length;
  const healthy = components.filter((c) => c.state === 'up').length;
  if (!components.length) return { words: 'Nothing checked yet', tone: 'info' };
  if (down) return { words: `${down} of ${components.length} ${components.length === 1 ? 'part' : 'parts'} down`, tone: 'problem' };
  if (slow) return { words: `${slow} of ${components.length} ${components.length === 1 ? 'part' : 'parts'} slow`, tone: 'needs' };
  return { words: `${healthy} of ${components.length} ${components.length === 1 ? 'part' : 'parts'} healthy`, tone: 'ok' };
};

/** The last backup in a few words: the overview's line. */
export const backupLine = (v: Pick<View, 'zone' | 'now'>, b?: BackupStatus): string =>
  !b ? 'Not reported' : !b.lastBackup ? 'None yet' : b.lastBackup.ok ? `${when(v, b.lastBackup.at)}, succeeded` : `${when(v, b.lastBackup.at)}, failed`;

const size = (bytes?: number) => (bytes === undefined ? undefined : bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

const emailRow = (v: View, e: EmailStatus) => ({
  id: 'email',
  title: e.state === 'ok' ? 'Email can be sent' : e.state === 'off' ? 'Email is off' : 'Email needs a look',
  detail: [e.problem, e.relay && `Relay ${e.relay}`, e.from && `sent from ${e.from}`, e.checkedAt && `checked ${when(v, e.checkedAt)}`].filter(Boolean).join(' · ') || undefined,
  tone: (e.state === 'ok' ? 'ok' : e.state === 'off' ? 'info' : 'needs') as Tone,
});

const DELIVERY: Record<EventDelivery['state'], Tone> = { ok: 'ok', retrying: 'needs', stalled: 'problem' };
const troubled = (all: EventDelivery[]) => all.filter((x) => x.state !== 'ok');
const okWords = (n: number) => (n === 1 ? '1 app takes its events without trouble' : `${n} apps take their events without trouble`);

/** What the gateway's status couldn't say, or that it hasn't been read yet. */
const unread = (v: View, what: string): RemoteNode =>
  v.data.statusError && !v.data.status
    ? quill('quill-state', { kind: 'error', heading: `The gateway didn’t say how ${what} doing`, body: `${v.data.statusError} Check it with \`pc logs gateway\`.`, size: 'region' })
    : quill('quill-state', { kind: 'loading', heading: `Reading how ${what} doing`, size: 'region' });

/** Health: whether every part is answering, email, and how apps take their events. */
export const healthPage = (v: View): RemoteNode => {
  const s = v.data.status;
  if (!s) return unread(v, 'AUGUR is');
  const line = healthLine(s.components);
  const sick = s.components.filter((c) => c.state === 'down' || c.state === 'slow');
  const d = v.data.deliveries;
  return [
    v.data.statusError ? quill('quill-notice', { tone: 'warning', heading: 'This may be out of date' }, `The gateway didn’t answer the last check: ${v.data.statusError}`) : null,
    s.publicAccess?.open
      ? quill(
          'quill-notice',
          { tone: 'warning', heading: s.publicAccess.until ? `Open to the internet until ${when(v, s.publicAccess.until)}` : 'Open to the internet' },
          'Anyone with AUGUR’s address can reach its sign-in page. It closes by itself then; to close it now, run `infra/deploy/public.sh off` on the server.',
        )
      : null,
    quill('quill-section', { label: 'Services' }, [
      sick.length
        ? quill('quill-check-list', {
            label: line.words,
            rows: sick.map((c) => ({ id: c.name, title: `${c.name}: ${STATE[c.state]}`, detail: c.problem ? `${c.problem} ${advice(c)}` : advice(c), tone: (c.state === 'down' ? 'problem' : 'needs') as Tone })),
          })
        : null,
      quill('quill-table', {
        label: 'Services',
        noun: 'part',
        columns: [
          { key: 'part', label: 'Part' },
          { key: 'kind', label: 'Kind' },
          { key: 'version', label: 'Version' },
          { key: 'state', label: 'Status' },
          { key: 'answered', label: 'Last answered', wrap: true },
        ],
        rows: s.components.map((c) => ({
          id: c.name,
          part: c.name,
          kind: KIND[c.kind],
          version: c.version ?? '—',
          state: c.latencyMs !== undefined && c.state !== 'down' ? `${STATE[c.state]}, ${c.latencyMs} ms` : STATE[c.state],
          answered: c.seenAt ? when(v, c.seenAt) : 'Never',
        })),
        empty: 'The gateway hasn’t checked anything yet.',
        ...paged(s.components.length),
      }),
    ]),
    s.email ? quill('quill-section', { label: 'Email' }, quill('quill-check-list', { label: 'Email', rows: [emailRow(v, s.email)] })) : null,
    quill('quill-section', { label: 'Event deliveries' }, [
      !d
        ? v.data.deliveriesError
          ? quill('quill-notice', { tone: 'warning' }, `How apps take their events couldn’t be read: ${v.data.deliveriesError}`)
          : quill('quill-state', { kind: 'loading', heading: 'Reading event deliveries', size: 'line' })
        : [
            !d.pushing.on
              ? quill('quill-notice', { tone: 'info', heading: 'Events aren’t pushed to apps' }, `${d.pushing.why} ${d.pushing.whoCanChange}`)
              : d.pushing.problem
                ? quill('quill-notice', { tone: 'warning' }, d.pushing.problem)
                : null,
            // Only the apps in trouble are listed: the rest are a count, however many apps there are.
            d.deliveries.length
              ? [
                  troubled(d.deliveries).length
                    ? quill('quill-check-list', {
                        label: 'Event deliveries',
                        rows: troubled(d.deliveries).map((x) => ({
                          id: x.app,
                          title: x.app,
                          detail: [x.words, x.lastError && `Last error: ${x.lastError}`, x.dropped ? `${x.dropped} dropped` : null].filter(Boolean).join(' · '),
                          tone: DELIVERY[x.state],
                        })),
                      })
                    : null,
                  d.deliveries.length > troubled(d.deliveries).length
                    ? quill('quill-check-list', {
                        label: 'Taking their events',
                        rows: [{ id: 'ok', title: okWords(d.deliveries.length - troubled(d.deliveries).length), tone: 'ok' as Tone }],
                      })
                    : null,
                ]
              : quill('quill-state', { kind: 'empty', heading: 'No app takes events here', size: 'line' }),
          ],
    ]),
    quill(
      'quill-section',
      { label: 'Incident history' },
      quill('quill-notice', { tone: 'info' }, 'AUGUR doesn’t keep a record of past outages yet. Grafana keeps the last 72 hours of alerts and logs (docs/observability.md).'),
    ),
  ];
};

/** Backups: the last backup, the copy off the server, point in time and the restore tests. */
export const backupsPage = (v: View): RemoteNode => {
  const s = v.data.status;
  if (!s) return unread(v, 'backups are');
  const b = s.backups;
  if (!b)
    return quill('quill-state', {
      kind: 'empty',
      heading: 'Backups aren’t reported here',
      body: 'The gateway isn’t told where the backup container writes its results. See AUGUR’s docs, Backups.',
      size: 'region',
    });
  const pit = b.pointInTime;
  const rt = b.lastRestoreTest;
  const okTone = (ok?: boolean): Tone => (ok === undefined ? 'needs' : ok ? 'ok' : 'problem');
  return [
    v.data.statusError ? quill('quill-notice', { tone: 'warning', heading: 'This may be out of date' }, `The gateway didn’t answer the last check: ${v.data.statusError}`) : null,
    b.problem ? quill('quill-notice', { tone: b.state === 'ok' ? 'info' : 'warning', heading: b.state === 'ok' ? undefined : 'Backups need a look' }, b.problem) : null,
    quill('quill-section', { label: 'Backups' }, [
      quill('quill-check-list', {
        label: b.state === 'ok' ? 'Backups restore cleanly' : 'Backups need a look',
        rows: [
          {
            id: 'last',
            title: 'Last backup',
            detail: b.lastBackup ? [when(v, b.lastBackup.at), b.lastBackup.ok ? size(b.lastBackup.bytes) : (b.lastBackup.problem ?? 'Failed')].filter(Boolean).join(' · ') : 'None yet',
            tone: okTone(b.lastBackup?.ok),
          },
          {
            id: 'offsite',
            title: 'Copy off the server',
            detail: b.offsite
              ? b.offsite.ok
                ? `${when(v, b.offsite.at)} · kept ${b.offsite.keepDays ?? 30} days`
                : (b.offsite.problem ?? 'Failed')
              : 'Not set up: backups stay on this server. Set OFFSITE_REPOSITORY, OFFSITE_PASSWORD and the bucket key in .env (AUGUR’s docs, Backups, Off-server copy).',
            tone: b.offsite ? okTone(b.offsite.ok) : 'needs',
          },
          pit
            ? {
                id: 'pit',
                title: 'Point in time',
                detail: !pit.ok ? (pit.problem ?? 'Needs a look') : pit.earliest ? `Any moment since ${when(v, pit.earliest)}` : 'Not yet: the first base backup is still to come',
                tone: pit.ok ? (pit.earliest ? 'ok' : 'info') : 'problem',
              }
            : { id: 'pit', title: 'Point in time', detail: 'Off: Postgres doesn’t archive its changes on this deployment (AUGUR’s docs, Restore to a point in time).', tone: 'info' },
          ...(pit ? [{ id: 'replay', title: 'Last replay test', detail: pit.lastTest ? `${when(v, pit.lastTest.at)}${pit.lastTest.ok ? '' : ', failed'}` : 'Never', tone: okTone(pit.lastTest?.ok) }] : []),
          {
            id: 'restore',
            title: 'Last restore test',
            detail: rt
              ? rt.ok
                ? `${when(v, rt.at)} · restored ${rt.from === 'offsite' ? 'from the copy off the server' : 'from this server'}, ${rt.people ?? 0} people`
                : `${when(v, rt.at)} · ${rt.problem ?? 'failed'}`
              : 'Never',
            tone: okTone(rt?.ok),
          },
        ],
      }),
    ]),
    quill(
      'quill-section',
      { label: 'Restore' },
      quill(
        'quill-notice',
        { tone: 'info' },
        'Restoring is done on the server, by hand: from a backup, to a point in time, or onto a new server (AUGUR’s docs, Backups). Deployment can’t start a restore yet.',
      ),
    ),
    quill(
      'quill-section',
      { label: 'Backup and restore log' },
      quill('quill-notice', { tone: 'info' }, 'Only the latest backup and test are reported, so there is no log here yet. The backup container’s own log has every run (`pc logs backup`).'),
    ),
  ];
};
