import type { AppManifestEntry } from '@augur/mfe-sdk';
import type { MenuCategory, MenuItem, ShellFindResult } from '@augur/ui-kit';
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
 * Title: one chapter per app. A chapter's items are the app's menu categories,
 * each opening the app's Orbit there (or, for an app without one, the
 * category's first page); an app without a menu is one item that opens it.
 */
export function titleMenu(manifest: AppManifestEntry[]): MenuCategory[] {
  return manifest.map((app) => ({
    id: app.id,
    label: app.name,
    icon: app.icon ?? 'apps',
    ai: app.ai,
    items: app.menu?.length
      ? app.menu.map((cat, i) => ({
          id: `${app.id}/${i}`,
          label: cat.label,
          icon: cat.icon ?? app.icon ?? 'apps',
          ai: cat.ai,
          detail: listed(cat.items.map((it) => it.label)),
          keywords: cat.items.map((it) => `${it.label} ${it.keywords ?? ''}`).join(' '),
        }))
      : [{ id: `${app.id}/`, label: app.name, icon: app.icon ?? 'apps', ai: app.ai, detail: app.description }],
  }));
}

/**
 * Where a Title item leads: the app, the Orbit category to start on, and the
 * path to open, which is the category's first page for an app without an Orbit.
 */
export function titleTarget(
  manifest: AppManifestEntry[],
  item: MenuItem,
): { app: AppManifestEntry; category: number; path?: string } | undefined {
  const [id, index] = (item.id ?? '').split('/');
  const app = manifest.find((a) => a.id === id);
  if (!app) return undefined;
  const category = index ? Number(index) : 0;
  const path = hasOrbit(app) ? undefined : app.menu?.[category]?.items[0]?.path;
  return { app, category, path };
}

/** Orbit: the app's own menu. Each item's id is the path it opens. */
export function orbitMenu(app: AppManifestEntry): MenuCategory[] {
  return (app.menu ?? []).map((cat) => ({
    id: cat.id,
    label: cat.label,
    icon: cat.icon ?? 'apps',
    ai: cat.ai,
    items: cat.items.map((it) => ({ id: it.path, label: it.label, icon: it.icon ?? cat.icon ?? 'apps', detail: it.detail, keywords: it.keywords, ai: it.ai })),
  }));
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
