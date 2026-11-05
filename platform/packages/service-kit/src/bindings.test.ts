import { describe, expect, it } from 'vitest';
import { bindingEvent, bindingTopics, outboxBinding, readBinding } from './bindings.js';

const entity = 'ent_01JBX0000000000000000000AB';

describe('entity bindings', () => {
  it('tells of a binding in the shape Mandate and Artifacts publish', () => {
    expect(bindingEvent({ app: 'mandate', type: 'intent', id: 'int_1', entity, role: 'subject' }, 'bound', 't-ops')).toEqual({
      topic: 'mandate.intent.entity-bound',
      workspace: 't-ops',
      payload: { intent: 'int_1', entity, role: 'subject' },
    });
    expect(bindingEvent({ app: 'folio', type: 'record', id: 'lib_1/d-9', entity, role: 'about', more: { library: 'lib_1', level: 'file', link: 'k1' } }, 'unbound').payload).toEqual({
      record: 'lib_1/d-9',
      library: 'lib_1',
      level: 'file',
      link: 'k1',
      entity,
      role: 'about',
    });
    expect(bindingTopics('mandate', 'intent')).toEqual({ bound: 'mandate.intent.entity-bound', unbound: 'mandate.intent.entity-unbound' });
  });

  it('refuses a binding that would read back as something else', () => {
    expect(() => bindingEvent({ app: 'Mandate', type: 'intent', id: 'i', entity }, 'bound')).toThrow(/lowercase/);
    expect(() => bindingEvent({ app: 'mandate', type: 'entity', id: 'i', entity }, 'bound')).toThrow(/can't be "entity"/);
    expect(() => bindingEvent({ app: 'mandate', type: 'intent', id: 'i', entity, more: { role: 'x' } }, 'bound')).toThrow(/"role"/);
    expect(() => bindingEvent({ app: 'mandate', type: 'intent', id: '', entity }, 'bound')).toThrow(/needs/);
  });

  it('reads back what it wrote, from any app, and nothing else', () => {
    const binding = { app: 'folio', type: 'record', id: 'lib_1/d-9', entity, role: 'about', more: { library: 'lib_1', level: 'file' } };
    const event = bindingEvent(binding, 'bound');
    expect(readBinding({ ...event, workspace: { id: 't-ops', path: [] } })).toEqual({ ...binding, change: 'bound', workspace: 't-ops' });
    expect(readBinding({ topic: 'mandate.intent.entity-unbound', payload: { intent: 'int_1', entity } })).toEqual({ app: 'mandate', type: 'intent', id: 'int_1', entity, change: 'unbound' });
    expect(readBinding({ topic: 'folio.document.published', payload: { document: 'd1' } })).toBeUndefined();
    expect(readBinding({ topic: 'mandate.intent.entity-bound', payload: { entity } })).toBeUndefined();
  });

  it('writes the event to the outbox in the caller’s transaction', async () => {
    const calls: unknown[][] = [];
    await outboxBinding({ query: async (text, values) => (calls.push([text, values]), { rows: [] }) }, { app: 'mandate', type: 'intent', id: 'int_1', entity }, 'bound', 't-ops');
    expect(calls).toEqual([['insert into outbox (topic, workspace_id, payload) values ($1, $2, $3)', ['mandate.intent.entity-bound', 't-ops', JSON.stringify({ intent: 'int_1', entity })]]]);
  });
});
