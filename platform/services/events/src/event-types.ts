/**
 * Holding an app to the event types its manifest declares (ADR 0104): each event it publishes is on a declared
 * topic, at a declared version, with a payload its schema takes. An event that names no version goes at the
 * newest declared version its payload fits, so an outbox row queued before an upgrade still goes out.
 */
import { Compile } from 'typebox/compile';
import type { DeclaredEvents, DeclaredEventType } from '@augur/service-kit';

type Validator = ReturnType<typeof Compile>;

/** The topics an app that says what it reads is given: those, and AUGUR's own (platform.*), which any follower may read. */
export const readable = (reads: string[] | undefined) => (reads ? [...reads, 'platform.*'] : undefined);

/** A check of one event against what its app declares; each type's schema is compiled once and kept, failures too. */
export const payloadChecker = () => {
  const compiled = new WeakMap<DeclaredEventType, Validator | Error>();
  const validator = (type: DeclaredEventType): Validator | Error => {
    let v = compiled.get(type);
    if (!v) {
      try {
        v = Compile(type.schema as Parameters<typeof Compile>[0]);
      } catch (err) {
        v = err instanceof Error ? err : new Error(String(err));
      }
      compiled.set(type, v);
    }
    return v;
  };
  /** Why the payload doesn't fit this type, or undefined when it does. */
  const misfit = (app: string, type: DeclaredEventType, event: { id: string; payload: unknown }): string | undefined => {
    const check = validator(type);
    if (check instanceof Error) return `${app}'s schema for ${type.topic} version ${type.version} can't be read: ${check.message}.`;
    if (check.Check(event.payload)) return undefined;
    const first = [...check.Errors(event.payload)][0];
    const where = first ? `${first.instancePath || '/'} ${first.message}` : 'it doesn’t fit';
    return `Event ${event.id}'s payload isn't ${type.topic} version ${type.version}: ${where}.`;
  };
  return (app: string, declared: DeclaredEvents, event: { id: string; topic: string; version?: number; payload: unknown }): { version: number } | { problem: string } => {
    const types = declared.publishes.filter((t) => t.topic === event.topic).sort((a, b) => b.version - a.version);
    if (!types.length) return { problem: `${app} doesn’t declare ${event.topic} in its manifest (contributes.events.publishes), so it can’t publish it.` };
    if (event.version === undefined) {
      const fits = types.find((t) => !misfit(app, t, event));
      return fits ? { version: fits.version } : { problem: misfit(app, types[0]!, event)! };
    }
    const type = types.find((t) => t.version === event.version);
    if (!type) return { problem: `${app} declares ${event.topic} at version ${types.map((t) => t.version).reverse().join(', ')}, not ${event.version}.` };
    const problem = misfit(app, type, event);
    return problem ? { problem } : { version: type.version };
  };
};
