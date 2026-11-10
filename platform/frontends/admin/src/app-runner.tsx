import { Button, Dialog, Heading, Section, TagPicker } from '@augur/app-kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fullName, type AdminApi, type AppInstalls, type InstalledApp, type Person } from './api.js';
import { SettingFields } from './app-settings.js';
import { fieldName, settingChanges } from './settings-form.js';
import { JobSteps } from './changes.js';
import { JOB_REFRESH_MS, jobOpen, jobWords } from './installs.js';
import { Line, Problem, Quiet } from './parts.js';

/** Where the password is entered again before anything is installed or removed; back here after. */
const signInAgain = (query = '') => {
  const back = `${window.location.pathname}${query ? `?${query}` : ''}`;
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
  const [confirmRemove, setConfirmRemove] = useState<InstalledApp>();
  const [confirmInternet, setConfirmInternet] = useState<InstalledApp>();
  const [people, setPeople] = useState<Person[]>();
  const resumed = useRef(false);

  /** Back from entering the password again (`?uninstall=<app>` or `?internet=<app>`): ask once more. */
  const resume = useCallback(
    (i: AppInstalls) => {
      if (resumed.current) return;
      resumed.current = true;
      const params = new URLSearchParams(window.location.search);
      const uninstall = params.get('uninstall');
      const internet = params.get('internet');
      if (!uninstall && !internet) return;
      params.delete('uninstall');
      params.delete('internet');
      const rest = params.toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
      if (uninstall) setConfirmRemove(i.installed.find((x) => x.app === uninstall));
      if (internet) setConfirmInternet(i.installed.find((x) => x.app === internet && x.internet));
    },
    [],
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

  /** Saves one setting as soon as it changes, if it differs from what it is; a secret may ask for the password again first. */
  const saveSetting = async (app: InstalledApp, id: string, raw: string) => {
    const [change] = settingChanges((app.settings ?? []).filter((x) => x.id === id), { [fieldName(id)]: raw });
    if (!change) return;
    setError('');
    try {
      setInstalls(await api.setRunnerSetting(app.app, change.id, change.value));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'sign_in_again') return signInAgain();
      setError((err as Error).message);
    }
  };

  const dialogs = (
    <>
      {confirmInternet?.internet ? (
        <Dialog
          open
          size="glance"
          eyebrow={confirmInternet.name}
          heading={confirmInternet.internet.allowed ? `Take the internet from ${confirmInternet.name}?` : `Let ${confirmInternet.name} reach the internet?`}
          summary={
            confirmInternet.internet.allowed
              ? 'Its parts that ask for it lose it within a minute, without restarting. What they fetch from outside stops.'
              : `Its parts that ask for it can reach any host on the internet within a minute, without restarting; its previews never can. ${internetWords(confirmInternet.internet)}`
          }
          actionLabel={confirmInternet.internet.allowed ? 'Turn it off' : 'Allow it'}
          danger={!confirmInternet.internet.allowed}
          busyLabel="Asking…"
          cancelLabel="Not now"
          onSubmit={() => stepUp(() => api.setInternet(confirmInternet.app, !confirmInternet.internet!.allowed), `internet=${encodeURIComponent(confirmInternet.app)}`)}
          onClose={() => setConfirmInternet(undefined)}
        />
      ) : null}
      {confirmRemove ? (
        <Dialog
          open
          size="glance"
          danger
          eyebrow={confirmRemove.name}
          heading="Remove it from the server?"
          summary={`Its containers stop and are removed and its sign-in is taken away, so nobody can open it. Its data, settings and floors are kept ${installs?.dataGraceDays ? `for ${installs.dataGraceDays} days` : 'for a while'}: install it again before then to get them back. After that they are deleted, a backup taken first.`}
          actionLabel="Remove"
          busyLabel="Asking…"
          cancelLabel="Keep it"
          onSubmit={() => stepUp(() => api.uninstallApp(confirmRemove.app), `uninstall=${encodeURIComponent(confirmRemove.app)}`)}
          onClose={() => setConfirmRemove(undefined)}
        />
      ) : null}
    </>
  );

  return { installs, error, people, loadPeople, setDevelopers, remove: setConfirmRemove, internet: setConfirmInternet, saveSetting, dialogs };
}

export type Installs = ReturnType<typeof useInstalls>;

const WAIT = 'Wait for the server to finish its current job with this app.';

/** What an app says it fetches from the internet, and from where. */
const internetWords = (i: NonNullable<InstalledApp['internet']>) =>
  `${i.why.length ? i.why.join('; ') : 'it doesn’t say what for'}${i.hosts.length ? ` (it names ${i.hosts.join(', ')})` : ''}.`;

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
          <Button kind="secondary" size="sm" onPress={() => openUpgrades()}>
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
      {installed.internet ? (
        <div data-internet className="admin-stack">
          <p className="admin-flat">
            {installed.internet.allowed
              ? `Reaches the internet, allowed${installed.internet.allowedAt ? ` on ${new Date(installed.internet.allowedAt).toLocaleDateString()}` : ''}: ${internetWords(installed.internet)}`
              : `Asks to reach the internet, which is off until a deployment admin allows it: ${internetWords(installed.internet)}`}
          </p>
          <div>
            <Button kind="tertiary" size="sm" disabled={open} reason={WAIT} onPress={() => ins.internet(installed)}>
              {installed.internet.allowed ? 'Take the internet away' : 'Allow the internet'}
            </Button>
          </div>
        </div>
      ) : null}
      {installed.settings?.length ? (
        <div data-settings className="admin-stack">
          <Heading heading="Its settings" summary="Each is saved as soon as you change it. The parts that read it start again with it within a minute; a secret is never shown again once given." size="s" />
          <SettingFields settings={installed.settings} onSave={(id, raw) => void ins.saveSetting(installed, id, raw)} disabled={open} reason={WAIT} />
        </div>
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
      {installed.default ? (
        <div data-default>
          <Quiet>A default app of this deployment (DEFAULT_APPS): what it asks for was agreed by the deployment, apart from the internet, which a deployment admin allows.</Quiet>
        </div>
      ) : null}
      <div>
        <Button
          kind="tertiary"
          size="sm"
          disabled={open || installed.default}
          reason={installed.default ? 'It’s one of this deployment’s default apps: take it out of DEFAULT_APPS in .env and run pc up -d first' : WAIT}
          onPress={() => ins.remove(installed)}
        >
          Remove from the server
        </Button>
      </div>
    </div>
  );
}
