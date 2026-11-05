import { describe, expect, it } from 'vitest';
import { DirectoryError, KeycloakDirectory } from './directory.ts';
import { applyEntra, ENTRA_FIRST_SIGN_IN, realmEntraFromEnv, applyIdleWorkflow, idleWorkflow, IDLE_WORKFLOW, applyLook, applyMail, withSender, applyRealmSettings, MAIL_FINGERPRINT, realmMailFromEnv, DEFAULT_PRODUCT_NAME, productNameFromEnv, applyServiceAccountRights, applySignInFlow, IDENTITY_RIGHTS, passwordPolicy, REALM_FLOORS, realmLookFromEnv, realmSettingsFromEnv, SIGN_IN_THEME, TWO_STEP_STEP } from './realm.ts';

type Call = { method: string; path: string; body?: unknown };

/** A Keycloak admin API answered by `answer`, recording every call. */
const keycloak = (answer: (method: string, path: string, body?: unknown) => unknown) => {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/protocol/openid-connect/token')) return Response.json({ access_token: 't', expires_in: 300 });
    const method = init?.method ?? 'GET';
    const path = url.replace('http://kc/admin/realms/platform', '');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    const data = answer(method, path, body);
    return data === undefined ? new Response(null, { status: 204 }) : Response.json(data);
  }) as typeof fetch;
  return { calls, kc: new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn: { admin: { user: 'a', password: 'p' } }, fetchImpl }) };
};

describe('the realm’s settings', () => {
  it('start at the floors from ADR 0038', () => {
    expect(realmSettingsFromEnv({})).toEqual(REALM_FLOORS);
    expect(passwordPolicy(REALM_FLOORS)).toBe('length(15) and maxLength(256) and notUsername(undefined) and notEmail(undefined) and passwordBlacklist(ncsc-top100k.txt)');
  });

  it('take a stricter value from a deployment, and keep the floor for a looser one', () => {
    const warnings: string[] = [];
    const s = realmSettingsFromEnv(
      { REALM_PASSWORD_MIN_LENGTH: '20', REALM_SESSION_IDLE_HOURS: '12', REALM_SESSION_MAX_HOURS: '4', REALM_SIGN_IN_EVENT_DAYS: '30', REALM_ADMIN_EVENT_DAYS: 'lots' },
      (m) => warnings.push(m),
    );
    expect(s).toMatchObject({ passwordMinLength: 20, sessionIdleHours: 4, sessionMaxHours: 4, signInEventDays: 90, adminEventDays: 365 });
    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toContain('REALM_SESSION_IDLE_HOURS=12 is looser');
  });

  it('can drop the breached-password list only by saying so, with a warning', () => {
    const warnings: string[] = [];
    expect(passwordPolicy(realmSettingsFromEnv({ REALM_PASSWORD_DENYLIST: 'none' }, (m) => warnings.push(m)))).not.toContain('passwordBlacklist');
    expect(warnings[0]).toContain('not checked');
    expect(realmSettingsFromEnv({ REALM_PASSWORD_DENYLIST: '../../etc/passwd' }).passwordDenylist).toBe(REALM_FLOORS.passwordDenylist);
  });

  it('are written only when they differ, keeping the realm’s other attributes', async () => {
    let realm: Record<string, unknown> = { displayName: 'AUGUR', attributes: { other: 'kept' } };
    const { calls, kc } = keycloak((method, path, body) => {
      if (path !== '') return undefined;
      if (method === 'PUT') realm = { ...realm, ...(body as object) };
      return method === 'GET' ? realm : undefined;
    });
    const changes: string[] = [];
    await applyRealmSettings(kc, REALM_FLOORS, changes);
    const put = calls.find((c) => c.method === 'PUT')!.body as Record<string, unknown>;
    expect(put).toMatchObject({ ssoSessionIdleTimeout: 8 * 3600, ssoSessionMaxLifespan: 10 * 3600, eventsEnabled: true, adminEventsEnabled: true, webAuthnPolicyPasswordlessPasskeysEnabled: true, webAuthnPolicyRpEntityName: 'AUGUR' });
    expect(put.attributes).toEqual({ other: 'kept', adminEventsExpiration: String(365 * 86400) });
    expect(changes).toHaveLength(1);
    await applyRealmSettings(kc, REALM_FLOORS, changes);
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  });

  it('name the realm after the deployment’s product, for sign-in, emails and passkeys', async () => {
    let realm: Record<string, unknown> = { displayName: 'AUGUR' };
    const { calls, kc } = keycloak((method, path, body) => {
      if (path !== '') return undefined;
      if (method === 'PUT') realm = { ...realm, ...(body as object) };
      return method === 'GET' ? realm : undefined;
    });
    const changes: string[] = [];
    const product = productNameFromEnv({ ORG_PRODUCT_NAME: ' Example product ' });
    await applyRealmSettings(kc, REALM_FLOORS, changes, product);
    expect(calls.find((c) => c.method === 'PUT')!.body).toMatchObject({ displayName: 'Example product', webAuthnPolicyRpEntityName: 'Example product', webAuthnPolicyPasswordlessRpEntityName: 'Example product' });
    expect(changes[0]).toContain('displayName');
    await applyRealmSettings(kc, REALM_FLOORS, changes, product);
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
    expect(productNameFromEnv({})).toBe(DEFAULT_PRODUCT_NAME);
    expect(productNameFromEnv({ ORG_PRODUCT_NAME: '  ' })).toBe(DEFAULT_PRODUCT_NAME);
  });
});

describe('identity’s rights', () => {
  it('leave out manage-realm, so identity can’t change how people sign in', () => {
    expect(IDENTITY_RIGHTS).not.toContain('manage-realm');
    expect(IDENTITY_RIGHTS).not.toContain('realm-admin');
  });

  it('are set to exactly the list: missing ones given, extra ones taken away', async () => {
    const { calls, kc } = keycloak((method, path) => {
      if (path === '/clients?clientId=platform-identity') return [{ id: 'c-1' }];
      if (path === '/clients/c-1/service-account-user') return { id: 'sa-1' };
      if (path === '/clients?clientId=realm-management') return [{ id: 'rm-1' }];
      if (path === '/users/sa-1/role-mappings/clients/rm-1' && method === 'GET') return ['view-users', 'manage-realm'].map((name) => ({ id: `r-${name}`, name }));
      if (path === '/clients/rm-1/roles') return [...IDENTITY_RIGHTS, 'manage-realm', 'realm-admin'].map((name) => ({ id: `r-${name}`, name }));
      return undefined;
    });
    const changes: string[] = [];
    await applyServiceAccountRights(kc, 'platform-identity', IDENTITY_RIGHTS, changes);
    const given = calls.find((c) => c.method === 'POST')!.body as { name: string }[];
    const taken = calls.find((c) => c.method === 'DELETE')!.body as { name: string }[];
    expect(given.map((r) => r.name).sort()).toEqual(IDENTITY_RIGHTS.filter((r) => r !== 'view-users').sort());
    expect(taken.map((r) => r.name)).toEqual(['manage-realm']);
    expect(changes[0]).toContain('taken away manage-realm');
  });
});

describe('the sign-in flow', () => {
  it('is left alone when it already has the admin roles’ step and is in use', async () => {
    const { calls, kc } = keycloak((method, path) => {
      if (path === '/authentication/flows') return [{ id: 'f-1', alias: 'augur browser' }];
      if (path === '/authentication/flows/augur%20browser/executions') return [{ id: 'e-1', level: 1, index: 2, requirement: 'CONDITIONAL', displayName: TWO_STEP_STEP, authenticationFlow: true }];
      if (path === '' && method === 'GET') return { browserFlow: 'augur browser' };
      return undefined;
    });
    const changes: string[] = [];
    await applySignInFlow(kc, changes);
    expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
    expect(changes).toEqual([]);
  });

  it('replaces an older release’s flow, handing sign-in back to Keycloak’s own flow first', async () => {
    const { calls, kc } = keycloak((method, path) => {
      if (path === '/authentication/flows') return [{ id: 'f-old', alias: 'augur browser' }];
      if (path === '/authentication/flows/augur%20browser/executions') return [{ id: 'e-1', level: 1, index: 2, requirement: 'CONDITIONAL', displayName: 'deployment-admin code', authenticationFlow: true }];
      return undefined;
    });
    // The rebuilt copy is shaped unlike Keycloak's, so the build stops; the old flow is already out of use by then.
    await expect(applySignInFlow(kc, [])).rejects.toThrow('shaped as expected');
    const writes = calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`);
    expect(writes.slice(0, 3)).toEqual(['PUT ', 'DELETE /authentication/flows/f-old', 'POST /authentication/flows/browser/copy']);
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ browserFlow: 'browser' });
  });
});

describe('the sign-in pages’ look and languages', () => {
  const serverinfo = 'http://kc/admin/serverinfo';
  const withTheme = { themes: { login: [{ name: 'keycloak.v2' }, { name: SIGN_IN_THEME, locales: ['de', 'en', 'fr'] }], email: [{ name: SIGN_IN_THEME }] } };

  it('offer English unless a deployment asks for more, leaving out what isn’t a language', () => {
    expect(realmLookFromEnv({})).toEqual({ theme: SIGN_IN_THEME, languages: ['en'] });
    const warnings: string[] = [];
    expect(realmLookFromEnv({ REALM_LANGUAGES: 'de, en,de,../x' }, (m) => warnings.push(m)).languages).toEqual(['de', 'en']);
    expect(warnings[0]).toContain('../x');
  });

  it('put the realm in AUGUR’s theme, with the languages the pages have, the first the default', async () => {
    let realm: Record<string, unknown> = { loginTheme: 'keycloak.v2' };
    const { calls, kc } = keycloak((method, path, body) => {
      if (path === serverinfo) return withTheme;
      if (path !== '') return undefined;
      if (method === 'PUT') realm = { ...realm, ...(body as object), supportedLocales: [...((body as { supportedLocales: string[] }).supportedLocales)].sort() };
      return method === 'GET' ? realm : undefined;
    });
    const warnings: string[] = [];
    const changes: string[] = [];
    await applyLook(kc, { theme: SIGN_IN_THEME, languages: ['fr', 'en', 'tlh'] }, changes, (m) => warnings.push(m));
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ internationalizationEnabled: true, supportedLocales: ['fr', 'en'], defaultLocale: 'fr', loginTheme: SIGN_IN_THEME, emailTheme: SIGN_IN_THEME });
    expect(warnings).toEqual([expect.stringContaining('no tlh')]);
    // Keycloak keeps the languages in its own order: that is no change.
    await applyLook(kc, { theme: SIGN_IN_THEME, languages: ['fr', 'en'] }, changes);
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
    expect(changes).toHaveLength(1);
  });

  it('keep Keycloak’s own look on a Keycloak without the theme, and say so', async () => {
    const { calls, kc } = keycloak((method, path) => {
      if (path === serverinfo) return { themes: { login: [{ name: 'keycloak.v2' }], email: [] } };
      return path === '' && method === 'GET' ? { loginTheme: SIGN_IN_THEME, emailTheme: '' } : undefined;
    });
    const warnings: string[] = [];
    await applyLook(kc, { theme: SIGN_IN_THEME, languages: ['en'] }, [], (m) => warnings.push(m));
    expect(calls.find((c) => c.method === 'PUT')!.body).toMatchObject({ loginTheme: '', emailTheme: '' });
    expect(warnings[0]).toContain(`no ${SIGN_IN_THEME} theme`);
  });
});

describe('email through the organisation’s relay (ADR 0035)', () => {
  it('reads the relay from the environment, guessing security from the port, and sends nothing without a host or a sender', () => {
    expect(realmMailFromEnv({})).toBeUndefined();
    expect(realmMailFromEnv({ SMTP_HOST: 'relay.example', SMTP_FROM: 'augur@example.org' })).toEqual({ host: 'relay.example', port: 587, security: 'starttls', from: 'augur@example.org' });
    expect(realmMailFromEnv({ SMTP_HOST: 'relay.example', SMTP_PORT: '465', SMTP_FROM: 'a@b.c', SMTP_USER: 'u', SMTP_PASSWORD: 'p' })).toMatchObject({ port: 465, security: 'tls', user: 'u', password: 'p' });
    expect(realmMailFromEnv({ SMTP_HOST: 'mailpit', SMTP_SECURITY: 'none', SMTP_FROM: 'a@b.c' })).toMatchObject({ port: 25, security: 'none' });
    const warnings: string[] = [];
    expect(realmMailFromEnv({ SMTP_HOST: 'relay.example' }, (m) => warnings.push(m))).toBeUndefined();
    expect(realmMailFromEnv({ SMTP_HOST: 'relay.example', SMTP_FROM: 'a@b.c', SMTP_PORT: 'many' }, (m) => warnings.push(m))).toBeUndefined();
    expect(realmMailFromEnv({ SMTP_HOST: 'relay.example', SMTP_FROM: 'a@b.c', SMTP_SECURITY: 'maybe' }, (m) => warnings.push(m))).toBeUndefined();
    expect(warnings).toEqual([expect.stringContaining('SMTP_FROM'), expect.stringContaining('SMTP_PORT many'), expect.stringContaining('SMTP_SECURITY maybe')]);
  });

  const realmAt = (start: Record<string, unknown>) => {
    let realm: Record<string, unknown> = start;
    const k = keycloak((method, path, body) => {
      if (path !== '') return undefined;
      if (method === 'PUT') {
        const b = body as Record<string, unknown> & { smtpServer?: Record<string, string> };
        // Keycloak never reads a password back.
        realm = { ...realm, ...b, ...(b.smtpServer ? { smtpServer: { ...b.smtpServer, ...(b.smtpServer.password ? { password: '**********' } : {}) } } : {}) };
      }
      return method === 'GET' ? realm : undefined;
    });
    return { ...k, realm: () => realm };
  };

  it('points the realm at the relay with the product as the sender, turns on verification, resets and security-change emails, and writes again only when something changed', async () => {
    const t = realmAt({ attributes: { other: 'kept' }, verifyEmail: false, resetPasswordAllowed: false });
    const mail = realmMailFromEnv({ SMTP_HOST: 'relay.example', SMTP_FROM: 'augur@example.org', SMTP_USER: 'u', SMTP_PASSWORD: 'secret' })!;
    const changes: string[] = [];
    await applyMail(t.kc, mail, changes, 'Skein');
    expect(t.realm()).toMatchObject({
      verifyEmail: true,
      resetPasswordAllowed: true,
      smtpServer: { host: 'relay.example', port: '587', from: 'augur@example.org', fromDisplayName: 'Skein', starttls: 'true', ssl: 'false', auth: 'true', user: 'u' },
      attributes: { other: 'kept', [MAIL_FINGERPRINT]: expect.any(String) },
      eventsListeners: ['jboss-logging', 'email'],
    });
    expect(JSON.stringify(t.realm().attributes)).not.toContain('secret');
    expect(changes).toEqual(['email: relay relay.example:587, verifyEmail on, resetPasswordAllowed on, security-change emails on']);
    const puts = () => t.calls.filter((c) => c.method === 'PUT').length;
    await applyMail(t.kc, mail, changes, 'Skein');
    expect(puts()).toBe(1);
    // A new password is noticed though Keycloak never shows the old one.
    await applyMail(t.kc, { ...mail, password: 'rotated' }, changes, 'Skein');
    expect(puts()).toBe(2);
    expect(changes.at(-1)).toBe('email: relay relay.example:587');
  });

  it('sends from the organisation’s sender when an admin set one, and moves the relay when it changes', async () => {
    const t = realmAt({ verifyEmail: true, resetPasswordAllowed: true });
    const relay = realmMailFromEnv({ SMTP_HOST: 'relay.example', SMTP_FROM: 'augur@example.org' })!;
    const set = withSender(relay, { name: 'Finance Group', address: 'notices@finance.example' }, 'Skein');
    await applyMail(t.kc, set.mail, [], set.fromName);
    expect(t.realm().smtpServer).toMatchObject({ from: 'notices@finance.example', fromDisplayName: 'Finance Group' });
    // No address set: SMTP_FROM, under the sender's name; no sender read at all: the product's name.
    expect(withSender(relay, { name: 'Finance Group' }, 'Skein')).toEqual({ mail: relay, fromName: 'Finance Group' });
    expect(withSender(relay, undefined, 'Skein')).toEqual({ mail: relay, fromName: 'Skein' });
    expect(withSender(undefined, { name: 'Finance Group', address: 'n@f.example' }, 'Skein').mail).toBeUndefined();
    const changes: string[] = [];
    const back = withSender(relay, { name: 'Finance Group' }, 'Skein');
    await applyMail(t.kc, back.mail, changes, back.fromName);
    expect(t.realm().smtpServer).toMatchObject({ from: 'augur@example.org', fromDisplayName: 'Finance Group' });
    expect(changes).toEqual(['email: relay relay.example:587']);
  });

  it('without a relay, keeps one set in the console and offers resets only when there is one', async () => {
    const kept = realmAt({ smtpServer: { host: 'console.example' }, verifyEmail: false, resetPasswordAllowed: false });
    await applyMail(kept.kc, undefined, []);
    expect(kept.realm()).toMatchObject({ smtpServer: { host: 'console.example' }, verifyEmail: true, resetPasswordAllowed: true });
    expect(kept.realm().eventsListeners).toEqual(['jboss-logging', 'email']);
    // Gone back to no relay: security-change emails stop, and a listener an admin added stays.
    const none = realmAt({ verifyEmail: true, resetPasswordAllowed: true, eventsListeners: ['jboss-logging', 'email', 'metrics'] });
    const changes: string[] = [];
    await applyMail(none.kc, undefined, changes);
    expect(none.realm()).toMatchObject({ verifyEmail: false, resetPasswordAllowed: false, eventsListeners: ['jboss-logging', 'metrics'] });
    expect(none.realm().smtpServer).toBeUndefined();
    expect(changes).toEqual(['email: verifyEmail off, resetPasswordAllowed off, security-change emails off']);
  });
});

describe('idle accounts through Keycloak’s Workflow (PER-194)', () => {
  const days = { on: true, warningDays: 60, turnOffDays: 90 };
  /** Keycloak's workflows, as a list the fake answers from. */
  const workflowsAt = (start: { id: string; name: string }[], status?: number) => {
    let workflows = [...start];
    let next = 1;
    const calls: Call[] = [];
    const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/protocol/openid-connect/token')) return Response.json({ access_token: 't', expires_in: 300 });
      const method = init?.method ?? 'GET';
      const path = url.replace('http://kc/admin/realms/platform', '');
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path, body });
      if (status) return Response.json({ errorMessage: 'nope' }, { status });
      if (method === 'GET' && path.startsWith('/workflows')) return Response.json(workflows);
      if (method === 'POST' && path === '/workflows') workflows.push({ id: `w-${next++}`, name: body.name });
      if (method === 'DELETE') workflows = workflows.filter((w) => !path.endsWith(`/${w.id}`));
      return new Response(null, { status: method === 'POST' ? 201 : 204 });
    }) as typeof fetch;
    const kc = new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn: { admin: { user: 'a', password: 'p' } }, fetchImpl });
    return { kc, calls, workflows: () => workflows };
  };

  it('warns after the warning days and turns off after the rest, leaving deployment admins out and restarting at each sign-in', () => {
    expect(idleWorkflow(days)).toEqual({
      name: `${IDLE_WORKFLOW}-60-90`,
      on: 'user-authenticated',
      if: 'not has-role(deployment-admin)',
      concurrency: { 'restart-in-progress': 'true' },
      steps: [
        { uses: 'notify-user', after: '60d' },
        { uses: 'disable-user', after: '30d' },
      ],
    });
  });

  it('makes the Workflow once, and leaves it alone when nothing changed', async () => {
    const t = workflowsAt([]);
    const changes: string[] = [];
    await applyIdleWorkflow(t.kc, days, true, changes);
    expect(t.workflows().map((w) => w.name)).toEqual([`${IDLE_WORKFLOW}-60-90`]);
    expect(changes).toEqual(['idle accounts: warned after 60 days, turned off after 90']);
    await applyIdleWorkflow(t.kc, days, true, changes);
    expect(changes).toHaveLength(1);
    expect(t.calls.filter((c) => c.method !== 'GET')).toHaveLength(1);
  });

  it('replaces the Workflow when the days change, as Keycloak won’t change parked steps', async () => {
    const t = workflowsAt([{ id: 'old', name: `${IDLE_WORKFLOW}-60-90` }, { id: 'theirs', name: 'someone-elses' }]);
    await applyIdleWorkflow(t.kc, { ...days, turnOffDays: 120 }, true, []);
    expect(t.workflows().map((w) => w.name)).toEqual(['someone-elses', `${IDLE_WORKFLOW}-60-120`]);
  });

  it('takes the Workflow away when idle accounts are off, or when nobody could be warned by email', async () => {
    const off = workflowsAt([{ id: 'old', name: `${IDLE_WORKFLOW}-60-90` }]);
    const changes: string[] = [];
    await applyIdleWorkflow(off.kc, { ...days, on: false }, true, changes);
    expect(off.workflows()).toEqual([]);
    expect(changes).toEqual(['idle accounts: no longer turned off']);

    const noEmail = workflowsAt([{ id: 'old', name: `${IDLE_WORKFLOW}-60-90` }]);
    const warnings: string[] = [];
    await applyIdleWorkflow(noEmail.kc, days, false, [], (m) => warnings.push(m));
    expect(noEmail.workflows()).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining('email isn’t set up')]);
  });

  it('warns, and changes nothing, on a Keycloak without Workflows or one that refuses this one', async () => {
    const warnings: string[] = [];
    await applyIdleWorkflow(workflowsAt([], 404).kc, days, true, [], (m) => warnings.push(m));
    const refusing = workflowsAt([]);
    const kc = refusing.kc;
    const post = kc.call.bind(kc);
    kc.call = (async (method: string, path: string, body?: unknown) => {
      if (method === 'POST') return workflowsAt([], 400).kc.call(method, path, body);
      return post(method, path, body);
    }) as typeof kc.call;
    await applyIdleWorkflow(kc, days, true, [], (m) => warnings.push(m));
    expect(warnings).toEqual([expect.stringContaining('no Workflows'), expect.stringContaining('refused the idle-account Workflow')]);
  });

  it('leaves the Workflow alone when the days couldn’t be read', async () => {
    const t = workflowsAt([{ id: 'old', name: `${IDLE_WORKFLOW}-60-90` }]);
    await applyIdleWorkflow(t.kc, undefined, true, []);
    expect(t.calls).toEqual([]);
  });
});

describe('Entra as the organisation’s sign-in', () => {
  const entra = { tenantId: '11111111-2222-3333-4444-555555555555', clientId: 'augur-app', clientSecret: 's3cret' };

  it('needs all three settings and a tenant id, not a domain', () => {
    const warnings: string[] = [];
    expect(realmEntraFromEnv({})).toBeUndefined();
    expect(realmEntraFromEnv({ ENTRA_TENANT_ID: entra.tenantId }, (m) => warnings.push(m))).toBeUndefined();
    expect(realmEntraFromEnv({ ENTRA_TENANT_ID: 'example.org', ENTRA_CLIENT_ID: 'a', ENTRA_CLIENT_SECRET: 'b' }, (m) => warnings.push(m))).toBeUndefined();
    expect(warnings).toHaveLength(2);
    expect(realmEntraFromEnv({ ENTRA_TENANT_ID: entra.tenantId, ENTRA_CLIENT_ID: 'augur-app', ENTRA_CLIENT_SECRET: 's3cret' })).toEqual(entra);
  });

  it('adds the provider for the tenant, its first sign-in that links by email, and its mappers; then changes nothing', async () => {
    let provider: Record<string, unknown> | undefined;
    const flows: { alias: string }[] = [];
    const executions: { id: string; requirement: string; providerId: string }[] = [];
    let mappers: { name: string }[] = [];
    const { calls, kc } = keycloak((method, path, body) => {
      if (path === '/identity-provider/instances/entra' && method === 'GET') return provider ?? { __status: 404 };
      if (path === '/identity-provider/instances' && method === 'POST') provider = body as Record<string, unknown>;
      if (path === '/identity-provider/instances/entra' && method === 'PUT') provider = body as Record<string, unknown>;
      if (path === '/authentication/flows' && method === 'GET') return flows;
      if (path === '/authentication/flows' && method === 'POST') flows.push(body as { alias: string });
      if (path.endsWith('/executions') && method === 'GET') return executions;
      if (path.endsWith('/mappers') && method === 'GET') return mappers;
      if (path.endsWith('/mappers') && method === 'POST') mappers = [...mappers, body as { name: string }];
      return undefined;
    });
    // The fake answers 404 for a missing provider through the directory's own error.
    const call = kc.call.bind(kc);
    let n = 0;
    kc.call = (async (method: string, path: string, body?: unknown) => {
      if (path === '/authentication/flows/augur%20first%20sign-in/executions/execution') {
        const id = `e${++n}`;
        executions.push({ id, requirement: 'DISABLED', providerId: (body as { provider: string }).provider });
        calls.push({ method, path, body });
        return { data: undefined, location: `http://kc/x/${id}` };
      }
      const r = await call(method, path, body);
      if ((r.data as { __status?: number } | undefined)?.__status === 404) throw new DirectoryError('missing', 404);
      return r;
    }) as typeof kc.call;
    const changes: string[] = [];
    await applyEntra(kc, entra, 'Example Org', changes);
    expect(flows).toEqual([expect.objectContaining({ alias: ENTRA_FIRST_SIGN_IN, providerId: 'basic-flow' })]);
    expect(calls.filter((c) => c.method === 'PUT' && c.path.endsWith('/executions')).map((c) => (c.body as { requirement: string }).requirement)).toEqual(['ALTERNATIVE', 'ALTERNATIVE']);
    expect(provider).toMatchObject({
      alias: 'entra',
      providerId: 'oidc',
      displayName: 'Example Org account',
      trustEmail: true,
      firstBrokerLoginFlowAlias: ENTRA_FIRST_SIGN_IN,
      config: { issuer: `https://login.microsoftonline.com/${entra.tenantId}/v2.0`, clientId: 'augur-app', syncMode: 'FORCE', defaultScope: 'openid profile email' },
    });
    expect(mappers.map((m) => m.name)).toEqual(['first name', 'last name', 'email']);
    expect(changes.length).toBeGreaterThan(0);

    const again: string[] = [];
    await applyEntra(kc, entra, 'Example Org', again);
    expect(again).toEqual([]);
    // A new secret is noticed from the fingerprint, without reading the secret back.
    await applyEntra(kc, { ...entra, clientSecret: 'new' }, 'Example Org', again);
    expect(again).toEqual([`entra: brought up to date for tenant ${entra.tenantId}`]);
  });

  it('turns the provider off without the settings, keeping it and its links', async () => {
    let provider: Record<string, unknown> = { alias: 'entra', enabled: true, config: {} };
    const { kc } = keycloak((method, path, body) => {
      if (path !== '/identity-provider/instances/entra') return undefined;
      if (method === 'PUT') provider = body as Record<string, unknown>;
      return method === 'GET' ? provider : undefined;
    });
    const changes: string[] = [];
    await applyEntra(kc, undefined, 'Example Org', changes);
    expect(provider.enabled).toBe(false);
    expect(changes).toEqual(['entra: turned off (no ENTRA_* settings); accounts stay linked']);
    await applyEntra(kc, undefined, 'Example Org', changes);
    expect(changes).toHaveLength(1);
  });
});
