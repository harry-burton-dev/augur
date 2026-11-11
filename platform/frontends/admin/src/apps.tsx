import { AskTwice, Button, Details, Dialog, Heading, Rows, Select, Status, Table, TagPicker, TextField, type Detail, type StatusName, type TableColumn, type TableRow } from '@augur/app-kit';
import { useCallback, useEffect, useState } from 'react';
import type { AdminApi, AppSettingValue, CatalogueApp, FeaturePreviewMode, FeaturePreviews, FloorChoice, FloorRule } from './api.js';
import { appEyebrow, appStatus, FLOOR_CHOICES, floorStatus, floorTree, inboxWords, kindWords, refusedKindNote, scopeWords, shipsWithAugur, uploadChoices, type AppFloor } from './apps-model.js';
import { featureHint, featureModeChoices } from './installs.js';
import { day, Page, Problem } from './parts.js';

const columns: TableColumn[] = [
  { key: 'name', label: 'App', sortable: true },
  { key: 'version', label: 'Version', sortable: true },
  { key: 'route', label: 'Address', sortable: true },
  { key: 'state', label: 'Status', kind: 'status', sortable: true, format: (v, row) => <Status status={row.stateStatus as StatusName} label={String(v)} />, text: (v) => String(v) },
  { key: 'kind', label: 'Kind', sortable: true },
  { key: 'source', label: 'From', sortable: true },
];

/** Every app in the catalogue with its version and a switch to stop offering one; its versions and server are in Deployment. */
export function Apps({ api, openUpgrades, upgradesName }: { api: AdminApi; openUpgrades: (to?: string) => void; upgradesName: string }) {
  const [apps, setApps] = useState<CatalogueApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string>();

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
  const took = (updated: CatalogueApp) => setApps((all) => all.map((a) => (a.id === updated.id ? updated : a)));

  const rows: TableRow[] = apps.map((a) => {
    const s = appStatus(a);
    return { id: a.id, name: a.name, version: a.pinnedVersion ? `${a.version}, held` : a.version, route: a.route, state: s.label, stateStatus: s.status, kind: kindWords(a).label, source: a.platform || shipsWithAugur(a) ? 'AUGUR' : (a.registeredBy ?? '') };
  });
  const app = apps.find((a) => a.id === open);

  return (
    <Page
      heading="Apps"
      summary={`Every app in the catalogue. Turn one off to stop offering it, without removing it. Installing, rolling back and what the server runs for each app are in ${upgradesName}, Apps.`}
    >
      <Table noun="apps" columns={columns} rows={rows} loading={loading} error={error} empty="No apps are registered." onOpen={(row) => setOpen(row.id)} onRetry={() => void load()} />
      <div data-installs>
        <Button kind="secondary" size="sm" onPress={() => openUpgrades('/apps')}>
          {`Install apps in ${upgradesName}`}
        </Button>
      </div>
      {app ? <AppDetails key={app.id} api={api} app={app} openUpgrades={openUpgrades} upgradesName={upgradesName} took={took} onClose={() => setOpen(undefined)} /> : null}
    </Page>
  );
}

/** One app opened: what it is, whether it's offered, its limits, settings and previews, and where it's on. */
function AppDetails({ api, app, openUpgrades, upgradesName, took, onClose }: { api: AdminApi; app: CatalogueApp; openUpgrades: (to?: string) => void; upgradesName: string; took: (a: CatalogueApp) => void; onClose: () => void }) {
  const [problem, setProblem] = useState('');
  const ships = shipsWithAugur(app);
  const shipped = app.platform || ships;
  const refused = refusedKindNote(app);
  const s = appStatus(app);
  const inbox = inboxWords(app);
  const facts: Detail[] = [
    { label: 'Kind', value: kindWords(app).fact },
    { label: 'Version', value: app.pinnedVersion ? `${app.version}, held` : app.version },
    { label: 'AUGUR SDK', value: app.sdk },
    { label: 'Address', value: app.route },
    ...(app.entry.startsWith('/') && !app.entry.startsWith('//') ? [] : [{ label: 'Loads from', value: app.entry }]),
    ...(app.requiredRole ? [{ label: 'Only for', value: app.requiredRole }] : []),
    ...(app.platform ? [] : [{ label: 'May', value: scopeWords(app.grantedScopes ?? app.scopes) }]),
    ...(inbox ? [{ label: 'Inbox work', value: inbox }] : []),
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
      eyebrow={appEyebrow(app)}
      heading={app.name}
      summary={app.description ?? ''}
      cancelLabel="Close"
      onClose={onClose}
    >
      <Details items={facts} limit={0} />
      {refused ? <p data-kind-refused>{refused}</p> : null}
      {app.platform ? (
        <p>Built-in apps are always on.</p>
      ) : (
        <div className="admin-live-actions" data-offered>
          <p className="admin-muted">{app.enabled ? (s.why ?? 'Offered to people: everyone it’s meant for sees it in Apps and Title.') : 'Turned off: nobody is offered it. Nothing of its data is removed.'}</p>
          {app.enabled ? (
            <AskTwice size="sm" confirm="Press again: nobody is offered it from now" busyLabel="Turning off…" onPress={() => act(() => api.setAppEnabled(app.id, false))}>
              Turn it off
            </AskTwice>
          ) : (
            <Button kind="secondary" size="sm" busyLabel="Turning on…" onPress={() => act(() => api.setAppEnabled(app.id, true))}>
              Offer it to people
            </Button>
          )}
        </div>
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
      {ships ? <p data-pillar>It ships with AUGUR and changes version with it. Turn it off here or floor by floor; it can’t be removed, and its sign-in is in the server’s settings.</p> : null}
      {shipped ? null : (
        <div data-moved className="admin-stack">
          <p className="admin-flat">Its versions, rolling it back, its sign-in, its internet, settings on the server, developers and removing it are in {upgradesName}.</p>
          <div>
            <Button kind="secondary" size="sm" onPress={() => openUpgrades(`/apps/${encodeURIComponent(app.id)}`)}>
              Open it in {upgradesName}
            </Button>
          </div>
        </div>
      )}
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

/** The features the app is trying, each with who gets it (SDK 1.7), down to chosen floors (ADR 0021, amended). */
function FeaturePreviewsPart({ api, app }: { api: AdminApi; app: CatalogueApp }) {
  const { value: features, setValue, error, setError } = useLoaded<FeaturePreviews>(() => api.featurePreviews(app.id), Boolean(app.previews?.length));
  // The floors to choose from, fetched only once someone targets floors.
  const [floors, setFloors] = useState<AppFloor[] | undefined>();
  // A preview being moved onto floors: nothing is saved until at least one floor is chosen.
  const [picking, setPicking] = useState<string | undefined>();
  const wantsFloors = Boolean(picking || features?.previews.some((p) => p.mode === 'floors'));
  useEffect(() => {
    if (!wantsFloors || floors) return;
    Promise.all([api.org(), api.departments()])
      .then(([org, departments]) => setFloors(floorTree(org, departments)))
      .catch((err: Error) => setError(`The floors can’t be listed: ${err.message}`));
  }, [api, wantsFloors, floors, setError]);
  if (!app.previews?.length) return null;
  const save = async (preview: string, mode: FeaturePreviewMode | null, chosen?: string[]) => {
    setError('');
    try {
      setValue(await api.setFeaturePreview(app.id, preview, mode, chosen));
      setPicking(undefined);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const set = (preview: string, value: string) => {
    if (value === 'floors') {
      setError('');
      setPicking(preview);
      return;
    }
    if (picking === preview) setPicking(undefined);
    void save(preview, value === 'default' ? null : (value as FeaturePreviewMode));
  };
  const names = new Map((floors ?? []).map((f) => [f.id, f.name]));
  const floorName = (id: string) => names.get(id) ?? 'a floor that’s gone';
  return (
    <section data-feature-previews className="admin-stack-wide">
      <Heading heading="Feature previews" summary="Features it’s trying before they’re everyone’s. Turn one on for chosen floors to try it there first; people turn the opt-in ones on for themselves in the shell’s Previews." size="s" />
      {features ? (
        features.previews.map((p) => {
          const onFloors = picking === p.id || (p.chosen && p.mode === 'floors');
          return (
            <div key={p.id} data-feature-preview={p.id} className="admin-stack">
              <Select label={p.name} hint={featureHint(p, floorName)} options={featureModeChoices(p, features.defaultMode)} value={picking === p.id ? 'floors' : p.chosen ? p.mode : 'default'} onChange={(v) => set(p.id, v)} />
              {onFloors ? (
                <div data-preview-floors={p.id}>
                  <TagPicker
                    label="On for these floors"
                    hint={picking === p.id ? 'Choose at least one: it’s saved once you do. The floors beneath each have it too.' : 'The floors beneath each have it too. To turn it off everywhere, choose Off above.'}
                    placeholder={floors ? 'Type a floor’s name' : 'Listing the floors…'}
                    disabled={!floors}
                    reason={floors ? undefined : 'The floors are still being listed.'}
                    options={(floors ?? []).map((f) => ({ value: f.id, label: f.name, detail: f.path.length > 2 ? f.path.slice(1, -1).map(floorName).join(' › ') : undefined }))}
                    value={picking === p.id ? [] : (p.floors ?? [])}
                    onChange={(ids) => {
                      if (ids.length) void save(p.id, 'floors', ids);
                      else setError(`${p.name} needs at least one floor. To turn it off everywhere, choose Off.`);
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        })
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


