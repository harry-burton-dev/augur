import { describe, expect, it, vi } from 'vitest';
import { choosePreview, loadPreviews, previewLine, previewPr } from './previews.js';

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
