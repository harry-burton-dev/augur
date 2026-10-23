import { callerCheckFromEnv, floorPlaces, platformCredentialsFromEnv, serviceVerifierFromEnv } from '@augur/service-kit';
import { auditTo, buildApp } from './app.ts';
import { AUGUR_RELEASE } from './augur-version.ts';
import { DEFAULT_FEED_URL, feedTokenFromEnv, releaseFeed, UpdateChecker, type Channel } from './updates.ts';
import { MemoryAppStore, PgAppStore, type AppStore } from './store.ts';

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

// New AUGUR releases: this repo's GitHub releases, or a mirror's feed; RELEASE_FEED_URL=off checks none.
// RELEASE_CHANNEL is stable or beta; by default the channel of the release this registry ships in.
// Compose passes unset settings as empty strings.
const feedUrl = process.env.RELEASE_FEED_URL || DEFAULT_FEED_URL;
const channel = (process.env.RELEASE_CHANNEL || undefined) as Channel | undefined;
if (channel && channel !== 'stable' && channel !== 'beta') throw new Error('RELEASE_CHANNEL is stable or beta.');
const feed = feedUrl === 'off' ? undefined : releaseFeed({ url: feedUrl, token: feedTokenFromEnv() });
const updates = new UpdateChecker({ feed, running: AUGUR_RELEASE, channel });
updates.start();

// Apps and platform services sign in as themselves (their Keycloak clients).
const app = await buildApp({ callers: callerCheckFromEnv('registry'), store, verifyService: serviceVerifierFromEnv(), audit, floors, updates });
await app.listen({ port, host: '0.0.0.0' });
