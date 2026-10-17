// Seed manifest until the registry has its own schema (build step 3).
export interface AppEntry {
  id: string;
  name: string;
  route: string;
  entry: string;
  version: string;
  requiredRole?: string;
  handles?: string[];
}

export const seedApps: AppEntry[] = [
  { id: 'home', name: 'Home', route: '/', entry: '/apps/home/entry.js', version: '0.1.0' },
  {
    id: 'library',
    name: 'Library',
    route: '/library',
    entry: '/apps/library/entry.js',
    version: '0.1.0',
    handles: ['document.open'],
  },
  { id: 'admin', name: 'Admin', route: '/admin', entry: '/apps/admin/entry.js', version: '0.1.0', requiredRole: 'admin' },
];
