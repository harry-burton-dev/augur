import type { AppArea, AppCategory, AppManifestEntry } from '@augur/mfe-sdk';
import type { ShellApp, ShellAppGroup, ShellFindResult, ShellPage } from '@augur/shell-kit';
import { isWorkerApp, placePath } from './apps3.js';
import { incompatibility } from './manifest.js';
import { hrefFor, matchRoute } from './routes.js';
import { BAR_WORDS } from './words.js';

/**
 * What the shell shows at a location (PDR-020): the desktop, with the app bar across it, at "/";
 * anywhere else the app whose route it is, with the bar docked beside it as the rail.
 */
export type Screen = { kind: 'desk' } | { kind: 'app'; app: AppManifestEntry; path: string };

export function screenFor(manifest: AppManifestEntry[], pathname: string): Screen | undefined {
  if (pathname === '/' || pathname === '') return { kind: 'desk' };
  const match = matchRoute(manifest, pathname);
  return match && { kind: 'app', app: match.app, path: match.path };
}

/**
 * The app bar's groups, one tile each on the desktop (PDR-020 D1): each app's manifest category,
 * Platform and Pillars, then Apps for the rest. No new manifest field; the names are the shell's words.
 */
const BAR_GROUPS: { id: string; category?: AppCategory; icon: string; words: (product: string) => { name: string; line: string } }[] = [
  { id: 'platform', category: 'platform', icon: 'server', words: BAR_WORDS.platform },
  { id: 'pillar', category: 'pillar', icon: 'context', words: BAR_WORDS.pillars },
  { id: 'apps', icon: 'apps', words: BAR_WORDS.apps },
];

/** The group an app sits in on the bar: its category's, or Apps. */
export const groupOf = (app: AppManifestEntry) => BAR_GROUPS.find((g) => g.category && g.category === app.category)?.id ?? 'apps';

/** The groups that hold an app on this floor, in the bar's order. */
export const groupsFor = (manifest: AppManifestEntry[], product = productName()): ShellAppGroup[] =>
  BAR_GROUPS.filter((g) => manifest.some((a) => groupOf(a) === g.id)).map(({ id, icon, words }) => ({ id, icon, ...words(product) }));

/**
 * The open app's pages in the rail (PDR-020 D2): one per item of its manifest menu, in its order, each
 * named by the path it opens. An app with one page or none shows no page list.
 */
export function pagesOf(app: AppManifestEntry): ShellPage[] {
  // An app on the contract: its places, each saying where it opens and whether the app fills what sits under it (spec 6.3).
  // One place that fills is a list, since what is under it is the list.
  if (isWorkerApp(app)) {
    const seen = new Set<string>();
    const places = (app.manifest.contributes?.places ?? []).flatMap((p) => {
      const path = placePath(p);
      if (seen.has(path)) return [];
      seen.add(path);
      return [{ id: path, name: p.label, icon: p.icon ?? 'arrow', path, ...(p.fills ? { fills: true } : {}) }];
    });
    return places.length >= 2 || places.some((p) => p.fills) ? places : [];
  }
  const seen = new Set<string>();
  const pages = (app.menu ?? []).flatMap((g) =>
    g.items.flatMap((it) => {
      if (seen.has(it.path)) return [];
      seen.add(it.path);
      return [{ id: it.path, name: it.label, icon: it.icon ?? g.icon ?? 'arrow' }];
    }),
  );
  return pages.length >= 2 ? pages : [];
}

/** The page of the rail a path is on: the item with the longest path that holds it, or none. */
export function pageAt(app: AppManifestEntry, path: string): string {
  let best = '';
  for (const p of pagesOf(app)) {
    const inside = p.id === '/' ? true : path === p.id || path.startsWith(`${p.id}/`);
    if (inside && p.id.length > best.length) best = p.id;
  }
  return best;
}

/** One app as the shell's model takes it: its group on the bar and its pages for the rail. */
export const toShellApp = (a: AppManifestEntry): ShellApp => ({
  id: a.id,
  name: a.name,
  line: a.description,
  icon: a.icon ?? 'apps',
  ai: a.ai,
  sameOnEveryFloor: a.sameOnEveryFloor,
  group: groupOf(a),
  pages: pagesOf(a),
});

/**
 * The areas an app lists (SDK 1.5). Read, no longer drawn as menus (PDR-020 D5); the band still names the
 * area the open page is in. One area is the app itself, so it needs two to count.
 */
const areasOf = (app: AppManifestEntry): AppArea[] => ((app.areas?.length ?? 0) >= 2 ? app.areas! : []);

/** The area a page is in, when the app shows areas. */
export function areaOf(app: AppManifestEntry, path: string): AppArea | undefined {
  const group = app.menu?.find((g) => g.items.some((it) => it.path === path));
  return areasOf(app).find((a) => a.id === group?.area);
}

/**
 * The product's name, as the deployment sets it (ORG_PRODUCT_NAME): the web
 * container writes it into the page's `augur-product` meta. AUGUR without one.
 */
export function productName(doc: Pick<Document, 'querySelector'> | undefined = typeof document === 'undefined' ? undefined : document): string {
  return doc?.querySelector<HTMLMetaElement>('meta[name="augur-product"]')?.content.trim() || 'AUGUR';
}

/** A meta the web container fills in, empty when it's missing or still its placeholder (`@NAME@`). */
const pageMeta = (name: string, doc: Pick<Document, 'querySelector'> | undefined) => {
  const value = doc?.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content.trim() ?? '';
  return /^@[A-Z_]+@$/.test(value) ? '' : value;
};
const page = () => (typeof document === 'undefined' ? undefined : document);

/** The mark on the logo button, as the deployment sets it (ORG_LOGO_URL, the `augur-logo` meta). Empty for the kit's placeholder. */
export const logoUrl = (doc = page()): string => pageMeta('augur-logo', doc);

/** The id of the app drawn on the desktop, as the deployment sets it (DESKTOP_APP, the `augur-desktop` meta). Empty for a bare desktop. */
export const desktopAppId = (doc = page()): string => pageMeta('augur-desktop', doc);

/**
 * The app drawn on the desktop, when this person can open it on this floor: the desktop then holds it
 * at "/", under the bar and over the background. Otherwise the desktop stays bare.
 */
export const desktopApp = (manifest: AppManifestEntry[], id = desktopAppId()): AppManifestEntry | undefined =>
  id ? manifest.find((a) => a.id === id && !incompatibility(a)) : undefined;

/**
 * The tab's title, most specific first: the page, the app, the floor, the
 * product. The page is the app's menu item for where you are, when there is one.
 */
export function titleFor(screen: Screen | undefined, floor: string | undefined, product = productName()): string {
  const parts: string[] = [];
  if (screen?.kind === 'app') {
    const page = screen.app.menu?.flatMap((c) => c.items).find((it) => it.path === screen.path);
    if (page) parts.push(page.label);
    parts.push(screen.app.name);
  }
  if (floor) parts.push(floor);
  parts.push(product);
  return parts.join(' · ');
}

/**
 * Find across apps: every page an app's menu offers, matched on its label,
 * detail, keywords and category. Each result's id is the location it opens;
 * apps' own content joins when apps can answer searches themselves.
 */
export function findPages(manifest: AppManifestEntry[], q: string, limit = 12): ShellFindResult[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out: ShellFindResult[] = [];
  for (const app of manifest)
    for (const cat of app.menu ?? [])
      for (const it of cat.items) {
        const text = [it.label, it.detail, it.keywords, cat.label, app.name].join(' ').toLowerCase();
        if (words.every((w) => text.includes(w))) out.push({ id: hrefFor(app, it.path), title: it.label, detail: `${app.name} · ${cat.label}`, kind: 'page' });
      }
  return out.slice(0, limit);
}
