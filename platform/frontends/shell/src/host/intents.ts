import { resolveIntent, type AppManifestEntry, type Intent } from '@platform/mfe-sdk';

export class IntentError extends Error {}

/**
 * Routes an intent to the app that handles it. No app calls another directly:
 * the shell opens the handler with the intent in its mount context.
 */
export function routeIntent(manifest: AppManifestEntry[], intent: Intent, open: (app: AppManifestEntry, intent: Intent) => void) {
  const app = resolveIntent(manifest, intent);
  if (!app) throw new IntentError(`No app you can open handles "${intent.type}".`);
  open(app, intent);
  return app;
}
