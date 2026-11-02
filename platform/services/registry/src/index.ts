import { callerCheckFromEnv, commonSettings, floorPlaces, loadConfigOrExit, platformCredentialsFromEnv, serviceVerifierFromEnv } from '@augur/service-kit';
import { auditTo, buildApp, pillarsFromEnv } from './app.ts';
import { appFeed, AppUpdateChecker } from './app-updates.ts';
import { AUGUR_RELEASE } from './augur-version.ts';
import { frontendFilesFromEnv } from './frontends.ts';
import { knownTimeZone } from './desired-state.ts';
import { tailnetOf } from './live.ts';
import { PipelineReader, pipelineUrlFor } from './pipeline.ts';
import { cosignFeedCheck, feedSigner, repoOfFeed, TRUSTED_ROOT_IN_REGISTRY } from './feed-trust.ts';
import { DEFAULT_FEED_URL, DEFAULT_OCI_FEED_URL, feedTokenFromEnv, readKeyFromEnv, releaseFeed, UpdateChecker, type Channel } from './updates.ts';
import { reportingFrom } from './report.ts';
import { ringFrom, takesPreview } from './ring.ts';
import { MemoryAppStore, PgAppStore, type AppStore } from './store.ts';

// Every setting the registry reads, checked before it starts (in production, a missing one stops it).
loadConfigOrExit('registry', [
  commonSettings.database,
  commonSettings.identity,
  commonSettings.events,
  commonSettings.issuer,
  commonSettings.issuerInside,
  commonSettings.clientSecret,
  commonSettings.gateway,
  { name: 'GITHUB_READ_USER', about: 'the GitHub account the deployment’s read key (secrets/github-read-key) belongs to.' },
  { name: 'GITHUB_READ_KEY', about: 'the deployment’s read key, a GitHub token with read:packages, usually in secrets/github-read-key.', secret: true },
  { name: 'RELEASE_FEED_URL', about: 'where new AUGUR releases are listed, or off.' },
  { name: 'RELEASE_CHANNEL', about: 'stable, beta or dev (default: dev on the workbench, beta on a preview server, stable on a production one, which takes nothing else; only the workbench takes dev).' },
  { name: 'PIPELINE_FEED_URL', about: 'where the pipeline feed is (default: feed:pipeline beside the release feed on GitHub’s container registry, else off).' },
  { name: 'PORTAL_URL', about: 'the company’s Backstage, which the Upgrade Centre links to and this deployment reports what it runs to (optional).' },
  { name: 'DEPLOYMENT_ID', about: 'this deployment’s name in Backstage’s catalog (org/deployments.yaml), such as augur-workbench; without it nothing is reported.' },
  { name: 'DEPLOYMENT_REPORTING', about: 'off: don’t report what this server runs to Backstage, or export it (default on).' },
  { name: 'PLATFORM_URL', about: 'where AUGUR is; on the workbench, Live on the workbench loads apps only from machines on its tailnet (https://<machine>.<tailnet>.ts.net).' },
  { name: 'SERVER_RING', about: 'dev (the workbench), preview or production (default): what kind of server this is (docs/release-channels.md).' },
  { name: 'ALLOW_PR_PREVIEWS', about: 'on: run pull requests’ builds for apps’ developers on a production server too.' },
  { name: 'APP_FEED_URL', about: 'where new versions of apps are listed, or off.' },
  { name: 'DEPLOYMENT_TIME_ZONE', about: 'the time zone upgrade windows are in, such as Europe/London (default UTC).' },
  { name: 'FEED_SIGNER', about: 'who must sign the release feed, for a fork (default: this repository’s Release feed workflow).' },
  { name: 'PILLAR_APPS', about: 'the apps that ship with AUGUR, which register themselves.' },
  { name: 'FRONTENDS_BUCKET_SECRET', about: 'the registry’s key to the bucket apps’ frontends are kept in by version.', secret: true },
  { name: 'FRONTENDS_S3_URL', about: 'where that bucket is.' },
]);

const port = Number(process.env.PORT ?? 8082);

let store: AppStore;
if (process.env.DATABASE_URL) {
  store = await PgAppStore.connect(process.env.DATABASE_URL);
} else if (process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL is not set: the registry needs Postgres to keep the catalogue.');
} else {
  console.warn('DATABASE_URL is not set: keeping registered apps in memory until the registry restarts.');
  store = new MemoryAppStore();
}

// The registry signs in as itself (Keycloak client platform-registry) to write the audit log.
const { EVENTS_URL } = process.env;
const credentials = platformCredentialsFromEnv('registry');
const audit = EVENTS_URL && credentials ? auditTo(EVENTS_URL, credentials) : undefined;
if (!audit) console.warn('EVENTS_URL or SERVICE_CLIENT_SECRET is not set: changes to the catalogue are not audited.');

// Where floors sit comes from identity, asked as the registry.
const { IDENTITY_URL = 'http://localhost:8081' } = process.env;
const floors = credentials ? floorPlaces({ identityUrl: IDENTITY_URL, credentials }) : undefined;
if (!floors) console.warn('SERVICE_CLIENT_SECRET is not set: the catalogue can’t be read floor by floor.');

// New AUGUR releases: with the deployment's read key, the feed the Release workflow keeps beside the images
// on GitHub's container registry; without one, this repo's GitHub releases (with RELEASE_FEED_TOKEN's older
// Contents: read token); or a mirror's feed. RELEASE_FEED_URL=off checks none.
// RELEASE_CHANNEL is stable, beta or dev; by default the channel of the release this registry ships in.
// Compose passes unset settings as empty strings.
const readKey = readKeyFromEnv();
const githubFeed = readKey ? DEFAULT_OCI_FEED_URL : DEFAULT_FEED_URL;
const feedUrl = process.env.RELEASE_FEED_URL || githubFeed;
const channel = (process.env.RELEASE_CHANNEL || undefined) as Channel | undefined;
if (channel && !['stable', 'beta', 'dev'].includes(channel)) throw new Error('RELEASE_CHANNEL is stable, beta or dev.');
// What kind of server this is: a production one follows stable only and runs no pull requests' builds.
const ring = ringFrom(process.env.SERVER_RING);
const allowPrPreviews = takesPreview(ring) || process.env.ALLOW_PR_PREVIEWS === 'on';
// The publisher's feed is signed by its Release feed workflow (ADR 0017); FEED_SIGNER names another
// signer, for a fork. Checked offline when the deployment has Sigstore's trust root (docs/mirror.md).
const signer = process.env.FEED_SIGNER || feedSigner(repoOfFeed(feedUrl) ?? repoOfFeed(DEFAULT_OCI_FEED_URL)!);
const checking = { check: cosignFeedCheck({ identity: signer, trustedRoot: TRUSTED_ROOT_IN_REGISTRY }), signer };
const feed = feedUrl === 'off' ? undefined : releaseFeed({ url: feedUrl, token: feedTokenFromEnv(), key: readKey, ...checking });
const updates = new UpdateChecker({ feed, running: AUGUR_RELEASE, channel, ring });
// The line from dev to production, for the Upgrade Centre: beside the release feed, read with the same key.
const pipeline = new PipelineReader(process.env.PIPELINE_FEED_URL || (feedUrl === 'off' ? 'off' : pipelineUrlFor(feedUrl)), { token: feedTokenFromEnv(), key: readKey });
// Upgrade windows (ADR 0020) are in the deployment's own time zone unless a unit names another.
const timeZone = process.env.DEPLOYMENT_TIME_ZONE || 'UTC';
if (!knownTimeZone(timeZone)) throw new Error(`DEPLOYMENT_TIME_ZONE is a time zone such as Europe/London, not "${timeZone}".`);
const portalUrl = process.env.PORTAL_URL?.replace(/\/+$/, '') || undefined;
if (portalUrl && !/^https?:\/\//.test(portalUrl)) throw new Error('PORTAL_URL is an http(s) address.');
updates.start();
// What this deployment runs, signed and sent to Backstage after each change and once a day (ADR 0019).
const reporting = reportingFrom(process.env);

// Live on the workbench loads apps only from machines on the workbench's own tailnet, the one in PLATFORM_URL.
const tailnet = tailnetOf(process.env.PLATFORM_URL);

// Apps' own releases, for the app runner (Admin → Apps): from the same feed, read with the same key or
// token, unless APP_FEED_URL says otherwise. Off when the AUGUR feed is a mirror or off and APP_FEED_URL
// isn't set, or with APP_FEED_URL=off.
const appFeedUrl = process.env.APP_FEED_URL || (process.env.RELEASE_FEED_URL ? 'off' : githubFeed);
const appUpdates = new AppUpdateChecker(appFeedUrl === 'off' ? undefined : appFeed({ url: appFeedUrl, token: feedTokenFromEnv(), key: readKey, ...checking }));
appUpdates.start();

// Apps' frontends, kept by version in the frontends bucket (FRONTENDS_BUCKET_SECRET, made by the storage service).
const frontendFiles = frontendFilesFromEnv();
if (!frontendFiles) console.warn('FRONTENDS_BUCKET_SECRET is not set: apps’ frontends are served from where their manifests say, not kept by version.');

// Apps and platform services sign in as themselves (their Keycloak clients). PILLAR_APPS are the apps
// this deployment ships with, which register themselves like any other.
const app = await buildApp({ callers: callerCheckFromEnv('registry'), store, verifyService: serviceVerifierFromEnv(), audit, floors, updates, pillars: pillarsFromEnv(), frontendFiles, appUpdates, allowPrPreviews, pipeline, portalUrl, reporting, tailnet, timeZone });
await app.listen({ port, host: '0.0.0.0' });
