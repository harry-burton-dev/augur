import { searchPrincipals, type AppManifestEntry, type DirectoryPrincipal, type InboxCounts, type InboxItem, type MountContext, type Workspace } from '@augur/mfe-sdk';
import { Button, Dialog, Heading, Menu, Progress, Tab, TabList, TabPanel, Tabs, TextField } from '@augur/shell-kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  appNameOf,
  dueLine,
  INBOX_UNREACHABLE,
  InboxError,
  kindOf,
  menuFor,
  openProblem,
  ordered,
  subjectLabel,
  type InboxClient,
  type InboxTab,
  type InboxVerb,
} from '../host/index.js';

export interface InboxViewProps {
  client: InboxClient;
  manifest: AppManifestEntry[];
  floors: Workspace[];
  /** The floor the person stands on. */
  here: string;
  me: string;
  counts?: InboxCounts;
  /** Bumped whenever the stream says something changed: the open tab loads again. */
  version: number;
  /** For the hand-on picker: the directory, through the gateway. */
  fetch: MountContext['fetch'];
  onOpen(item: InboxItem): void;
  /** After any action: the counts load again. */
  onChanged(): void;
}

type Listing = { state: 'loading' } | { state: 'shown'; items: InboxItem[]; stale?: boolean } | { state: 'failed'; message: string };

const floorLabel = (f: Workspace) => (f.kind === 'personal' ? 'your own floor' : f.name);

/**
 * The Inbox: For you, Your teams and Done, each a list of rows with Open and a menu. Every
 * action that can't be taken stays in the menu, disabled, saying why (explain, never hide).
 */
export function InboxView({ client, manifest, floors, here, me, counts, version, fetch, onOpen, onChanged }: InboxViewProps) {
  const [tab, setTab] = useState<InboxTab>('you');
  const [listing, setListing] = useState<Listing>({ state: 'loading' });
  const [problem, setProblem] = useState<{ id: string; message: string } | null>(null);
  const [declining, setDeclining] = useState<InboxItem | null>(null);
  const [handing, setHanding] = useState<InboxItem | null>(null);
  const last = useRef<InboxItem[] | null>(null);

  const load = useCallback(() => {
    if (!last.current) setListing({ state: 'loading' });
    client.list(tab).then(
      (items) => {
        last.current = items;
        setListing({ state: 'shown', items: tab === 'you' ? ordered(items) : items });
      },
      (err: unknown) => {
        const message = err instanceof InboxError ? err.message : INBOX_UNREACHABLE;
        // The last list stays, marked, rather than blanking (states in PER-146 3.3).
        setListing(last.current ? { state: 'shown', items: last.current, stale: true } : { state: 'failed', message });
      },
    );
  }, [client, tab]);

  useEffect(() => {
    last.current = null;
  }, [tab]);
  useEffect(load, [load, version]);

  const act = async (item: InboxItem, verb: InboxVerb, body?: { note?: string; to?: string }) => {
    setProblem(null);
    try {
      await client.act(item.id, verb, body);
    } catch (err) {
      const e = err instanceof InboxError ? err : new InboxError(INBOX_UNREACHABLE, 0);
      setProblem({ id: item.id, message: e.takenBy ? 'Someone else took this a moment ago.' : e.message });
      return false;
    } finally {
      onChanged();
      load();
    }
    return undefined;
  };

  const choose = (item: InboxItem, verb: InboxVerb) => {
    if (verb === 'decline') setDeclining(item);
    else if (verb === 'hand-on') setHanding(item);
    else void act(item, verb);
  };

  const summary = counts ? `${counts.you} waiting on you · ${counts.teams} for your teams` : undefined;
  const teamCount = counts?.teams ?? 0;

  return (
    <section className="inbox" data-inbox>
      <Heading heading="Inbox" summary={summary} size="m" />
      <Tabs selected={tab} onChange={(id) => setTab(id as InboxTab)}>
        <TabList label="Inbox">
          <Tab id="you" count={counts?.you}>
            For you
          </Tab>
          <Tab id="teams" count={teamCount}>
            Your teams
          </Tab>
          <Tab id="done">Done</Tab>
        </TabList>
        {(['you', 'teams', 'done'] as const).map((t) => (
          <TabPanel key={t} id={t}>
            {t !== tab ? null : listing.state === 'loading' ? (
              <Progress label="Loading your inbox" />
            ) : listing.state === 'failed' ? (
              <div className="inbox-empty" role="status">
                <p>{listing.message}</p>
                <Button kind="secondary" size="sm" onPress={load}>
                  Try again
                </Button>
              </div>
            ) : (
              <>
                {listing.stale ? (
                  <p className="inbox-stale" role="status">
                    {INBOX_UNREACHABLE}
                  </p>
                ) : null}
                {listing.items.length ? (
                  <ul>
                    {listing.items.map((item) => (
                      <InboxRow
                        key={item.id}
                        item={item}
                        manifest={manifest}
                        floors={floors}
                        here={here}
                        me={me}
                        problem={problem?.id === item.id ? problem.message : undefined}
                        onOpen={() => onOpen(item)}
                        onAction={(verb) => choose(item, verb)}
                      />
                    ))}
                  </ul>
                ) : (
                  <Empty tab={t} teamCount={teamCount} onTeams={() => setTab('teams')} />
                )}
              </>
            )}
          </TabPanel>
        ))}
      </Tabs>
      <Dialog
        open={!!declining}
        onClose={() => setDeclining(null)}
        size="decision"
        heading="Decline it"
        summary={`${declining ? appNameOf(declining, manifest) : 'The app'} and whoever sent it will see why.`}
        actionLabel="Decline"
        cancelLabel="Cancel"
        onSubmit={async (values) => {
          const note = (values.note ?? '').trim();
          if (!note || !declining) return false;
          const result = await act(declining, 'decline', { note });
          if (result !== false) setDeclining(null);
          return result;
        }}
        fields={<TextField label="Why" name="note" multiline rows={3} maxLength={500} required autoFocus />}
      />
      <HandOn item={handing} fetch={fetch} me={me} onClose={() => setHanding(null)} onHandOn={(to, note) => act(handing!, 'hand-on', { to, ...(note ? { note } : {}) })} />
    </section>
  );

}

function Empty({ tab: t, teamCount: m, onTeams }: { tab: InboxTab; teamCount: number; onTeams(): void }) {
  if (t === 'you')
    return (
      <div className="inbox-empty">
        <p>{m ? 'Nothing is waiting on you.' : 'Nothing is waiting on you or your teams.'}</p>
        {m ? (
          <Button kind="tertiary" size="sm" onPress={onTeams}>
            {m} for your teams
          </Button>
        ) : null}
      </div>
    );
  return <p className="inbox-empty">{t === 'teams' ? 'Nothing is waiting for your teams.' : 'Nothing closed in the last 30 days.'}</p>;
}

function InboxRow({
  item,
  problem: rowProblem,
  onOpen: open,
  onAction,
  manifest: m,
  floors: fs,
  here: h,
  me: who,
}: {
  item: InboxItem;
  problem?: string;
  onOpen(): void;
  onAction(verb: InboxVerb): void;
  manifest: AppManifestEntry[];
  floors: Workspace[];
  here: string;
  me: string;
}) {
  const appName = appNameOf(item, m);
  const kind = kindOf(item, m);
  const due = dueLine(item);
  const other = item.workspace && item.workspace.id !== h ? fs.find((f) => f.id === item.workspace!.id) : undefined;
  const team = item.owner.kind === 'team' ? fs.find((f) => f.id === item.owner.id) : undefined;
  const why = openProblem(item, { manifest: m, floors: fs, here: h });
  const about = subjectLabel(item);
  const entries = menuFor(item, who, appName);
  return (
    <li className={item.redacted ? 'inbox-row redacted' : 'inbox-row'} data-inbox-item={item.id}>
      <span className="inbox-what">
        <small>
          {appName}
          {kind ? ` · ${kind.label}` : ''}
          {other ? ` · on ${floorLabel(other)}` : ''}
        </small>
        <strong>{item.redacted ? `For ${team?.name ?? 'the team'}’s leads` : item.title}</strong>
        {item.detail ? <span className="inbox-detail">{item.detail}</span> : null}
        <small>
          {about ? `About ${about}` : ''}
          {item.takenBy && item.takenBy !== who ? `${about ? ' · ' : ''}Taken by someone on the team` : ''}
          {item.state !== 'open' ? `${item.state === 'withdrawn' ? 'Withdrawn' : item.state === 'declined' ? 'Declined' : 'Done'}${item.closeNote ? `: ${item.closeNote}` : ''}` : ''}
        </small>
        {due ? <small className={due.late ? 'inbox-late' : undefined}>{due.text}</small> : null}
        {rowProblem ? (
          <small className="inbox-problem" role="alert">
            {rowProblem}
          </small>
        ) : null}
      </span>
      {item.state === 'open' ? (
        <span className="inbox-actions">
          <Button kind="primary" size="sm" disabled={!!why} reason={why} onPress={open}>
            Open
          </Button>
          {entries.length ? (
            <Menu label={`More for ${item.title ?? 'this item'}`} items={entries.map((e) => ({ id: e.id, label: e.label, ...(e.disabled ? { disabled: true, reason: e.reason } : {}) }))} onAction={(id) => onAction(id as InboxVerb)}>
              <Button kind="tertiary" size="sm">
                More
              </Button>
            </Menu>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

/** Hand on: find a person or a team by name, then an optional note. */
function HandOn({ item, fetch, me, onClose, onHandOn }: { item: InboxItem | null; fetch: MountContext['fetch']; me: string; onClose(): void; onHandOn(to: string, note?: string): Promise<false | undefined> }) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<DirectoryPrincipal[]>([]);
  const [chosen, setChosen] = useState<DirectoryPrincipal | null>(null);
  const [searchProblem, setSearchProblem] = useState('');

  useEffect(() => {
    if (!item) {
      setQuery('');
      setFound([]);
      setChosen(null);
      setSearchProblem('');
    }
  }, [item]);

  useEffect(() => {
    if (!query.trim()) return void setFound([]);
    const t = setTimeout(() => {
      searchPrincipals({ fetch }, query.trim(), { limit: 8 }).then(
        (list) => {
          setSearchProblem('');
          setFound(list.filter((p) => !(p.kind === 'person' && p.id === me)));
        },
        (err: Error) => setSearchProblem(err.message),
      );
    }, 250);
    return () => clearTimeout(t);
  }, [query, fetch, me]);

  return (
    <Dialog
      open={!!item}
      onClose={onClose}
      size="decision"
      heading="Hand it on"
      summary={chosen ? `To ${chosen.name}.` : 'Find a person or a team to hand it to.'}
      actionLabel="Hand on"
      cancelLabel="Cancel"
      onSubmit={async (values) => {
        if (!chosen) return false;
        const result = await onHandOn(`${chosen.kind}:${chosen.id}`, (values.note ?? '').trim() || undefined);
        if (result !== false) onClose();
        return result;
      }}
      fields={
        <>
          <TextField label="Who" type="search" value={query} onChange={setQuery} autoFocus state={searchProblem ? 'error' : undefined} message={searchProblem || undefined} />
          {found.length ? (
            <ul className="inbox-found">
              {found.map((p) => (
                <li key={`${p.kind}:${p.id}`}>
                  <Button kind={chosen?.id === p.id && chosen.kind === p.kind ? 'secondary' : 'tertiary'} size="sm" onPress={() => setChosen(p)}>
                    {p.name}
                    {p.detail ? ` · ${p.detail}` : ''}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <TextField label="Note" name="note" optional multiline rows={2} maxLength={500} />
        </>
      }
    />
  );
}
