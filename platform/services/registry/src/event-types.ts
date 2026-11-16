/**
 * The domain events an app on contract 3 declares (ADR 0104): the topics it reads and each type it publishes,
 * with a version and its payload's JSON Schema. The registry checks them on a release, beside its schema, and
 * holds each published type to its version: within one it only gains optional fields.
 */
import { Compile } from 'typebox/compile';
import type { AppManifest3, EventType3 } from '@augur/app-tools/validate';

/** The largest payload schema one event type may declare, in bytes of JSON. */
export const MAX_EVENT_SCHEMA_BYTES = 16 * 1024;

const JSON_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);
const SUBSCHEMA = ['items', 'additionalProperties', 'not', 'contains', 'propertyNames', 'if', 'then', 'else', 'unevaluatedProperties', 'unevaluatedItems'];
const SUBSCHEMA_MAPS = ['properties', '$defs', 'patternProperties', 'dependentSchemas'];
const SUBSCHEMA_LISTS = ['anyOf', 'allOf', 'oneOf', 'prefixItems'];
const NUMBERS = ['minLength', 'maxLength', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minItems', 'maxItems', 'minProperties', 'maxProperties'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Where a JSON pointer within the schema leads, or undefined when nowhere. */
const resolve = (root: unknown, ref: string): unknown =>
  ref
    .slice(2)
    .split('/')
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>((at, key) => (isObject(at) ? at[key] : undefined), root);

/**
 * What's wrong with a payload schema, as far as it can be seen without a meta-schema: the keywords AUGUR reads
 * have the shape JSON Schema 2020-12 gives them, each $ref points somewhere inside it, and each pattern is a
 * regular expression. TypeBox compiles almost anything, so these are what stop a type no event could ever pass.
 */
export const schemaProblem = (root: unknown): string | undefined => {
  const walk = (s: unknown, at: string): string | undefined => {
    if (typeof s === 'boolean') return undefined;
    if (!isObject(s)) return `${at || '/'} is not a schema`;
    const types = s.type === undefined ? [] : Array.isArray(s.type) ? s.type : [s.type];
    if (!types.length && s.type !== undefined) return `${at}/type is empty`;
    const odd = types.find((t) => typeof t !== 'string' || !JSON_TYPES.has(t));
    if (odd !== undefined) return `${at}/type ${JSON.stringify(odd)} is not a JSON type`;
    if (s.required !== undefined && !(Array.isArray(s.required) && s.required.every((r) => typeof r === 'string'))) return `${at}/required is not a list of names`;
    if (s.enum !== undefined && !Array.isArray(s.enum)) return `${at}/enum is not a list`;
    for (const key of NUMBERS) if (s[key] !== undefined && typeof s[key] !== 'number') return `${at}/${key} is not a number`;
    if (s.pattern !== undefined) {
      if (typeof s.pattern !== 'string') return `${at}/pattern is not a string`;
      try {
        new RegExp(s.pattern, 'u');
      } catch {
        return `${at}/pattern is not a regular expression`;
      }
    }
    if (s.$ref !== undefined) {
      if (typeof s.$ref !== 'string' || !s.$ref.startsWith('#/')) return `${at}/$ref must point inside the schema (#/…)`;
      if (resolve(root, s.$ref) === undefined) return `${at}/$ref ${s.$ref} points at nothing`;
    }
    for (const key of SUBSCHEMA) if (s[key] !== undefined) {
      const p = walk(s[key], `${at}/${key}`);
      if (p) return p;
    }
    for (const key of SUBSCHEMA_MAPS) if (s[key] !== undefined) {
      if (!isObject(s[key])) return `${at}/${key} is not an object of schemas`;
      for (const [name, sub] of Object.entries(s[key])) {
        const p = walk(sub, `${at}/${key}/${name}`);
        if (p) return p;
      }
    }
    for (const key of SUBSCHEMA_LISTS) if (s[key] !== undefined) {
      if (!Array.isArray(s[key])) return `${at}/${key} is not a list of schemas`;
      for (const [i, sub] of (s[key] as unknown[]).entries()) {
        const p = walk(sub, `${at}/${key}/${i}`);
        if (p) return p;
      }
    }
    return undefined;
  };
  const found = walk(root, '');
  if (found) return found;
  try {
    Compile(root as Parameters<typeof Compile>[0]);
  } catch (err) {
    return (err as Error).message;
  }
  return undefined;
};

/**
 * Why a manifest's events can't be taken, beyond its schema, every reason at once: reading needs
 * events:subscribe and publishing events:publish; an app publishes only under its own id, each topic and
 * version once, with a payload schema that reads and isn't over the limit.
 */
export const eventsProblems = (m: AppManifest3): string[] => {
  const events = m.contributes?.events;
  if (!events) return [];
  const out: string[] = [];
  const scopes = m.scopes ?? [];
  if (events.reads?.length && !scopes.includes('events:subscribe')) out.push(`${m.name} says which events it reads, but doesn't ask for events:subscribe.`);
  if (events.publishes?.length && !scopes.includes('events:publish')) out.push(`${m.name} says which events it publishes, but doesn't ask for events:publish.`);
  const seen = new Set<string>();
  for (const type of events.publishes ?? []) {
    const key = `${type.topic} version ${type.version}`;
    if (!type.topic.startsWith(`${m.id}.`)) out.push(`${m.name} can't publish ${type.topic}: an app publishes only under its own id (${m.id}.…).`);
    if (seen.has(key)) out.push(`${m.name} declares ${key} twice.`);
    seen.add(key);
    if (Buffer.byteLength(JSON.stringify(type.schema)) > MAX_EVENT_SCHEMA_BYTES) out.push(`${m.name}'s schema for ${key} is over ${MAX_EVENT_SCHEMA_BYTES / 1024} KB.`);
    else {
      const problem = schemaProblem(type.schema);
      if (problem) out.push(`${m.name}'s schema for ${key} can't be read: ${problem}.`);
    }
  }
  return out;
};

/** Words only for people, which a type may change within its version. */
const NOTES = new Set(['title', 'description', '$comment', 'examples']);

const stable = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(stable).join(',')}]`
    : isObject(v)
      ? `{${Object.keys(v)
          .filter((k) => v[k] !== undefined && !NOTES.has(k))
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
          .join(',')}}`
      : JSON.stringify(v);

/** What a type changed within its version beyond adding optional fields; undefined when it only added them. */
const changeOf = (was: Record<string, unknown>, now: Record<string, unknown>): string | undefined => {
  const required = (s: Record<string, unknown>) => [...((s.required as string[] | undefined) ?? [])].sort().join(',');
  if (required(was) !== required(now)) return 'changes which fields it requires';
  const wasProps = (was.properties ?? {}) as Record<string, unknown>;
  const nowProps = (now.properties ?? {}) as Record<string, unknown>;
  for (const [name, schema] of Object.entries(wasProps)) {
    if (!(name in nowProps)) return `drops ${name}`;
    if (stable(schema) !== stable(nowProps[name])) return `changes ${name}`;
  }
  const { properties: _w, required: _wr, ...wasRest } = was;
  const { properties: _n, required: _nr, ...nowRest } = now;
  if (stable(wasRest) !== stable(nowRest)) return 'changes more than its fields';
  return undefined;
};

/**
 * How a release's event types break the ones it replaces (ADR 0104): within a version a type only gains optional
 * fields, so anything else needs a new version. A version a release stops declaring is fine: it publishes no more.
 */
export const eventsChangeProblems = (before: AppManifest3 | undefined, after: AppManifest3): string[] => {
  const was = new Map((before?.contributes?.events?.publishes ?? []).map((t: EventType3) => [`${t.topic} version ${t.version}`, t.schema]));
  const out: string[] = [];
  for (const type of after.contributes?.events?.publishes ?? []) {
    const key = `${type.topic} version ${type.version}`;
    const old = was.get(key);
    const change = old && changeOf(old, type.schema);
    if (change) out.push(`${after.name} ${after.version}'s ${key} ${change} from ${before!.version}'s: within a version a type only gains optional fields, so this needs version ${type.version + 1}.`);
  }
  return out;
};

/** The events a manifest declares, as AUGUR's services read them (ADR 0104); undefined when it declares none. */
export const declaredEvents = (m: AppManifest3 | undefined) => {
  const events = m?.contributes?.events;
  if (!events || (events.reads === undefined && !events.publishes?.length)) return undefined;
  return {
    ...(events.reads ? { reads: events.reads } : {}),
    publishes: (events.publishes ?? []).map(({ topic, version, schema }) => ({ topic, version, schema })),
  };
};
