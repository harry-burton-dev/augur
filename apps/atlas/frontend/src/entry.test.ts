import { createEventBus, type MountContext, type Workspace } from '@augur/mfe-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { entityLine, placeFor, pathFor, typeTree, type Entity, type Ontology } from './api.js';
import type { AtlasApp } from './atlas-app.js';
import app, { addressFor } from './entry.js';

const floor: Workspace = { id: 't-mar', kind: 'team', name: 'Maritime desk', slug: 'maritime', path: [], role: 'member' };

const ONTOLOGY: Ontology = {
  version: 1,
  types: [
    { key: 'artifact', label: 'Artifact', plural: 'Artifacts', abstract: true, icon: 'apps', pack: 'cco', packTerm: 'Artifact', details: [] },
    { key: 'vehicle', label: 'Vehicle', plural: 'Vehicles', parent: 'artifact', abstract: true, icon: 'vehicle', pack: 'cco', packTerm: 'Vehicle', details: [] },
    {
      key: 'vessel',
      label: 'Vessel',
      plural: 'Vessels',
      parent: 'vehicle',
      abstract: false,
      icon: 'vessel',
      pack: 'cco',
      packTerm: 'Watercraft',
      details: [{ key: 'imo', label: 'IMO number', kind: 'text', identity: true, pattern: '\\d{7}' }],
    },
  ],
};

const TERN: Entity = {
  id: 'ent_01',
  type: 'vessel',
  label: 'Northern Tern',
  aliases: ['N. Tern'],
  description: '',
  details: { imo: '9400117' },
  workspace: 't-mar',
  floor: 'tree:t-mar',
  floorName: 'Maritime desk',
  state: 'active',
  createdBy: 'u1',
  createdAt: '2026-10-27T00:00:00Z',
  updatedBy: 'u1',
  updatedAt: '2026-10-27T00:00:00Z',
  can: { edit: false, retire: false, why: 'It’s kept on the org floor: go there to change it.' },
};

const ctx = (fetch: MountContext['fetch'], path = '/'): MountContext => ({
  user: { id: 'u1', name: 'Sam Okafor', departments: [], roles: [] },
  getToken: async () => 't',
  bus: createEventBus(),
  raise: vi.fn(),
  request: vi.fn(),
  notify: vi.fn(),
  path,
  workspace: floor,
  getWorkspace: () => floor,
  fetch,
});

const answering = (routes: Record<string, () => Response>) =>
  vi.fn(async (path: string) => {
    const route = Object.keys(routes).find((r) => path.startsWith(r));
    return route ? routes[route]() : new Response(null, { status: 404 });
  });

const settle = async (el: HTMLElement) => {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await (el.querySelector('atlas-app') as AtlasApp | null)?.updateComplete;
  }
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('places', () => {
  it('reads and writes its own addresses', () => {
    expect(placeFor('/')).toEqual({ page: 'entities' });
    expect(placeFor('/entities/new')).toEqual({ page: 'new' });
    expect(placeFor('/entities/ent_01')).toEqual({ page: 'entity', id: 'ent_01' });
    expect(pathFor({ page: 'entity', id: 'ent_01' })).toBe('/entities/ent_01');
    expect(addressFor('/@maritime/atlas/entities', '/entities', { page: 'entity', id: 'ent_01' })).toBe('/@maritime/atlas/entities/ent_01');
  });

  it('lays kinds out as a tree and says what an entity is in a line', () => {
    expect(typeTree(ONTOLOGY).map((t) => [t.type.key, t.depth])).toEqual([
      ['artifact', 0],
      ['vehicle', 1],
      ['vessel', 2],
    ]);
    expect(entityLine(ONTOLOGY, TERN)).toBe('Vessel · IMO number 9400117 · Kept on Maritime desk');
  });
});

describe('atlas', () => {
  it('lists what shows from this floor, and says which floors that is', async () => {
    const fetch = answering({
      '/api/atlas/v1/ontology': () => Response.json(ONTOLOGY),
      '/api/atlas/v1/entities': () => Response.json({ entities: [TERN], total: 1, floors: ['org', 'tree:t-mar'], seeing: ['Org', 'Maritime desk'] }),
    });
    const el = document.body.appendChild(document.createElement('div'));
    await app.mount(el, ctx(fetch));
    await settle(el);
    expect(el.querySelector('ui-heading')!.getAttribute('summary')).toMatch(/floors above it shows: Org, Maritime desk/);
    const list = el.querySelector('ui-list') as HTMLElement & { items: { title: string; detail: string }[] };
    expect(list.items).toEqual([expect.objectContaining({ title: 'Northern Tern', detail: 'Vessel · IMO number 9400117 · Kept on Maritime desk' })]);
    await app.unmount!(el);
    expect(el.querySelector('atlas-app')).toBeNull();
  });

  it('shows an entity, with what can’t be done and why, instead of hiding it', async () => {
    const fetch = answering({ '/api/atlas/v1/ontology': () => Response.json(ONTOLOGY), '/api/atlas/v1/entities/ent_01': () => Response.json(TERN) });
    const el = document.body.appendChild(document.createElement('div'));
    await app.mount(el, ctx(fetch, '/entities/ent_01'));
    await settle(el);
    expect(el.querySelector('ui-heading')!.getAttribute('heading')).toBe('Northern Tern');
    const edit = [...el.querySelectorAll('ui-button')].find((b) => b.textContent === 'Edit') as HTMLElement & { disabled: boolean };
    expect(edit.disabled).toBe(true);
    expect(el.textContent).toMatch(/kept on the org floor: go there/);
  });

  it('says why an entity can’t be seen from here', async () => {
    const fetch = answering({
      '/api/atlas/v1/ontology': () => Response.json(ONTOLOGY),
      '/api/atlas/v1/entities/ent_02': () => Response.json({ error: 'unseen', reason: 'kept', message: 'It’s kept on the Finance floor. Ask one of its leads if you need it.' }, { status: 403 }),
    });
    const el = document.body.appendChild(document.createElement('div'));
    await app.mount(el, ctx(fetch, '/entities/ent_02'));
    await settle(el);
    const state = el.querySelector('ui-state')!;
    expect(state.getAttribute('heading')).toBe('You can’t see this from here');
    expect(state.getAttribute('body')).toMatch(/Finance floor/);
  });
});
