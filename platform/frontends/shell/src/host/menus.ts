import type { AppArea, AppManifestEntry, AppMenuCategory } from '@augur/mfe-sdk';
import type { MenuCategory, MenuItem, ShellFindResult, ShellNav } from '@augur/ui-kit';
import { hrefFor, matchRoute } from './routes.js';

/**
 * What the shell shows at a location: Title (every app a chapter) at "/",
 * an app's Orbit menu at the app's root when it has one and wants it, or the
 * app itself.
 */
export type Screen =
  | { kind: 'title' }
  | { kind: 'orbit'; app: AppManifestEntry }
  | { kind: 'app'; app: AppManifestEntry; path: string };

export function screenFor(manifest: AppManifestEntry[], pathname: string, intent = false): Screen | undefined {
  if (pathname === '/' || pathname === '') return { kind: 'title' };
  const match = matchRoute(manifest, pathname);
  if (!match) return undefined;
  // An intent goes to the app itself, never its Orbit, so the app can answer it.
  if (match.path === '/' && hasOrbit(match.app) && !intent) return { kind: 'orbit', app: match.app };
  return { kind: 'app', app: match.app, path: match.path };
}

/** Whether the shell shows the app's menu as its Orbit; an app with `orbit: false` keeps its menu inside it. */
export const hasOrbit = (app: AppManifestEntry) => Boolean(app.menu?.length) && app.orbit !== false;

/** "Reports, Drafts and 2 more": one short line naming what a chapter leads to. */
const listed = (labels: string[]) =>
  labels.length <= 2 ? labels.join(' and ') : `${labels.slice(0, 2).join(', ')} and ${labels.length - 2} more`;

/**
 * The areas Title lists under an app. One child is the parent: an app with
 * one area or none shows only itself, so nothing is offered twice.
 */
export const areasOf = (app: AppManifestEntry): AppArea[] => ((app.areas?.length ?? 0) >= 2 ? app.areas! : []);

/**
 * The app's menu groups in the order Orbit shows them: by area, in the order
 * the app lists its areas, then any group without one. Within an area, the
 * app's own order.
 */
export function orbitGroups(app: AppManifestEntry): AppMenuCategory[] {
  const order = new Map(areasOf(app).map((a, i) => [a.id, i]));
  const rank = (g: AppMenuCategory) => order.get(g.area ?? '') ?? order.size;
  return (app.menu ?? []).map((g, i) => ({ g, i })).sort((a, b) => rank(a.g) - rank(b.g) || a.i - b.i).map(({ g }) => g);
}

/** Where in Orbit the group holding `path` sits, so going back up lands there. */
export const orbitIndexOf = (app: AppManifestEntry, path: string) => Math.max(0, orbitGroups(app).findIndex((g) => g.items.some((it) => it.path === path)));

/** The area a page, or Orbit group, is in, when the app shows areas. */
export function areaOf(app: AppManifestEntry, path: string): AppArea | undefined {
  const group = app.menu?.find((g) => g.items.some((it) => it.path === path));
  return areasOf(app).find((a) => a.id === group?.area);
}

const searchWords = (groups: AppMenuCategory[]) => groups.flatMap((g) => [g.label, ...g.items.map((it) => `${it.label} ${it.keywords ?? ''}`)]).join(' ');

/**
 * Title: one chapter per app, holding the app's areas. An app with fewer than
 * two is a choice by itself, captioned with its description. Title never
 * lists an app's groups or pages; those are Orbit's.
 */
export function titleMenu(manifest: AppManifestEntry[]): MenuCategory[] {
  return manifest.map((app) => {
    const areas = areasOf(app);
    const chapter = { id: app.id, label: app.name, icon: app.icon ?? 'apps', ai: app.ai };
    if (!areas.length) return { ...chapter, detail: app.description, keywords: searchWords(app.menu ?? []), items: [] };
    return {
      ...chapter,
      items: areas.map((area) => {
        const groups = (app.menu ?? []).filter((g) => g.area === area.id);
        return {
          id: `${app.id}/${area.id}`,
          label: area.label,
          icon: area.icon ?? 'folder',
          detail: area.detail ?? listed(groups.map((g) => g.label)),
          keywords: searchWords(groups),
        };
      }),
    };
  });
}

/**
 * Where a Title choice leads: the app, the Orbit group to start on (an area's
 * first), and, for an app that keeps its own menu, the area's first page.
 */
export function titleTarget(
  manifest: AppManifestEntry[],
  item: MenuItem,
): { app: AppManifestEntry; category: number; path?: string } | undefined {
  const [id, areaId] = (item.id ?? '').split('/');
  const app = manifest.find((a) => a.id === id);
  if (!app) return undefined;
  if (!areaId) return { app, category: 0 };
  const groups = orbitGroups(app);
  const category = Math.max(0, groups.findIndex((g) => g.area === areaId));
  const path = hasOrbit(app) ? undefined : groups[category]?.items[0]?.path;
  return { app, category, path };
}

/**
 * Orbit: the app's own menu, grouped by area, each group naming its area. A
 * group with one page is that page: choosing it opens the page. Each choice's
 * id is the path it opens.
 */
export function orbitMenu(app: AppManifestEntry): MenuCategory[] {
  const areas = areasOf(app);
  return orbitGroups(app).map((cat) => {
    const section = areas.find((a) => a.id === cat.area)?.label;
    const only = cat.items.length === 1 ? cat.items[0] : undefined;
    if (only) return { id: only.path, label: cat.label, icon: cat.icon ?? 'apps', ai: cat.ai || only.ai, section, detail: only.detail, keywords: `${only.label} ${only.keywords ?? ''}`, items: [] };
    return {
      id: cat.id,
      label: cat.label,
      icon: cat.icon ?? 'apps',
      ai: cat.ai,
      section,
      items: cat.items.map((it) => ({ id: it.path, label: it.label, icon: it.icon ?? 'arrow', detail: it.detail, keywords: it.keywords, ai: it.ai })),
    };
  });
}

/**
 * Up one level, which is what Back always does: from inside an app to its
 * Orbit, from Orbit (or an app without one) to Title. Nothing on Title. `to`
 * is where it goes and `label` names it, for Back's spoken name.
 */
export function upFrom(screen: Screen | undefined): { to: string; label: string } | undefined {
  if (!screen || screen.kind === 'title') return undefined;
  if (screen.kind === 'app' && hasOrbit(screen.app) && screen.path !== '/') return { to: hrefFor(screen.app), label: `${screen.app.name}’s menu` };
  return { to: '/', label: 'all apps' };
}

/** The app Home is: the one with the id `home`, when this floor has it. */
export const homeApp = (manifest: AppManifestEntry[]) => manifest.find((a) => a.id === 'home');

/**
 * The ways to go from every screen, the same everywhere: Home, and Title
 * (every app). The one you're on is marked; Home says so when this floor
 * hasn't got it, rather than going missing.
 */
export function navsFor(screen: Screen | undefined, manifest: AppManifestEntry[]): ShellNav[] {
  const home = homeApp(manifest);
  return [
    home
      ? { id: 'home', label: 'Home', icon: 'home', current: screen?.kind !== 'title' && screen?.app.id === home.id }
      : { id: 'home', label: 'Home', icon: 'home', unavailable: 'Home isn’t on this floor' },
    { id: 'title', label: 'All apps', icon: 'apps', current: screen?.kind === 'title' },
  ];
}

/** Where a nav goes: Home's start, or Title. */
export function navTarget(id: string, manifest: AppManifestEntry[]): string | undefined {
  if (id === 'title') return '/';
  const home = id === 'home' ? homeApp(manifest) : undefined;
  return home && hrefFor(home);
}

/**
 * Where Esc goes: up one level, as Back does, except that an app that keeps
 * its own menu keeps Esc for itself; Back is its way out.
 */
export function backFrom(screen: Screen | undefined): string | undefined {
  if (screen?.kind === 'app' && screen.app.menu?.length && screen.app.orbit === false) return undefined;
  return upFrom(screen)?.to;
}

/**
 * The tab's title, most specific first: the page, the app, the floor, AUGUR.
 * The page is the app's menu item for where you are, when there is one.
 */
export function titleFor(screen: Screen | undefined, floor: string | undefined, product = 'AUGUR'): string {
  const parts: string[] = [];
  if (screen && screen.kind !== 'title') {
    if (screen.kind === 'app') {
      const page = screen.app.menu?.flatMap((c) => c.items).find((it) => it.path === screen.path);
      if (page) parts.push(page.label);
    }
    parts.push(screen.app.name);
  }
  if (floor) parts.push(floor);
  parts.push(product);
  return parts.join(' · ');
}

/**
 * Whether an Esc is free for the shell to take as "go back": nothing it
 * passed through used it (a menu, an armed button, a filter) and no dialog or
 * text field had it.
 */
export function escapeIsFree(e: KeyboardEvent): boolean {
  if (e.key !== 'Escape' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return false;
  for (const node of e.composedPath()) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)) return false;
    if (node.tagName === 'DIALOG' || node.hasAttribute('open') || node.getAttribute('role') === 'dialog') return false;
  }
  return true;
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
