import { callerHeaders, GATEWAY_CALLER, signedCallerHeaders, withDeadline, type CallerSigner } from '@augur/service-kit';
import type { Upstreams } from './app.ts';

/**
 * Where apps' services are that the registry knows of, by app id, and the pull requests' previews
 * that some developers chose instead: app id → person id → where that preview is.
 */
export interface KnownUpstreams {
  apps: Upstreams;
  previews: Record<string, Record<string, string>>;
}

/** Where apps' services are, as the registry says. Throws when that can't be found out. */
export type AppUpstreams = () => Promise<KnownUpstreams>;

export class UpstreamsUnavailable extends Error {}

export interface RegistryUpstreamsOptions {
  registryUrl: string;
  /** Signs the gateway itself for the registry, which believes no other caller. */
  signer?: CallerSigner;
  /** How long the answer is used before the registry is asked again. */
  ttlMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/**
 * Where each app's service is, as the registry says (set by what runs the app, or an admin), asked
 * again after `ttlMs`. When the registry can't be reached, the last answer is used until it can,
 * so a registry restart doesn't cut people off from apps.
 */
export const registryUpstreams = ({ registryUrl, signer, ttlMs = 30_000, fetchImpl = fetch, now = Date.now }: RegistryUpstreamsOptions): AppUpstreams => {
  let last: { upstreams: KnownUpstreams; at: number } | undefined;
  let asking: Promise<KnownUpstreams> | undefined;
  const ask = async (): Promise<KnownUpstreams> => {
    let res: Response;
    try {
      const headers = { ...callerHeaders(GATEWAY_CALLER), ...(signer ? await signedCallerHeaders(signer, GATEWAY_CALLER, 'registry') : {}) };
      res = await withDeadline(fetchImpl)(`${registryUrl.replace(/\/$/, '')}/v1/upstreams`, { headers });
    } catch (err) {
      throw new UpstreamsUnavailable(`the registry could not be reached (${(err as Error).message})`);
    }
    if (!res.ok) throw new UpstreamsUnavailable(`the registry answered ${res.status}`);
    const { apps, previews } = (await res.json()) as Partial<KnownUpstreams>;
    return { apps: apps ?? {}, previews: previews ?? {} };
  };
  return async () => {
    if (last && now() - last.at < ttlMs) return last.upstreams;
    asking ??= ask()
      .then((upstreams) => {
        last = { upstreams, at: now() };
        return upstreams;
      })
      .finally(() => (asking = undefined));
    try {
      return await asking;
    } catch (err) {
      if (last) return last.upstreams;
      throw err;
    }
  };
};
