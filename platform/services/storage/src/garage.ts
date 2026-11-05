import { createHash } from 'node:crypto';
import { withDeadline } from '@augur/service-kit';

/**
 * The few calls to Garage's admin API (v2) that give each app a bucket and a key
 * that opens only that bucket. Garage is the platform's object store: S3's API,
 * one container, no cluster to run. https://garagehq.deuxfleurs.fr/
 */
export interface GarageOptions {
  url: string;
  token: string;
  fetchImpl?: typeof fetch;
}

/**
 * A bucket key's id, derived from its secret, so a new secret in .env is a new key and the same one is left alone.
 * Apps work it out the same way (service-kit's bucketKeyIdFor), so they need only the secret.
 */
export const keyIdFor = (secret: string) => `GK${createHash('sha256').update(secret).digest('hex').slice(0, 24)}`;
/** The name an app's key carries in Garage, which is how its old keys are found. */
export const keyNameFor = (app: string) => `app-${app}`;

/** How much a single node offers; Garage only uses it to weigh nodes against each other. */
const NODE_CAPACITY = 1_000_000_000_000;

export class GarageError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

export const garageAdmin = ({ url, token, fetchImpl = fetch }: GarageOptions) => {
  const call = async <T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> => {
    const res = await withDeadline(fetchImpl, 15_000)(`${url.replace(/\/+$/, '')}/v2/${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok) throw new GarageError(res.status, json?.code, `Garage ${path}: ${res.status} ${json?.message ?? text}`);
    return json as T;
  };

  return {
    /** Waits until Garage answers, for when it is starting beside us. */
    async ready(attempts = 30, waitMs = 1000): Promise<void> {
      for (let i = 1; ; i++) {
        try {
          await call('GET', 'GetClusterStatus');
          return;
        } catch (err) {
          if (i >= attempts) throw err;
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
    },

    /** A new Garage has no layout and stores nothing until it has one: this gives its one node a role. */
    async ensureLayout(): Promise<'applied' | 'already'> {
      const layout = await call<{ version: number; roles: unknown[] }>('GET', 'GetClusterLayout');
      if (layout.roles.length) return 'already';
      const status = await call<{ nodes: { id: string }[] }>('GET', 'GetClusterStatus');
      await call('POST', 'UpdateClusterLayout', { roles: status.nodes.map((n) => ({ id: n.id, zone: 'local', capacity: NODE_CAPACITY, tags: [] })) });
      await call('POST', 'ApplyClusterLayout', { version: layout.version + 1 });
      return 'applied';
    },

    /** The bucket named after the app, made when missing. Returns its id. */
    async ensureBucket(alias: string): Promise<string> {
      try {
        return (await call<{ id: string }>('GET', `GetBucketInfo?globalAlias=${encodeURIComponent(alias)}`)).id;
      } catch (err) {
        if (!(err instanceof GarageError) || err.status !== 404) throw err;
        return (await call<{ id: string }>('POST', 'CreateBucket', { globalAlias: alias })).id;
      }
    },

    /**
     * The app's key for this secret (or the platform's own, named `name`), imported when it's new, allowed to read and
     * write the app's bucket only, and every other key the app had removed.
     */
    async ensureKey(app: string, secret: string, bucketId: string, name = keyNameFor(app)): Promise<string> {
      const id = keyIdFor(secret);
      const keys = await call<{ id: string; name: string }[]>('GET', 'ListKeys');
      if (!keys.some((k) => k.id === id)) await call('POST', 'ImportKey', { name, accessKeyId: id, secretAccessKey: secret });
      await call('POST', 'AllowBucketKey', { bucketId, accessKeyId: id, permissions: { read: true, write: true, owner: false } });
      for (const old of keys.filter((k) => k.name === name && k.id !== id)) await call('POST', `DeleteKey?id=${encodeURIComponent(old.id)}`);
      return id;
    },

    /**
     * Takes a bucket away, after `empty` has emptied it (Garage only deletes an empty bucket), with
     * the app's keys. False when there was no such bucket.
     */
    async removeBucket(alias: string, empty: () => Promise<void>, name = keyNameFor(alias)): Promise<boolean> {
      let id: string | undefined;
      try {
        id = (await call<{ id: string }>('GET', `GetBucketInfo?globalAlias=${encodeURIComponent(alias)}`)).id;
      } catch (err) {
        if (!(err instanceof GarageError) || err.status !== 404) throw err;
      }
      if (id) {
        await empty();
        await call('POST', `DeleteBucket?id=${encodeURIComponent(id)}`);
      }
      const keys = await call<{ id: string; name: string }[]>('GET', 'ListKeys');
      for (const key of keys.filter((k) => k.name === name)) await call('POST', `DeleteKey?id=${encodeURIComponent(key.id)}`);
      return Boolean(id);
    },

    /**
     * Serves the bucket's objects read-only on Garage's web endpoint (port 3902), so the
     * front door can hand them to browsers without a key. Only for what anyone may read.
     */
    async ensureWebsite(bucketId: string): Promise<void> {
      await call('POST', `UpdateBucket?id=${encodeURIComponent(bucketId)}`, { websiteAccess: { enabled: true, indexDocument: 'index.html', errorDocument: null } });
    },
  };
};
