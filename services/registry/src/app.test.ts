import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';

describe('registry', () => {
  it('reports healthy', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });

  it('hides apps that need a role the caller lacks', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/manifest' });
    expect(res.json().map((a: { id: string }) => a.id)).toEqual(['home', 'library']);
  });

  it('shows role-gated apps to callers with the role', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/manifest', headers: { 'x-user-roles': 'editor, admin' } });
    expect(res.json().map((a: { id: string }) => a.id)).toContain('admin');
  });
});
