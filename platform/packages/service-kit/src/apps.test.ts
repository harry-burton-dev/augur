import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { clientCredentials, identityFromClientId, isOfferedScope, isPlatformScope, PLATFORM_SCOPES, SCOPES, scopeWords, serviceVerifier, ServiceTokenError, type ServiceVerifier } from './apps.js';

const issuer = 'http://sign-in.test/realms/platform';

describe('who a client is', () => {
  it('reads apps and platform services from their client ids, and nothing else', () => {
    expect(identityFromClientId('app-library')).toEqual({ kind: 'app', app: 'library' });
    expect(identityFromClientId('platform-registry')).toEqual({ kind: 'platform', name: 'registry' });
    expect(identityFromClientId('shell')).toBeUndefined();
    expect(identityFromClientId('app-')).toBeUndefined();
  });
});

describe('platform scopes', () => {
  it('are never among the scopes an app can ask for, and each has words for a refusal', () => {
    for (const s of PLATFORM_SCOPES) {
      expect(isPlatformScope(s)).toBe(true);
      expect(isOfferedScope(s)).toBe(false);
      expect(scopeWords(s)).not.toBe('do that');
    }
    for (const s of SCOPES) expect(isPlatformScope(s)).toBe(false);
  });
});

describe('client credentials', () => {
  const tokenFor = (n: number) => Response.json({ access_token: `t${n}`, expires_in: 300 });

  it('signs in once and keeps the token until shortly before it expires', async () => {
    let t = 0;
    let n = 0;
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(init?.body)).toBe('grant_type=client_credentials&client_id=app-library&client_secret=s3cret');
      return tokenFor(++n);
    });
    const getToken = clientCredentials({ tokenUrl: 'http://kc/token', clientId: 'app-library', clientSecret: 's3cret', fetchImpl: fetchImpl as typeof fetch, now: () => t });
    expect(await Promise.all([getToken(), getToken()])).toEqual(['t1', 't1']);
    t = 269_000;
    expect(await getToken()).toBe('t1');
    t = 271_000;
    expect(await getToken()).toBe('t2');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('says so when the secret is refused', async () => {
    const getToken = clientCredentials({ tokenUrl: 'http://kc/token', clientId: 'app-library', clientSecret: 'wrong', fetchImpl: (async () => new Response(null, { status: 401 })) as typeof fetch });
    await expect(getToken()).rejects.toBeInstanceOf(ServiceTokenError);
  });
});

describe('checking service tokens', () => {
  let verify: ServiceVerifier;
  let sign: (claims: Record<string, unknown>) => Promise<string>;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    verify = serviceVerifier({ issuer, keys: createLocalJWKSet({ keys: [jwk] }) });
    sign = (claims) =>
      new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(issuer).setIssuedAt().setExpirationTime('5m').sign(privateKey);
  });

  it('knows the app a token was issued to', async () => {
    const token = await sign({ azp: 'app-library', aud: 'platform-services' });
    expect(await verify({ authorization: `Bearer ${token}` })).toEqual({ kind: 'app', app: 'library' });
  });

  it('refuses a person’s token, another audience, and no token at all', async () => {
    expect(await verify({ authorization: `Bearer ${await sign({ azp: 'shell', aud: 'platform-services', sub: 'u-1' })}` })).toBeUndefined();
    expect(await verify({ authorization: `Bearer ${await sign({ azp: 'app-library', aud: 'platform-api' })}` })).toBeUndefined();
    expect(await verify({})).toBeUndefined();
  });
});
