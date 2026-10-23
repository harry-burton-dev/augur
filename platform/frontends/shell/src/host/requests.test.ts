import type { AppManifestEntry } from '@augur/mfe-sdk';
import { isIntentCancelled } from '@augur/mfe-sdk';
import { describe, expect, it } from 'vitest';
import { IntentError, RequestBroker } from './intents.js';

const app = (id: string, handles: string[] = []): AppManifestEntry => ({ id, name: id, route: `/${id}`, entry: `/apps/${id}/entry.js`, version: '0.1.0', sdk: '^1.0.0', handles });
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
