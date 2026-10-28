import { describe, expect, it } from 'vitest';
import type { FloorApp, PersonMap } from './api.js';
import { AuspexApi } from './api.js';
import { pathFor, placeFor, type AuspexApp } from './auspex-app.js';
import { addressFor, AUSPEX_OPEN, FLOOR_MAP, placeForIntent } from './entry.js';
import { layoutMap } from './layout.js';
import { ACCESS_EXPLAIN, explain, readExplain } from './access.js';
import type { AuspexAccess } from './auspex-access.js';
import { appLine, ledBy, whoCanAdd, whyHere } from './words.js';

/** Acme: Finance (Payroll, Treasury) and Legal (Contracts, inside it Disputes). Alex is on Payroll. */
const acme: PersonMap = {
  floors: [
    { id: 'org', kind: 'org', name: 'Acme', slug: 'acme', depth: 0, open: true, why: { kind: 'org' }, people: 9, leads: [] },
    { id: 'fin', kind: 'team', name: 'Finance', slug: 'finance', parentId: 'org', depth: 1, open: true, why: { kind: 'inside', via: { id: 'pay', name: 'Payroll' } }, people: 4, leads: [{ id: 'priya', name: 'Priya Shah' }], members: [{ id: 'priya', name: 'Priya Shah', role: 'lead' }] },
    { id: 'pay', kind: 'team', name: 'Payroll', slug: 'payroll', parentId: 'fin', depth: 2, open: true, why: { kind: 'member', role: 'member' }, people: 2, leads: [{ id: 'sam', name: 'Sam Okafor' }], members: [{ id: 'sam', name: 'Sam Okafor', role: 'lead' }, { id: 'alex', name: 'Alex Kim', role: 'member' }] },
    { id: 'me', kind: 'personal', name: 'You', slug: 'alex', depth: 0, open: true, why: { kind: 'own' }, people: 1, leads: [{ id: 'alex', name: 'Alex Kim' }] },
  ],
  closed: [
    { id: 'tre', name: 'Treasury', parentId: 'fin', depth: 2, leads: [] },
    { id: 'leg', name: 'Legal', parentId: 'org', depth: 1, leads: [{ id: 'lee', name: 'Lee Park' }] },
    { id: 'con', name: 'Contracts', parentId: 'leg', depth: 2, leads: [] },
    { id: 'dis', name: 'Disputes', parentId: 'con', depth: 3, leads: [] },
  ],
  principals: ['person:alex', 'team:pay', 'tree:fin', 'tree:pay', 'org'],
};

const apps: FloorApp[] = [
  { id: 'home', name: 'Home', icon: 'home', state: { on: true, why: 'platform' } },
  { id: 'agents', name: 'Agents', icon: 'agents', state: { on: false, why: 'blocked', by: 'fin', setBy: 'ada', setAt: '2026-10-20T09:00:00Z' } },
  { id: 'board', name: 'Board', state: { on: true, why: 'set-here', by: 'pay' } },
  { id: 'notes', name: 'Notes', floors: ['personal'], state: { on: false, why: 'not-for-this-kind' } },
  { id: 'ledger', name: 'Ledger', requiredRole: 'publisher', hasRole: false, state: { on: true, why: 'approved' } },
];

describe('the map', () => {
  it('lays the org out left to right, folding closed teams inside closed teams', () => {
    const laid = layoutMap(acme, 'pay')!;
    const byId = new Map(laid.nodes.map((n) => [n.id, n]));
    expect([...byId.keys()].sort()).toEqual(['fin', 'leg', 'org', 'pay', 'tre']);
    expect(byId.get('leg')).toMatchObject({ reach: 'closed', folded: 2, depth: 1 });
    expect(byId.get('pay')).toMatchObject({ reach: 'stand', here: true, depth: 2 });
    // A level per column, and nobody on top of anyone else.
    expect(byId.get('fin')!.x).toBeGreaterThan(byId.get('org')!.x);
    expect(byId.get('pay')!.x).toBeGreaterThan(byId.get('fin')!.x);
    const ys = laid.nodes.filter((n) => n.depth === 1).map((n) => n.y);
    expect(new Set(ys).size).toBe(ys.length);
    expect(laid.links.filter((l) => l.lit).map((l) => l.to.id).sort()).toEqual(['fin', 'pay']);
    // Their own floors come before closed ones.
    expect(byId.get('fin')!.y).toBeLessThan(byId.get('leg')!.y);
  });
});

describe('what Auspex says', () => {
  it('says why you can go somewhere, who leads it and who to ask', () => {
    expect(whyHere(acme.floors[1], 'Acme')).toBe('You’re here because Payroll is inside it');
    expect(whyHere(acme.floors[0], 'Acme')).toBe('Everyone at Acme can come here');
    expect(ledBy([{ id: 'sam', name: 'Sam Okafor' }], 'alex')).toBe('Sam Okafor leads it.');
    expect(ledBy([{ id: 'alex', name: 'Alex Kim' }, { id: 'sam', name: 'Sam Okafor' }], 'alex')).toBe('You and Sam Okafor lead it.');
    expect(whoCanAdd(acme.closed[1])).toBe('Ask Lee Park, who leads it. An admin adds people to teams.');
    expect(whoCanAdd(acme.closed[0])).toBe('No one leads it yet. An admin adds people to teams.');
  });

  it('gives every app a reason, naming the floor a rule comes from', () => {
    const name = (id: string) => ({ fin: 'Finance', pay: 'Payroll' })[id] ?? id;
    expect(apps.map((a) => appLine(a, name, 'team'))).toEqual([
      'Part of AUGUR, on everywhere',
      'Blocked by Finance',
      'Turned on here',
      'Not made for teams',
      'Needs the publisher role',
    ]);
  });
});

describe('places', () => {
  it('reads and writes its address', () => {
    expect(placeFor('/', 'pay')).toEqual({ view: 'where' });
    expect(placeFor('/here', 'pay')).toEqual({ view: 'floor', id: 'pay' });
    expect(placeFor('/floors/fin/apps/agents', 'pay')).toEqual({ view: 'app', floor: 'fin', app: 'agents' });
    expect(pathFor({ view: 'app', floor: 'fin', app: 'agents' })).toBe('/floors/fin/apps/agents');
    expect(addressFor('/auspex/floors/fin', '/floors/fin', { view: 'where' })).toBe('/auspex');
    expect(addressFor('/auspex', '/', { view: 'floor', id: 'pay' })).toBe('/auspex/floors/pay');
  });

  it('opens where an intent asks', () => {
    expect(placeForIntent({ type: AUSPEX_OPEN, payload: { path: '/here' } }, 'pay')).toEqual({ view: 'floor', id: 'pay' });
    expect(placeForIntent({ type: FLOOR_MAP, payload: {} }, 'pay')).toEqual({ view: 'where' });
    expect(placeForIntent({ type: FLOOR_MAP, payload: { floor: 'fin' } }, 'pay')).toEqual({ view: 'floor', id: 'fin' });
    expect(placeForIntent(undefined, 'pay')).toBeUndefined();
  });
});

describe('the app', () => {
  const api = () => {
    const asked: { path: string; floor: string | null }[] = [];
    const api = new AuspexApi(async (path, init) => {
      asked.push({ path, floor: new Headers(init?.headers).get('X-Workspace-Id') });
      const body = path.includes('/me/map')
        ? acme
        : path.includes('/me/apps')
          ? { apps }
          : path.includes('/changes')
            ? { days: 7, changes: [{ at: new Date().toISOString(), kind: 'joined', floor: 'pay', person: 'alex', team: 'pay' }], names: { alex: 'Alex Kim' } }
            : { names: { ada: 'Ada Lovelace' } };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    return { api, asked };
  };
  const mount = async (place: object) => {
    await import('./auspex-app.js');
    const { api: a, asked } = api();
    const el = document.createElement('auspex-app') as AuspexApp;
    Object.assign(el, { api: a, here: 'pay', userId: 'alex', place });
    document.body.replaceChildren(el);
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 5));
      await el.updateComplete;
    }
    return { el, asked };
  };

  it('opens on the map, with every team on it and the closed ones saying so', async () => {
    const { el } = await mount({ view: 'where' });
    expect(el.querySelector('ui-heading')!.getAttribute('heading')).toBe('Where you are');
    const marks = [...el.querySelectorAll('auspex-map .node')].map((n) => n.getAttribute('aria-label'));
    expect(marks).toContain('Legal and 2 teams inside. Closed to you. Ask Lee Park, who leads it. An admin adds people to teams.');
    expect(marks.find((m) => m?.startsWith('Payroll'))).toBe('Payroll. You’re a member');
  });

  it('shows a floor as apps, people and its week, asking each floor it shows', async () => {
    const { el, asked } = await mount({ view: 'floor', id: 'pay' });
    expect(asked).toContainEqual({ path: '/api/registry/v1/me/apps?workspace=pay', floor: 'pay' });
    expect([...el.querySelectorAll('.ax-tile .nm')].map((t) => t.textContent)).toEqual(['Board', 'Home', 'Agents', 'Ledger', 'Notes']);
    expect([...el.querySelectorAll('.ax-person .nm')].map((t) => t.textContent)).toEqual(['Sam Okafor', 'Alex Kim']);
    expect(el.querySelector('.ax-events')!.textContent).toContain('Alex Kim joined');
    expect(el.querySelector('.ax-can ui-button')!.textContent).toBe('Why can’t I use Agents on Payroll?');
  });

  it('answers why not with the rule that decides it and who set it', async () => {
    const { el } = await mount({ view: 'app', floor: 'pay', app: 'agents' });
    expect(el.querySelector('ui-heading')!.getAttribute('heading')).toBe('You can’t use Agents here');
    const steps = [...el.querySelectorAll('.ax-step')].map((s) => [...s.querySelectorAll('.t1, .verdict, .t2')].map((t) => t.textContent).join(' '));
    expect(steps).toEqual([
      'Acme Allows it, with no rule of its own',
      expect.stringMatching(/^Finance blocks it Decides it Set by Ada Lovelace on/),
      'Payroll No rule of its own',
    ]);
    expect(el.querySelector('.ax-step.decides.no')).not.toBeNull();
  });

  it('says a closed team is there, where it sits and who to ask, and nothing inside it but names', async () => {
    const { el } = await mount({ view: 'floor', id: 'leg' });
    expect(el.querySelector('ui-heading')!.getAttribute('heading')).toBe('Legal');
    expect([...el.querySelectorAll('.ax-names li')].map((l) => l.textContent)).toEqual(['Contracts', 'Disputes']);
    expect(el.querySelector('.ax-can')!.textContent).toContain('Lee Park');
  });
});

describe('who can open this (access.explain)', () => {
  const ask = readExplain({
    thing: { app: 'folio', appName: 'Artifacts', id: 'd-1', title: 'Travel policy', kind: 'document' },
    audience: [
      { principal: 'tree:fin', name: 'Finance', level: 'read', via: 'its floor' },
      { principal: 'team:pay', level: 'edit', via: 'its library', since: '2026-10-01T09:00:00Z' },
      { principal: 'person:lee', name: 'Lee Park', level: 'manage', via: 'shared with this document' },
      { principal: 'tree:leg', name: 'Legal', level: 'read', via: 'shared with this document' },
      { principal: 'nonsense' },
    ],
    change: { where: 'Share', allowed: false },
  })!;

  it('reads only what it can explain', () => {
    expect(ACCESS_EXPLAIN).toBe('access.explain');
    expect(readExplain({ thing: { app: 'folio', id: 'd-1' }, audience: [] })).toBeUndefined();
    expect(readExplain(undefined)).toBeUndefined();
    expect(ask.audience.map((a) => a.principal)).toEqual(['tree:fin', 'team:pay', 'person:lee', 'tree:leg']);
    expect(ask.change).toEqual({ where: 'Share', allowed: false });
  });

  it('counts only people the person may know about, and says when it is at least that', () => {
    const { entries, people, atLeast, org } = explain(ask, acme);
    expect(entries.map((e) => e.who)).toEqual(['Finance and the teams inside it', 'Payroll', 'Lee Park', 'Legal and the teams inside it']);
    expect(entries[1]).toMatchObject({ people: 2 });
    // Legal is closed to them: its size isn't theirs to know.
    expect(entries[3].people).toBeUndefined();
    expect(people).toBe(4);
    expect(atLeast).toBe(true);
    expect(org?.name).toBe('Acme');
  });

  it('says everyone when the org can open it', () => {
    const all = explain({ ...ask, audience: [{ principal: 'org' }] }, acme);
    expect(all).toMatchObject({ people: 9, atLeast: false, org: undefined });
    expect(all.entries[0].who).toBe('Everyone at Acme');
  });

  it('shows each one, who’s left out, and who can change it, over the app that asked', async () => {
    await import('./auspex-access.js');
    const api = new AuspexApi(async () => new Response(JSON.stringify(acme), { status: 200 }));
    const el = document.createElement('auspex-access') as AuspexAccess;
    Object.assign(el, { api, ask, appName: 'Artifacts' });
    document.body.replaceChildren(el);
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 5));
      await el.updateComplete;
    }
    expect(el.querySelector('ui-heading')!.getAttribute('summary')).toBe('At least 4 people can open it.');
    const rows = [...el.querySelectorAll('.ax-who')].map((r) => r.textContent!.replace(/\s+/g, ' ').trim());
    expect(rows).toHaveLength(5);
    expect(rows[3]).toContain('You’re not on it, so its size isn’t shown');
    expect(rows[4]).toContain('Everyone else at Acme');
    expect(el.querySelector('.ax-can')!.textContent).toContain('Only whoever manages it can change who can open it, in Share.');
    let done = 0;
    el.addEventListener('auspex-done', () => done++);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    el.querySelector<HTMLElement>('.ax-can ui-button')!.click();
    expect(done).toBe(2);
    expect(el.querySelector('.ax-can ui-button')!.textContent).toBe('Back to Artifacts');
  });
});
