import { addToOutbox, type DomainEvent, type NewDomainEvent, type Queryable } from './domain-events.js';

/**
 * Entity bindings (ADR 0025, ADR 0066): an app keeps its own links from its things to entities in
 * Data Atlas, in its own schema, and tells the rest of AUGUR through its outbox, in the same
 * transaction as the link. Every app's events have one shape, so Data Atlas (and anyone else)
 * reads them all the same way:
 *
 * - topic `<app>.<type>.entity-bound` or `<app>.<type>.entity-unbound` ("mandate.intent.entity-bound");
 * - payload `{ <type>: id, entity, role?, ...more ids }` (`{ intent: 'int_1', entity: 'ent_…', role: 'subject' }`).
 *
 * Like every domain event they carry ids only, never titles or text: a follower that needs more
 * asks the app, as the person.
 */

/** One link from an app's thing to an entity. */
export interface Binding {
  /** The app that keeps the link: "mandate". */
  app: string;
  /** What kind of thing of the app's is linked: "intent". It names the topic and the payload's key for `id`. */
  type: string;
  /** The app's own id for the thing. */
  id: string;
  /** The entity's id in Data Atlas (`ent_` and a ULID). */
  entity: string;
  /** How the thing relates to the entity, in the app's words: "subject", "about". */
  role?: string;
  /** More ids a follower needs to open the thing, as Artifacts sends `library` and `level`. Never titles or text. */
  more?: Record<string, string>;
}

export type BindingChange = 'bound' | 'unbound';

const NAME = /^[a-z][a-z0-9-]*$/;
const TOPIC = /^([a-z][a-z0-9-]*)\.([a-z][a-z0-9-]*)\.entity-(bound|unbound)$/;
const RESERVED = new Set(['entity', 'role']);

/** The two topics an app's bindings of one type are published on, to declare and to follow. */
export const bindingTopics = (app: string, type: string) => ({ bound: `${app}.${type}.entity-bound`, unbound: `${app}.${type}.entity-unbound` });

/** The domain event that tells of a binding made or taken away. Throws on a binding that can't be told this way. */
export const bindingEvent = (binding: Binding, change: BindingChange, workspace?: string): Omit<NewDomainEvent, 'id'> => {
  const { app, type, id, entity, role, more = {} } = binding;
  if (!NAME.test(app) || !NAME.test(type)) throw new Error(`A binding's app and type are lowercase names: "${app}", "${type}".`);
  if (RESERVED.has(type)) throw new Error(`A binding's type can't be "${type}": the payload uses that key.`);
  if (!id || !entity) throw new Error('A binding needs the thing’s id and the entity’s.');
  const clash = Object.keys(more).find((k) => k === type || RESERVED.has(k));
  if (clash) throw new Error(`A binding's more ids can't use "${clash}": the payload uses that key.`);
  return {
    topic: bindingTopics(app, type)[change],
    ...(workspace ? { workspace } : {}),
    payload: { ...more, [type]: id, entity, ...(role ? { role } : {}) },
  };
};

/** Adds the event for a binding made or taken away to the outbox. Call it inside the transaction that changes the link. */
export const outboxBinding = (db: Queryable, binding: Binding, change: BindingChange, workspace?: string) => addToOutbox(db, bindingEvent(binding, change, workspace));

/** A binding read back from a followed event, with whether it was made or taken away and its floor. */
export interface FollowedBinding extends Binding {
  change: BindingChange;
  workspace?: string;
}

/** The binding an event tells of, or undefined when it isn't a binding event or its payload doesn't hold one. */
export const readBinding = (event: Pick<DomainEvent, 'topic' | 'payload' | 'workspace'>): FollowedBinding | undefined => {
  const m = TOPIC.exec(event.topic);
  if (!m) return undefined;
  const [, app, type, change] = m as unknown as [string, string, string, BindingChange];
  const p = (event.payload ?? {}) as Record<string, unknown>;
  const id = p[type];
  if (typeof id !== 'string' || !id || typeof p.entity !== 'string' || !p.entity) return undefined;
  const more = Object.fromEntries(Object.entries(p).filter(([k, v]) => k !== type && !RESERVED.has(k) && typeof v === 'string')) as Record<string, string>;
  return {
    app,
    type,
    id,
    entity: p.entity,
    change,
    ...(typeof p.role === 'string' && p.role ? { role: p.role } : {}),
    ...(Object.keys(more).length ? { more } : {}),
    ...(event.workspace?.id ? { workspace: event.workspace.id } : {}),
  };
};
