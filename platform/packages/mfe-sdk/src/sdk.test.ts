import { describe, expect, it, vi } from 'vitest';
import {
  createEventBus,
  explainEntity,
  isEntityRef,
  openEntity,
  pickEntities,
  proposeEntity,
  type EntityRef,
  floorFetch,
  IntentCancelled,
  IntentError,
  isDocumentRef,
  isIntentCancelled,
  openDocument,
  openLibrary,
  isLibraryRef,
  type LibraryRef,
  pickDocument,
  resolveIntent,
  type AppManifestEntry,
  type DocumentRef,
  type MountContext,
  type Workspace,
  isUnitRef,
  openUnit,
  type UnitRef,
} from './index.js';

describe('event bus', () => {
  it('delivers to subscribers until they unsubscribe', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const off = bus.on('document.published', handler);
    bus.emit('document.published', { id: 'd1' });
    off();
    bus.emit('document.published', { id: 'd2' });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ id: 'd1' });
  });
});

describe('resolveIntent', () => {
  const manifest: AppManifestEntry[] = [
    { id: 'home', name: 'Home', route: '/', entry: '/home.js', version: '0.1.0' },
    { id: 'library', name: 'Library', route: '/library', entry: '/library.js', version: '0.1.0', handles: ['document.open'] },
  ];

  it('routes to the app that handles the intent type', () => {
    expect(resolveIntent(manifest, { type: 'document.open', payload: { id: 'd1' } })?.id).toBe('library');
  });

  it('returns undefined when nothing handles it', () => {
    expect(resolveIntent(manifest, { type: 'entity.open', payload: {} })).toBeUndefined();
  });
});

describe('isIntentCancelled', () => {
  it('recognises a cancellation by name, even from another copy of the SDK', () => {
    const fromAnotherBundle = Object.assign(new Error('closed'), { name: 'IntentCancelled' });
    expect(isIntentCancelled(new IntentCancelled())).toBe(true);
    expect(isIntentCancelled(fromAnotherBundle)).toBe(true);
    expect(isIntentCancelled(new IntentError('No app handles it'))).toBe(false);
    expect(isIntentCancelled('IntentCancelled')).toBe(false);
  });
});

describe('floorFetch', () => {
  const finance: Workspace = { id: 'w-fin', kind: 'team', name: 'Finance', slug: 'finance', path: [], role: 'member' };

  it('adds the token and the current floor, read at call time', async () => {
    let floor = finance;
    const fetchImpl = vi.fn(async () => new Response('ok'));
    const call = floorFetch(async () => 'tok', () => floor, fetchImpl as unknown as typeof fetch);
    await call('/api/library/v1/docs', { method: 'POST' });
    floor = { ...finance, id: 'w-org' };
    await call('/api/library/v1/docs');
    const sent = fetchImpl.mock.calls.map((c) => (c as unknown as [string, RequestInit])[1]);
    expect(sent[0].method).toBe('POST');
    expect(new Headers(sent[0].headers).get('authorization')).toBe('Bearer tok');
    expect(new Headers(sent[0].headers).get('x-workspace-id')).toBe('w-fin');
    expect(new Headers(sent[1].headers).get('x-workspace-id')).toBe('w-org');
  });

  it('leaves headers the app set itself', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok'));
    await floorFetch(async () => 'tok', () => finance, fetchImpl as unknown as typeof fetch)('/x', { headers: { 'X-Workspace-Id': 'w-other', Authorization: 'Bearer mine' } });
    const headers = new Headers((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].headers);
    expect([headers.get('x-workspace-id'), headers.get('authorization')]).toEqual(['w-other', 'Bearer mine']);
  });
});

describe('document intents', () => {
  const ref: DocumentRef = { app: 'folio', id: 'd-1', version: '3', title: 'Travel policy' };

  it('opens a document through whichever app handles document.open', async () => {
    const raise = vi.fn(async () => undefined);
    await openDocument({ raise }, ref);
    expect(raise).toHaveBeenCalledWith({ type: 'document.open', payload: ref });
  });

  it('asks for a document and checks the answer is one', async () => {
    const request = vi.fn(async () => ref as unknown);
    await expect(pickDocument({ request: request as MountContext['request'] }, { purpose: 'Attach a policy' })).resolves.toEqual(ref);
    expect(request).toHaveBeenCalledWith({ type: 'document.pick', payload: { purpose: 'Attach a policy' } });
    request.mockResolvedValueOnce({ id: 'd-1' });
    await expect(pickDocument({ request: request as MountContext['request'] })).rejects.toMatchObject({ name: 'IntentError' });
  });

  it('opens a library through whichever app handles library.open, and knows a LibraryRef', async () => {
    const raise = vi.fn(async () => undefined);
    const library: LibraryRef = { app: 'folio', id: 'l-1', name: 'Policies' };
    await openLibrary({ raise }, library);
    expect(raise).toHaveBeenCalledWith({ type: 'library.open', payload: library });
    expect(isLibraryRef(library)).toBe(true);
    expect(isLibraryRef({ app: 'folio', id: 'l-1' })).toBe(false);
    expect(isLibraryRef('l-1')).toBe(false);
  });

  it('knows a DocumentRef when it sees one', () => {
    expect(isDocumentRef(ref)).toBe(true);
    expect(isDocumentRef({ app: 'folio', id: 'd-1' })).toBe(false);
    expect(isDocumentRef({ ...ref, version: 3 })).toBe(false);
    expect(isDocumentRef(null)).toBe(false);
  });
});

describe('unit intent', () => {
  const ref: UnitRef = { kind: 'unit', app: 'folio', id: 'l-1/f-reports', level: 'series', name: 'Reports' };

  it('opens a unit through whichever app handles unit.open', async () => {
    const raise = vi.fn(async () => undefined);
    await openUnit({ raise }, ref);
    expect(raise).toHaveBeenCalledWith({ type: 'unit.open', payload: ref });
  });

  it('knows a UnitRef when it sees one, at a level of the shape', () => {
    expect(isUnitRef(ref)).toBe(true);
    expect(isUnitRef({ ...ref, level: 'file', id: 'l-1/d-1' })).toBe(true);
    expect(isUnitRef({ ...ref, level: 'folder' })).toBe(false);
    expect(isUnitRef({ ...ref, kind: 'entity' })).toBe(false);
    expect(isUnitRef({ ...ref, name: '' })).toBe(false);
    expect(isUnitRef(undefined)).toBe(false);
  });
});

describe('entity intents', () => {
  const tern: EntityRef = { kind: 'entity', id: 'ent_01JBX7Q2W3E4R5T6Y7V8H9Q0PA', type: 'vessel', label: 'Northern Tern' };
  const port: EntityRef = { kind: 'entity', id: 'ent_01JBX7Q2W3E4R5T6Y7V8H9Q0PB', type: 'port', label: 'Felixstowe' };

  it('knows an EntityRef by its shape', () => {
    expect(isEntityRef(tern)).toBe(true);
    expect(isEntityRef({ ...tern, at: '2026-10-27' })).toBe(true);
    expect(isEntityRef({ ...tern, kind: 'document' })).toBe(false);
    expect(isEntityRef({ ...tern, id: 'd-1' })).toBe(false);
    expect(isEntityRef({ ...tern, label: '' })).toBe(false);
  });

  it('opens and explains an entity through whichever app handles them', async () => {
    const raise = vi.fn(async () => undefined);
    await openEntity({ raise }, tern);
    await explainEntity({ raise }, tern);
    expect(raise.mock.calls).toEqual([[{ type: 'entity.open', payload: tern }], [{ type: 'entity.explain', payload: tern }]]);
  });

  it('asks for entities and always answers a checked list', async () => {
    const request = vi.fn(async () => tern as unknown);
    await expect(pickEntities({ request: request as MountContext['request'] }, { purpose: 'Bind' })).resolves.toEqual([tern]);
    expect(request).toHaveBeenCalledWith({ type: 'entity.pick', payload: { purpose: 'Bind' } });
    request.mockResolvedValueOnce([tern, port]);
    await expect(pickEntities({ request: request as MountContext['request'] }, { multiple: true })).resolves.toEqual([tern, port]);
    request.mockResolvedValueOnce([tern, port]);
    await expect(pickEntities({ request: request as MountContext['request'] })).resolves.toEqual([tern]);
    request.mockResolvedValueOnce([]);
    await expect(pickEntities({ request: request as MountContext['request'] })).rejects.toMatchObject({ name: 'IntentError' });
    request.mockResolvedValueOnce([{ id: 'x' }]);
    await expect(pickEntities({ request: request as MountContext['request'] })).rejects.toMatchObject({ name: 'IntentError' });
  });

  it('offers marked words to whatever keeps entities, and checks the receipt', async () => {
    const source = { app: 'folio', id: 'd7', version: '3', title: 'Maritime weekly 42' };
    const request = vi.fn(async () => ({ proposal: 'prp_1', queue: 'Maritime desk’s Triage' }) as unknown);
    const offer = { source, anchor: 'p-12', text: 'N. Tern', context: 'The cargo ship N. Tern was seen alongside.' };
    await expect(proposeEntity({ request: request as MountContext['request'] }, offer)).resolves.toEqual({ proposal: 'prp_1', queue: 'Maritime desk’s Triage' });
    expect(request).toHaveBeenCalledWith({ type: 'entity.propose', payload: offer });
    request.mockResolvedValueOnce({ id: 'x' });
    await expect(proposeEntity({ request: request as MountContext['request'] }, offer)).rejects.toMatchObject({ name: 'IntentError' });
    await expect(proposeEntity({ request: request as MountContext['request'] }, { source, text: '' })).rejects.toMatchObject({ name: 'IntentError' });
  });
});
