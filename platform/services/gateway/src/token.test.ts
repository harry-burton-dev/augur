// A part's own sign-in (spec 8.4): its client-credentials grant goes on to the sign-in service, and nothing else does.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { createLocalJWKSet } from 'jose';
import { buildApp, TOKEN_PATH } from './app.ts';
import { HealthMonitor } from './status.ts';
import type { AuthConfig } from './auth.ts';

describe('the token route', () => {
  let signIn: FastifyInstance;
  let url: string;
  const received: { body: string; contentType?: string }[] = [];

  beforeAll(async () => {
    signIn = Fastify();
    signIn.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => done(null, body));
    signIn.post('/realms/platform/protocol/openid-connect/token', async (req, reply) => {
      received.push({ body: req.body as string, contentType: req.headers['content-type'] });
      const form = new URLSearchParams(req.body as string);
      if (form.get('client_secret') !== 'right') return reply.code(401).send({ error: 'invalid_client', error_description: 'Invalid client or Invalid client credentials' });
      return { access_token: 'tok', token_type: 'Bearer', expires_in: 300 };
    });
    url = await signIn.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(() => signIn.close());

  const auth = (tokenUrl?: string): AuthConfig => ({ issuer: 'http://sign-in.test/realms/platform', audience: 'platform-api', keys: createLocalJWKSet({ keys: [] }), tokenUrl });
  const gateway = (tokenUrl?: string) => buildApp({ upstreams: {}, auth: auth(tokenUrl), monitor: new HealthMonitor({ probes: [] }) });
  const post = (app: Awaited<ReturnType<typeof buildApp>>, form: Record<string, string>) =>
    app.inject({ method: 'POST', url: TOKEN_PATH, headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: new URLSearchParams(form).toString() });

  it('passes a client-credentials grant on and answers as the sign-in service did, without a sign-in', async () => {
    const app = await gateway(`${url}/realms/platform/protocol/openid-connect/token`);
    const ok = await post(app, { grant_type: 'client_credentials', client_id: 'app-notes', client_secret: 'right' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ access_token: 'tok', token_type: 'Bearer', expires_in: 300 });
    expect(ok.headers['cache-control']).toBe('no-store');
    expect(received.at(-1)).toMatchObject({ body: 'grant_type=client_credentials&client_id=app-notes&client_secret=right', contentType: 'application/x-www-form-urlencoded' });
    const wrong = await post(app, { grant_type: 'client_credentials', client_id: 'app-notes', client_secret: 'wrong' });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json().error).toBe('invalid_client');
  });

  it('refuses any other grant before it reaches the sign-in service', async () => {
    const app = await gateway(`${url}/realms/platform/protocol/openid-connect/token`);
    const before = received.length;
    const res = await post(app, { grant_type: 'password', username: 'alex', password: 'hunter2', client_id: 'platform-shell' });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/client-credentials/);
    expect(received.length).toBe(before);
  });

  it('says so when the sign-in service can’t be reached', async () => {
    const app = await gateway('http://127.0.0.1:1/token');
    const res = await post(app, { grant_type: 'client_credentials', client_id: 'app-notes', client_secret: 'right' });
    expect(res.statusCode).toBe(503);
    expect((await gateway(undefined).then((a) => post(a, { grant_type: 'client_credentials' }))).statusCode).toBe(503);
  });
});
