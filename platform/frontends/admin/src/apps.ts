import { LitElement, html, nothing } from 'lit';
import semver from 'semver';
import { SDK_VERSION } from '@augur/mfe-sdk';
import type { DialogSubmit, Fact, Row, SelectOption, StatusName, TableColumn, TableRow } from '@augur/ui-kit';
import { ApiError, fullName, type AdminApi, type AllowedOrigin, type AppChannel, type AppInstalls, type AppPolicy, type AppSettingValue, type AppVersion, type CatalogueApp, type Department, type FeaturePreviewMode, type FeaturePreviews, type FloorChoice, type FloorRule, type InstalledApp, type IssuedSignIn, type Person } from './api.js';
import { asksWords, channelChoices, featureHint, featureModeChoices, JOB_REFRESH_MS, jobOpen, jobSteps, jobWords, POLICY_CHOICES, policyHint, waitingWhy } from './installs.js';
import { appHistoryList, changeList } from './changes.js';
import { line, page, section } from './parts.js';

/** Where an app stands: off, on, or on but unable to open in this platform. */
export const appStatus = (app: CatalogueApp, sdkVersion = SDK_VERSION): { status: StatusName; label: string; why?: string } => {
  if (!app.enabled) return { status: 'paused', label: 'Off', why: 'Nobody is offered it until it’s turned on.' };
  if (app.blocked) return { status: 'warning', label: 'Blocked', why: app.blocked };
  const range = semver.validRange(app.sdk);
  if (!range || !semver.satisfies(sdkVersion, range, { includePrerelease: true })) {
    return { status: 'warning', label: 'Won’t open', why: `It works with platform SDK ${app.sdk}; this platform has ${sdkVersion}.` };
  }
  return { status: 'done', label: 'On' };
};

/** "Follow new versions" in the version picker. */
const NEWEST = '';

/** Why rolling back might not be all it seems: the manifest changes, the code at the entry address may not. */
export const rollbackNote = (current: CatalogueApp, target?: AppVersion): string =>
  target && target.version !== current.version && target.entry.entry === current.entry
    ? `Version ${target.version} loads from the same address as ${current.version}, so the shell gets that version’s menu and settings but runs whatever code is there now. Redeploy that version’s service to run its code too.`
    : '';

/** What each scope lets an app's service do, in words. */
export const SCOPE_WORDS: Record<string, string> = {
  'notifications:send': 'Notify people',
  'audit:write': 'Write to the activity log',
  'models:use': 'Use AI models',
  'events:publish': 'Tell other services what happened',
  'events:subscribe': 'Hear what other services did',
  'people:read': 'Look up people and teams',
};

/** What an app may do on the platform, as a fact's value. */
export const scopeWords = (scopes: string[] | undefined) =>
  scopes?.length ? scopes.map((s) => SCOPE_WORDS[s] ?? s).join(', ') : 'Nothing beyond registering itself';

/** A floor an app can be set on, in tree order: the org first, then each team below the one it sits in. */
export interface AppFloor {
  id: string;
  name: string;
  /** Ids from the org down to this floor, itself included. */
  path: string[];
}

/** The org and its teams as floors, parents before children. */
export const floorTree = (org: { id: string; name: string }, departments: Department[]): AppFloor[] => {
  const out: AppFloor[] = [{ id: org.id, name: org.name, path: [org.id] }];
  const walk = (parent: string | undefined, path: string[]) => {
    for (const d of departments.filter((x) => x.parentId === parent).sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ id: d.id, name: d.name, path: [...path, d.id] });
      walk(d.id, [...path, d.id]);
    }
  };
  walk(undefined, [org.id]);
  return out;
};

/**
 * Whether an app is on for a floor, in words, the way the registry decides
 * it: off everywhere while it's turned off, a block on the floor or above
 * wins, then the nearest rule from the floor upwards that carries on, and on
 * with no rule at all.
 */
export const floorStatus = (app: CatalogueApp, floor: AppFloor, rules: FloorRule[], names: Map<string, string>): { on: boolean; words: string } => {
  if (!app.enabled) return { on: false, words: 'Off: the app is turned off' };
  const kind = floor.path.length === 1 ? 'org' : 'team';
  if (app.floors && !app.floors.includes(kind)) return { on: false, words: `Off: it doesn’t work on ${kind === 'org' ? 'the org' : 'teams'}` };
  const block = rules.find((r) => r.state === 'blocked' && floor.path.includes(r.workspace));
  if (block) return { on: false, words: block.workspace === floor.id ? 'Blocked here and below' : `Off: blocked by ${names.get(block.workspace) ?? 'a floor above'}` };
  for (let i = floor.path.length - 1; i >= 0; i--) {
    const here = i === floor.path.length - 1;
    const rule = rules.find((r) => r.workspace === floor.path[i] && r.state !== 'blocked' && (here || r.carriesOn));
    if (rule) return { on: rule.state === 'on', words: `${rule.state === 'on' ? 'On' : 'Off'}${here ? '' : `, as ${names.get(rule.workspace) ?? 'the floor above'}`}` };
  }
  return { on: true, words: 'On' };
};

/** What an admin can lower an app's upload limit to: what it asks, or any of these below that. */
const UPLOAD_STEPS = [500, 200, 100, 50, 25, 10, 5, 1];
const DEFAULT_UPLOAD_MB = 10;

/** The choices for an app's upload limit, its own first. */
export const uploadChoices = (app: Pick<CatalogueApp, 'maxUpload' | 'uploadLimit' | 'uploadLimitLowered'>): SelectOption[] => {
  const asked = app.maxUpload ?? DEFAULT_UPLOAD_MB;
  // A limit set another way than this list still shows as chosen.
  const steps = new Set(UPLOAD_STEPS.filter((mb) => mb < asked));
  if (app.uploadLimitLowered && app.uploadLimit) steps.add(app.uploadLimit);
  return [{ value: 'asked', label: `${asked} MB, as it asks` }, ...[...steps].sort((a, b) => b - a).map((mb) => ({ value: String(mb), label: `${mb} MB` }))];
};

const FLOOR_CHOICES: SelectOption[] = [
  { value: 'inherit', label: 'As the floor above' },
  { value: 'on', label: 'On here and below' },
  { value: 'off', label: 'Off here and below' },
  { value: 'blocked', label: 'Blocked here and below', detail: 'No team below can turn it on' },
];

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Every app in the catalogue with its version, a switch to stop offering one, and its kept versions to go back to. */
export class AdminApps extends LitElement {
  static override properties = {
    api: { attribute: false },
    apps: { state: true },
    loading: { state: true },
    error: { state: true },
    open: { state: true },
    versions: { state: true },
    versionsError: { state: true },
    choice: { state: true },
    saving: { state: true },
    saveError: { state: true },
    origins: { state: true },
    originsOpen: { state: true },
    originsError: { state: true },
    working: { state: true },
    issuing: { state: true },
    issued: { state: true },
    floorRules: { state: true },
    floorList: { state: true },
    floorsError: { state: true },
    settingValues: { state: true },
    settingsError: { state: true },
    features: { state: true },
    featuresError: { state: true },
    installs: { state: true },
    installsError: { state: true },
    checkingInstalls: { state: true },
    confirmInstall: { state: true },
    confirmRemove: { state: true },
    people: { state: true },
  };

  declare api: AdminApi;
  declare apps: CatalogueApp[];
  declare loading: boolean;
  declare error: string;
  declare open: string | undefined;
  declare versions: AppVersion[] | undefined;
  declare versionsError: string;
  /** The version picked in the open app's picker, before Use this. */
  declare choice: string;
  declare saving: boolean;
  declare saveError: string;
  /** Sites apps may load from besides the platform itself; undefined until loaded. */
  declare origins: AllowedOrigin[] | undefined;
  declare originsOpen: boolean;
  declare originsError: string;
  declare working: boolean;
  /** The app whose sign-in is about to be replaced, while the admin confirms. */
  declare issuing: CatalogueApp | undefined;
  /** The secret just issued, shown once. */
  declare issued: (IssuedSignIn & { name: string }) | undefined;
  /** What each floor says about the open app; undefined until loaded. */
  declare floorRules: FloorRule[] | undefined;
  /** The org and its teams; loaded once. */
  declare floorList: AppFloor[] | undefined;
  declare floorsError: string;
  /** The open app's settings with their values; undefined until loaded. */
  declare settingValues: AppSettingValue[] | undefined;
  declare settingsError: string;
  /** Who gets each of the open app's feature previews; undefined until loaded. */
  declare features: FeaturePreviews | undefined;
  declare featuresError: string;
  /** What the app runner installed and what the app feed offers; undefined until loaded. */
  declare installs: AppInstalls | undefined;
  declare installsError: string;
  declare checkingInstalls: boolean;
  /** The release about to be installed, while the admin confirms: with what it asks, or why it waited. */
  declare confirmInstall: { app: string; name: string; version: string; notes: string[] } | undefined;
  /** The installed app about to be removed, while the admin confirms. */
  declare confirmRemove: InstalledApp | undefined;
  /** Everyone, to choose an installed app's developers from; asked for once an installed app is opened. */
  declare people: Person[] | undefined;
  private refreshTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    super();
    this.apps = [];
    this.loading = true;
    this.error = '';
    this.versionsError = '';
    this.settingsError = '';
    this.featuresError = '';
    this.choice = NEWEST;
    this.saving = false;
    this.saveError = '';
    this.originsOpen = false;
    this.originsError = '';
    this.working = false;
    this.floorsError = '';
    this.installsError = '';
    this.checkingInstalls = false;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.refreshTimer);
  }

  /** Asks again while the app runner has something waiting or under way, so the page follows along. */
  override updated() {
    const busy = this.installs && [...this.installs.installed, ...this.installs.available].some((a) => jobOpen(a.job));
    if (busy && !this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = undefined;
        void this.loadInstalls().then(() => this.load(false));
      }, JOB_REFRESH_MS);
    }
  }

  async loadInstalls() {
    try {
      const installs = await this.api.installs();
      // Anything else (a registry without the app runner) shows no installs.
      this.installs = Array.isArray(installs?.installed) && Array.isArray(installs.available) ? installs : undefined;
      this.installsError = '';
      this.resumeInstall();
    } catch (err) {
      this.installsError = (err as Error).message;
    }
  }

  async checkInstalls() {
    this.checkingInstalls = true;
    try {
      this.installs = await this.api.checkInstalls();
      this.installsError = '';
    } catch (err) {
      this.installsError = (err as Error).message;
    } finally {
      this.checkingInstalls = false;
    }
  }

  /** Back from entering the password again (`?install=<app>@<version>` or `?uninstall=<app>`): ask once more. */
  private resumeInstall() {
    const params = new URLSearchParams(window.location.search);
    const install = params.get('install');
    const uninstall = params.get('uninstall');
    if (!install && !uninstall) return;
    params.delete('install');
    params.delete('uninstall');
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
    const at = install?.lastIndexOf('@') ?? -1;
    if (install && at > 0) this.askInstall(install.slice(0, at), install.slice(at + 1));
    if (uninstall) this.confirmRemove = this.installs?.installed.find((i) => i.app === uninstall);
  }

  /** Opens "Install …?" for a release the feed offers, or an installed app's newer version. */
  askInstall(app: string, version: string) {
    const offered = this.installs?.available.find((a) => a.app === app && a.version === version);
    const installed = this.installs?.installed.find((a) => a.app === app && a.update?.version === version);
    if (offered) this.confirmInstall = { app, name: offered.name, version, notes: [...asksWords(offered.asks, scopeWords), ...(offered.problem ? [offered.problem] : [])] };
    else if (installed) this.confirmInstall = { app, name: installed.name, version, notes: installed.update!.needs };
  }

  /** Where the password is entered again before anything is installed or removed; back here after. */
  private signInAgain(query: string) {
    const back = `${window.location.pathname}?${query}`;
    window.location.assign(`/auth/again?return=${encodeURIComponent(back)}`);
  }

  install: DialogSubmit = async () => {
    const { app, version } = this.confirmInstall!;
    try {
      await this.api.installApp(app, version);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'sign_in_again') {
        this.signInAgain(`install=${encodeURIComponent(`${app}@${version}`)}`);
        return false;
      }
      throw err;
    }
    await this.loadInstalls();
  };

  uninstall: DialogSubmit = async () => {
    const { app } = this.confirmRemove!;
    try {
      await this.api.uninstallApp(app);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'sign_in_again') {
        this.signInAgain(`uninstall=${encodeURIComponent(app)}`);
        return false;
      }
      throw err;
    }
    await this.loadInstalls();
  };

  async loadPeople() {
    try {
      this.people = await this.api.people();
    } catch (err) {
      this.installsError = (err as Error).message;
    }
  }

  async setDevelopers(app: InstalledApp, people: string[]) {
    this.installsError = '';
    try {
      this.installs = await this.api.setDevelopers(app.app, people);
    } catch (err) {
      this.installsError = (err as Error).message;
    }
  }

  async follow(app: InstalledApp, channel: AppChannel, policy: AppPolicy) {
    this.installsError = '';
    try {
      this.installs = await this.api.followApp(app.app, channel, policy);
    } catch (err) {
      this.installsError = (err as Error).message;
    }
  }

  override createRenderRoot() {
    return this;
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has('api') && this.api) {
      void this.load();
      void this.loadInstalls();
    }
    if (changed.has('originsOpen') && this.originsOpen) void this.loadOrigins();
    if (changed.has('open')) {
      this.versions = undefined;
      this.versionsError = '';
      this.saveError = '';
      const app = this.apps.find((a) => a.id === this.open);
      this.choice = app?.pinnedVersion ?? NEWEST;
      this.floorRules = undefined;
      this.floorsError = '';
      this.settingValues = undefined;
      this.settingsError = '';
      if (app?.settings?.length) void this.loadSettings(app.id);
      this.features = undefined;
      this.featuresError = '';
      if (app?.previews?.length) void this.loadFeatures(app.id);
      if (app && !this.people && this.installs?.installed.some((i) => i.app === app.id)) void this.loadPeople();
      if (app && !app.platform) {
        // An app that ships with AUGUR changes version with the release, so it has none to go back to.
        if (!app.pillar) void this.loadVersions(app.id);
        void this.loadFloors(app.id);
      }
    }
  }

  async loadFloors(id: string) {
    try {
      const [rules, list] = await Promise.all([
        this.api.appFloors(id),
        this.floorList ?? Promise.all([this.api.org(), this.api.departments()]).then(([org, departments]) => floorTree(org, departments)),
      ]);
      this.floorList = list;
      if (this.open === id) this.floorRules = rules;
    } catch (err) {
      if (this.open === id) this.floorsError = (err as Error).message;
    }
  }

  async setFloor(app: CatalogueApp, floor: AppFloor, state: FloorChoice) {
    this.floorsError = '';
    try {
      const { rules } = await this.api.setAppFloor(app.id, floor.id, state);
      if (this.open === app.id) this.floorRules = rules;
    } catch (err) {
      this.floorsError = (err as Error).message;
    }
  }

  async loadSettings(id: string) {
    try {
      const values = await this.api.appSettings(id);
      if (this.open === id) this.settingValues = values;
    } catch (err) {
      if (this.open === id) this.settingsError = (err as Error).message;
    }
  }

  /** Sets one of the open app's settings from what was typed; empty puts it back to its default. */
  async setSetting(app: CatalogueApp, setting: AppSettingValue, typed: string) {
    this.settingsError = '';
    const value = typed.trim() === '' ? null : Number(typed);
    if (value !== null && (!Number.isInteger(value) || value < setting.min || value > setting.max)) {
      this.settingsError = `${setting.label} is a whole number from ${setting.min} to ${setting.max}${setting.unit ? ` ${setting.unit}` : ''}.`;
      return;
    }
    try {
      const values = await this.api.setAppSetting(app.id, setting.id, value);
      if (this.open === app.id) this.settingValues = values;
    } catch (err) {
      this.settingsError = (err as Error).message;
    }
  }

  async loadFeatures(id: string) {
    try {
      const features = await this.api.featurePreviews(id);
      if (this.open === id) this.features = features;
    } catch (err) {
      if (this.open === id) this.featuresError = (err as Error).message;
    }
  }

  async setFeature(app: CatalogueApp, preview: string, value: string) {
    this.featuresError = '';
    try {
      const features = await this.api.setFeaturePreview(app.id, preview, value === 'default' ? null : (value as FeaturePreviewMode));
      if (this.open === app.id) this.features = features;
    } catch (err) {
      this.featuresError = (err as Error).message;
    }
  }

  /** The features the app is trying, each with who gets it (SDK 1.7). */
  private featureFields(app: CatalogueApp) {
    if (!app.previews?.length) return nothing;
    const features = this.features;
    return html`<section data-feature-previews style="display:flex;flex-direction:column;gap:var(--space-4)">
      <ui-heading heading="Feature previews" summary="Features it’s trying before they’re everyone’s. People turn the opt-in ones on for themselves in the shell’s Previews." size="s"></ui-heading>
      ${features
        ? features.previews.map(
            (p) => html`<ui-select
              data-feature-preview=${p.id}
              label=${p.name}
              hint=${featureHint(p)}
              .options=${featureModeChoices(p, features.defaultMode)}
              .value=${p.chosen ? p.mode : 'default'}
              @ui-change=${(e: CustomEvent<{ value: string }>) => this.setFeature(app, p.id, e.detail.value)}
            ></ui-select>`,
          )
        : this.featuresError
          ? nothing
          : html`<p>Loading its previews…</p>`}
      ${this.featuresError ? html`<p role="alert" data-feature-previews-error>${this.featuresError}</p>` : nothing}
    </section>`;
  }

  /** The settings the app offers, each a number to type, saved when the field is left. */
  private settingsFields(app: CatalogueApp) {
    if (!app.settings?.length) return nothing;
    const values = this.settingValues;
    return html`<div data-settings style="display:flex;flex-direction:column;gap:var(--space-4)">
      ${values
        ? values.map(
            (s) => html`<ui-text-field
              data-setting=${s.id}
              type="number"
              label=${s.unit ? `${s.label} (${s.unit})` : s.label}
              hint=${[s.detail, `${s.min} to ${s.max}; ${s.default} unless you change it.`].filter(Boolean).join(' ')}
              .value=${String(s.value)}
              @ui-change=${(e: CustomEvent<{ value: string }>) => this.setSetting(app, s, e.detail.value)}
            ></ui-text-field>`,
          )
        : this.settingsError
          ? nothing
          : html`<p>Loading its settings…</p>`}
      ${this.settingsError ? html`<p role="alert" data-settings-error>${this.settingsError}</p>` : nothing}
    </div>`;
  }

  async limitUploads(app: CatalogueApp, choice: string) {
    this.floorsError = '';
    try {
      const updated = await this.api.limitUploads(app.id, choice === 'asked' ? null : Number(choice));
      this.apps = this.apps.map((a) => (a.id === updated.id ? updated : a));
    } catch (err) {
      this.floorsError = (err as Error).message;
    }
  }

  async allowScopes(app: CatalogueApp) {
    this.floorsError = '';
    try {
      const updated = await this.api.grantScopes(app.id, [...(app.grantedScopes ?? []), ...(app.awaitingScopes ?? [])]);
      this.apps = this.apps.map((a) => (a.id === updated.id ? updated : a));
    } catch (err) {
      this.floorsError = (err as Error).message;
    }
  }

  /** Where the app is on, floor by floor, and a choice for each. */
  private floors(app: CatalogueApp) {
    const rules = this.floorRules;
    const list = this.floorList;
    if (this.floorsError && !rules) return html`<p style="color:var(--danger)">${this.floorsError}</p>`;
    if (!rules || !list) return html`<ui-rows loading count="3"></ui-rows>`;
    const names = new Map(list.map((f) => [f.id, f.name]));
    return html`<div data-floors style="display:flex;flex-direction:column;gap:var(--space-2)">
      <p>Where it’s on. Everyone’s own floor follows the org.</p>
      ${this.floorsError ? html`<p style="color:var(--danger)">${this.floorsError}</p>` : nothing}
      ${list.map((floor) => {
        const rule = rules.find((r) => r.workspace === floor.id);
        const status = floorStatus(app, floor, rules, names);
        return html`<ui-select
          data-floor=${floor.id}
          style=${`margin-inline-start:calc(var(--space-4) * ${floor.path.length - 1})`}
          label=${floor.name}
          hint=${status.words}
          .options=${FLOOR_CHOICES}
          .value=${rule?.state ?? 'inherit'}
          @ui-change=${(e: CustomEvent<{ value: FloorChoice }>) => this.setFloor(app, floor, e.detail.value)}
        ></ui-select>`;
      })}
    </div>`;
  }

  async loadVersions(id: string) {
    try {
      const versions = await this.api.appVersions(id);
      if (this.open === id) this.versions = versions;
    } catch (err) {
      if (this.open === id) this.versionsError = (err as Error).message;
    }
  }

  /** Serves the picked version and holds the app there, or follows new versions again. */
  async useChoice(app: CatalogueApp) {
    this.saving = true;
    this.saveError = '';
    try {
      const updated = await this.api.pinApp(app.id, this.choice === NEWEST ? null : this.choice);
      this.apps = this.apps.map((a) => (a.id === updated.id ? updated : a));
      await this.loadVersions(app.id);
    } catch (err) {
      this.saveError = (err as Error).message;
    } finally {
      this.saving = false;
    }
  }

  private history(app: CatalogueApp) {
    if (this.versionsError) return html`<p style="color:var(--danger)">${this.versionsError}</p>`;
    const versions = this.versions;
    const rows: Row[] = (versions ?? []).map((v) => ({
      label: `Version ${v.version}`,
      value: `${day(v.registeredAt)}${v.serving ? ' · in use' : ''}${v.version === app.pinnedVersion ? ', held' : ''}`,
    }));
    const options: SelectOption[] = [
      { value: NEWEST, label: 'The newest, as it registers' },
      ...(versions ?? []).map((v) => ({ value: v.version, label: `Version ${v.version}, and hold it` })),
    ];
    const current = app.pinnedVersion ?? NEWEST;
    const note = rollbackNote(app, versions?.find((v) => v.version === this.choice));
    return html`<ui-rows .items=${rows} ?loading=${!versions} count="2" empty="No versions are kept yet."></ui-rows>
      <ui-select
        label="Give the shell"
        hint=${app.pinnedVersion ? `Held at ${app.pinnedVersion}: new versions are kept but not used.` : 'Each new version is used as soon as it registers.'}
        .options=${options}
        .value=${this.choice}
        ?disabled=${!versions}
        @ui-change=${(e: CustomEvent<{ value: string }>) => (this.choice = e.detail.value)}
      ></ui-select>
      ${note ? html`<p>${note}</p>` : nothing}
      ${this.saveError ? html`<p style="color:var(--danger)">${this.saveError}</p>` : nothing}
      <div>
        <ui-button kind="secondary" size="sm" ?disabled=${this.choice === current} reason="That’s what it uses now. Choose another version first." ?busy=${this.saving} @click=${() => this.useChoice(app)}>
          ${this.choice === NEWEST ? 'Follow new versions' : `Use version ${this.choice}`}
        </ui-button>
      </div>`;
  }

  async load(showLoading = true) {
    this.loading = showLoading;
    this.error = '';
    try {
      this.apps = await this.api.apps();
    } catch (err) {
      this.error = (err as Error).message;
    } finally {
      this.loading = false;
    }
  }

  async loadOrigins() {
    this.originsError = '';
    try {
      this.origins = await this.api.origins();
    } catch (err) {
      this.originsError = (err as Error).message;
    }
  }

  /** Allows a site, then stays open with the field cleared for the next. */
  allowOrigin: DialogSubmit = async (values, dialog) => {
    const added = await this.api.allowOrigin(values.origin.trim());
    this.origins = [...(this.origins ?? []).filter((o) => o.origin !== added.origin), added];
    const field = dialog.querySelector<HTMLElement & { value: string }>('ui-text-field[name="origin"]');
    if (field) field.value = '';
    // An app registered from it before is offered again.
    await this.load();
    return false as const;
  };

  async removeOrigin(origin: string) {
    this.working = true;
    this.originsError = '';
    try {
      await this.api.removeOrigin(origin);
      this.origins = (this.origins ?? []).filter((o) => o.origin !== origin);
      await this.load();
    } catch (err) {
      this.originsError = (err as Error).message;
    } finally {
      this.working = false;
    }
  }

  private originsDialog() {
    if (!this.originsOpen) return nothing;
    const origins = this.origins;
    return html`<ui-dialog
      open
      size="glance"
      eyebrow="Apps"
      heading="Where apps load from"
      summary="Apps on the platform’s own address can always load. An app whose entry is on another site can only register, and only open, if that site is here."
      action-label="Allow"
      busy-label="Allowing…"
      cancel-label="Done"
      .submit=${this.allowOrigin}
      @ui-close=${() => (this.originsOpen = false)}
    >
      <div data-origins style="display:flex;flex-direction:column;gap:var(--space-2)">
        ${this.originsError ? html`<p style="color:var(--danger)">${this.originsError}</p>` : nothing}
        ${!origins
          ? this.originsError
            ? nothing
            : html`<ui-rows loading count="2"></ui-rows>`
          : origins.length
            ? origins.map(
                (o) => html`<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);min-height:40px;border-bottom:1px solid var(--hairline)">
                  <span style="color:var(--ink)">${o.origin}<span style="color:var(--ink-muted);font-size:var(--type-small)"> since ${day(o.addedAt)}</span></span>
                  <ui-button kind="tertiary" size="sm" ?busy=${this.working} @click=${() => this.removeOrigin(o.origin)}>Remove</ui-button>
                </div>`,
              )
            : html`<p>No other sites yet, so apps can only load from the platform itself.</p>`}
      </div>
      <p>The server must allow a site too, so the browser will run its code; see Deploy in the platform’s guides.</p>
      <ui-text-field slot="fields" name="origin" label="Allow a site" placeholder="https://apps.example.org" required></ui-text-field>
    </ui-dialog>`;
  }

  /** Replaces the app's secret, then shows the new one once. */
  issueSignIn: DialogSubmit = async () => {
    const app = this.issuing!;
    const issued = await this.api.issueSignIn(app.id);
    this.issued = { ...issued, name: app.name };
  };

  private issueDialog() {
    const app = this.issuing;
    if (!app) return nothing;
    return html`<ui-dialog
      open
      size="glance"
      danger
      eyebrow=${app.name}
      heading="Issue a new sign-in?"
      summary="The app’s service signs in to the platform with a secret. A new one stops the old one working straight away, so the service can’t register, notify or write to the log until it’s given the new one."
      action-label="Issue a new sign-in"
      busy-label="Issuing…"
      cancel-label="Keep the old one"
      .submit=${this.issueSignIn}
      @ui-close=${() => (this.issuing = undefined)}
    ></ui-dialog>`;
  }

  /** Shown once, straight after it is made: it isn't kept anywhere the admin can see it again. */
  private secretNote() {
    const issued = this.issued;
    if (!issued) return nothing;
    return html`<ui-dialog
      open
      size="glance"
      eyebrow="New sign-in"
      heading=${`Give ${issued.name}’s service this secret`}
      summary=${`Set it as SERVICE_CLIENT_SECRET where the service runs, then restart it. It signs in as ${issued.clientId}.`}
      cancel-label="Done"
      @ui-close=${() => (this.issued = undefined)}
    >
      <p
        data-secret
        style="margin:0;padding:var(--space-4);border-radius:var(--radius-inset);background:color-mix(in srgb, var(--ink) 6%, transparent);font-family:var(--font-mono, monospace);font-size:var(--type-body);color:var(--ink);word-break:break-all;user-select:all"
      >${issued.secret}</p>
      <p>It won’t be shown again. If it’s lost, issue a new one.</p>
      <div>
        <ui-button kind="secondary" size="sm" @click=${() => navigator.clipboard?.writeText(issued.secret).catch(() => undefined)}>Copy it</ui-button>
      </div>
    </ui-dialog>`;
  }

  /** For an app the app runner installed: how it takes new releases, a newer one waiting, what the runner is doing, and Remove. */
  private runnerControls(app: CatalogueApp) {
    const installed = this.installs?.installed.find((i) => i.app === app.id);
    if (!installed) return nothing;
    const waiting = waitingWhy(installed);
    return html`<div data-runner style="display:flex;flex-direction:column;gap:var(--space-4)">
      <ui-select
        data-channel
        label="New releases"
        hint=${this.installs?.channelNote ?? ''}
        .options=${channelChoices(this.installs?.ring)}
        .value=${installed.channel}
        @ui-change=${(e: CustomEvent<{ value: AppChannel }>) => this.follow(installed, e.detail.value, installed.policy)}
      ></ui-select>
      <ui-select
        data-policy
        label="When one is out"
        hint=${policyHint(installed.policy)}
        .options=${POLICY_CHOICES}
        .value=${installed.policy}
        @ui-change=${(e: CustomEvent<{ value: AppPolicy }>) => this.follow(installed, installed.channel, e.detail.value)}
      ></ui-select>
      ${installed.update && !jobOpen(installed.job)
        ? html`<p style="margin:0">
              Version ${installed.update.version} is out${waiting.length ? html`, and waits for you: ${waiting.join(' ')}` : installed.policy === 'hold' ? ', but it’s held.' : '; it installs by itself shortly.'}
              ${installed.update.notesUrl ? html`<a href=${installed.update.notesUrl} target="_blank" rel="noopener">What’s new</a>` : nothing}
            </p>
            ${installed.policy === 'automatic' && !waiting.length
              ? nothing
              : html`<div><ui-button data-update kind="secondary" size="sm" @click=${() => this.askInstall(installed.app, installed.update!.version)}>Install ${installed.update.version}</ui-button></div>`}`
        : nothing}
      ${installed.update?.changes?.length ? section(`What’s new in ${installed.update.version}`, changeList(installed.update.changes, () => installed.name)) : nothing}
      ${installed.job ? html`<p style="margin:0" data-job>${jobWords(installed.job)}</p>${jobOpen(installed.job) || installed.job.state === 'failed' ? jobSteps(installed.job) : nothing}` : nothing}
      ${installed.history?.length ? section('History', appHistoryList(installed.history)) : nothing}
      ${installed.older?.length
        ? section(
            'Go back',
            html`<div data-app-go-back>
              ${installed.older.map((o) =>
                line(
                  `${installed.name} ${o.version}`,
                  html`<ui-button kind="tertiary" size="sm" ?disabled=${jobOpen(installed.job)} reason="Wait for the server to finish its current job with this app." @click=${() => this.askInstall(installed.app, o.version)}>Go back</ui-button>`,
                ),
              )}
              <p style="margin:0;color:var(--ink-muted);font-size:var(--type-small)">Going back holds the app on that version, so it isn’t updated again by itself. Its data stays as it is.</p>
            </div>`,
          )
        : nothing}
      <ui-tag-picker
        data-developers
        label="Developers"
        hint="They can switch to a preview of any pull request that changes it, for themselves; previews run only while it has developers."
        placeholder="Type a name"
        max="50"
        .options=${(this.people ?? []).map((p) => ({ value: p.id, label: fullName(p), detail: p.email, icon: 'account' }))}
        .values=${installed.developers ?? []}
        @ui-change=${(e: CustomEvent<{ values: string[] }>) => this.setDevelopers(installed, e.detail.values)}
      ></ui-tag-picker>
      ${installed.previews?.length
        ? section(
            'Previews running',
            html`${installed.previews.map((p) =>
              line(
                html`${p.url ? html`<a href=${p.url} target="_blank" rel="noopener">#${p.pr}</a>` : `#${p.pr}`} ${p.title ?? ''}`,
                `${p.version}, until ${new Date(p.endsAt).toLocaleDateString()}`,
              ),
            )}`,
          )
        : nothing}
      ${this.installsError ? html`<p role="alert" style="color:var(--danger)">${this.installsError}</p>` : nothing}
      <div><ui-button data-uninstall kind="tertiary" size="sm" ?disabled=${jobOpen(installed.job)} reason="Wait for the server to finish its current job with this app." @click=${() => (this.confirmRemove = installed)}>Remove from the server</ui-button></div>
    </div>`;
  }

  /** What the app feed offers to install, what's waiting on an admin, and whether there's a runner to do it. */
  private installsSection() {
    const i = this.installs;
    if (!i) return this.installsError ? html`<p style="color:var(--danger);padding:var(--space-4)">${this.installsError}</p>` : nothing;
    const waiting = i.installed.filter((a) => waitingWhy(a).length);
    const busy = [...i.installed, ...i.available].filter((a) => jobOpen(a.job));
    return html`<div data-installs style="display:flex;flex-direction:column;gap:var(--space-5);padding:var(--space-4)">
      ${!i.runnerSeenAt
        ? html`<ui-status status="warning" label="No app runner has asked for work since the registry started, so nothing below can be installed yet. It’s the updater with APP_SECRETS_KEY set: see docs/upgrade.md, The app runner."></ui-status>`
        : nothing}
      ${i.problem ? html`<ui-status status="warning" label=${`The app feed couldn’t be read: ${i.problem}`}></ui-status>` : nothing}
      ${busy.length ? section('Under way', html`${busy.map((a) => line(a.name, jobWords(a.job!)))}`) : nothing}
      ${waiting.length
        ? section(
            'Needs you',
            html`<div data-waiting>
              ${waiting.map((a) =>
                line(
                  html`${a.name} ${a.update!.version}<span style="color:var(--ink-muted);font-size:var(--type-small)"> · ${waitingWhy(a).join(' ')}</span>`,
                  html`<ui-button kind="secondary" size="sm" @click=${() => this.askInstall(a.app, a.update!.version)}>Install</ui-button>`,
                ),
              )}
            </div>`,
          )
        : nothing}
      ${section(
        'Install from releases',
        i.feed === 'off'
          ? html`<p style="margin:0">This server doesn’t read app releases: APP_FEED_URL is off, or the release feed is a mirror.</p>`
          : html`<div data-available>
                ${i.available.filter((a) => !jobOpen(a.job)).length
                  ? i.available
                      .filter((a) => !jobOpen(a.job))
                      .map((a) =>
                        line(
                          html`${a.name} ${a.version}${a.channel === 'beta' ? ' (preview)' : ''}<span style="color:var(--ink-muted);font-size:var(--type-small)">${a.description ? ` · ${a.description}` : ''}${a.job?.state === 'failed' ? ` · ${jobWords(a.job)}` : ''}</span>`,
                          html`<ui-button kind="secondary" size="sm" ?disabled=${Boolean(a.problem)} reason=${a.problem ?? ''} @click=${() => this.askInstall(a.app, a.version)}>Install</ui-button>`,
                        ),
                      )
                  : html`<p style="margin:0">Nothing new to install.${i.checkedAt ? ` Checked ${new Date(i.checkedAt).toLocaleString()}.` : ''}</p>`}
              </div>
              <div><ui-button data-check-installs kind="tertiary" size="sm" ?busy=${this.checkingInstalls} @click=${() => this.checkInstalls()}>Check for releases</ui-button></div>`,
      )}
    </div>`;
  }

  private installDialog() {
    const c = this.confirmInstall;
    if (!c) return nothing;
    return html`<ui-dialog
      open
      size="glance"
      eyebrow="Apps"
      heading=${`Install ${c.name} ${c.version}?`}
      summary="The new version starts beside whatever runs now, and people are switched to it only once it answers. If it doesn’t, nothing changes."
      action-label="Install"
      busy-label="Asking…"
      cancel-label="Not now"
      .submit=${this.install}
      @ui-close=${() => (this.confirmInstall = undefined)}
    >
      ${c.notes.length ? html`<ul style="margin:0;padding-left:var(--space-5)">${c.notes.map((n) => html`<li>${n}</li>`)}</ul>` : nothing}
      <p>You may be asked for your password again.</p>
    </ui-dialog>`;
  }

  private removeDialog() {
    const app = this.confirmRemove;
    if (!app) return nothing;
    return html`<ui-dialog
      open
      size="glance"
      danger
      eyebrow=${app.name}
      heading="Remove it from the server?"
      summary="Its containers stop and are removed, so nobody can open it. Its data stays: install it again to get it back. Remove it from the catalogue too, to stop it being listed."
      action-label="Remove"
      busy-label="Asking…"
      cancel-label="Keep it"
      .submit=${this.uninstall}
      @ui-close=${() => (this.confirmRemove = undefined)}
    ></ui-dialog>`;
  }

  private readonly columns: TableColumn[] = [
    { key: 'name', label: 'App', sortable: true },
    { key: 'version', label: 'Version', sortable: true },
    { key: 'route', label: 'Address', sortable: true },
    { key: 'state', label: 'Status', sortable: true, format: (v, row) => html`<ui-status status=${String(row.stateStatus)} label=${String(v)}></ui-status>` },
    { key: 'source', label: 'From', sortable: true },
  ];

  private details() {
    const app = this.apps.find((a) => a.id === this.open);
    if (!app) return nothing;
    const state = appStatus(app);
    const facts: Fact[] = [
      { label: 'Version', value: app.pinnedVersion ? `${app.version}, held` : app.version },
      { label: 'AUGUR SDK', value: app.sdk },
      { label: 'Address', value: app.route },
      ...(app.entry.startsWith('/') && !app.entry.startsWith('//') ? [] : [{ label: 'Loads from', value: app.entry }]),
      ...(app.requiredRole ? [{ label: 'Only for', value: app.requiredRole }] : []),
      ...(app.platform ? [] : [{ label: 'May', value: scopeWords(app.grantedScopes ?? app.scopes) }]),
    ];
    return html`<ui-dialog
      open
      light
      size="glance"
      eyebrow=${app.platform ? 'Part of the platform' : app.pillar ? 'Ships with AUGUR' : `Registered by ${app.registeredBy ?? 'its service'}`}
      heading=${app.name}
      summary=${app.description ?? ''}
      cancel-label="Close"
      @ui-close=${() => (this.open = undefined)}
    >
      <ui-facts .items=${facts}></ui-facts>
      ${app.platform
        ? html`<p>Built-in apps are always on.</p>`
        : html`<ui-toggle
            label="Offered to people"
            hint=${state.why ?? 'Everyone it’s meant for sees it in Apps and Title.'}
            ?checked=${app.enabled}
            .change=${async (enabled: boolean) => {
              const updated = await this.api.setAppEnabled(app.id, enabled);
              this.apps = this.apps.map((a) => (a.id === updated.id ? updated : a));
            }}
          ></ui-toggle>`}
      ${app.awaitingScopes?.length
        ? html`<p>Version ${app.version} also asks to: ${scopeWords(app.awaitingScopes)}. It runs without that until you allow it.</p>
            <div><ui-button kind="secondary" size="sm" @click=${() => this.allowScopes(app)}>Allow it</ui-button></div>`
        : nothing}
      ${app.platform
        ? nothing
        : html`<ui-select
            data-upload-limit
            label="Largest upload"
            hint="What one request to its service may carry. You can lower what it asks for, not raise it."
            .options=${uploadChoices(app)}
            .value=${app.uploadLimitLowered ? String(app.uploadLimit) : 'asked'}
            @ui-change=${(e: CustomEvent<{ value: string }>) => this.limitUploads(app, e.detail.value)}
          ></ui-select>`}
      ${app.platform ? nothing : this.settingsFields(app)}
      ${app.platform ? nothing : this.featureFields(app)}
      ${app.platform ? nothing : this.floors(app)}
      ${app.handles?.length ? html`<p>Answers ${app.handles.join(', ')}.</p>` : nothing}
      ${app.pillar
        ? html`<p data-pillar>It ships with AUGUR and changes version with it. Turn it off here or floor by floor; it can’t be removed, and its sign-in is in the server’s settings.</p>`
        : nothing}
      ${app.platform || app.pillar ? nothing : this.history(app)}
      ${app.platform || app.pillar
        ? nothing
        : html`<div>
            <ui-button kind="tertiary" size="sm" @click=${() => (this.issuing = app)}>Issue a new sign-in</ui-button>
          </div>`}
      ${app.platform || app.pillar ? nothing : this.runnerControls(app)}
      ${app.updatedAt ? html`<p>Registered ${day(app.registeredAt)}, last updated ${day(app.updatedAt)}.</p>` : nothing}
    </ui-dialog>`;
  }

  override render() {
    const rows: TableRow[] = this.apps.map((a) => {
      const state = appStatus(a);
      return {
        id: a.id,
        name: a.name,
        version: a.pinnedVersion ? `${a.version}, held` : a.version,
        route: a.route,
        state: state.label,
        stateStatus: state.status,
        source: a.platform || a.pillar ? 'AUGUR' : (a.registeredBy ?? ''),
      };
    });
    return page(
      'Admin',
      'Apps',
      'Every app in the catalogue. Turn one off to stop offering it, or go back to an earlier version, without removing it. Install new apps from their releases below.',
      html`<ui-table
          noun="apps"
          .columns=${this.columns}
          .rows=${rows}
          ?loading=${this.loading}
          .error=${this.error}
          empty="No apps are registered."
          @ui-open=${(e: CustomEvent<{ row: TableRow }>) => (this.open = e.detail.row.id)}
          @ui-retry=${() => this.load()}
        >
          <ui-button slot="actions" kind="secondary" size="sm" @click=${() => (this.originsOpen = true)}>Where apps load from</ui-button>
        </ui-table>
        ${this.installsSection()} ${this.details()} ${this.originsDialog()} ${this.issueDialog()} ${this.secretNote()} ${this.installDialog()} ${this.removeDialog()}`,
    );
  }
}

if (!customElements.get('admin-apps')) customElements.define('admin-apps', AdminApps);
