import { Button, Dialog, Section, Status, TagPicker, TextField } from '@augur/app-kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fullName, type AdminApi, type AppInstalls, type InstalledApp, type PastedRelease, type Person } from './api.js';
import { scopeWords } from './apps-model.js';
import { JobSteps } from './changes.js';
import { asksWords, JOB_REFRESH_MS, jobOpen, jobWords } from './installs.js';
import { Line, Problem, Quiet } from './parts.js';

/** A release about to be installed, while the admin confirms: with what it asks, or why it waited. */
export type InstallAsk = { app: string; name: string; version: string; notes: string[]; release?: PastedRelease['release']; from?: string };

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
  /** Counts failed reads, so the wait for the next one starts again after one. */
  const [failedReads, setFailedReads] = useState(0);
  const [checking, setChecking] = useState(false);
  const [confirmInstall, setConfirmInstall] = useState<InstallAsk>();
  const [confirmRemove, setConfirmRemove] = useState<InstalledApp>();
  const [pasting, setPasting] = useState<string>();
  const [people, setPeople] = useState<Person[]>();
  const resumed = useRef(false);
  const latest = useRef(installs);
  latest.current = installs;

  const ask = useCallback((app: string, version: string, i = latest.current) => {
    const offered = i?.available.find((a) => a.app === app && a.version === version);
    if (offered)
      setConfirmInstall({ app, name: offered.name, version, notes: [...(offered.asks ? asksWords(offered.asks, scopeWords, offered.review, offered.signer) : []), ...(offered.problem ? [offered.problem] : [])] });
  }, []);

  /** Back from entering the password again (`?install=<app>@<version>` or `?uninstall=<app>`): ask once more. */
  const resume = useCallback(
    (i: AppInstalls) => {
      if (resumed.current) return;
      resumed.current = true;
      const params = new URLSearchParams(window.location.search);
      const install = params.get('install');
      const uninstall = params.get('uninstall');
      const paste = params.get('paste');
      if (!install && !uninstall && !paste) return;
      params.delete('install');
      params.delete('uninstall');
      params.delete('paste');
      const rest = params.toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
      const at = install?.lastIndexOf('@') ?? -1;
      if (install && at > 0) ask(install.slice(0, at), install.slice(at + 1), i);
      if (uninstall) setConfirmRemove(i.installed.find((x) => x.app === uninstall));
      if (paste) setPasting(paste);
    },
    [ask],
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
      setFailedReads((n) => n + 1);
    }
  }, [api, resume]);
  useEffect(() => void load(), [load]);

  const busy = Boolean(installs && [...installs.installed, ...installs.available].some((a) => jobOpen(a.job)));
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => void load().then(then), JOB_REFRESH_MS);
    return () => clearTimeout(timer);
  }, [busy, installs, failedReads, load, then]);

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

  /**
   * Reads a pasted release file's address and, when it can install, asks to confirm it with what it asks
   * for. Why it can't is the read dialog's error; the password asked again comes back here to read it again.
   */
  const readPasted = async (url: string) => {
    let read: PastedRelease;
    try {
      read = await api.readRelease(url);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'sign_in_again') {
        signInAgain(`paste=${encodeURIComponent(url)}`);
        return false as const;
      }
      throw err;
    }
    if (read.refusals.length) throw new Error(`It can’t install here: ${read.refusals.join(' ')}`);
    const { release } = read;
    const name = typeof release.manifest?.name === 'string' ? release.manifest.name : release.id;
    setPasting(undefined);
    setConfirmInstall({
      app: release.id,
      name,
      version: release.version,
      release,
      from: url,
      notes: [...(read.asks ? asksWords(read.asks, scopeWords, read.review, read.signer) : []), ...read.warnings, 'No feed lists it: later versions are installed the same way, from their address.'],
    });
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
          onSubmit={() =>
            confirmInstall.release
              ? stepUp(() => api.installRelease(confirmInstall.release!), `paste=${encodeURIComponent(confirmInstall.from ?? '')}`)
              : stepUp(() => api.installApp(confirmInstall.app, confirmInstall.version), `install=${encodeURIComponent(`${confirmInstall.app}@${confirmInstall.version}`)}`)
          }
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
      {pasting !== undefined ? (
        <Dialog
          open
          size="glance"
          eyebrow="Apps"
          heading="Install from a release file’s address"
          summary="For an app no feed lists: paste the address of its app-release.json. It is read over https and checked as the feed’s are, and you see what it asks for before anything is installed."
          actionLabel="Read it"
          busyLabel="Reading…"
          cancelLabel="Not now"
          onSubmit={(values) => readPasted((values.url ?? '').trim())}
          onClose={() => setPasting(undefined)}
          fields={<TextField name="url" label="Release file address" placeholder="https://github.com/owner/repo/releases/download/…/app-release.json" defaultValue={pasting} required />}
        />
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

  return { installs, error, checking, check, ask, paste: () => setPasting(''), people, loadPeople, setDevelopers, remove: setConfirmRemove, dialogs };
}

export type Installs = ReturnType<typeof useInstalls>;

const WAIT = 'Wait for the server to finish its current job with this app.';

/**
 * For an app the app runner installed: what the runner is doing, its developers and previews, and
 * Remove. How it takes new releases, a newer one waiting, its history and going back are in the
 * Upgrade Centre (ADR 0030), so Admin doesn't keep a second copy of them.
 */
export function RunnerControls({ installed, ins, openUpgrades, upgradesName }: { installed: InstalledApp; ins: Installs; openUpgrades: () => void; upgradesName: string }) {
  const { loadPeople } = ins;
  useEffect(() => loadPeople(), [loadPeople]);
  const open = jobOpen(installed.job);
  return (
    <div data-runner className="admin-stack-wide">
      <div data-moved className="admin-stack">
        <p className="admin-flat">
          {installed.update ? `Version ${installed.update.version} is out. ` : ''}New releases, installing one, going back and its history are in the {upgradesName}.
        </p>
        <div>
          <Button kind="secondary" size="sm" onPress={openUpgrades}>
            Open the {upgradesName}
          </Button>
        </div>
      </div>
      {installed.job ? (
        <>
          <p className="admin-flat" data-job>
            {jobWords(installed.job)}
          </p>
          {open || installed.job.state === 'failed' ? <JobSteps job={installed.job} /> : null}
        </>
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

/** What the app feed offers to install, what's under way, and whether there's a runner to do it. Updates waiting on an admin are in the Upgrade Centre's Needs you. */
export function InstallsSection({ ins }: { ins: Installs }) {
  const i = ins.installs;
  if (!i) return <Problem>{ins.error}</Problem>;
  const busy = [...i.installed, ...i.available].filter((a) => jobOpen(a.job));
  const offered = i.available.filter((a) => !jobOpen(a.job));
  return (
    <div data-installs className="admin-stack-wide">
      {!i.runnerSeenAt ? (
        <Status status="warning" label="No app runner has asked for work since the registry started, so nothing below can be installed yet. It’s the updater with APP_SECRETS_KEY set: see docs/upgrade.md, The app runner." />
      ) : null}
      {i.problem ? <Status status="warning" label={`Not every app release could be read. ${i.problem}`} /> : null}
      {busy.length ? (
        <Section label="Under way" limit={0}>
          {busy.map((a) => (
            <Line key={a.app} end={jobWords(a.job!)}>
              {a.name}
            </Line>
          ))}
        </Section>
      ) : null}
      <Section label="Install from releases" count={-1} limit={0}>
        {i.feed === 'off' ? (
          <p className="admin-flat">This server doesn’t read app releases: APP_FEEDS is off, or the release feed is a mirror and APP_FEEDS names none.</p>
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
              </Button>{' '}
              <Button kind="tertiary" size="sm" onPress={ins.paste}>
                Install from an address
              </Button>
            </div>
          </>
        )}
      </Section>
      <Problem>{ins.error}</Problem>
    </div>
  );
}
