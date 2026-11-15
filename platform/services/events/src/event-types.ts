/**
 * Holding an app to the event types its manifest declares (ADR 0104): each event it publishes is on a declared
 * topic, at a declared version (the newest when it names none), with a payload its schema takes.
 */
import { Compile } from 'typebox/compile';
import { BoundedMap, type DeclaredEvents } from '@augur/service-kit';

type Validator = ReturnType<typeof Compile>;

/** A check of one event against what its app declares; each type's schema is compiled once and kept. */
export const payloadChecker = () => {
  const compiled = new BoundedMap<string, Validator>();
  const validator = (schema: Record<string, unknown>): Validator => {
    const key = JSON.stringify(schema);
    let v = compiled.get(key);
    if (!v) {
      v = Compile(schema as Parameters<typeof Compile>[0]);
      compiled.set(key, v);
    }
    return v;
  };
  return (app: string, declared: DeclaredEvents, event: { id: string; topic: string; version?: number; payload: unknown }): { version: number } | { problem: string } => {
    const types = declared.publishes.filter((t) => t.topic === event.topic);
    if (!types.length) return { problem: `${app} doesn’t declare ${event.topic} in its manifest (contributes.events.publishes), so it can’t publish it.` };
    const version = event.version ?? Math.max(...types.map((t) => t.version));
    const type = types.find((t) => t.version === version);
    if (!type) return { problem: `${app} declares ${event.topic} at version ${types.map((t) => t.version).join(', ')}, not ${version}.` };
    let check: Validator;
    try {
      check = validator(type.schema);
    } catch (err) {
      return { problem: `${app}'s schema for ${event.topic} version ${version} can't be read: ${(err as Error).message}.` };
    }
    if (!check.Check(event.payload)) {
      const first = [...check.Errors(event.payload)][0];
      const where = first ? `${first.instancePath || '/'} ${first.message}` : 'it doesn’t fit';
      return { problem: `Event ${event.id}'s payload isn't ${event.topic} version ${version}: ${where}.` };
    }
    return { version };
  };
};
