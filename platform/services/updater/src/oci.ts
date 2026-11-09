/**
 * Pulls one file out of an OCI artifact by digest, the way a release's frontend bundle is pushed (spec 3.3:
 * `oras push … frontend.tar.gz:<media type>`, so the artifact's manifest has one layer of that media type).
 * Only the registry's HTTP API is used (manifests and blobs by digest, a bearer token where the registry asks
 * for one), so nothing but Node is needed and nothing is run. The manifest's bytes are checked against the
 * digest the release names, and the layer's bytes against the digest the manifest names. Each body is read
 * as it arrives and dropped the moment it passes its ceiling, so a registry can't fill the runner's memory.
 */
import { createHash } from 'node:crypto';

export class ArtifactProblem extends Error {}

export interface ArtifactAuth {
  user: string;
  token: string;
}

export interface PullOptions {
  /** The artifact by digest: `<host>/<repository>@sha256:<64 hex>`. */
  ref: string;
  /** The media type of the one layer wanted. */
  mediaType: string;
  /** The most bytes the layer may be; a registry answering more is refused as soon as it passes that. */
  maxBytes: number;
  /**
   * The read key for a private registry, if the deployment has one for this host. It is sent only to the
   * registry's own sign-in (an https realm on the registry's host), never to a realm elsewhere.
   */
  auth?: ArtifactAuth;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const OCI_MANIFEST = 'application/vnd.oci.image.manifest.v1+json';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
/** A manifest is a few hundred bytes; one past this isn't a manifest. */
const MANIFEST_MAX_BYTES = 4 * 1024 * 1024;
/** A registry host (a name, or a name and port) and a repository, as the OCI distribution spec spells them. */
const HOST = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?::[0-9]{1,5})?$/i;
const REPOSITORY = /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*(?:\/[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*)*$/;

const sha256 = (bytes: Uint8Array) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

/** The parts of an artifact reference by digest. */
export const parseRef = (ref: string): { host: string; repository: string; digest: string } => {
  const m = /^([^/@]+)\/([^@]+)@(sha256:[0-9a-f]{64})$/.exec(ref);
  if (!m || !HOST.test(m[1]!) || !REPOSITORY.test(m[2]!)) throw new ArtifactProblem(`${ref} isn’t an artifact named by digest (<registry>/<repository>@sha256:…).`);
  return { host: m[1]!, repository: m[2]!, digest: m[3]! };
};

/** Reads a body up to `max` bytes; one past that is dropped unread with `tooBig`. */
const readUpTo = async (res: Response, max: number, tooBig: () => ArtifactProblem): Promise<Buffer> => {
  const length = Number(res.headers.get('content-length'));
  if (Number.isFinite(length) && length > max) {
    await res.body?.cancel().catch(() => undefined);
    throw tooBig();
  }
  if (!res.body) return Buffer.alloc(0);
  const parts: Uint8Array[] = [];
  let got = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    got += value.byteLength;
    if (got > max) {
      await reader.cancel().catch(() => undefined);
      throw tooBig();
    }
    parts.push(value);
  }
  return Buffer.concat(parts);
};

/**
 * The bearer token the registry's challenge asks for, exchanged at its realm. The read key goes along only when
 * the realm is the registry's own sign-in, over https: a realm elsewhere gets an anonymous exchange, and a
 * private artifact there says so.
 */
const tokenFor = async (host: string, challenge: string, auth: ArtifactAuth | undefined, call: (url: string, headers: Record<string, string>) => Promise<Response>) => {
  const params = Object.fromEntries([...challenge.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
  const realm = params.realm;
  if (!/^Bearer\b/i.test(challenge) || !realm) {
    const scheme = challenge.split(' ')[0];
    throw new ArtifactProblem(scheme ? `The registry asks for a sign-in this runner doesn’t do (${scheme}).` : 'The registry asked for a sign-in without saying how.');
  }
  let url: URL;
  try {
    url = new URL(realm);
  } catch {
    throw new ArtifactProblem(`The registry’s sign-in address isn’t one (${realm}).`);
  }
  if (url.protocol !== 'https:') throw new ArtifactProblem(`The registry signs in over ${url.protocol.replace(/:$/, '')}, not https; the runner won’t send a key there.`);
  if (params.service) url.searchParams.set('service', params.service);
  if (params.scope) url.searchParams.set('scope', params.scope);
  const own = url.host.toLowerCase() === host.toLowerCase();
  const key = own ? auth : undefined;
  const res = await call(url.toString(), key ? { authorization: `Basic ${Buffer.from(`${key.user}:${key.token}`).toString('base64')}` } : {});
  if (!res.ok) {
    if (key) throw new ArtifactProblem(`The registry refused the deployment’s read key (${res.status}).`);
    if (auth && !own) throw new ArtifactProblem(`The registry sends sign-ins to ${url.host}, not to itself, so the deployment’s read key wasn’t sent; it refused an anonymous pull (${res.status}).`);
    throw new ArtifactProblem(`The registry refused an anonymous pull (${res.status}); a private artifact needs the deployment’s read key (docs/upgrade.md).`);
  }
  const body = await readUpTo(res, MANIFEST_MAX_BYTES, () => new ArtifactProblem('The registry’s sign-in answered with more than a token.'));
  let answer: { token?: string; access_token?: string } = {};
  try {
    answer = JSON.parse(body.toString('utf8')) as typeof answer;
  } catch {
    // Said below.
  }
  const got = answer.token ?? answer.access_token;
  if (!got) throw new ArtifactProblem('The registry’s sign-in answered without a token.');
  return got;
};

/** The one layer of `mediaType` in the artifact `ref`, its bytes checked against the manifest's and the release's digests. */
export const pullArtifactLayer = async ({ ref, mediaType, maxBytes, auth, fetchImpl = fetch, timeoutMs = 60_000 }: PullOptions): Promise<Buffer> => {
  const { host, repository, digest } = parseRef(ref);
  const call = async (url: string, headers: Record<string, string>) => {
    try {
      // Bytes as they are: a body the registry compressed would be measured small and counted large.
      return await fetchImpl(url, { headers: { 'user-agent': 'augur-updater', 'accept-encoding': 'identity', ...headers }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      throw new ArtifactProblem(`${host} couldn’t be reached: ${(err as Error).message}`);
    }
  };
  // The registry says how to sign in when it needs one; a public artifact needs nothing.
  let authHeaders: Record<string, string> = {};
  const get = async (path: string, accept: string) => {
    let res = await call(`https://${host}/v2/${repository}/${path}`, { ...authHeaders, accept });
    if (res.status === 401 && !authHeaders.authorization) {
      const challenge = res.headers.get('www-authenticate') ?? '';
      await res.body?.cancel().catch(() => undefined);
      authHeaders = { authorization: `Bearer ${await tokenFor(host, challenge, auth, call)}` };
      res = await call(`https://${host}/v2/${repository}/${path}`, { ...authHeaders, accept });
    }
    return res;
  };
  const manifestRes = await get(`manifests/${digest}`, `${OCI_MANIFEST}, application/vnd.oci.artifact.manifest.v1+json`);
  if (manifestRes.status === 404) throw new ArtifactProblem(`${ref} isn’t in the registry.`);
  if (manifestRes.status === 401 || manifestRes.status === 403) throw new ArtifactProblem(`The registry refused to give ${ref} (${manifestRes.status}); a private artifact needs the deployment’s read key (docs/upgrade.md).`);
  if (!manifestRes.ok) throw new ArtifactProblem(`The registry answered ${manifestRes.status} for ${ref}.`);
  const manifestBytes = await readUpTo(manifestRes, MANIFEST_MAX_BYTES, () => new ArtifactProblem(`What the registry gave for ${ref} is too big to be a manifest.`));
  if (sha256(manifestBytes) !== digest) throw new ArtifactProblem(`What the registry gave for ${ref} doesn’t match its digest.`);
  let manifest: { layers?: { digest?: string; mediaType?: string; size?: number }[] };
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8')) as typeof manifest;
  } catch {
    throw new ArtifactProblem(`${ref} isn’t an OCI manifest.`);
  }
  if (typeof manifest !== 'object' || manifest === null) throw new ArtifactProblem(`${ref} isn’t an OCI manifest.`);
  const layers = (Array.isArray(manifest.layers) ? manifest.layers : []).filter((l) => l?.mediaType === mediaType);
  if (layers.length !== 1) throw new ArtifactProblem(`${ref} should hold one ${mediaType} file; it holds ${layers.length}.`);
  const layer = layers[0]!;
  if (!layer.digest || !DIGEST.test(layer.digest)) throw new ArtifactProblem(`${ref} names its file by no digest.`);
  const tooBig = () => new ArtifactProblem(`${ref}’s file is more than the ${maxBytes} bytes this AUGUR takes.`);
  if (layer.size !== undefined && layer.size > maxBytes) throw tooBig();
  const blobRes = await get(`blobs/${layer.digest}`, '*/*');
  if (!blobRes.ok) throw new ArtifactProblem(`The registry answered ${blobRes.status} for ${ref}’s file.`);
  const bytes = await readUpTo(blobRes, maxBytes, tooBig);
  if (sha256(bytes) !== layer.digest) throw new ArtifactProblem(`${ref}’s file doesn’t match the digest its manifest names.`);
  return bytes;
};
