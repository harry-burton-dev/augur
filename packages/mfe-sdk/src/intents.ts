import type { AppManifestEntry, Intent } from './contract.js';

/** Picks the app that handles an intent: the first manifest entry listing its type. */
export const resolveIntent = (manifest: AppManifestEntry[], intent: Intent): AppManifestEntry | undefined =>
  manifest.find((app) => app.handles?.includes(intent.type));
