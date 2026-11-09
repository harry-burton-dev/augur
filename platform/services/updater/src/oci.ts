/**
 * Pulls one file out of an OCI artifact by digest, the way a release's frontend bundle is pushed (spec 3.3:
 * `oras push … frontend.tar.gz:<media type>`, so the artifact's manifest has one layer of that media type).
 * Only the registry's HTTP API is used (manifests and blobs by digest, a bearer token where the registry asks
 * for one), so nothing but Node is needed and nothing is run. The manifest's bytes are checked against the
 * digest the release names, and the layer's bytes against the digest the manifest names.
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
  /** The most bytes the layer may be; a registry answering more is refused before it is read whole. */
  maxBytes: number;
  /** The read key for a private registry, if the deployment has one for this host. */
  auth?: ArtifactAuth;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const OCI_MANIFEST = 'application/vnd.oci.image.manifest.v1+json';
const DIGEST = /^sha256:[0-9a-f]{64}$/;

const sha256 = (bytes: Uint8Array) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

/** The parts of an artifact reference by digest. */
export const parseRef = (ref: string): { host: string; repository: string; digest: string } => {
  const m = /^([^/@]+)\/([^@]+)@(sha256:[0-9a-f]{64})$/.exec(ref);
  if (!m) throw new ArtifactProblem(`${ref} isn’t an artifact named by digest (<registry>/<repository>@sha256:…).`);
  return { host: m[1]!, repository: m[2]!, digest: m[3]! };
};

/** The bearer token the registry's challenge asks for, exchanged at its realm, with the read key when there is one. */
const tokenFor = async (challenge: string, auth: ArtifactAuth | undefined, call: (url: string, headers: Record<string, string>) => Promise<Response>) => {
  const params = Object.fromEntries([...challenge.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
  const realm = params.realm;
  if (!/^Bearer\b/i.test(challenge) || !realm) throw new ArtifactProblem(`The registry asks for a sign-in this runner doesn’t do (${challenge.split(' ')[0]}).`);
  const url = new URL(realm);
  if (params.service) url.searchParams.set('service', params.service);
  if (params.scope) url.searchParams.set('scope', params.scope);
  const res = await call(url.toString(), auth ? { authorization: `Basic ${Buffer.from(`${auth.user}:${auth.token}`).toString('base64')}` } : {});
  if (!res.ok) throw new ArtifactProblem(auth ? `The registry refused the deployment’s read key (${res.status}).` : `The registry refused an anonymous pull (${res.status}); a private artifact needs the deployment’s read key (docs/upgrade.md).`);
  const { token, access_token: accessToken } = (await res.json().catch(() => ({}))) as { token?: string; access_token?: string };
  const got = token ?? accessToken;
  if (!got) throw new ArtifactProblem('The registry’s sign-in answered without a token.');
  return got;
};

/** The one layer of `mediaType` in the artifact `ref`, its bytes checked against the manifest's and the release's digests. */
export const pullArtifactLayer = async ({ ref, mediaType, maxBytes, auth, fetchImpl = fetch, timeoutMs = 60_000 }: PullOptions): Promise<Buffer> => {
  const { host, repository, digest } = parseRef(ref);
  const call = async (url: string, headers: Record<string, string>) => {
    try {
      return await fetchImpl(url, { headers: { 'user-agent': 'augur-updater', ...headers }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
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
      authHeaders = { authorization: `Bearer ${await tokenFor(challenge, auth, call)}` };
      res = await call(`https://${host}/v2/${repository}/${path}`, { ...authHeaders, accept });
    }
    return res;
  };
  const manifestRes = await get(`manifests/${digest}`, `${OCI_MANIFEST}, application/vnd.oci.artifact.manifest.v1+json`);
  if (manifestRes.status === 404) throw new ArtifactProblem(`${ref} isn’t in the registry.`);
  if (manifestRes.status === 401 || manifestRes.status === 403) throw new ArtifactProblem(`The registry refused to give ${ref} (${manifestRes.status}); a private artifact needs the deployment’s read key (docs/upgrade.md).`);
  if (!manifestRes.ok) throw new ArtifactProblem(`The registry answered ${manifestRes.status} for ${ref}.`);
  const manifestBytes = Buffer.from(await manifestRes.arrayBuffer());
  if (sha256(manifestBytes) !== digest) throw new ArtifactProblem(`What the registry gave for ${ref} doesn’t match its digest.`);
  let manifest: { layers?: { digest?: string; mediaType?: string; size?: number }[] };
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8')) as typeof manifest;
  } catch {
    throw new ArtifactProblem(`${ref} isn’t an OCI manifest.`);
  }
  const layers = (manifest.layers ?? []).filter((l) => l.mediaType === mediaType);
  if (layers.length !== 1) throw new ArtifactProblem(`${ref} should hold one ${mediaType} file; it holds ${layers.length}.`);
  const layer = layers[0]!;
  if (!layer.digest || !DIGEST.test(layer.digest)) throw new ArtifactProblem(`${ref} names its file by no digest.`);
  if (layer.size !== undefined && layer.size > maxBytes) throw new ArtifactProblem(`${ref}’s file is ${layer.size} bytes, more than the ${maxBytes} this AUGUR takes.`);
  const blobRes = await get(`blobs/${layer.digest}`, '*/*');
  if (!blobRes.ok) throw new ArtifactProblem(`The registry answered ${blobRes.status} for ${ref}’s file.`);
  const length = Number(blobRes.headers.get('content-length') ?? 0);
  if (length > maxBytes) throw new ArtifactProblem(`${ref}’s file is ${length} bytes, more than the ${maxBytes} this AUGUR takes.`);
  const bytes = Buffer.from(await blobRes.arrayBuffer());
  if (bytes.length > maxBytes) throw new ArtifactProblem(`${ref}’s file is more than the ${maxBytes} bytes this AUGUR takes.`);
  if (sha256(bytes) !== layer.digest) throw new ArtifactProblem(`${ref}’s file doesn’t match the digest its manifest names.`);
  return bytes;
};
