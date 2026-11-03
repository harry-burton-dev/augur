import { Button, Details, Dialog, Heading, Rows, Select, Status, Table, TextField, Toggle, type Detail, type StatusName, type TableColumn, type TableRow } from '@augur/app-kit';
import { useCallback, useEffect, useState } from 'react';
import type { AdminApi, AllowedOrigin, AppSettingValue, AppVersion, CatalogueApp, FeaturePreviewMode, FeaturePreviews, FloorChoice, FloorRule, IssuedSignIn } from './api.js';
import { InstallsSection, RunnerControls, useInstalls, type Installs } from './app-runner.js';
import { appStatus, FLOOR_CHOICES, floorStatus, floorTree, NEWEST, rollbackNote, scopeWords, uploadChoices, type AppFloor } from './apps-model.js';
import { featureHint, featureModeChoices } from './installs.js';
import { day, Line, Page, Problem, Quiet, Secret } from './parts.js';

const columns: TableColumn[] = [
  { key: 'name', label: 'App', sortable: true },
  { key: 'version', label: 'Version', sortable: true },
  { key: 'route', label: 'Address', sortable: true },
  { key: 'state', label: 'Status', kind: 'status', sortable: true, format: (v, row) => <Status status={row.stateStatus as StatusName} label={String(v)} />, text: (v) => String(v) },
  { key: 'source', label: 'From', sortable: true },
];

/** Every app in the catalogue with its version, a switch to stop offering one, and its kept versions to go back to. */
export function Apps({ api }: { api: AdminApi }) {
  const [apps, setApps] = useState<CatalogueApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string>();
  const [originsOpen, setOriginsOpen] = useState(false);
  const [issuing, setIssuing] = useState<CatalogueApp>();
  const [issued, setIssued] = useState<IssuedSignIn & { name: string }>();

  const load = useCallback(
    async (showLoading = true) => {
      setLoading(showLoading);
      setError('');
      try {
        setApps(await api.apps());
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );
  useEffect(() => void load(), [load]);
  const quietly = useCallback(() => void load(false), [load]);
  const ins = useInstalls(api, quietly);
  const took = (updated: CatalogueApp) => setApps((all) => all.map((a) => (a.id === updated.id ? updated : a)));

  const rows: TableRow[] = apps.map((a) => {
    const s = appStatus(a);
    return { id: a.id, name: a.name, version: a.pinnedVersion ? `${a.version}, held` : a.version, route: a.route, state: s.label, stateStatus: s.status, source: a.platform || a.pillar ? 'AUGUR' : (a.registeredBy ?? '') };
  });
  const app = apps.find((a) => a.id === open);

  return (
    <Page
      heading="Apps"
      summary="Every app in the catalogue. Turn one off to stop offering it, or go back to an earlier version, without removing it. Install new apps from their releases below."
      actions={[{ id: 'origins', label: 'Where apps load from' }]}
      onAction={() => setOriginsOpen(true)}
    >
      <Table noun="apps" columns={columns} rows={rows} loading={loading} error={error} empty="No apps are registered." onOpen={(row) => setOpen(row.id)} onRetry={() => void load()} />
      <InstallsSection ins={ins} />
      {app ? <AppDetails key={app.id} api={api} app={app} ins={ins} took={took} onIssue={() => setIssuing(app)} onClose={() => setOpen(undefined)} /> : null}
      {originsOpen ? <Origins api={api} reload={() => load()} onClose={() => setOriginsOpen(false)} /> : null}
      {issuing ? (
        <Dialog
          open
          size="glance"
          danger
          eyebrow={issuing.name}
          heading="Issue a new sign-in?"
          summary="The app’s service signs in to AUGUR with a secret. A new one stops the old one working straight away, so the service can’t register, notify or write to the log until it’s given the new one."
          actionLabel="Issue a new sign-in"
          busyLabel="Issuing…"
          cancelLabel="Keep the old one"
          onSubmit={async () => setIssued({ ...(await api.issueSignIn(issuing.id)), name: issuing.name })}
          onClose={() => setIssuing(undefined)}
        />
      ) : null}
      {issued ? (
        <Dialog
          open
          size="glance"
          eyebrow="New sign-in"
          heading={`Give ${issued.name}’s service this secret`}
          summary={`Set it as SERVICE_CLIENT_SECRET where the service runs, then restart it. It signs in as ${issued.clientId}.`}
          cancelLabel="Done"
          onClose={() => setIssued(undefined)}
        >
          <Secret value={issued.secret} kind="secret" />
          <p>It won’t be shown again. If it’s lost, issue a new one.</p>
        </Dialog>
      ) : null}
      {ins.dialogs}
    </Page>
  );
}

/** One app opened: what it is, whether it's offered, its limits, settings and previews, where it's on, its versions and its runner. */
function AppDetails({ api, app, ins, took, onIssue, onClose }: { api: AdminApi; app: CatalogueApp; ins: Installs; took: (a: CatalogueApp) => void; onIssue: () => void; onClose: () => void }) {
  const [problem, setProblem] = useState('');
  const shipped = app.platform || app.pillar;
  const installed = ins.installs?.installed.find((i) => i.app === app.id);
  const s = appStatus(app);
  const facts: Detail[] = [
    { label: 'Version', value: app.pinnedVersion ? `${app.version}, held` : app.version },
    { label: 'AUGUR SDK', value: app.sdk },
    { label: 'Address', value: app.route },
    ...(app.entry.startsWith('/') && !app.entry.startsWith('//') ? [] : [{ label: 'Loads from', value: app.entry }]),
    ...(app.requiredRole ? [{ label: 'Only for', value: app.requiredRole }] : []),
    ...(app.platform ? [] : [{ label: 'May', value: scopeWords(app.grantedScopes ?? app.scopes) }]),
  ];
  const act = async (call: () => Promise<CatalogueApp>) => {
    setProblem('');
    try {
      took(await call());
    } catch (err) {
      setProblem((err as Error).message);
    }
  };
  return (
    <Dialog
      open
      light
      size="read"
      eyebrow={app.platform ? 'Part of AUGUR' : app.pillar ? 'Ships with AUGUR' : `Registered by ${app.registeredBy ?? 'its service'}`}
      heading={app.name}
      summary={app.description ?? ''}
      cancelLabel="Close"
      onClose={onClose}
    >
      <Details items={facts} limit={0} />
      {app.platform ? (
        <p>Built-in apps are always on.</p>
      ) : (
        <Toggle label="Offered to people" hint={s.why ?? 'Everyone it’s meant for sees it in Apps and Title.'} checked={app.enabled} onChange={async (enabled) => took(await api.setAppEnabled(app.id, enabled))} />
      )}
      {app.awaitingScopes?.length ? (
        <>
          <p>
            Version {app.version} also asks to: {scopeWords(app.awaitingScopes)}. It runs without that until you allow it.
          </p>
          <div>
            <Button kind="secondary" size="sm" onPress={() => void act(() => api.grantScopes(app.id, [...(app.grantedScopes ?? []), ...(app.awaitingScopes ?? [])]))}>
              Allow it
            </Button>
          </div>
        </>
      ) : null}
      {app.platform ? null : (
        <div data-upload-limit>
          <Select
            label="Largest upload"
            hint="What one request to its service may carry. You can lower what it asks for, not raise it."
            options={uploadChoices(app)}
            value={app.uploadLimitLowered ? String(app.uploadLimit) : 'asked'}
            onChange={(v) => void act(() => api.limitUploads(app.id, v === 'asked' ? null : Number(v)))}
          />
        </div>
      )}
      <Problem>{problem}</Problem>
      {app.platform ? null : <AppSettings api={api} app={app} />}
      {app.platform ? null : <FeaturePreviewsPart api={api} app={app} />}
      {app.platform ? null : <Floors api={api} app={app} />}
      {app.handles?.length ? <p>Answers {app.handles.join(', ')}.</p> : null}
      {app.pillar ? <p data-pillar>It ships with AUGUR and changes version with it. Turn it off here or floor by floor; it can’t be removed, and its sign-in is in the server’s settings.</p> : null}
      {shipped ? null : <Versions api={api} app={app} took={took} />}
      {shipped ? null : (
        <div>
          <Button kind="tertiary" size="sm" onPress={onIssue}>
            Issue a new sign-in
          </Button>
        </div>
      )}
      {!shipped && installed ? <RunnerControls installed={installed} ins={ins} /> : null}
      {app.updatedAt ? (
        <p>
          Registered {day(app.registeredAt)}, last updated {day(app.updatedAt)}.
        </p>
      ) : null}
    </Dialog>
  );
}

/** Loads something about the open app once, with its error. */
function useLoaded<T>(load: () => Promise<T>, when = true) {
  const [value, setValue] = useState<T>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!when) return;
    let live = true;
    load().then(
      (v) => live && setValue(v),
      (err: Error) => live && setError(err.message),
    );
    return () => {
      live = false;
    };
    // the app is fixed for the dialog's life (it's keyed by the app's id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { value, setValue, error, setError };
}

/** The settings the app offers, each a whole number to type, saved when the field is left. */
function AppSettings({ api, app }: { api: AdminApi; app: CatalogueApp }) {
  const { value: values, setValue, error, setError } = useLoaded<AppSettingValue[]>(() => api.appSettings(app.id), Boolean(app.settings?.length));
  if (!app.settings?.length) return null;
  const save = async (setting: AppSettingValue, typed: string) => {
    setError('');
    const value = typed.trim() === '' ? null : Number(typed);
    if (value !== null && (!Number.isInteger(value) || value < setting.min || value > setting.max)) {
      setError(`${setting.label} is a whole number from ${setting.min} to ${setting.max}${setting.unit ? ` ${setting.unit}` : ''}.`);
      return;
    }
    if (value === setting.value) return;
    try {
      setValue(await api.setAppSetting(app.id, setting.id, value));
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <div data-settings className="admin-stack-wide">
      {values ? (
        values.map((s) => (
          <div key={`${s.id}:${s.value}`} data-setting={s.id}>
            <TextField
              label={s.unit ? `${s.label} (${s.unit})` : s.label}
              hint={[s.detail, `${s.min} to ${s.max}; ${s.default} unless you change it.`].filter(Boolean).join(' ')}
              defaultValue={String(s.value)}
              onCommit={(v) => void save(s, v)}
            />
          </div>
        ))
      ) : error ? null : (
        <p>Loading its settings…</p>
      )}
      <Problem>{error}</Problem>
    </div>
  );
}

/** The features the app is trying, each with who gets it (SDK 1.7). */
function FeaturePreviewsPart({ api, app }: { api: AdminApi; app: CatalogueApp }) {
  const { value: features, setValue, error, setError } = useLoaded<FeaturePreviews>(() => api.featurePreviews(app.id), Boolean(app.previews?.length));
  if (!app.previews?.length) return null;
  const set = async (preview: string, value: string) => {
    setError('');
    try {
      setValue(await api.setFeaturePreview(app.id, preview, value === 'default' ? null : (value as FeaturePreviewMode)));
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <section data-feature-previews className="admin-stack-wide">
      <Heading heading="Feature previews" summary="Features it’s trying before they’re everyone’s. People turn the opt-in ones on for themselves in the shell’s Previews." size="s" />
      {features ? (
        features.previews.map((p) => (
          <div key={p.id} data-feature-preview={p.id}>
            <Select label={p.name} hint={featureHint(p)} options={featureModeChoices(p, features.defaultMode)} value={p.chosen ? p.mode : 'default'} onChange={(v) => void set(p.id, v)} />
          </div>
        ))
      ) : error ? null : (
        <p>Loading its previews…</p>
      )}
      <Problem>{error}</Problem>
    </section>
  );
}

/** Where the app is on, floor by floor, and a choice for each. */
function Floors({ api, app }: { api: AdminApi; app: CatalogueApp }) {
  const { value, setValue, error, setError } = useLoaded<{ rules: FloorRule[]; list: AppFloor[] }>(async () => {
    const [rules, org, departments] = await Promise.all([api.appFloors(app.id), api.org(), api.departments()]);
    return { rules, list: floorTree(org, departments) };
  });
  if (error && !value) return <Problem>{error}</Problem>;
  if (!value) return <Rows loading count={3} />;
  const names = new Map(value.list.map((f) => [f.id, f.name]));
  const set = async (floor: AppFloor, state: FloorChoice) => {
    setError('');
    try {
      const { rules } = await api.setAppFloor(app.id, floor.id, state);
      setValue({ ...value, rules });
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <div data-floors className="admin-stack">
      <p>Where it’s on. Everyone’s own floor follows the org.</p>
      <Problem>{error}</Problem>
      {value.list.map((floor) => (
        <div key={floor.id} data-floor={floor.id} className="admin-floor" style={{ marginInlineStart: `calc(var(--space-4) * ${floor.path.length - 1})` }}>
          <Select label={floor.name} hint={floorStatus(app, floor, value.rules, names).words} options={FLOOR_CHOICES} value={value.rules.find((r) => r.workspace === floor.id)?.state ?? 'inherit'} onChange={(v) => void set(floor, v as FloorChoice)} />
        </div>
      ))}
    </div>
  );
}

/** The versions kept for an app, and which one the shell is given. */
function Versions({ api, app, took }: { api: AdminApi; app: CatalogueApp; took: (a: CatalogueApp) => void }) {
  const { value: versions, setValue, error } = useLoaded<AppVersion[]>(() => api.appVersions(app.id));
  const [choice, setChoice] = useState(app.pinnedVersion ?? NEWEST);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  if (error) return <Problem>{error}</Problem>;
  const current = app.pinnedVersion ?? NEWEST;
  const note = rollbackNote(app, versions?.find((v) => v.version === choice));
  const use = async () => {
    setSaving(true);
    setSaveError('');
    try {
      took(await api.pinApp(app.id, choice === NEWEST ? null : choice));
      setValue(await api.appVersions(app.id));
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div data-versions className="admin-stack">
      <Rows
        loading={!versions}
        count={2}
        empty="No versions are kept yet."
        items={(versions ?? []).map((v) => ({ label: `Version ${v.version}`, value: `${day(v.registeredAt)}${v.serving ? ' · in use' : ''}${v.version === app.pinnedVersion ? ', held' : ''}` }))}
      />
      <Select
        label="Give the shell"
        hint={app.pinnedVersion ? `Held at ${app.pinnedVersion}: new versions are kept but not used.` : 'Each new version is used as soon as it registers.'}
        options={[{ value: NEWEST, label: 'The newest, as it registers' }, ...(versions ?? []).map((v) => ({ value: v.version, label: `Version ${v.version}, and hold it` }))]}
        value={choice}
        disabled={!versions}
        reason="Wait for its versions to load."
        onChange={setChoice}
      />
      {note ? <p>{note}</p> : null}
      <Problem>{saveError}</Problem>
      <div>
        <Button kind="secondary" size="sm" disabled={choice === current} reason="That’s what it uses now. Choose another version first." busy={saving} onPress={() => void use()}>
          {choice === NEWEST ? 'Follow new versions' : `Use version ${choice}`}
        </Button>
      </div>
    </div>
  );
}

/** Sites apps may load from besides the platform itself: allow one, and remove one. */
function Origins({ api, reload, onClose }: { api: AdminApi; reload: () => Promise<void>; onClose: () => void }) {
  const { value: origins, setValue, error, setError } = useLoaded<AllowedOrigin[]>(() => api.origins());
  const [working, setWorking] = useState(false);
  const [round, setRound] = useState(0);
  const remove = async (origin: string) => {
    setWorking(true);
    setError('');
    try {
      await api.removeOrigin(origin);
      setValue((origins ?? []).filter((o) => o.origin !== origin));
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setWorking(false);
    }
  };
  return (
    <Dialog
      open
      size="glance"
      eyebrow="Apps"
      heading="Where apps load from"
      summary="Apps on AUGUR’s own address can always load. An app whose entry is on another site can only register, and only open, if that site is here."
      actionLabel="Allow"
      busyLabel="Allowing…"
      cancelLabel="Done"
      onSubmit={async (values) => {
        const added = await api.allowOrigin((values.origin ?? '').trim());
        setValue([...(origins ?? []).filter((o) => o.origin !== added.origin), added]);
        // the field starts empty for the next one
        setRound((n) => n + 1);
        // An app registered from it before is offered again.
        await reload();
        return false as const;
      }}
      onClose={onClose}
      fields={<TextField key={round} name="origin" label="Allow a site" placeholder="https://apps.example.org" required />}
    >
      <div data-origins className="admin-stack">
        <Problem>{error}</Problem>
        {!origins ? (
          error ? null : (
            <Rows loading count={2} />
          )
        ) : origins.length ? (
          origins.map((o) => (
            <Line
              key={o.origin}
              end={
                <Button kind="tertiary" size="sm" busy={working} onPress={() => void remove(o.origin)}>
                  Remove
                </Button>
              }
            >
              {o.origin} <Quiet>since {day(o.addedAt)}</Quiet>
            </Line>
          ))
        ) : (
          <p>No other sites yet, so apps can only load from AUGUR’s own address.</p>
        )}
      </div>
      <p>The server must allow a site too, so the browser will run its code; see Deploy in AUGUR’s guides.</p>
    </Dialog>
  );
}

