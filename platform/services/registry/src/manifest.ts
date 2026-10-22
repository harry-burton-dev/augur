import semver from 'semver';

/** One app in the catalogue, as the app itself describes it in its manifest.json. */
export interface AppEntry {
  id: string;
  name: string;
  route: string;
  entry: string;
  /** The app's release, semver. */
  version: string;
  /** The SDK releases the app works with, a semver range such as "^1.2.0". */
  sdk: string;
  description?: string;
  icon?: string;
  requiredRole?: string;
  handles?: string[];
  ai?: boolean;
  menu?: AppMenuCategory[];
}

export interface AppMenuItem {
  id?: string;
  label: string;
  icon?: string;
  detail?: string;
  keywords?: string;
  ai?: boolean;
  path: string;
}

export interface AppMenuCategory {
  id?: string;
  label: string;
  icon?: string;
  ai?: boolean;
  items: AppMenuItem[];
}

/**
 * The platform's own apps. They ship with the platform, so they live in code, not in the catalogue table.
 * "/" is the shell's own: Title, where every app is a chapter.
 */
export const platformApps: AppEntry[] = [
  { id: 'home', name: 'Home', route: '/home', entry: '/apps/home/entry.js', version: '0.1.0', sdk: '^1.0.0', icon: 'home', description: 'What needs you' },
  {
    id: 'admin',
    name: 'Admin',
    route: '/admin',
    entry: '/apps/admin/entry.js',
    version: '0.1.0',
    sdk: '^1.0.0',
    icon: 'admin',
    description: 'People, departments and apps',
    requiredRole: 'admin',
    menu: [
      {
        label: 'People',
        icon: 'people',
        items: [
          { label: 'Everyone', icon: 'people', path: '/people', detail: 'Roles, departments, sign-in', keywords: 'users accounts roles disable' },
          { label: 'Add a person', icon: 'user-plus', path: '/people/new', keywords: 'invite create user' },
        ],
      },
      {
        label: 'Departments',
        icon: 'department',
        items: [
          { label: 'All departments', icon: 'department', path: '/departments', detail: 'Names and members', keywords: 'groups teams' },
          { label: 'New department', icon: 'plus', path: '/departments/new', keywords: 'create group team' },
        ],
      },
      {
        label: 'Apps',
        icon: 'apps',
        items: [{ label: 'All apps', icon: 'apps', path: '/apps', detail: 'Versions, on or off', keywords: 'catalogue registry enable disable' }],
      },
    ],
  },
];

/**
 * Platform apps whose frontend hasn't shipped yet. Their ids and routes stay
 * reserved, but the manifest leaves them out so no one is offered a dead end.
 */
export const unbuiltApps = new Set<string>();

/** What a registering app may send. Mirrors AppManifestEntry in contracts/registry.openapi.yaml. */
export const appEntrySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'route', 'entry', 'version', 'sdk'],
  properties: {
    id: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,39}$' },
    name: { type: 'string', minLength: 1, maxLength: 60 },
    route: { type: 'string', pattern: '^/[a-z0-9][a-z0-9/-]*$', maxLength: 100 },
    entry: { type: 'string', minLength: 1, maxLength: 500 },
    version: { type: 'string', minLength: 1, maxLength: 40 },
    sdk: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', maxLength: 140 },
    icon: { type: 'string', maxLength: 40 },
    requiredRole: { type: 'string', maxLength: 60 },
    handles: { type: 'array', maxItems: 50, items: { type: 'string', pattern: '^[a-z][a-z0-9.-]*$', maxLength: 80 } },
    ai: { type: 'boolean' },
    menu: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'items'],
        properties: {
          id: { type: 'string', maxLength: 40 },
          label: { type: 'string', minLength: 1, maxLength: 40 },
          icon: { type: 'string', maxLength: 40 },
          ai: { type: 'boolean' },
          items: {
            type: 'array',
            minItems: 1,
            maxItems: 12,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'path'],
              properties: {
                id: { type: 'string', maxLength: 40 },
                label: { type: 'string', minLength: 1, maxLength: 60 },
                icon: { type: 'string', maxLength: 40 },
                detail: { type: 'string', maxLength: 60 },
                keywords: { type: 'string', maxLength: 140 },
                ai: { type: 'boolean' },
                path: { type: 'string', pattern: '^/.+', maxLength: 200 },
              },
            },
          },
        },
      },
    },
  },
} as const;

/** Why an app's versions can't be read, or undefined when they can. The shell compares them with semver. */
export const versionProblem = (entry: AppEntry): string | undefined => {
  if (!semver.valid(entry.version)) return `"${entry.version}" is not a semver version such as 1.2.0.`;
  if (!semver.validRange(entry.sdk)) return `"${entry.sdk}" is not a semver range of SDK versions such as ^1.0.0.`;
  return undefined;
};

/** Why an app can't take the id or route it asked for, or undefined when it can. */
export const conflictFor = (entry: AppEntry, others: AppEntry[]): string | undefined => {
  const platform = platformApps.find((a) => a.id === entry.id);
  if (platform) return `"${entry.id}" is one of the platform's own apps.`;
  const sameRoute = [...platformApps, ...others].find((a) => a.id !== entry.id && a.route === entry.route);
  if (sameRoute) return `${sameRoute.name} already lives at ${entry.route}.`;
  return undefined;
};
