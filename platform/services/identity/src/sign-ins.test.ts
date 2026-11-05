import { describe, expect, it } from 'vitest';
import type { NewAuditEntry } from '@augur/service-kit';
import { copySignIns, MemorySignInCursorStore, signInEntry, type KcEvent } from './sign-ins.ts';

const T0 = Date.parse('2026-11-05T09:00:00Z');

/** A Keycloak that answers like the admin API: newest first, paged by first/max. */
const keycloak = (all: KcEvent[]) => {
  const paths: string[] = [];
  const events = async (path: string) => {
    paths.push(path);
    const q = new URLSearchParams(path.split('?')[1]);
    const types = q.getAll('type');
    const from = Date.parse(`${q.get('dateFrom')}T00:00:00Z`);
    const first = Number(q.get('first'));
    const max = Number(q.get('max'));
    return all
      .filter((e) => types.includes(e.type) && e.time >= from)
      .sort((a, b) => b.time - a.time)
      .slice(first, first + max);
  };
  return { events, paths };
};

const run = async (all: KcEvent[], store: MemorySignInCursorStore, now = T0) => {
  const kc = keycloak(all);
  const written: NewAuditEntry[] = [];
  const copied = await copySignIns({ events: kc.events, store, audit: async (e) => void written.push(e), now: () => now });
  return { copied, written, paths: kc.paths };
};

describe('sign-ins in Activity', () => {
  it('starts from now on its first run, leaving what Keycloak already holds', async () => {
    const store = new MemorySignInCursorStore();
    const { copied, written } = await run([{ id: 'old', time: T0 - 1000, type: 'LOGIN', userId: 'u1' }], store);
    expect(copied).toBe(0);
    expect(written).toEqual([]);
    expect(await store.load()).toEqual({ time: T0, seen: [] });
  });

  it('copies new sign-ins oldest first, once each, across runs', async () => {
    const store = new MemorySignInCursorStore();
    await store.save({ time: T0, seen: [] });
    const all: KcEvent[] = [
      { id: 'a', time: T0 + 1000, type: 'LOGIN', userId: 'u1', clientId: 'platform-shell', ipAddress: '10.0.0.1' },
      { id: 'b', time: T0 + 2000, type: 'LOGIN_ERROR', userId: 'u2', error: 'invalid_user_credentials' },
      { id: 'c', time: T0 + 2000, type: 'LOGIN', userId: 'u3' },
      { id: 'x', time: T0 + 3000, type: 'CODE_TO_TOKEN', userId: 'u1' },
    ];
    const first = await run(all, store);
    expect(first.copied).toBe(3);
    expect(first.written.map((e) => e.target)).toEqual(['u1', expect.any(String), expect.any(String)]);
    expect(first.written[0]).toMatchObject({ app: 'identity', action: 'sign-in.succeeded', actor: { id: 'u1', kind: 'user' }, detail: { kind: 'sign-in', keycloakEvent: 'a', client: 'platform-shell', ip: '10.0.0.1', method: 'password' } });
    expect(first.written.map((e) => e.action).sort()).toEqual(['sign-in.failed', 'sign-in.succeeded', 'sign-in.succeeded']);
    expect(first.paths[0]).toMatch(/^\/events\?type=LOGIN&type=LOGIN_ERROR&.*dateFrom=2026-11-05&first=0&max=100$/);

    // Nothing new: nothing copied again, even the two at the cursor's own time.
    expect((await run(all, store)).copied).toBe(0);

    // One more at the same millisecond as the last: only it is copied.
    const later = await run([...all, { id: 'd', time: T0 + 2000, type: 'LOGIN', userId: 'u4' }], store);
    expect(later.written.map((e) => e.target)).toEqual(['u4']);
  });

  it('reads further pages when a page is full', async () => {
    const store = new MemorySignInCursorStore();
    await store.save({ time: T0, seen: [] });
    const all = Array.from({ length: 150 }, (_, i): KcEvent => ({ id: `e${i}`, time: T0 + i + 1, type: 'LOGIN', userId: `u${i}` }));
    const { copied, written, paths } = await run(all, store);
    expect(copied).toBe(150);
    expect(paths).toHaveLength(2);
    expect(written[0]!.target).toBe('u0');
    expect(written[149]!.target).toBe('u149');
  });

  it('keeps the cursor after each one, so a failure part way never copies one twice', async () => {
    const store = new MemorySignInCursorStore();
    await store.save({ time: T0, seen: [] });
    const all: KcEvent[] = [
      { id: 'a', time: T0 + 1, type: 'LOGIN', userId: 'u1' },
      { id: 'b', time: T0 + 2, type: 'LOGIN', userId: 'u2' },
    ];
    const written: string[] = [];
    const kc = keycloak(all);
    await expect(
      copySignIns({
        events: kc.events,
        store,
        audit: async (e) => {
          if (e.target === 'u2') throw new Error('events is down');
          written.push(e.target!);
        },
      }),
    ).rejects.toThrow('events is down');
    expect(written).toEqual(['u1']);
    const again = await run(all, store);
    expect(again.written.map((e) => e.target)).toEqual(['u2']);
  });

  it('runs one copy at a time', async () => {
    const store = new MemorySignInCursorStore();
    await store.save({ time: T0, seen: [] });
    let release!: () => void;
    const slow = new Promise<void>((r) => (release = r));
    const first = copySignIns({ events: async () => (await slow, []), store, audit: async () => {} });
    expect(await copySignIns({ events: async () => [], store, audit: async () => {} })).toBe(0);
    release();
    await first;
  });

  it('counts failed sign-ins for names nobody has once an hour, keeping the addresses but not the names', async () => {
    const store = new MemorySignInCursorStore();
    await store.save({ time: T0, seen: [] });
    const H = 3_600_000;
    const all: KcEvent[] = [
      { id: 'n1', time: T0 + 10, type: 'LOGIN_ERROR', error: 'user_not_found', ipAddress: '10.0.0.9', details: { username: 'mallory' } },
      { id: 'n2', time: T0 + 20, type: 'LOGIN_ERROR', error: 'user_not_found', ipAddress: '10.0.0.9', details: { username: 'admin' } },
      { id: 'n3', time: T0 + 30, type: 'LOGIN_ERROR', error: 'user_not_found', ipAddress: '10.0.0.7' },
      { id: 'n4', time: T0 + H + 5, type: 'LOGIN_ERROR', error: 'user_not_found' },
    ];
    const { copied, written } = await run(all, store);
    expect(copied).toBe(4);
    expect(written).toEqual([
      { actor: { id: 'identity', kind: 'service' }, app: 'identity', action: 'sign-in.failed-unknown', detail: { kind: 'sign-in', at: '2026-11-05T09:00:00.000Z', count: 3, ips: ['10.0.0.9', '10.0.0.7'] } },
      { actor: { id: 'identity', kind: 'service' }, app: 'identity', action: 'sign-in.failed-unknown', detail: { kind: 'sign-in', at: '2026-11-05T10:00:00.000Z', count: 1 } },
    ]);
    expect(JSON.stringify(written)).not.toContain('mallory');
    expect((await run(all, store)).copied).toBe(0);
  });

  it('says how each change to someone’s sign-in reads in Activity', () => {
    const at = (type: string, details?: Record<string, string>) => signInEntry({ id: type, time: T0, type, userId: 'u1', details });
    expect(at('LOGIN', { identity_provider: 'entra' }).detail).toMatchObject({ method: 'federated' });
    expect(at('LOGIN', { credential_type: 'webauthn-passwordless' }).detail).toMatchObject({ method: 'passkey' });
    expect(at('UPDATE_CREDENTIAL', { credential_type: 'password' }).action).toBe('account.password-changed');
    expect(at('UPDATE_CREDENTIAL', { credential_type: 'otp' })).toMatchObject({ action: 'account.two-step-added', detail: { credential: 'otp' } });
    expect(at('REMOVE_CREDENTIAL', { credential_type: 'webauthn' })).toMatchObject({ action: 'account.two-step-removed', target: 'u1' });
    expect(at('UPDATE_EMAIL', { previous_email: 'a@x.example', updated_email: 'b@x.example' }).detail).toMatchObject({ email: { from: 'a@x.example', to: 'b@x.example' } });
    expect(at('USER_DISABLED_BY_TEMPORARY_LOCKOUT').action).toBe('sign-in.locked');
    expect(at('FEDERATED_IDENTITY_LINK', { identity_provider: 'entra' })).toMatchObject({ action: 'sign-in.linked', detail: { provider: 'entra' } });
  });

  it('says so when more arrived than one run reads back', async () => {
    const store = new MemorySignInCursorStore();
    await store.save({ time: T0, seen: [] });
    const warnings: string[] = [];
    const full = Array.from({ length: 100 }, (_, i): KcEvent => ({ id: `p${i}`, time: T0 + 10_000 - i, type: 'LOGIN', userId: 'u1' }));
    let calls = 0;
    await copySignIns({ events: async () => (calls++, full), store, audit: async () => {}, warn: (m) => warnings.push(m) });
    expect(calls).toBe(500);
    expect(warnings[0]).toMatch(/More than 50000 sign-in events/);
  });
});
