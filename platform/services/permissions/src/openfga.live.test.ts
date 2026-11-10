import { describe, expect, it } from 'vitest';
import { loadModel, OpenFga } from './openfga.ts';
import { project } from './projection.ts';

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
            { user: 'person:tomas', relation: 'holder', object: 'persona:port-lead' },
            { user: 'person:amara', relation: 'holder', object: 'persona:ops-head' },
            { user: 'persona:port-lead#holder', relation: 'lead', object: 'floor:port' },
            { user: 'persona:ops-head#holder', relation: 'lead', object: 'floor:ops' },
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

  it('copies identity in, reading every page and writing what changed, and the copy answers checks', async () => {
    const engine = new OpenFga({ url: url! });
    const store = await engine.ensureStore(`copy-${Date.now()}`);
    const modelId = await engine.ensureModel(store, loadModel());
    const people = Array.from({ length: 130 }, (_, i) => `p${i}`);
    const identity = {
      org: 'o',
      teams: [{ id: 'port', parent: 'o' }],
      personal: [],
      positions: [{ id: 'harbour-master', team: 'port', role: 'lead' as const, holder: 'p1' }],
      people,
      roles: { admin: ['p0'], 'deployment-admin': [], publisher: [] },
    };
    // More than one page to read and more than one call to write.
    expect(await project({ engine, store, modelId, relationships: async () => identity })).toMatchObject({ added: 137, removed: 0 });
    expect((await engine.readAll(store, 50)).length).toBe(137);
    expect(await project({ engine, store, modelId, relationships: async () => identity })).toMatchObject({ added: 0, removed: 0 });
    const now = { current_time: new Date().toISOString() };
    expect(await engine.check(store, modelId, { user: 'person:p1', relation: 'can_act_as_lead', object: 'floor:port' }, now, 'HIGHER_CONSISTENCY')).toBe(true);
    const handedOver = { ...identity, positions: [{ ...identity.positions[0], holder: 'p2' }] };
    expect(await project({ engine, store, modelId, relationships: async () => handedOver })).toMatchObject({ added: 1, removed: 1 });
    expect(await engine.check(store, modelId, { user: 'person:p1', relation: 'can_act_as_lead', object: 'floor:port' }, now, 'HIGHER_CONSISTENCY')).toBe(false);
    expect(await engine.check(store, modelId, { user: 'person:p2', relation: 'stands', object: 'org:o' }, now, 'HIGHER_CONSISTENCY')).toBe(true);

    // Today's admin is copied as an admin persona: it can manage people, the person as themselves can't.
    expect(await engine.listObjects(store, modelId, { user: 'person:p0', relation: 'holder', type: 'persona' }, now, 'HIGHER_CONSISTENCY')).toEqual(['persona:admin.p0']);
    expect(await engine.check(store, modelId, { user: 'persona:admin.p0', relation: 'can_manage_people', object: 'org:o' }, now, 'HIGHER_CONSISTENCY')).toBe(true);
    expect(await engine.check(store, modelId, { user: 'persona:admin.p0', relation: 'admin', object: 'floor:port' }, now, 'HIGHER_CONSISTENCY')).toBe(true);
    expect(await engine.check(store, modelId, { user: 'persona:admin.p0', relation: 'can_upgrade', object: 'deployment:this' }, now, 'HIGHER_CONSISTENCY')).toBe(false);
    expect(await engine.check(store, modelId, { user: 'person:p0', relation: 'can_manage_people', object: 'org:o' }, now, 'HIGHER_CONSISTENCY')).toBe(false);
  });
});
