/** What someone has chosen for the shell, kept by Identity so it follows them to any browser. */
export interface Preferences {
  reduceMotion?: boolean;
  density?: 'comfortable' | 'compact';
  /** Whether an area title card shows on arriving at a floor or opening an app; on unless false. */
  areaTitles?: boolean;
  away?: boolean;
  /** App ids, most recent first. */
  recent?: string[];
  /** App ids whose notifications land in the stream silently and never on Home. */
  muted?: string[];
}

const RECENT = 6;

/**
 * Loads a person's preferences once, then saves each change shortly after it
 * happens, so flicking a switch twice is one request. Saving never gets in
 * the way: a failed save is reported, and the shell carries on with what was
 * chosen.
 */
export class PreferenceSync {
  private prefs: Preferences = {};
  private timer: ReturnType<typeof setTimeout> | undefined;

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
    try {
      const res = await (this.opts.fetchImpl ?? fetch)(this.url, { headers: { authorization: `Bearer ${await this.getToken()}`, accept: 'application/json' } });
      if (res.ok) this.prefs = { ...((await res.json()) as Preferences), ...this.prefs };
    } catch {
      // keep the defaults
    }
    return this.prefs;
  }

  set<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    this.prefs = { ...this.prefs, [key]: value };
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
    try {
      const res = await (this.opts.fetchImpl ?? fetch)(this.url, {
        method: 'PUT',
        headers: { authorization: `Bearer ${await this.getToken()}`, 'content-type': 'application/json' },
        body: JSON.stringify(this.prefs),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
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
