import { describe, expect, it, vi } from 'vitest';
import { chooseFeaturePreview, choosable, choosePreview, featureLine, loadFeaturePreviews, loadPreviews, previewLine, previewPr } from './previews.js';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const notes = { app: 'notes', name: 'Notes', version: '1.0.0', chosen: 12, previews: [{ pr: 12, version: '1.1.0-pr.12.3', title: 'Tags', startedAt: '2026-10-27T12:00:00Z', endsAt: '2026-11-03T12:00:00Z' }] };

describe('previews', () => {
  it('knows a pull request’s build by its version', () => {
    expect(previewPr('1.1.0-pr.12.3')).toBe(12);
    expect(previewPr('1.1.0')).toBeUndefined();
    expect(previewPr('1.1.0-beta.1')).toBeUndefined();
    expect(previewPr(undefined)).toBeUndefined();
    expect(previewLine(notes.previews[0])).toMatch(/^#12 Tags · 1\.1\.0-pr\.12\.3 · until /);
  });

  it('lists a developer’s previews, and nothing for anyone else or an older registry', async () => {
    const fetchImpl = vi.fn(async () => json({ apps: [notes, { nonsense: true }] }));
    expect(await loadPreviews(fetchImpl as unknown as typeof fetch, '/api/registry/v1/previews', 't')).toEqual([notes]);
    expect(await loadPreviews((async () => json({ error: 'not_found' }, 404)) as unknown as typeof fetch, '/p', 't')).toEqual([]);
    expect(await loadPreviews((async () => Promise.reject(new TypeError('offline'))) as unknown as typeof fetch, '/p', 't')).toEqual([]);
  });

  it('switches to a preview and back, saying why when it can’t', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => (JSON.parse(String(init?.body)).pr === 7 ? json({ message: 'No preview of pull request 7 is running.' }, 404) : new Response(null, { status: 204 })));
    await choosePreview(fetchImpl as unknown as typeof fetch, '/api/registry/v1/previews', 't', 'notes', 12);
    expect(fetchImpl).toHaveBeenCalledWith('/api/registry/v1/previews/notes', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ pr: 12 }) }));
    await choosePreview(fetchImpl as unknown as typeof fetch, '/api/registry/v1/previews', 't', 'notes', null);
    await expect(choosePreview(fetchImpl as unknown as typeof fetch, '/api/registry/v1/previews', 't', 'notes', 7)).rejects.toThrow('No preview of pull request 7 is running.');
  });
});

describe('feature previews', () => {
  const board = { id: 'board', name: 'Board view', mode: 'opt-in' as const, on: false };
  it('reads them, and nothing from a registry without them', async () => {
    const ok = (async () => new Response(JSON.stringify({ apps: [{ app: 'notes', name: 'Notes', previews: [board] }, { nonsense: true }] }))) as unknown as typeof fetch;
    expect(await loadFeaturePreviews(ok, '/f', 't')).toEqual([{ app: 'notes', name: 'Notes', previews: [board] }]);
    const missing = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    expect(await loadFeaturePreviews(missing, '/f', 't')).toEqual([]);
  });

  it('offers a choice only of an opt-in one still running, and says why otherwise', () => {
    expect(choosable(board)).toBe(true);
    expect(choosable({ ...board, ended: true })).toBe(false);
    expect(choosable({ ...board, mode: 'everyone' })).toBe(false);
    expect(featureLine({ ...board, on: true })).toBe('On for you');
    expect(featureLine({ ...board, mode: 'off' })).toMatch(/an admin hasn’t opened it/);
    expect(featureLine({ ...board, mode: 'everyone', on: true })).toMatch(/On for everyone/);
    expect(featureLine({ ...board, ended: true })).toBe('Ended');
  });

  it('sends a choice, and says what the registry said when it refuses', async () => {
    const sent: { url: string; body?: unknown }[] = [];
    const ok = (async (url: string, init?: RequestInit) => (sent.push({ url, body: init?.body }), new Response(null, { status: 204 }))) as unknown as typeof fetch;
    await chooseFeaturePreview(ok, '/f', 't', 'notes', 'board', true);
    expect(sent).toEqual([{ url: '/f/notes/board', body: '{"on":true}' }]);
    const no = (async () => new Response(JSON.stringify({ message: 'Board view is off.' }), { status: 409 })) as unknown as typeof fetch;
    await expect(chooseFeaturePreview(no, '/f', 't', 'notes', 'board', true)).rejects.toThrow('Board view is off.');
  });
});
