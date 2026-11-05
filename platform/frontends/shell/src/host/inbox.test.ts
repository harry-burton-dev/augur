import type { AppManifestEntry, InboxItem, Workspace } from '@augur/mfe-sdk';
import { describe, expect, it, vi } from 'vitest';
import { INBOX_MORE, InboxClient, InboxError, inboxLabel, inboxNeeds, itemOfNeed, menuFor, openProblem, ordered, subjectLabel, withInbox } from './inbox.js';

const app = (id: string, more: Partial<AppManifestEntry> = {}): AppManifestEntry => ({ id, name: id === 'mandate' ? 'Intent' : id, route: `/${id}`, entry: `/apps/${id}/entry.js`, version: '1.0.0', sdk: '^1.0.0 || ^2.0.0', ...more });
const manifest = [app('mandate', { inbox: { kinds: [{ id: 'assignment', label: 'Assigned to you' }] } })];
const floors: Workspace[] = [
  { id: 'me', kind: 'personal', name: 'Nora', slug: 'me', role: 'lead', path: [] } as Workspace,
  { id: 'fin', kind: 'team', name: 'Finance', slug: 'finance', path: [], role: 'member' } as Workspace,
];
const item = (id: string, more: Partial<InboxItem> = {}): InboxItem => ({
  id,
  app: 'mandate',
  key: id,
  kind: 'assignment',
  owner: { kind: 'person', id: 'u-nora' },
  state: 'open',
  title: `Item ${id}`,
  subject: { kind: 'ref', app: 'mandate', type: 'intent', id, label: 'Office move' },
  allow: { decline: true, handOn: true, selfComplete: false },
  createdAt: `2026-11-0${id.length}T10:00:00.000Z`,
  updatedAt: '2026-11-01T10:00:00.000Z',
  workspace: { id: 'fin', path: ['org', 'fin'] },
  ...more,
});

describe('the Inbox function', () => {
  it('carries the count in its label, after Find', () => {
    expect(inboxLabel()).toBe('Inbox');
    expect(inboxLabel({ you: 2, teams: 1, overdue: 0 })).toBe('Inbox 3');
    expect(inboxLabel({ you: 120, teams: 0, overdue: 0 })).toBe('Inbox 99+');
    const fns = withInbox([{ id: 'apps', label: 'Apps', icon: 'apps' }, { id: 'find', label: 'Find', icon: 'find' }, { id: 'account', label: 'Account', icon: 'account' }], { you: 1, teams: 0, overdue: 0 });
    expect(fns.map((f) => f.label)).toEqual(['Apps', 'Find', 'Inbox 1', 'Account']);
  });
});

describe('an item’s row', () => {
  it('opens unless its app is off here, made for another SDK, on a floor the person left, or for the leads', () => {
    const where = { manifest, floors, here: 'fin' };
    expect(openProblem(item('a'), where)).toBeUndefined();
    expect(openProblem(item('a', { app: 'gone' }), where)).toBe('gone is turned off on Finance, or was removed. An admin can turn it on in Admin, Apps.');
    expect(openProblem(item('a'), { ...where, manifest: [app('mandate', { sdk: '^9.0.0' })] })).toContain('newer version');
    expect(openProblem(item('a', { workspace: { id: 'me', path: ['me'] } }), where)).toBeUndefined();
    expect(openProblem(item('a', { workspace: { id: 'old', path: ['old'] } }), where)).toContain('no longer on');
    expect(openProblem(item('a', { redacted: true }), where)).toContain('leads');
  });

  it('offers each action, and keeps the ones the app doesn’t allow, disabled, saying why', () => {
    const mine = menuFor(item('a', { allow: { decline: true, handOn: false, selfComplete: false } }), 'u-nora', 'Intent');
    expect(mine.map((e) => [e.id, e.disabled ?? false])).toEqual([['hand-on', true], ['decline', false], ['done', true]]);
    expect(mine.find((e) => e.id === 'hand-on')?.reason).toBe('Intent doesn’t let this be handed on.');
    const team = item('t', { owner: { kind: 'team', id: 'fin' } });
    expect(menuFor(team, 'u-nora', 'Intent').map((e) => e.id)).toEqual(['take', 'hand-on', 'decline', 'done']);
    expect(menuFor({ ...team, takenBy: 'u-nora' }, 'u-nora', 'Intent')[0].id).toBe('release');
    expect(menuFor({ ...team, takenBy: 'u-sam' }, 'u-nora', 'Intent').find((e) => e.id === 'decline')?.reason).toContain('Someone else');
    expect(menuFor({ ...team, state: 'done' }, 'u-nora', 'Intent')).toEqual([]);
  });

  it('puts overdue items first, then the newest, and names what an item is about', () => {
    expect(ordered([item('a'), item('bbb'), item('cc', { overdue: true })]).map((i) => i.id)).toEqual(['cc', 'bbb', 'a']);
    expect(subjectLabel(item('a'))).toBe('Office move');
    expect(subjectLabel({ subject: { kind: 'document', app: 'folio', id: 'd', title: 'Budget' } as never })).toBe('Budget');
  });
});

describe('Home’s needs', () => {
  it('lists up to five open items on this floor, then one row for the rest', () => {
    const items = ['a', 'bb', 'ccc', 'dddd', 'eeeee', 'ffffff'].map((id) => item(id));
    const rows = inboxNeeds([...items, item('elsewhere', { workspace: { id: 'me', path: ['me'] } })], { manifest, here: 'fin', total: 6 });
    expect(rows.map((r) => r.id)).toEqual(['inbox:ffffff', 'inbox:eeeee', 'inbox:dddd', 'inbox:ccc', 'inbox:bb', INBOX_MORE]);
    expect(rows[0]).toMatchObject({ appName: 'Assigned to you', title: 'Item ffffff', actions: [] });
    expect(rows.at(-1)!.title).toBe('1 more in your Inbox');
    expect(itemOfNeed('inbox:abc')).toBe('abc');
    expect(itemOfNeed(INBOX_MORE)).toBeUndefined();
    expect(itemOfNeed('n-1')).toBeUndefined();
  });
});

describe('InboxClient', () => {
  it('asks as the person, on the floor they stand on, and says what the events service said when it refuses', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith('/take')) return Response.json({ detail: 'Someone took this a moment ago.', takenBy: 'u-sam' }, { status: 409 });
      if (String(url).endsWith('/decline')) return new Response('{}', { status: 502 });
      expect(new Headers(init?.headers).get('x-workspace-id')).toBe('fin');
      return Response.json([item('a')]);
    });
    const client = new InboxClient({ getToken: async () => 't', floor: () => 'fin', fetchImpl: fetchImpl as typeof fetch });
    expect((await client.list('teams')).map((i) => i.id)).toEqual(['a']);
    expect(String(fetchImpl.mock.calls[0][0])).toBe('/api/events/v1/inbox?tab=teams');
    const lost = (await client.act('a', 'take').catch((e: unknown) => e)) as InboxError;
    expect([lost.status, lost.takenBy, lost.message]).toEqual([409, 'u-sam', 'Someone took this a moment ago.']);
    const down = (await client.act('a', 'decline', { note: 'No' }).catch((e: unknown) => e)) as InboxError;
    expect(down.message).toBe('Your inbox can’t be reached right now. Trying again.');
  });
});
