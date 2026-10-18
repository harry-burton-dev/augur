import { IntentCancelled, IntentError, resolveIntent, type AppManifestEntry, type Intent } from '@platform/mfe-sdk';

export { IntentError };

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

export interface OpenRequest {
  /** The app answering. */
  app: AppManifestEntry;
  intent: Intent;
}

/**
 * The one request open at a time: an app asked another for an answer, the
 * answering app is open over it, and the asker waits on a promise.
 */
export class RequestBroker {
  private active?: OpenRequest & { resolve(result: unknown): void; reject(err: Error): void };

  get current(): OpenRequest | undefined {
    return this.active && { app: this.active.app, intent: this.active.intent };
  }

  /** Starts a request; the promise settles when the answering app responds or the person closes it. */
  begin<T>(manifest: AppManifestEntry[], intent: Intent): { request: OpenRequest; answer: Promise<T> } {
    if (this.active) throw new IntentError(`${this.active.app.name} is already open for another request. Finish that first.`);
    const app = resolveIntent(manifest, intent);
    if (!app) throw new IntentError(`No app you can open handles "${intent.type}".`);
    const answer = new Promise<T>((resolve, reject) => {
      this.active = { app, intent, resolve: resolve as (r: unknown) => void, reject };
    });
    return { request: { app, intent }, answer };
  }

  respond(result: unknown) {
    const active = this.active;
    this.active = undefined;
    active?.resolve(result);
  }

  cancel(err: Error = new IntentCancelled()) {
    const active = this.active;
    this.active = undefined;
    active?.reject(err);
  }
}
