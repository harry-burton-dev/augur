/** What someone has chosen for the shell, kept by Identity so it follows them to any browser. */
export interface Preferences {
  reduceMotion?: boolean;
  density?: 'comfortable' | 'compact';
  /** Whether an area title card shows on arriving at a floor or opening an app; on unless false. */
  areaTitles?: boolean;
  /** Whether each new notification is also said once as a toast at the bottom of the screen; off unless true. */
  toasts?: boolean;
  /** Where the app bar rests on the desktop: under the band (0), upper (1, the default), lower (2) or at the bottom (3). */
  barStop?: 0 | 1 | 2 | 3;
  away?: boolean;
  /** App ids, most recent first. */
  recent?: string[];
  /** App ids whose notifications land in the stream silently and never on Home. */
  muted?: string[];
  /** Kinds of notification, as "<app>:<kind>", that land in the stream silently and never on Home or as a toast. */
  quietKinds?: string[];
  /** App ids kept first on Home and in the list of apps, in their order. */
  pinned?: string[];
  /** The floor id the shell opens on when an address names none; their own without it. */
  startFloor?: string;
  /** What their away status says, and when away ends by itself (ISO date-time). */
  awayMessage?: string;
  awayUntil?: string;
  /** Their time zone (IANA); without it, the browser's. */
  timeZone?: string;
  /** The region whose way of writing dates and times they want (a language tag such as en-GB); without it, their language's, then the browser's. */
  dateFormat?: string;
  /** A 12- or 24-hour clock; without it, as their date format writes it. */
  clock?: '12' | '24';
  /** How AUGUR reaches them beyond the shell (identity's Preferences). */
  notifications?: { email?: boolean; digest?: 'off' | 'daily' | 'weekly'; quietHours?: { from: string; to: string } };
}

const RECENT = 6;

/**
 * Loads a person's preferences once, then saves each change shortly after it
 * happens, so flicking a switch twice is one request. Saving never gets in
 * the way: a failed save is reported, and the shell carries on with what was
 * chosen.
 *
 * Identity's PUT replaces everything it holds, so nothing is saved until a load
 * has succeeded. Changes made before then stay here, are merged into what the
 * load brings, and are saved after it. When the load failed, the next save
 * tries it again first.
 */
export class PreferenceSync {
  private prefs: Preferences = {};
  private timer: ReturnType<typeof setTimeout> | undefined;
  private loaded = false;
  private loading: Promise<void> | undefined;
  /** There are changes Identity doesn't have yet. */
  private unsaved = false;

  constructor(
    private readonly url: string,
    private readonly getToken: () => Promise<string>,
    private readonly opts: { fetchImpl?: typeof fetch; delay?: number; onError?: (message: string) => void } = {},
  ) {}

  get current(): Preferences {
    return this.prefs;
  }

  /** Their saved preferences, or none when Identity can't be reached: the defaults are a fine start. */
  async load(): Promise<Preferences> {
    this.loading ??= this.read().finally(() => {
      this.loading = undefined;
    });
    await this.loading;
    return this.prefs;
  }

  private async read() {
    try {
      const res = await (this.opts.fetchImpl ?? fetch)(this.url, { headers: { authorization: `Bearer ${await this.getToken()}`, accept: 'application/json' } });
      if (!res.ok) return;
      const saved = (await res.json()) as Preferences;
      // What changed here wins, but apps opened before this arrived go in front of the history, not in place of it.
      const opened = this.prefs.recent?.length ? { recent: [...new Set([...this.prefs.recent, ...(saved.recent ?? [])])].slice(0, RECENT) } : {};
      this.prefs = { ...saved, ...this.prefs, ...opened };
      this.loaded = true;
    } catch {
      // keep the defaults
    }
  }

  set<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    this.prefs = { ...this.prefs, [key]: value };
    this.unsaved = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.save(), this.opts.delay ?? 400);
  }

  /** Puts an app at the front of recent, keeping the few most recent. */
  opened(appId: string) {
    const recent = [appId, ...(this.prefs.recent ?? []).filter((id) => id !== appId)].slice(0, RECENT);
    if (recent.join() !== (this.prefs.recent ?? []).join()) this.set('recent', recent);
  }

  async save() {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.unsaved && !this.loaded) await this.load();
    if (!this.unsaved) return;
    this.unsaved = false;
    try {
      if (!this.loaded) throw new Error('not loaded');
      const res = await (this.opts.fetchImpl ?? fetch)(this.url, {
        method: 'PUT',
        headers: { authorization: `Bearer ${await this.getToken()}`, 'content-type': 'application/json' },
        body: JSON.stringify(this.prefs),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      this.unsaved = true;
      this.opts.onError?.("Your settings weren't saved. They'll apply until you leave, and save with your next change.");
    }
  }

  stop() {
    clearTimeout(this.timer);
  }
}

/** Puts motion and density on <html>, where the shell's styles and the kit's components look for them. */
export function applyPreferences(prefs: Preferences, root: HTMLElement = document.documentElement) {
  if (prefs.reduceMotion) root.dataset.motion = 'reduce';
  else delete root.dataset.motion;
  if (prefs.density === 'compact') root.dataset.density = 'compact';
  else delete root.dataset.density;
}
