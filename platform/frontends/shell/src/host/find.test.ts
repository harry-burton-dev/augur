import type { AppManifestEntry } from '@augur/mfe-sdk';
import { CURRENT_SDK } from '../current-sdk.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppSearch, readAnswer, type FindUpdate } from './find.js';
import { fromCatalogue3 } from './apps3.js';

const app = (id: string, extra: Partial<AppManifestEntry> = {}): AppManifestEntry => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  route: `/${id}`,
  entry: `/apps/${id}/entry.js`,
  version: '0.1.0',
  sdk: CURRENT_SDK,
  search: true,
  ...extra,
});
const answer = (results: unknown[]) => new Response(JSON.stringify({ results }), { headers: { 'content-type': 'application/json' } });
/** A fetch that answers each app after its own delay, and respects aborts. */
const apps = (plan: Record<string, { after: number; results?: unknown[]; status?: number }>) =>
  vi.fn((path: string, init?: RequestInit) => {
    const id = /^\/api\/([\w-]+)\//.exec(path)![1];
    const { after, results = [], status = 200 } = plan[id];
    return new Promise<Response>((resolve, reject) => {
      const t = setTimeout(() => resolve(status === 200 ? answer(results) : new Response('', { status })), after);
      init?.signal?.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  });

afterEach(() => vi.useRealTimers());

describe('Find over apps’ content', () => {
  it('asks every app that searches, on the floor, and fills each group as it answers', async () => {
    vi.useFakeTimers();
    const fetchOnFloor = apps({
      library: { after: 100, results: [{ id: 'd7', title: 'Budget paper', detail: 'Draft', path: '/doc/7' }] },
      claims: { after: 400, results: [{ id: 'c1', title: 'Budget claim' }] },
    });
    const updates: FindUpdate[] = [];
    const search = new AppSearch(fetchOnFloor);
    const done = search.run([app('home', { search: undefined }), app('library'), app('claims')], ' budget ', 'w-me', (u) => updates.push(u));
    expect(updates[0].groups).toEqual([{ name: 'Library', state: 'looking' }, { name: 'Claims', state: 'looking' }]);
    expect(fetchOnFloor).toHaveBeenCalledWith('/api/library/v1/search?q=budget', expect.anything());
    expect(fetchOnFloor).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(100);
    expect(updates.at(-1)).toEqual({
      results: [{ id: 'library:d7', title: 'Budget paper', detail: 'Draft', kind: 'content', group: 'Library' }],
      groups: [{ name: 'Library', state: 'done' }, { name: 'Claims', state: 'looking' }],
    });
    await vi.advanceTimersByTimeAsync(300);
    await done;
    expect(updates.at(-1)!.results.map((r) => r.id)).toEqual(['library:d7', 'claims:c1']);
    expect(search.foundIn('library:d7')).toMatchObject({ app: { id: 'library' }, path: '/doc/7' });
  });

  it('asks an app on the app contract as itself, so the gateway holds the call to its grants', async () => {
    const fetchOnFloor = apps({ notes: { after: 0 }, library: { after: 0 } });
    const notes = fromCatalogue3({ contract: 3, id: 'notes', name: 'Notes', version: '1.0.0', frontend: { entry: 'sandbox.js' }, contributes: { search: true } });
    await new AppSearch(fetchOnFloor).run([notes, app('library')], 'budget', 'w-me', () => undefined);
    const headersFor = (id: string) => (fetchOnFloor.mock.calls.find(([path]) => path.startsWith(`/api/${id}/`))![1] as RequestInit).headers as Record<string, string>;
    expect(headersFor('notes')['x-augur-app']).toBe('notes');
    expect(headersFor('library')['x-augur-app']).toBeUndefined();
  });

  it('lets go of an app that takes longer than the budget, and says which failed', async () => {
    vi.useFakeTimers();
    const fetchOnFloor = apps({ slow: { after: 5000 }, broken: { after: 10, status: 500 }, quick: { after: 10, results: [{ id: '1', title: 'Quick one' }] } });
    const updates: FindUpdate[] = [];
    const done = new AppSearch(fetchOnFloor).run([app('slow'), app('broken'), app('quick')], 'qu', 'w-me', (u) => updates.push(u));
    await vi.advanceTimersByTimeAsync(1500);
    await done;
    expect(updates.at(-1)!.groups.map((g) => `${g.name} ${g.state}`)).toEqual(['Slow late', 'Broken failed', 'Quick done']);
    expect(updates.at(-1)!.results.map((r) => r.title)).toEqual(['Quick one']);
  });

  it('puts results on the floor asked from first, tagging the rest with theirs', async () => {
    const fetchOnFloor = vi.fn(async () => answer([{ id: 'a', title: 'On Legal', workspace: 'w-legal' }, { id: 'b', title: 'Here', workspace: 'w-fin' }, { id: 'c', title: 'Nowhere' }]));
    const updates: FindUpdate[] = [];
    const search = new AppSearch(fetchOnFloor, { floorName: (id) => (id === 'w-legal' ? 'Legal' : undefined) });
    await search.run([app('library')], 'doc', 'w-fin', (u) => updates.push(u));
    expect(updates.at(-1)!.results.map((r) => [r.title, r.detail])).toEqual([['Here', 'Library'], ['Nowhere', 'Library'], ['On Legal', 'On Legal']]);
    expect(search.foundIn('library:a')!.workspace).toBe('w-legal');
    expect(search.foundIn('library:b')!.workspace).toBeUndefined();
  });

  it('cancels the last query’s waiting when a new one starts, and doesn’t ask for one letter', async () => {
    vi.useFakeTimers();
    const fetchOnFloor = apps({ library: { after: 500, results: [{ id: '1', title: 'Old' }] } });
    const first: FindUpdate[] = [];
    const search = new AppSearch(fetchOnFloor);
    const old = search.run([app('library')], 'bu', 'w-me', (u) => first.push(u));
    const none: FindUpdate[] = [];
    await search.run([app('library')], 'b', 'w-me', (u) => none.push(u));
    await vi.advanceTimersByTimeAsync(600);
    await old;
    expect(first).toHaveLength(1);
    expect(none).toEqual([{ results: [], groups: [] }]);
  });

  it('only trusts well-formed results, at most ten', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: String(i), title: `R${i}` }));
    expect(readAnswer({ results: many })).toHaveLength(10);
    expect(readAnswer({ results: [{ id: 1, title: 'x' }, { id: 'a' }, { id: 'b', title: 'ok', path: 'no-slash' }, { id: 'c', title: 'fine', path: '/x' }] })).toEqual([{ id: 'c', title: 'fine', path: '/x' }]);
    expect(readAnswer(null)).toEqual([]);
    expect(readAnswer({ results: 'nope' })).toEqual([]);
  });
});
