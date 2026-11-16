import type { AppManifestEntry } from '@augur/mfe-sdk';
import { CURRENT_SDK } from '../current-sdk.js';
import { isIntentCancelled } from '@augur/mfe-sdk';
import { describe, expect, it } from 'vitest';
import { handlerFor, IntentError, RequestBroker } from './intents.js';

const app = (id: string, handles: string[] = []): AppManifestEntry => ({ id, name: id, route: `/${id}`, entry: `/apps/${id}/entry.js`, version: '0.1.0', sdk: CURRENT_SDK, handles });
const manifest = [app('board'), app('palette', ['colour.pick'])];
const pick = { type: 'colour.pick', payload: { purpose: 'a label' } };

describe('RequestBroker', () => {
  it('opens the answering app and resolves with its answer', async () => {
    const broker = new RequestBroker();
    const { request, answer } = broker.begin<{ hex: string }>(manifest, pick);
    expect(request.app.id).toBe('palette');
    expect(broker.current).toMatchObject({ app: { id: 'palette' }, intent: pick });
    broker.respond({ hex: '#4a8f6d' });
    await expect(answer).resolves.toEqual({ hex: '#4a8f6d' });
    expect(broker.current).toBeUndefined();
  });

  it('rejects as cancelled when the person closes it', async () => {
    const broker = new RequestBroker();
    const { answer } = broker.begin(manifest, pick);
    broker.cancel();
    const err = await answer.catch((e: unknown) => e);
    expect(isIntentCancelled(err)).toBe(true);
  });

  it('allows one request at a time', () => {
    const broker = new RequestBroker();
    broker.begin(manifest, pick);
    expect(() => broker.begin(manifest, pick)).toThrow(new IntentError('palette is already open for another request. Finish that first.'));
  });

  it('says so when no app the person can open handles it', () => {
    expect(() => new RequestBroker().begin(manifest, { type: 'map.pick', payload: {} })).toThrow(new IntentError('No app you can open handles "map.pick".'));
  });

  it('ignores a second answer', async () => {
    const broker = new RequestBroker();
    const { answer } = broker.begin(manifest, pick);
    broker.respond('first');
    broker.respond('second');
    broker.cancel();
    await expect(answer).resolves.toBe('first');
  });
});

describe('handlerFor (PER-468)', () => {
  const two = [app('board'), app('archive', ['document.open']), app('library', ['document.open'])];
  const open = { type: 'document.open', payload: { id: 'd1' } };

  it('asks the person when two apps handle an intent, rather than settling it by id', () => {
    expect(handlerFor(two, open)).toEqual({ choose: [two[1], two[2]] });
    expect(() => new RequestBroker().begin(two, open)).toThrow(/archive and library both handle "document.open"/);
  });

  it('keeps to their choice while that app still handles it, and asks again once it doesn’t', () => {
    expect(handlerFor(two, open, [{ intent: 'document.open', app: 'library' }])).toEqual({ app: two[2] });
    expect(handlerFor(two, open, [{ intent: 'document.open', app: 'gone' }])).toEqual({ choose: [two[1], two[2]] });
    expect(handlerFor(manifest, pick, [{ intent: 'colour.pick', app: 'gone' }])).toEqual({ app: manifest[1] });
  });

  it('opens the app they chose', () => {
    expect(new RequestBroker().begin(two, open, two[2]).request.app.id).toBe('library');
  });
});
