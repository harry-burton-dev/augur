/** The types of `catalog.mjs` (an app's Backstage catalog entry), for TypeScript callers. */

export const CATALOG_FILE: 'catalog-info.yaml';

/** A Backstage entity name made from a string: letters, digits and dashes, at most 63 characters. */
export function entityName(s: string): string;
/** `production` from 1.0.0, `experimental` before. */
export function lifecycle(version: string | undefined): 'production' | 'experimental';
/** The AUGUR APIs an app's manifest says it uses, as catalog references. */
export function appApis(manifest: { scopes?: string[]; [key: string]: unknown }): string[];
/** `owner/repo` from the environment or the git remote. */
export function repoSlug(input?: { env?: NodeJS.ProcessEnv; remote?: string }): string;

/** A Backstage catalog entity, as YAML will write it. */
export type CatalogEntity = Record<string, unknown>;

export function appCatalog(input: { manifest: Record<string, unknown> & { id: string; name: string; version: string }; parts: Record<string, Record<string, unknown>>; repo: string }): CatalogEntity[];
export function catalogText(entities: CatalogEntity[]): string;
