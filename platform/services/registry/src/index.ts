import { callerCheckFromEnv, commonSettings, floorPlaces, loadConfigOrExit, platformCredentialsFromEnv, serviceVerifierFromEnv } from '@augur/service-kit';
import { auditTo, buildApp, pillarsFromEnv } from './app.ts';
import { appFeed, AppUpdateChecker } from './app-updates.ts';
import { AUGUR_RELEASE } from './augur-version.ts';
import { frontendFilesFromEnv } from './frontends.ts';
import { DEFAULT_FEED_URL, DEFAULT_OCI_FEED_URL, feedTokenFromEnv, readKeyFromEnv, releaseFeed, UpdateChecker, type Channel } from './updates.ts';
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
  { name: 'RELEASE_CHANNEL', about: 'stable or beta (default: beta on a preview server, stable on a production one, which takes nothing else).' },
  { name: 'SERVER_RING', about: 'dev (the workbench), preview or production (default): what kind of server this is (docs/release-channels.md).' },
  { name: 'ALLOW_PR_PREVIEWS', about: 'on: run pull requests’ builds for apps’ developers on a production server too.' },
  { name: 'APP_FEED_URL', about: 'where new versions of apps are listed, or off.' },
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
// RELEASE_CHANNEL is stable or beta; by default the channel of the release this registry ships in.
// Compose passes unset settings as empty strings.
const readKey = readKeyFromEnv();
const githubFeed = readKey ? DEFAULT_OCI_FEED_URL : DEFAULT_FEED_URL;
const feedUrl = process.env.RELEASE_FEED_URL || githubFeed;
const channel = (process.env.RELEASE_CHANNEL || undefined) as Channel | undefined;
if (channel && channel !== 'stable' && channel !== 'beta') throw new Error('RELEASE_CHANNEL is stable or beta.');
// What kind of server this is: a production one follows stable only and runs no pull requests' builds.
const ring = ringFrom(process.env.SERVER_RING);
const allowPrPreviews = takesPreview(ring) || process.env.ALLOW_PR_PREVIEWS === 'on';
const feed = feedUrl === 'off' ? undefined : releaseFeed({ url: feedUrl, token: feedTokenFromEnv(), key: readKey });
const updates = new UpdateChecker({ feed, running: AUGUR_RELEASE, channel, ring });
updates.start();

// Apps' own releases, for the app runner (Admin → Apps): from the same feed, read with the same key or
// token, unless APP_FEED_URL says otherwise. Off when the AUGUR feed is a mirror or off and APP_FEED_URL
// isn't set, or with APP_FEED_URL=off.
const appFeedUrl = process.env.APP_FEED_URL || (process.env.RELEASE_FEED_URL ? 'off' : githubFeed);
const appUpdates = new AppUpdateChecker(appFeedUrl === 'off' ? undefined : appFeed({ url: appFeedUrl, token: feedTokenFromEnv(), key: readKey }));
appUpdates.start();

// Apps' frontends, kept by version in the frontends bucket (FRONTENDS_BUCKET_SECRET, made by the storage service).
const frontendFiles = frontendFilesFromEnv();
if (!frontendFiles) console.warn('FRONTENDS_BUCKET_SECRET is not set: apps’ frontends are served from where their manifests say, not kept by version.');

// Apps and platform services sign in as themselves (their Keycloak clients). PILLAR_APPS are the apps
// this deployment ships with, which register themselves like any other.
const app = await buildApp({ callers: callerCheckFromEnv('registry'), store, verifyService: serviceVerifierFromEnv(), audit, floors, updates, pillars: pillarsFromEnv(), frontendFiles, appUpdates, allowPrPreviews });
await app.listen({ port, host: '0.0.0.0' });
