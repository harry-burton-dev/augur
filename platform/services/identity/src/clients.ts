import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import { appClientId, callerFromHeaders, identifyService, ServiceAuthUnavailable, SERVICES_AUDIENCE, type NewAuditEntry, type ServiceVerifier } from '@augur/service-kit';
import { DirectoryError, type KeycloakDirectory } from './directory.ts';
import { AppParams, refused } from './schemas.ts';

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

/** Runs `work` until it succeeds, for while the sign-in service is starting, and gives up after `attempts`. */
export const retrying = async <T>(work: () => Promise<T>, retryMs = 2000, attempts = 60): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (err) {
      if (attempt >= attempts) throw err;
      await new Promise((r) => setTimeout(r, retryMs));
    }
  }
};

/**
 * Makes the clients the server's settings name, and keeps trying while the
 * sign-in service is starting: the platform's services can't sign in until then.
 */
export const ensureClients = async (clients: AppClients, secrets: [string, string][], log: (message: string) => void, retryMs = 2000, attempts = 60) => {
  await retrying(async () => {
    for (const [clientId, secret] of secrets) await clients.ensure(clientId, secret);
  }, retryMs, attempts);
  if (secrets.length) log(`Sign-ins ready for ${secrets.map(([id]) => id).join(', ')}.`);
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
  /** Checks platform services' own sign-ins, for the app runner setting an app's sign-in. */
  verifyService?: ServiceVerifier;
}

/** The platform service that runs apps: it sets the sign-in of each app it installs. */
const APP_RUNNER = 'updater';

/** When the sign-in service fails: 503 while it can't be reached, 502 when it answers with an error. */
const signInServiceFailed = {
  502: refused('The sign-in service refused the change'),
  503: refused("Identity isn't connected to the sign-in service, or can't reach it"),
};

/** Admins issue an app's sign-in, and replace it when it may have leaked. Audited, never with the secret. */
export const appClientRoutes =
  ({ clients, audit }: ClientRoutesOptions) =>
  async (plain: FastifyInstance) => {
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();
    app.post(
      '/:id/credential',
      {
        schema: {
          summary: "Issue an app's own sign-in, or replace its secret (admins only)",
          description: [
            "Makes the app's Keycloak client (app-<id>: client credentials only,",
            '5-minute tokens for the platform-services audience), or gives it a new',
            'secret, after which the old one stops working. The secret is in this',
            "answer only; the app's service is given it as SERVICE_CLIENT_SECRET.",
            'Audited as app.credential-issued, without the secret.',
          ].join(' '),
          params: AppParams,
          response: {
            201: Type.Object(
              { clientId: Type.String({ examples: ['app-library'] }), secret: Type.String() },
              { description: "The app's client and its secret" },
            ),
            400: refused('Not an app id'),
            401: refused('No signed-in caller'),
            403: refused('Not an admin'),
            ...signInServiceFailed,
          },
        },
      },
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

/** For the platform's services rather than people: the app runner setting the sign-in of an app it installs. */
export const appRunnerRoutes =
  ({ clients, audit, verifyService }: ClientRoutesOptions) =>
  async (plain: FastifyInstance) => {
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();
    /**
     * The app runner sets the sign-in of an app it installs to the secret it works out from
     * APP_SECRETS_KEY (service kit's appSecretFor), so it can give the app that secret without
     * keeping it anywhere. Only the runner: it already decides what runs on the server.
     */
    app.put(
      '/:id/credential',
      {
        schema: {
          summary: "Set an app's sign-in to a given secret (the app runner only)",
          description: [
            'The app runner (platform-updater) sets the sign-in of an app it',
            'installs to the secret it works out from APP_SECRETS_KEY, making the',
            "client if it's missing. Audited as app.credential-set, without the secret.",
          ].join(' '),
          params: AppParams,
          body: Type.Object({ secret: Type.String({ pattern: '^[0-9a-f]{64}$' }) }, { additionalProperties: false }),
          response: {
            200: Type.Object({ clientId: Type.String({ examples: ['app-notes'] }) }, { description: "The app's client" }),
            400: refused('Not an app id, or not 64 hex characters'),
            403: refused('Not the app runner'),
            ...signInServiceFailed,
            503: refused("The caller's token can't be checked right now, or identity isn't connected to the sign-in service or can't reach it"),
          },
        },
      },
      async (req, reply) => {
        let service;
        try {
          service = await identifyService(req.headers, verifyService);
        } catch (err) {
          if (!(err instanceof ServiceAuthUnavailable)) throw err;
          return reply.code(503).send({ error: 'unavailable', message: err.message });
        }
        if (service?.kind !== 'platform' || service.name !== APP_RUNNER) return reply.code(403).send({ error: 'forbidden', message: 'Only the app runner sets an app’s sign-in this way; admins issue one.' });
        if (!clients) return reply.code(503).send({ error: 'unavailable', message: 'Identity isn’t connected to the sign-in service, so apps’ sign-ins can’t be set here yet.' });
        try {
          const clientId = appClientId(req.params.id);
          await clients.ensure(clientId, req.body.secret);
          req.log.info({ app: req.params.id, by: service.name }, 'app credential set');
          await audit?.({ actor: { id: service.name, kind: 'service' }, app: 'identity', action: 'app.credential-set', target: req.params.id }).catch((err: Error) =>
            req.log.error({ err: err.message }, 'audit entry not recorded'),
          );
          return reply.code(200).send({ clientId });
        } catch (err) {
          if (!(err instanceof DirectoryError)) throw err;
          return reply.code(err.status === 503 ? 503 : 502).send({ error: 'unavailable', message: err.message });
        }
      },
    );
  };
