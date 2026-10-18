/** One app in the catalogue, as the app itself describes it in its manifest.json. */
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

/** The platform's own apps. They ship with the platform, so they live in code, not in the catalogue table. */
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

/** What a registering app may send. Mirrors AppManifestEntry in contracts/registry.openapi.yaml. */
export const appEntrySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'route', 'entry', 'version'],
  properties: {
    id: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,39}$' },
    name: { type: 'string', minLength: 1, maxLength: 60 },
    route: { type: 'string', pattern: '^/[a-z0-9][a-z0-9/-]*$', maxLength: 100 },
    entry: { type: 'string', minLength: 1, maxLength: 500 },
    version: { type: 'string', minLength: 1, maxLength: 40 },
    description: { type: 'string', maxLength: 140 },
    icon: { type: 'string', maxLength: 40 },
    requiredRole: { type: 'string', maxLength: 60 },
    handles: { type: 'array', maxItems: 50, items: { type: 'string', pattern: '^[a-z][a-z0-9.-]*$', maxLength: 80 } },
  },
} as const;

/** Why an app can't take the id or route it asked for, or undefined when it can. */
export const conflictFor = (entry: AppEntry, others: AppEntry[]): string | undefined => {
  const platform = platformApps.find((a) => a.id === entry.id);
  if (platform) return `"${entry.id}" is one of the platform's own apps.`;
  const sameRoute = [...platformApps, ...others].find((a) => a.id !== entry.id && a.route === entry.route);
  if (sameRoute) return `${sameRoute.name} already lives at ${entry.route}.`;
  return undefined;
};
