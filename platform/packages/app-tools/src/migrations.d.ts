/** The types of `migrations.mjs` (the migration rules apps share with AUGUR, ADR 0053), for TypeScript callers. */

export type Migration = { id: string; sql: string };
/** A finding: the rule, its line in the migration, and what it means. */
export type Finding = { rule: string; line: number; message: string };
/** A lock: { "<service or app>": { "<migration id>": "<fingerprint>" } }. */
export type Lock = Record<string, Record<string, string>>;
/** Finds, for each migration given, what the release before can't live with: { "<name> <id>": findings }. */
export type Lint = (migrations: (Migration & { name: string })[]) => Record<string, Finding[]>;
/** Git in a checkout: its output, or a throw. */
export type Git = (...args: string[]) => string;

export const FALLBACK: [rule: string, pattern: RegExp, message: string][];
export function fallback(sql: string): Finding[];
export function lintWith(input: { squawk: string; config: string }): Lint;
export function fingerprint(sql: string): string;
export function mergeLocks(released?: Lock, frozen?: Lock): Lock;
export function mergeAppLocks(released?: Record<string, string>, frozen?: Record<string, string>): Record<string, string>;
export function problemsFor(all: Record<string, (Migration & { hash: string })[]>, released: Lock, mayBreak: Set<string>, options: { lint: Lint; frozenAt?: string }): string[];

export const APP_LOCK: 'service/migrations.lock.json';
export const SQUAWK_CONFIG: string;
export function appLockOf(migrations: Migration[]): Record<string, string>;
export function appLockText(migrations: Migration[]): string;
export function newestStable(tags: string[], prefix: string, version: string): string | undefined;
export function gitIn(cwd: string): Git;
export function releasedLock(input: { git: Git; prefix: string; version: string; path: string }): { tag?: string; version?: string; lock?: Record<string, unknown> };
export function lockOnBranch(input: { git: Git; ref: string; path: string }): Record<string, unknown> | undefined;
export function majorReleases(root: string): { names: Set<string>; why?: string };
export function mayBreakSince(version: string, released: string | undefined): boolean;
