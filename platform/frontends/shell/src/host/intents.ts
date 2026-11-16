import { IntentCancelled, IntentError, intentHandlers, type AppManifestEntry, type Intent } from '@augur/mfe-sdk';

export { IntentError };

/** An intent type and the app a person chose to handle it, kept with their preferences (PER-468). */
export interface IntentChoice {
  intent: string;
  app: string;
}

/**
 * Who handles an intent: the one app that does, or the one the person chose before among several that
 * still do. Otherwise the apps to ask them to choose between, never one picked by its id.
 */
export function handlerFor(manifest: AppManifestEntry[], intent: Intent, chosen: IntentChoice[] = []): { app: AppManifestEntry } | { choose: AppManifestEntry[] } {
  const apps = intentHandlers(manifest, intent);
  if (!apps.length) throw new IntentError(`No app you can open handles "${intent.type}".`);
  if (apps.length === 1) return { app: apps[0]! };
  const kept = chosen.find((c) => c.intent === intent.type);
  const app = kept && apps.find((a) => a.id === kept.app);
  return app ? { app } : { choose: apps };
}

/** The app that answers an intent when only one does; with several, the person has to be asked first. */
const onlyHandler = (manifest: AppManifestEntry[], intent: Intent): AppManifestEntry => {
  const found = handlerFor(manifest, intent);
  if ('choose' in found) throw new IntentError(`${found.choose.map((a) => a.name).join(' and ')} both handle "${intent.type}": choose one first.`);
  return found.app;
};

/**
 * Routes an intent to the app that handles it. No app calls another directly:
 * the shell opens the handler with the intent in its mount context.
 */
export function routeIntent(manifest: AppManifestEntry[], intent: Intent, open: (app: AppManifestEntry, intent: Intent) => void, chosen?: AppManifestEntry) {
  const app = chosen ?? onlyHandler(manifest, intent);
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
  begin<T>(manifest: AppManifestEntry[], intent: Intent, chosen?: AppManifestEntry): { request: OpenRequest; answer: Promise<T> } {
    if (this.active) throw new IntentError(`${this.active.app.name} is already open for another request. Finish that first.`);
    const app = chosen ?? onlyHandler(manifest, intent);
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
