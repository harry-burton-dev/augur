// The release file for contract 3 (spec 3.3): `augur.app-release/v2`, beside the v1 writer in release.mjs,
// which apps on contract 2 keep using until they move. A v2 release carries the manifest, the frontend
// bundle by digest (or null), one Score workload per part with every image pinned by digest, who signed
// it, and `asks`: what an admin agrees to, written out so a runner compares two versions without reading
// the Score files.
import { FRONTEND_MEDIA_TYPE, channelOf } from './release.mjs';
import { contractValidators, partProblems } from './validate.mjs';

/** What an app-release.json on contract 3 says it is. */
export const APP_RELEASE_2_SCHEMA = 'augur.app-release/v2';

/** The default floors an app works on when its manifest doesn't say (spec 3, the manifest schema's default). */
const ALL_FLOORS = ['personal', 'team', 'org'];
/** The default upload cap in MB when the manifest doesn't say (spec 7.4). */
const DEFAULT_UPLOAD_MB = 10;

const DIGEST = /@sha256:[0-9a-f]{64}$/;

/** The one container of a part (AUGUR's part schema allows exactly one). Throws on a part that hasn't passed the schema. */
const containerOf = (workload) => {
  const container = Object.values(workload?.containers ?? {})[0];
  if (!container?.resources?.limits) throw new Error(`Part ${workload?.metadata?.name ?? '?'} has no container with resource limits: check it with augur-app validate first.`);
  return container;
};

/**
 * What a version asks an admin for, from its manifest and parts: scopes, the resources each part asks
 * for (with params), the limits of each part, the floors, the upload cap, the settings it offers and
 * whether it draws a canvas. A runner diffs this against the installed version's.
 */
export const asksOf2 = (manifest, parts) => ({
  scopes: manifest.scopes ?? [],
  resources: parts.flatMap((p) => Object.entries(p.resources ?? {}).map(([, r]) => ({ part: p.metadata.name, type: r.type, ...(r.params ? { params: r.params } : {}) }))),
  limits: Object.fromEntries(parts.map((p) => [p.metadata.name, containerOf(p).resources.limits])),
  floors: manifest.floors ?? ALL_FLOORS,
  maxUpload: manifest.maxUpload ?? DEFAULT_UPLOAD_MB,
  settings: (manifest.contributes?.settings ?? []).map((s) => s.id),
  canvas: Boolean(manifest.contributes?.canvas),
});

/**
 * Pins each part's image: the Score file names the image the part is built from (any tag or none), and
 * the release workflow, having pushed it, hands the digest reference here, by part name. A part whose
 * image isn't in `images` keeps its own reference, which must already be a digest.
 */
export const pinImages = (parts, images = {}) => {
  const names = new Set(parts.map((p) => p.metadata?.name));
  for (const key of Object.keys(images)) if (!names.has(key)) throw new Error(`images names a part ${key} that the release has no workload for (${[...names].join(', ') || 'none'}).`);
  return parts.map((p) => {
    containerOf(p);
    const [name, container] = Object.entries(p.containers)[0];
    const image = images[p.metadata.name] ?? container.image;
    if (!DIGEST.test(image)) throw new Error(`Part ${p.metadata.name}'s image must be named by digest, not ${image}.`);
    return { ...p, containers: { [name]: { ...container, image } } };
  });
};

/**
 * The file a deployment installs from, v2. `bundle` is what the release workflow pushed: `frontend`
 * ({ artifact, digest }, or absent for an app with no UI) and `images` (part name → image by digest).
 * The parts are given in the order the runner runs jobs; the file keeps that order.
 */
export const appRelease2 = ({ manifest, parts, bundle = {}, signer, notes = '', releasedAt = new Date().toISOString(), preview }) => {
  const v = contractValidators();
  const problems = v.manifest(manifest).map((p) => `manifest.json: ${p}`);
  for (const p of parts) for (const q of partProblems(p)) problems.push(`part ${p.metadata?.name ?? '?'}: ${q}`);
  if (problems.length) throw new Error(`The release can't be written:\n${problems.join('\n')}`);
  if (manifest.frontend && !bundle.frontend) throw new Error(`${manifest.id} has a frontend but the bundle has none.`);
  if (!manifest.frontend && bundle.frontend) throw new Error(`${manifest.id} has no frontend in its manifest, so the bundle's frontend would never be served (spec 3.5).`);
  if (bundle.frontend && !DIGEST.test(bundle.frontend.artifact)) throw new Error(`The frontend must be named by digest, not ${bundle.frontend.artifact}.`);
  if (!manifest.frontend && parts.length === 0) throw new Error(`${manifest.id} has neither a frontend nor a part to release.`);
  const pinned = pinImages(parts, bundle.images);
  const release = {
    schema: APP_RELEASE_2_SCHEMA,
    id: manifest.id,
    version: manifest.version,
    channel: bundle.channel ?? channelOf(manifest.version),
    releasedAt,
    manifest,
    frontend: bundle.frontend ? { artifact: bundle.frontend.artifact, digest: bundle.frontend.digest, mediaType: FRONTEND_MEDIA_TYPE } : null,
    parts: pinned,
    signer,
    asks: asksOf2(manifest, pinned),
    notes,
    ...(preview ? { preview } : {}),
  };
  const wrong = v.release(release);
  if (wrong.length) throw new Error(`The release file isn't a valid ${APP_RELEASE_2_SCHEMA}:\n${wrong.join('\n')}`);
  return release;
};

/** Whether a release file is on contract 3 (v2) rather than contract 2 (v1). */
export const isRelease2 = (release) => release?.schema === APP_RELEASE_2_SCHEMA;
