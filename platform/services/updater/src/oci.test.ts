import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ArtifactProblem, parseRef, pullArtifactLayer } from './oci.ts';

const sha = (b: Buffer | string) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const MEDIA = 'application/vnd.augur.frontend.v1.tar+gzip';

/** A registry holding one artifact with one frontend layer and a signature layer, behind a bearer token. */
const registry = ({ priv = false, manifestLies = false, blobLies = false } = {}) => {
  const blob = Buffer.from('frontend bytes');
  const manifest = Buffer.from(
    JSON.stringify({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      artifactType: 'application/vnd.augur.frontend.v1',
      layers: [
        { mediaType: MEDIA, digest: manifestLies ? sha('other') : sha(blob), size: blob.length },
        { mediaType: 'application/vnd.dev.cosign.simplesigning.v1+json', digest: sha('sig'), size: 3 },
      ],
    }),
  );
  const digest = sha(manifest);
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push(`${url}${headers.authorization ? ` as ${headers.authorization.split(' ')[0]}` : ''}`);
    if (url.startsWith('https://reg.test/token')) {
      if (priv && headers.authorization !== `Basic ${Buffer.from('reader:key-1').toString('base64')}`) return new Response('{}', { status: 401 });
      return Response.json({ token: 't-1' });
    }
    if (headers.authorization !== 'Bearer t-1') return new Response('', { status: 401, headers: { 'www-authenticate': 'Bearer realm="https://reg.test/token",service="reg.test",scope="repository:o/notes-frontend:pull"' } });
    if (url === `https://reg.test/v2/o/notes-frontend/manifests/${digest}`) return new Response(manifest, { headers: { 'content-type': 'application/vnd.oci.image.manifest.v1+json' } });
    if (url === `https://reg.test/v2/o/notes-frontend/blobs/${manifestLies ? sha('other') : sha(blob)}`) return new Response(blobLies ? Buffer.from('tampered') : blob);
    return new Response('', { status: 404 });
  }) as typeof fetch;
  return { ref: `reg.test/o/notes-frontend@${digest}`, blob, fetchImpl, calls };
};

describe('pulling a release’s frontend bundle out of its OCI artifact (spec 3.3)', () => {
  it('reads the ref', () => {
    expect(parseRef(`ghcr.io/o/r/notes-frontend@${sha('x')}`)).toEqual({ host: 'ghcr.io', repository: 'o/r/notes-frontend', digest: sha('x') });
    expect(() => parseRef('ghcr.io/o/r/notes-frontend:1.0.0')).toThrow(ArtifactProblem);
  });

  it('signs in as the registry asks, takes the one layer of the media type, and checks both digests', async () => {
    const r = registry();
    const bytes = await pullArtifactLayer({ ref: r.ref, mediaType: MEDIA, maxBytes: 1024, fetchImpl: r.fetchImpl });
    expect(bytes.equals(r.blob)).toBe(true);
    // One challenge, one token, then the manifest and the blob with it.
    expect(r.calls.filter((c) => c.includes('/token'))).toHaveLength(1);
    expect(r.calls.at(-1)).toMatch(/blobs\/sha256:.* as Bearer$/);
  });

  it('sends the read key only to the registry’s sign-in, and says when a private artifact needs one', async () => {
    const r = registry({ priv: true });
    await expect(pullArtifactLayer({ ref: r.ref, mediaType: MEDIA, maxBytes: 1024, fetchImpl: r.fetchImpl })).rejects.toThrow(/anonymous pull.*read key/);
    const bytes = await pullArtifactLayer({ ref: r.ref, mediaType: MEDIA, maxBytes: 1024, fetchImpl: r.fetchImpl, auth: { user: 'reader', token: 'key-1' } });
    expect(bytes.equals(r.blob)).toBe(true);
    expect(r.calls.filter((c) => c.endsWith('as Basic')).every((c) => c.startsWith('https://reg.test/token'))).toBe(true);
  });

  it('refuses bytes that don’t match the digests, a missing artifact, and a file too big', async () => {
    const lies = registry({ blobLies: true });
    await expect(pullArtifactLayer({ ref: lies.ref, mediaType: MEDIA, maxBytes: 1024, fetchImpl: lies.fetchImpl })).rejects.toThrow(/doesn’t match the digest its manifest names/);
    const r = registry();
    await expect(pullArtifactLayer({ ref: r.ref.replace(/@sha256:.*/, `@${sha('nope')}`), mediaType: MEDIA, maxBytes: 1024, fetchImpl: r.fetchImpl })).rejects.toThrow(/isn’t in the registry/);
    await expect(pullArtifactLayer({ ref: r.ref, mediaType: MEDIA, maxBytes: 4, fetchImpl: r.fetchImpl })).rejects.toThrow(/more than the 4/);
    await expect(pullArtifactLayer({ ref: r.ref, mediaType: 'application/other', maxBytes: 1024, fetchImpl: r.fetchImpl })).rejects.toThrow(/should hold one application\/other file; it holds 0/);
  });
});
