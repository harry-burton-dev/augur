import { describe, expect, it } from 'vitest';
import { loadModel, OpenFga } from './openfga.ts';

// Against a real OpenFGA, when OPENFGA_TEST_URL names one (docker run -p 8080:8080 openfga/openfga run):
// the calls this service makes, as OpenFGA's API answers them.
const url = process.env.OPENFGA_TEST_URL;

describe.skipIf(!url)('OpenFGA itself', () => {
  it('makes a store and model once, then finds them, and answers checks one at a time and in a batch', async () => {
    const engine = new OpenFga({ url: url! });
    const name = `test-${Date.now()}`;
    const store = await engine.ensureStore(name);
    expect(await engine.ensureStore(name)).toBe(store);
    const model = loadModel();
    const id = await engine.ensureModel(store, model);
    expect(await engine.ensureModel(store, model)).toBe(id);

    const write = await fetch(`${url}/stores/${store}/write`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        authorization_model_id: id,
        writes: {
          tuple_keys: [
            { user: 'org:org', relation: 'parent', object: 'floor:ops' },
            { user: 'floor:port', relation: 'child', object: 'floor:ops' },
            { user: 'floor:ops', relation: 'parent', object: 'floor:port' },
            { user: 'person:tomas', relation: 'lead', object: 'floor:port' },
            { user: 'person:amara', relation: 'lead', object: 'floor:ops' },
          ],
        },
      }),
    });
    expect(write.ok).toBe(true);

    const now = { current_time: new Date().toISOString() };
    expect(await engine.check(store, id, { user: 'person:tomas', relation: 'stands', object: 'floor:ops' }, now, 'HIGHER_CONSISTENCY')).toBe(true);
    expect(await engine.check(store, id, { user: 'person:amara', relation: 'can_act_as_lead', object: 'floor:port' }, now, 'MINIMIZE_LATENCY')).toBe(false);
    expect(
      await engine.batchCheck(
        store,
        id,
        [
          { user: 'person:amara', relation: 'can_manage_members', object: 'floor:port' },
          { user: 'person:tomas', relation: 'can_manage_members', object: 'floor:ops' },
        ],
        now,
        'MINIMIZE_LATENCY',
      ),
    ).toEqual([{ allowed: true }, { allowed: false }]);
    expect(await engine.healthy()).toBe(true);
  });
});
