import { readFileSync } from 'node:fs';

// Seed manifest until the registry has its own schema and apps register themselves.
export interface AppEntry {
  id: string;
  name: string;
  route: string;
  entry: string;
  version: string;
  description?: string;
  icon?: string;
  requiredRole?: string;
  handles?: string[];
}

/** The platform's own apps. Product apps (the Library app and later ones) are never listed here. */
export const platformApps: AppEntry[] = [
  { id: 'home', name: 'Home', route: '/', entry: '/apps/home/entry.js', version: '0.1.0', icon: 'home', description: 'What needs you' },
  {
    id: 'admin',
    name: 'Admin',
    route: '/admin',
    entry: '/apps/admin/entry.js',
    version: '0.1.0',
    icon: 'admin',
    description: 'People, departments and apps',
    requiredRole: 'admin',
  },
];

/**
 * App manifests to load at start, from APP_MANIFESTS (comma-separated paths to each
 * app's manifest.json). Stands in for self-registration until the registry has Postgres.
 */
export const loadAppManifests = (paths = process.env.APP_MANIFESTS ?? ''): AppEntry[] =>
  paths
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => JSON.parse(readFileSync(p, 'utf8')) as AppEntry);
