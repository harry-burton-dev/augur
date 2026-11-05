// The release steps every AUGUR app shares, in this repository or its own (ADR 0047): versions for
// dev builds and previews, channels, and the app-release.json a deployment's app runner installs from.
// scripts/app-release.mjs (apps in this repository) and the augur-app command (an app in its own
// repository) both build on these, so a release reads the same wherever it was made.
import semver from 'semver';

/** What an app-release.json says it is, so a runner can refuse one it doesn't understand. */
export const APP_RELEASE_SCHEMA = 'augur.app-release/v1';
/** The media type of a frontend tarball in the registry, as ORAS pushes it. */
export const FRONTEND_MEDIA_TYPE = 'application/vnd.augur.frontend.v1.tar+gzip';
/** The tag an app's release gets: app/<id>@<version>, beside AUGUR's augur@<version>. */
export const appTag = (id, version) => `app/${id}@${version}`;

/** A pull request's build: <x.y.z>-pr.<number>.<run>, as the registry recognises it. */
const PREVIEW = /-pr\.(\d+)\.\d+$/;
/** A dev build: <x.y.z>-dev.<run>, as the registry recognises it. */
const DEV = /-dev\.\d+$/;
/** How many of each app's dev builds are kept as releases. */
export const DEV_BUILDS_KEPT = 3;
/** stable, beta for a version with a prerelease part, preview for a pull request's build, or dev for a dev build. */
export const channelOf = (version) => (PREVIEW.test(version) ? 'preview' : DEV.test(version) ? 'dev' : semver.prerelease(version) ? 'beta' : 'stable');
/**
 * The version a dev build is given: the next patch after the app's own (so it sorts above the release
 * it follows and below the next), then the run. An app already on a prerelease keeps its x.y.z.
 */
export const devVersion = (version, run) => {
  const base = semver.parse(version);
  if (!base) throw new Error(`"${version}" is not a version.`);
  if (!/^\d+$/.test(String(run))) throw new Error('The run is a number.');
  const next = base.prerelease.length ? `${base.major}.${base.minor}.${base.patch}` : semver.inc(version, 'patch');
  return `${next}-dev.${run}`;
};
/** The app a dev build's tag is of, or undefined for any other tag. */
export const devAppOf = (tag) => {
  const m = /^app\/([a-z][a-z0-9-]{1,39})@(.+)$/.exec(tag);
  return m && DEV.test(m[2]) && semver.valid(m[2]) ? m[1] : undefined;
};
/** Which of an app's dev build tags to delete: all but the newest `kept` and those in `keep`. */
export const oldDevBuilds = (tags, app, keep = [], kept = DEV_BUILDS_KEPT) =>
  tags
    .filter((t) => devAppOf(t) === app)
    .sort((a, b) => semver.rcompare(a.split('@')[1], b.split('@')[1]))
    .slice(kept)
    .filter((t) => !keep.includes(t));
/** The version a pull request's build is given: the app's own, without any prerelease part, then the pull request and run. */
export const previewVersion = (version, pr, run) => {
  const base = semver.parse(version);
  if (!base) throw new Error(`"${version}" is not a version.`);
  if (!/^\d+$/.test(String(pr)) || !/^\d+$/.test(String(run))) throw new Error('The pull request and run are numbers.');
  return `${base.major}.${base.minor}.${base.patch}-pr.${pr}.${run}`;
};
/** The pull request a preview release's tag was built from, or undefined. */
export const previewPrOf = (tag) => {
  const m = /^app\/[a-z][a-z0-9-]{1,39}@(.+)$/.exec(tag);
  const pr = m && PREVIEW.exec(m[1]);
  return pr ? Number(pr[1]) : undefined;
};
/** What a version asks an admin for, beyond what any app gets: for a runner to compare with the version before. */
export const asksOf = (manifest) => ({
  scopes: manifest.scopes ?? [],
  storage: manifest.storage ?? {},
  floors: manifest.floors ?? ['personal', 'team', 'org'],
  maxUpload: manifest.maxUpload ?? 10,
  settings: (manifest.settings ?? []).map((s) => s.id),
});

/**
 * The file a deployment installs from: the manifest, where its service image and frontend are, by
 * digest, who built and signed them, and what it asks for. `bundle` is what infra/release-app.sh printed.
 */
export const appRelease = ({ app, bundle, signer, notes = '', releasedAt = new Date().toISOString(), preview }) => {
  const { manifest } = app;
  if (bundle.service && !/@sha256:[0-9a-f]{64}$/.test(bundle.service)) throw new Error(`The service image must be named by digest, not ${bundle.service}.`);
  if (bundle.frontend && !/@sha256:[0-9a-f]{64}$/.test(bundle.frontend.artifact)) throw new Error(`The frontend must be named by digest, not ${bundle.frontend.artifact}.`);
  if (!bundle.service && !bundle.frontend) throw new Error(`${app.id} has neither a service nor a frontend to release.`);
  return {
    schema: APP_RELEASE_SCHEMA,
    id: manifest.id,
    version: manifest.version,
    channel: bundle.channel ?? channelOf(manifest.version),
    releasedAt,
    sdk: manifest.sdk,
    manifest,
    service: bundle.service ? { image: bundle.service } : null,
    frontend: bundle.frontend ? { artifact: bundle.frontend.artifact, digest: bundle.frontend.digest, mediaType: FRONTEND_MEDIA_TYPE } : null,
    signer,
    asks: asksOf(manifest),
    notes,
    // Which pull request it was built from, and where to read it.
    ...(preview ? { preview } : {}),
  };
};

/** The notes under `## <version>` in a CHANGELOG.md's text, as Changesets writes them, or ''. */
export const changelogSection = (text, version) => {
  const start = text.indexOf(`\n## ${version}\n`);
  if (start < 0) return '';
  const body = text.slice(start + `\n## ${version}\n`.length);
  const end = body.search(/\n## /);
  return (end < 0 ? body : body.slice(0, end)).trim().replace(/^### /gm, '#### ');
};

/** The text of a GitHub release for it: a preview's, a dev build's, or a release's with its changelog. */
export const releaseNotes = (release, { target = 'main' } = {}) =>
  release.preview
    ? `A preview of ${release.manifest.name} from pull request #${release.preview.pr}${release.preview.title ? `, ${release.preview.title}` : ''}. It runs beside the app for its developers, and goes when the pull request closes.\n`
    : release.channel === 'dev'
      ? `A dev build of ${release.manifest.name}, from ${target}. Only a preview server set to take dev builds of it installs it.\n`
      : `${release.manifest.name} ${release.version}.\n\n${release.notes || '_No changelog entry._'}\n`;

/**
 * Who built it, from the workflow's own settings: the repository and the workflow file a runner checks
 * each signature against.
 */
export const signerOf = (env = process.env) => ({
  repository: env.GITHUB_REPOSITORY ?? 'harry-burton-dev/augur',
  workflow: env.GITHUB_WORKFLOW_REF?.replace(/^[^/]+\/[^/]+\//, '').replace(/@.*$/, '') ?? '.github/workflows/release.yml',
});
