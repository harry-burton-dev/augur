import { Button, Dialog, Section, Select, Status, TagPicker } from '@augur/app-kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fullName, type AdminApi, type AppChannel, type AppInstalls, type AppPolicy, type InstalledApp, type Person } from './api.js';
import { FOLLOW_KEY, scopeWords } from './apps-model.js';
import { AppHistory, ChangeList, JobSteps } from './changes.js';
import { asksWords, channelChoices, JOB_REFRESH_MS, jobOpen, jobWords, POLICY_CHOICES, policyHint, waitingWhy } from './installs.js';
import { Line, Problem, Quiet } from './parts.js';

/** A release about to be installed, while the admin confirms: with what it asks, or why it waited. */
export type InstallAsk = { app: string; name: string; version: string; notes: string[] };

/** Where the password is entered again before anything is installed or removed; back here after. */
const signInAgain = (query: string) => {
  const back = `${window.location.pathname}?${query}`;
  window.location.assign(`/auth/again?return=${encodeURIComponent(back)}`);
};

/**
 * What the app runner installed and what the app feed offers, and the changes
 * an admin makes to them. It asks again while a job is waiting or under way,
 * so the page follows along; `then` runs after each of those asks.
 */
export function useInstalls(api: AdminApi, then: () => void) {
  const [installs, setInstalls] = useState<AppInstalls>();
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [confirmInstall, setConfirmInstall] = useState<InstallAsk>();
  const [confirmRemove, setConfirmRemove] = useState<InstalledApp>();
  const [people, setPeople] = useState<Person[]>();
  const resumed = useRef(false);
  const latest = useRef(installs);
  latest.current = installs;

  const ask = useCallback((app: string, version: string, i = latest.current) => {
    const offered = i?.available.find((a) => a.app === app && a.version === version);
    const installed = i?.installed.find((a) => a.app === app && (a.update?.version === version || a.older?.some((o) => o.version === version)));
    if (offered) setConfirmInstall({ app, name: offered.name, version, notes: [...asksWords(offered.asks, scopeWords), ...(offered.problem ? [offered.problem] : [])] });
    else if (installed) setConfirmInstall({ app, name: installed.name, version, notes: installed.update?.version === version ? installed.update.needs : [] });
  }, []);

  const follow = useCallback(
    async (app: InstalledApp, channel: AppChannel, policy: AppPolicy) => {
      setError('');
      try {
        setInstalls(await api.followApp(app.app, channel, policy));
      } catch (err) {
        if (err instanceof ApiError && err.code === 'sign_in_again') {
          // Kept in this tab only, never in the address: a link can't make the change for someone.
          try {
            sessionStorage.setItem(FOLLOW_KEY, JSON.stringify({ app: app.app, channel, policy }));
          } catch {
            // Private browsing: they choose again when they're back.
          }
          signInAgain('follow=1');
          return;
        }
        setError((err as Error).message);
      }
    },
    [api],
  );

  /** Back from entering the password again (`?install=<app>@<version>`, `?uninstall=<app>` or `?follow=1` with the change kept in this tab): ask once more. */
  const resume = useCallback(
    (i: AppInstalls) => {
      if (resumed.current) return;
      resumed.current = true;
      const params = new URLSearchParams(window.location.search);
      const install = params.get('install');
      const uninstall = params.get('uninstall');
      const following = params.get('follow');
      if (!install && !uninstall && !following) return;
      params.delete('install');
      params.delete('uninstall');
      params.delete('follow');
      const rest = params.toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
      const at = install?.lastIndexOf('@') ?? -1;
      if (install && at > 0) ask(install.slice(0, at), install.slice(at + 1), i);
      if (uninstall) setConfirmRemove(i.installed.find((x) => x.app === uninstall));
      if (following) {
        // The change they made in this tab before entering the password: made once more, as they chose it.
        let kept: { app?: string; channel?: AppChannel; policy?: AppPolicy } = {};
        try {
          kept = JSON.parse(sessionStorage.getItem(FOLLOW_KEY) ?? '{}');
          sessionStorage.removeItem(FOLLOW_KEY);
        } catch {
          // Nothing kept: they choose again.
        }
        const installed = i.installed.find((x) => x.app === kept.app);
        if (installed && kept.channel && kept.policy) void follow(installed, kept.channel, kept.policy);
      }
    },
    [ask, follow],
  );

  const load = useCallback(async () => {
    try {
      const i = await api.installs();
      // Anything else (a registry without the app runner) shows no installs.
      const shown = Array.isArray(i?.installed) && Array.isArray(i.available) ? i : undefined;
      setInstalls(shown);
      setError('');
      if (shown) resume(shown);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [api, resume]);
  useEffect(() => void load(), [load]);

  const busy = Boolean(installs && [...installs.installed, ...installs.available].some((a) => jobOpen(a.job)));
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => void load().then(then), JOB_REFRESH_MS);
    return () => clearTimeout(timer);
  }, [busy, installs, load, then]);

  const check = async () => {
    setChecking(true);
    try {
      setInstalls(await api.checkInstalls());
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  /** Asks the app runner; when the password is needed again, goes to enter it and keeps the dialog open. */
  const stepUp = async (call: () => Promise<unknown>, query: string) => {
    try {
      await call();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'sign_in_again') {
        signInAgain(query);
        return false as const;
      }
      throw err;
    }
    await load();
  };

  const loadPeople = useCallback(() => {
    if (people) return;
    api.people().then(setPeople, (err: Error) => setError(err.message));
  }, [api, people]);

  const setDevelopers = async (app: InstalledApp, ids: string[]) => {
    setError('');
    try {
      setInstalls(await api.setDevelopers(app.app, ids));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const dialogs = (
    <>
      {confirmInstall ? (
        <Dialog
          open
          size="glance"
          eyebrow="Apps"
          heading={`Install ${confirmInstall.name} ${confirmInstall.version}?`}
          summary="The new version starts beside whatever runs now, and people are switched to it only once it answers. If it doesn’t, nothing changes."
          actionLabel="Install"
          busyLabel="Asking…"
          cancelLabel="Not now"
          onSubmit={() => stepUp(() => api.installApp(confirmInstall.app, confirmInstall.version), `install=${encodeURIComponent(`${confirmInstall.app}@${confirmInstall.version}`)}`)}
          onClose={() => setConfirmInstall(undefined)}
        >
          {confirmInstall.notes.length ? (
            <ul className="admin-notes">
              {confirmInstall.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          <p>You may be asked for your password again.</p>
        </Dialog>
      ) : null}
      {confirmRemove ? (
        <Dialog
          open
          size="glance"
          danger
          eyebrow={confirmRemove.name}
          heading="Remove it from the server?"
          summary="Its containers stop and are removed, so nobody can open it. Its data stays: install it again to get it back. Remove it from the catalogue too, to stop it being listed."
          actionLabel="Remove"
          busyLabel="Asking…"
          cancelLabel="Keep it"
          onSubmit={() => stepUp(() => api.uninstallApp(confirmRemove.app), `uninstall=${encodeURIComponent(confirmRemove.app)}`)}
          onClose={() => setConfirmRemove(undefined)}
        />
      ) : null}
    </>
  );

  return { installs, error, checking, check, ask, follow, people, loadPeople, setDevelopers, remove: setConfirmRemove, dialogs };
}

export type Installs = ReturnType<typeof useInstalls>;

const WAIT = 'Wait for the server to finish its current job with this app.';

/** For an app the app runner installed: how it takes new releases, a newer one waiting, what the runner is doing, and Remove. */
export function RunnerControls({ installed, ins }: { installed: InstalledApp; ins: Installs }) {
  const { loadPeople } = ins;
  useEffect(() => loadPeople(), [loadPeople]);
  const waiting = waitingWhy(installed);
  const open = jobOpen(installed.job);
  const update = installed.update;
  return (
    <div data-runner className="admin-stack-wide">
      <Select label="New releases" hint={ins.installs?.channelNote} options={channelChoices(ins.installs?.ring)} value={installed.channel} onChange={(v) => void ins.follow(installed, v as AppChannel, installed.policy)} />
      <Select label="When one is out" hint={policyHint(installed.policy)} options={POLICY_CHOICES} value={installed.policy} onChange={(v) => void ins.follow(installed, installed.channel, v as AppPolicy)} />
      {update && !open ? (
        <>
          <p className="admin-flat">
            Version {update.version} is out
            {waiting.length ? `, and waits for you: ${waiting.join(' ')}` : installed.policy === 'hold' ? ', but it’s held.' : '; it installs by itself shortly.'}{' '}
            {update.notesUrl ? (
              <a href={update.notesUrl} target="_blank" rel="noopener">
                What’s new
              </a>
            ) : null}
          </p>
          {installed.policy === 'automatic' && !waiting.length ? null : (
            <div>
              <Button kind="secondary" size="sm" onPress={() => ins.ask(installed.app, update.version)}>
                Install {update.version}
              </Button>
            </div>
          )}
        </>
      ) : null}
      {update?.changes?.length ? (
        <Section label={`What’s new in ${update.version}`} count={-1} limit={0}>
          <ChangeList changes={update.changes} shortParts={() => installed.name} />
        </Section>
      ) : null}
      {installed.job ? (
        <>
          <p className="admin-flat" data-job>
            {jobWords(installed.job)}
          </p>
          {open || installed.job.state === 'failed' ? <JobSteps job={installed.job} /> : null}
        </>
      ) : null}
      {installed.history?.length ? (
        <Section label="History" count={-1} limit={0}>
          <AppHistory history={installed.history} />
        </Section>
      ) : null}
      {installed.older?.length ? (
        <Section label="Go back" count={-1} limit={0}>
          <div data-app-go-back>
            {installed.older.map((o) => (
              <Line
                key={o.version}
                end={
                  <Button kind="tertiary" size="sm" disabled={open} reason={WAIT} onPress={() => ins.ask(installed.app, o.version)}>
                    Go back
                  </Button>
                }
              >
                {installed.name} {o.version}
              </Line>
            ))}
            <p className="admin-flat admin-muted">Going back holds the app on that version, so it isn’t updated again by itself. Its data stays as it is.</p>
          </div>
        </Section>
      ) : null}
      <div data-developers>
        <TagPicker
          label="Developers"
          hint="They can switch to a preview of any pull request that changes it, for themselves; previews run only while it has developers."
          placeholder="Type a name"
          max={50}
          options={(ins.people ?? []).map((p) => ({ value: p.id, label: fullName(p), detail: p.email, icon: 'account' as const }))}
          value={installed.developers ?? []}
          onChange={(ids) => void ins.setDevelopers(installed, ids)}
        />
      </div>
      {installed.previews?.length ? (
        <Section label="Previews running" count={-1} limit={0}>
          {installed.previews.map((p) => (
            <Line key={p.pr} end={`${p.version}, until ${new Date(p.endsAt).toLocaleDateString()}`}>
              {p.url ? (
                <a href={p.url} target="_blank" rel="noopener">
                  #{p.pr}
                </a>
              ) : (
                `#${p.pr}`
              )}{' '}
              {p.title ?? ''}
            </Line>
          ))}
        </Section>
      ) : null}
      <Problem>{ins.error}</Problem>
      <div>
        <Button kind="tertiary" size="sm" disabled={open} reason={WAIT} onPress={() => ins.remove(installed)}>
          Remove from the server
        </Button>
      </div>
    </div>
  );
}

/** What the app feed offers to install, what's waiting on an admin, and whether there's a runner to do it. */
export function InstallsSection({ ins }: { ins: Installs }) {
  const i = ins.installs;
  if (!i) return <Problem>{ins.error}</Problem>;
  const waiting = i.installed.filter((a) => waitingWhy(a).length);
  const busy = [...i.installed, ...i.available].filter((a) => jobOpen(a.job));
  const offered = i.available.filter((a) => !jobOpen(a.job));
  return (
    <div data-installs className="admin-stack-wide">
      {!i.runnerSeenAt ? (
        <Status status="warning" label="No app runner has asked for work since the registry started, so nothing below can be installed yet. It’s the updater with APP_SECRETS_KEY set: see docs/upgrade.md, The app runner." />
      ) : null}
      {i.problem ? <Status status="warning" label={`The app feed couldn’t be read: ${i.problem}`} /> : null}
      {busy.length ? (
        <Section label="Under way" limit={0}>
          {busy.map((a) => (
            <Line key={a.app} end={jobWords(a.job!)}>
              {a.name}
            </Line>
          ))}
        </Section>
      ) : null}
      {waiting.length ? (
        <Section label="Needs you" limit={0}>
          {waiting.map((a) => (
            <Line
              key={a.app}
              data-waiting=""
              end={
                <Button kind="secondary" size="sm" onPress={() => ins.ask(a.app, a.update!.version)}>
                  Install
                </Button>
              }
            >
              {a.name} {a.update!.version} <Quiet>· {waitingWhy(a).join(' ')}</Quiet>
            </Line>
          ))}
        </Section>
      ) : null}
      <Section label="Install from releases" count={-1} limit={0}>
        {i.feed === 'off' ? (
          <p className="admin-flat">This server doesn’t read app releases: APP_FEED_URL is off, or the release feed is a mirror.</p>
        ) : (
          <>
            <div data-available>
              {offered.length ? (
                offered.map((a) => (
                  <Line
                    key={`${a.app}@${a.version}`}
                    end={
                      <Button kind="secondary" size="sm" disabled={Boolean(a.problem)} reason={a.problem} onPress={() => ins.ask(a.app, a.version)}>
                        Install
                      </Button>
                    }
                  >
                    {a.name} {a.version}
                    {a.channel === 'beta' ? ' (preview)' : ''}
                    <Quiet>
                      {a.description ? ` · ${a.description}` : ''}
                      {a.job?.state === 'failed' ? ` · ${jobWords(a.job)}` : ''}
                    </Quiet>
                  </Line>
                ))
              ) : (
                <p className="admin-flat">
                  Nothing new to install.{i.checkedAt ? ` Checked ${new Date(i.checkedAt).toLocaleString()}.` : ''}
                </p>
              )}
            </div>
            <div>
              <Button kind="tertiary" size="sm" busy={ins.checking} onPress={() => void ins.check()}>
                Check for releases
              </Button>
            </div>
          </>
        )}
      </Section>
      <Problem>{ins.error}</Problem>
    </div>
  );
}
