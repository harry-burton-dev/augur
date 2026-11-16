import type { AppManifestEntry, Intent } from './contract.js';

/** Picks the app that handles an intent: the first manifest entry listing its type. */
export const resolveIntent = (manifest: AppManifestEntry[], intent: Intent): AppManifestEntry | undefined =>
  manifest.find((app) => app.handles?.includes(intent.type));

/**
 * Errors are matched by name, not instanceof: each app bundles its own copy of
 * this package, so an error made by the shell is never an instance of an app's class.
 */
export class IntentCancelled extends Error {
  override name = 'IntentCancelled';
  constructor(message = 'The request was closed without an answer.') {
    super(message);
  }
}

/** An intent that failed, such as one no app you can open handles. Match it with isIntentError, never instanceof. */
export class IntentError extends Error {
  override name = 'IntentError';
}

/** True when a request was closed without an answer, which is usually not an error to show. */
export const isIntentCancelled = (err: unknown): boolean => err instanceof Error && err.name === 'IntentCancelled';

/** True when an intent failed rather than being closed, such as when no app you can open handles it (SDK 3.2). */
export const isIntentError = (err: unknown): boolean => err instanceof Error && err.name === 'IntentError';
