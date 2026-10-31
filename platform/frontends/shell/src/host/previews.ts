/** A pull request's build of an app, running beside it on this server for the app's developers. */
export interface Preview {
  pr: number;
  version: string;
  title?: string;
  /** The pull request. */
  url?: string;
  startedAt: string;
  endsAt: string;
}

/** An app the person is a developer of: the installed version, its previews, and the one they chose. */
export interface PreviewApp {
  app: string;
  name: string;
  version: string;
  chosen?: number;
  previews: Preview[];
  /** Live on the workbench: the entry on this person's own machine the shell loads instead of the app. */
  live?: string;
  /** Why it can't be loaded from their machine here: only the workbench does. */
  liveProblem?: string;
}

/** A pull request's build's version: <x.y.z>-pr.<number>.<run>. */
const PREVIEW = /-pr\.(\d+)\.\d+$/;

/** The pull request a version was built from, when it's a preview's. */
export const previewPr = (version: string | undefined) => {
  const m = version ? PREVIEW.exec(version) : null;
  return m ? Number(m[1]) : undefined;
};

const isPreviewApp = (a: unknown): a is PreviewApp =>
  !!a && typeof a === 'object' && typeof (a as PreviewApp).app === 'string' && typeof (a as PreviewApp).name === 'string' && Array.isArray((a as PreviewApp).previews);

/**
 * The previews this person may try. Nothing for someone who's no developer, and nothing (rather than
 * an error) from a registry without previews: they're for developers, never in anyone's way.
 */
export async function loadPreviews(fetchImpl: typeof fetch, url: string, token: string): Promise<PreviewApp[]> {
  try {
    const res = await fetchImpl(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
    if (!res.ok) return [];
    const body = (await res.json()) as { apps?: unknown };
    return Array.isArray(body?.apps) ? body.apps.filter(isPreviewApp) : [];
  } catch {
    return [];
  }
}

/** Uses pull request `pr`'s preview of `app` instead of the app, or with `null` goes back to the app. */
export async function choosePreview(fetchImpl: typeof fetch, url: string, token: string, app: string, pr: number | null): Promise<void> {
  const res = await fetchImpl(`${url}/${encodeURIComponent(app)}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ pr }),
  });
  if (!res.ok) {
    const said = ((await res.json().catch(() => ({}))) as { message?: string }).message;
    throw new Error(said ?? `The registry answered ${res.status}.`);
  }
}

/** Loads an app's frontend from this person's own machine (`pnpm dev:app <id> --live`), or with `null` stops. */
export async function chooseLive(fetchImpl: typeof fetch, url: string, token: string, app: string, entry: string | null): Promise<void> {
  const res = await fetchImpl(`${url}/${encodeURIComponent(app)}/live`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ url: entry }),
  });
  if (!res.ok) {
    const said = ((await res.json().catch(() => ({}))) as { message?: string }).message;
    throw new Error(said ?? `The registry answered ${res.status}.`);
  }
}

/** Where a preview stands, in a few words: what it is and when it goes. */
export const previewLine = (p: Preview) => `#${p.pr}${p.title ? ` ${p.title}` : ''} · ${p.version} · until ${new Date(p.endsAt).toLocaleDateString()}`;

/** One of an app's feature previews, as the person stands with it (SDK 1.7). */
export interface FeaturePreviewState {
  id: string;
  name: string;
  detail?: string;
  until?: string;
  /** Who gets it: nobody, those who turn it on, or everyone. An admin chooses in Admin → Apps. */
  mode: 'off' | 'opt-in' | 'everyone';
  ended?: boolean;
  on: boolean;
}

/** An app with feature previews, and each of them. */
export interface FeaturePreviewApp {
  app: string;
  name: string;
  previews: FeaturePreviewState[];
}

const isFeatureApp = (a: unknown): a is FeaturePreviewApp =>
  !!a && typeof a === 'object' && typeof (a as FeaturePreviewApp).app === 'string' && Array.isArray((a as FeaturePreviewApp).previews);

/** The feature previews of the apps this person can open; nothing (rather than an error) from a registry without them. */
export async function loadFeaturePreviews(fetchImpl: typeof fetch, url: string, token: string): Promise<FeaturePreviewApp[]> {
  try {
    const res = await fetchImpl(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
    if (!res.ok) return [];
    const body = (await res.json()) as { apps?: unknown };
    return Array.isArray(body?.apps) ? body.apps.filter(isFeatureApp) : [];
  } catch {
    return [];
  }
}

/** Turns one of an app's opt-in feature previews on or off for this person. */
export async function chooseFeaturePreview(fetchImpl: typeof fetch, url: string, token: string, app: string, preview: string, on: boolean): Promise<void> {
  const res = await fetchImpl(`${url}/${encodeURIComponent(app)}/${encodeURIComponent(preview)}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ on }),
  });
  if (!res.ok) {
    const said = ((await res.json().catch(() => ({}))) as { message?: string }).message;
    throw new Error(said ?? `The registry answered ${res.status}.`);
  }
}

/** Whether a person has anything to choose among an app's feature previews: one they can turn on or off. */
export const choosable = (p: FeaturePreviewState) => p.mode === 'opt-in' && !p.ended;

/** Where a feature preview stands for this person, in a few words, saying why when they can't change it. */
export const featureLine = (p: FeaturePreviewState) => {
  if (p.ended) return `Ended${p.until ? ` on ${new Date(`${p.until}T00:00:00Z`).toLocaleDateString()}` : ''}`;
  if (p.mode === 'everyone') return 'On for everyone: an admin chose that';
  if (p.mode === 'off') return 'Off for now: an admin hasn’t opened it';
  return `${p.on ? 'On for you' : 'Off'}${p.until ? ` · until ${new Date(`${p.until}T00:00:00Z`).toLocaleDateString()}` : ''}`;
};
