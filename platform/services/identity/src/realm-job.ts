import { loadConfigOrExit } from '@augur/service-kit';
import { KeycloakAppClients, parseClientSecrets, retrying } from './clients.ts';
import { KeycloakDirectory } from './directory.ts';
import { applyRealm, productNameFromEnv, realmLookFromEnv, realmMailFromEnv, realmSettingsFromEnv } from './realm.ts';

/**
 * The realm job (ADR 0057): brings Keycloak's realm to what this release declares (`realm.ts`), then
 * exits. Compose runs it on every `up`, so on every upgrade, before identity starts. It is the only
 * part of AUGUR that signs in as Keycloak's master admin.
 */
loadConfigOrExit('realm job', [
  { name: 'KEYCLOAK_URL', about: 'Keycloak as the job reaches it, such as http://keycloak:8080/sso.', required: true },
  { name: 'KEYCLOAK_REALM', about: 'the Keycloak realm people sign in to (default platform).' },
  { name: 'KEYCLOAK_ADMIN_USER', about: 'Keycloak’s own master admin, which the job signs in as.', required: true },
  { name: 'KEYCLOAK_ADMIN_PASSWORD', about: 'that admin’s password.', required: true, secret: true },
  { name: 'IDENTITY_CLIENT_SECRET', about: 'identity’s own sign-in (platform-identity), made if missing and given only the rights identity uses.', secret: true },
  { name: 'SERVICE_CLIENT_SECRETS', about: 'each platform service’s sign-in secret, client=secret, comma separated.', secret: true },
  { name: 'PLATFORM_ADMIN_USER', about: 'the first admin’s username, given the deployment-admin role when nobody has it.' },
  { name: 'REALM_PASSWORD_MIN_LENGTH', about: 'the shortest password allowed; 15 or more (ADR 0038).' },
  { name: 'REALM_PASSWORD_DENYLIST', about: 'the breached-password list in Keycloak’s data/password-blacklists (default ncsc-top100k.txt).' },
  { name: 'REALM_SESSION_IDLE_HOURS', about: 'how long a session may sit unused; 8 or fewer.' },
  { name: 'REALM_SESSION_MAX_HOURS', about: 'how long a session may last; 10 or fewer.' },
  { name: 'REALM_SIGN_IN_EVENT_DAYS', about: 'how long sign-in events are kept; 90 or more.' },
  { name: 'REALM_ADMIN_EVENT_DAYS', about: 'how long admins’ changes in Keycloak are kept; 365 or more.' },
  { name: 'ORG_PRODUCT_NAME', about: 'the product’s name on the sign-in pages and in emails, as the realm’s display name (default AUGUR).' },
  { name: 'REALM_LANGUAGES', about: 'the languages offered at sign-in, comma separated, the first the default (default en).' },
  { name: 'SMTP_HOST', about: 'the organisation’s SMTP relay; without it AUGUR sends no email and says so (ADR 0035).' },
  { name: 'SMTP_PORT', about: 'the relay’s port (default 587, or 465 with SMTP_SECURITY tls).' },
  { name: 'SMTP_SECURITY', about: 'starttls (default), tls from the start, or none for a relay on a trusted network.' },
  { name: 'SMTP_FROM', about: 'the address email comes from; the product’s name is shown as the sender.' },
  { name: 'SMTP_REPLY_TO', about: 'where replies go, if not to SMTP_FROM.' },
  { name: 'SMTP_USER', about: 'the relay sign-in, if it wants one.' },
  { name: 'SMTP_PASSWORD', about: 'that sign-in’s password.', secret: true },
]);

const { KEYCLOAK_URL = 'http://localhost:8180', KEYCLOAK_REALM = 'platform', KEYCLOAK_ADMIN_USER, KEYCLOAK_ADMIN_PASSWORD, IDENTITY_CLIENT_SECRET, PLATFORM_ADMIN_USER } = process.env;
const warn = (message: string) => console.warn(message);
const settings = realmSettingsFromEnv(process.env, warn);
const look = realmLookFromEnv(process.env, warn);
const mail = realmMailFromEnv(process.env, warn);
if (!mail) console.info('No SMTP relay is set (SMTP_HOST): the realm keeps any relay set in Keycloak’s console, and offers verification and password resets only with one.');
const kc = new KeycloakDirectory({ url: KEYCLOAK_URL, realm: KEYCLOAK_REALM, signIn: { admin: { user: KEYCLOAK_ADMIN_USER!, password: KEYCLOAK_ADMIN_PASSWORD! } } });

try {
  // Keycloak may still be starting (or migrating its database after an upgrade): keep trying for up to ten minutes.
  let attempt = 0;
  const changes = await retrying(
    () =>
      applyRealm(kc, {
        settings,
        productName: productNameFromEnv(process.env),
        look,
        warn,
        identity: IDENTITY_CLIENT_SECRET ? { clientId: 'platform-identity', secret: IDENTITY_CLIENT_SECRET } : undefined,
        serviceSecrets: parseClientSecrets(process.env.SERVICE_CLIENT_SECRETS),
        clients: new KeycloakAppClients(kc),
        firstAdmin: PLATFORM_ADMIN_USER || undefined,
        mail,
      }).catch((err: Error) => {
        attempt++;
        console.warn(`Attempt ${attempt}: ${err.message} Trying again in 5 seconds.`);
        throw err;
      }),
    5000,
    120,
  );
  console.info(changes.length ? `The ${KEYCLOAK_REALM} realm is up to date. Changed:\n- ${changes.join('\n- ')}` : `The ${KEYCLOAK_REALM} realm was already up to date.`);
} catch (err) {
  console.error(`The ${KEYCLOAK_REALM} realm couldn't be brought up to date: ${(err as Error).message}`);
  process.exit(1);
}
