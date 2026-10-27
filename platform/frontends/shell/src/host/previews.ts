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

/** Where a preview stands, in a few words: what it is and when it goes. */
export const previewLine = (p: Preview) => `#${p.pr}${p.title ? ` ${p.title}` : ''} · ${p.version} · until ${new Date(p.endsAt).toLocaleDateString()}`;
