import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { appClientId, callerFromHeaders, SERVICES_AUDIENCE, type NewAuditEntry } from '@augur/service-kit';
import { DirectoryError, type KeycloakDirectory } from './directory.ts';

/**
 * Each app's own sign-in: a Keycloak client `app-<id>` that can only get
 * tokens for itself (client credentials), issued for the platform's services
 * and short-lived. Identity creates them as Keycloak's admin; what an app may
 * do with its token is the registry's to say, not Keycloak's.
 */
export interface AppClients {
  /** Creates the app's client, or gives it a new secret; the old secret stops working. The secret is shown this once. */
  issue(app: string): Promise<{ clientId: string; secret: string }>;
  /** Makes sure a client (an app's, or a platform service's) exists with this secret, as the server's settings say. */
  ensure(clientId: string, secret: string): Promise<void>;
}

interface KcClient {
  id: string;
  clientId: string;
}

/** How long an app's token lasts, in seconds. */
const TOKEN_SECONDS = 300;

const audienceMapper = {
  name: `${SERVICES_AUDIENCE} audience`,
  protocol: 'openid-connect',
  protocolMapper: 'oidc-audience-mapper',
  config: { 'included.custom.audience': SERVICES_AUDIENCE, 'access.token.claim': 'true', 'id.token.claim': 'false' },
};

export const serviceClient = (clientId: string, secret: string) => ({
  clientId,
  name: clientId.startsWith('platform-') ? `${clientId.slice('platform-'.length)} (platform service)` : `${clientId.replace(/^app-/, '')} (app service)`,
  description: 'Made by the platform’s identity service. Its secret is issued and replaced from Admin, or set in the server’s settings.',
  enabled: true,
  publicClient: false,
  clientAuthenticatorType: 'client-secret',
  secret,
  serviceAccountsEnabled: true,
  standardFlowEnabled: false,
  implicitFlowEnabled: false,
  directAccessGrantsEnabled: false,
  attributes: { 'access.token.lifespan': String(TOKEN_SECONDS) },
  protocolMappers: [audienceMapper],
});

export const newSecret = () => randomBytes(32).toString('base64url');

export class KeycloakAppClients implements AppClients {
  private readonly keycloak: KeycloakDirectory;

  constructor(keycloak: KeycloakDirectory) {
    this.keycloak = keycloak;
  }

  async issue(app: string) {
    const clientId = appClientId(app);
    const { data: found } = await this.keycloak.call<KcClient[]>('GET', `/clients?clientId=${encodeURIComponent(clientId)}`);
    if (found[0]) {
      const { data } = await this.keycloak.call<{ value: string }>('POST', `/clients/${found[0].id}/client-secret`);
      return { clientId, secret: data.value };
    }
    const secret = newSecret();
    await this.keycloak.call('POST', '/clients', serviceClient(clientId, secret));
    return { clientId, secret };
  }

  async ensure(clientId: string, secret: string) {
    const { data: found } = await this.keycloak.call<KcClient[]>('GET', `/clients?clientId=${encodeURIComponent(clientId)}`);
    if (!found[0]) {
      await this.keycloak.call('POST', '/clients', serviceClient(clientId, secret));
      return;
    }
    const { protocolMappers: _, ...settings } = serviceClient(clientId, secret);
    await this.keycloak.call('PUT', `/clients/${found[0].id}`, { ...settings, id: found[0].id });
    const { data: mappers } = await this.keycloak.call<{ protocolMapper: string; config?: Record<string, string> }[]>('GET', `/clients/${found[0].id}/protocol-mappers/models`);
    if (!mappers.some((m) => m.protocolMapper === audienceMapper.protocolMapper && m.config?.['included.custom.audience'] === SERVICES_AUDIENCE)) {
      await this.keycloak.call('POST', `/clients/${found[0].id}/protocol-mappers/models`, audienceMapper);
    }
  }
}

/** "platform-registry=s3cret,app-library=…" (SERVICE_CLIENT_SECRETS) as client ids and secrets. */
export const parseClientSecrets = (list: string | undefined): [string, string][] =>
  (list ?? '')
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const at = pair.indexOf('=');
      return [pair.slice(0, at).trim(), pair.slice(at + 1).trim()] as [string, string];
    })
    .filter(([id, secret]) => id && secret);

/**
 * Makes the clients the server's settings name, and keeps trying while the
 * sign-in service is starting: the platform's services can't sign in until then.
 */
export const ensureClients = async (clients: AppClients, secrets: [string, string][], log: (message: string) => void, retryMs = 2000, attempts = 60) => {
  for (let attempt = 1; ; attempt++) {
    try {
      for (const [clientId, secret] of secrets) await clients.ensure(clientId, secret);
      if (secrets.length) log(`Sign-ins ready for ${secrets.map(([id]) => id).join(', ')}.`);
      return;
    } catch (err) {
      if (attempt >= attempts) throw err;
      await new Promise((r) => setTimeout(r, retryMs));
    }
  }
}

export class MemoryAppClients implements AppClients {
  readonly secrets = new Map<string, string>();

  async issue(app: string) {
    const clientId = appClientId(app);
    const secret = newSecret();
    this.secrets.set(clientId, secret);
    return { clientId, secret };
  }

  async ensure(clientId: string, secret: string) {
    this.secrets.set(clientId, secret);
  }
}

interface ClientRoutesOptions {
  clients?: AppClients;
  audit?: (entry: NewAuditEntry) => Promise<void>;
}

/** Admins issue an app's sign-in, and replace it when it may have leaked. Audited, never with the secret. */
export const appClientRoutes =
  ({ clients, audit }: ClientRoutesOptions) =>
  async (app: FastifyInstance) => {
    app.post<{ Params: { id: string } }>(
      '/:id/credential',
      { schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,39}$' } } } } },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can issue an app’s sign-in.' });
        if (!clients) return reply.code(503).send({ error: 'unavailable', message: 'Identity isn’t connected to the sign-in service, so apps’ sign-ins can’t be issued here yet.' });
        try {
          const issued = await clients.issue(req.params.id);
          req.log.info({ app: req.params.id, by: caller.id }, 'app credential issued');
          await audit?.({ actor: { id: caller.id, kind: 'user' }, app: 'identity', action: 'app.credential-issued', target: req.params.id }).catch((err: Error) =>
            req.log.error({ err: err.message }, 'audit entry not recorded'),
          );
          return reply.code(201).send(issued);
        } catch (err) {
          if (!(err instanceof DirectoryError)) throw err;
          return reply.code(err.status === 503 ? 503 : 502).send({ error: 'unavailable', message: err.message });
        }
      },
    );
  };
