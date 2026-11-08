/**
 * What the registry checks in a contract 3 release (spec 9.1 to 9.3, ADR 0075): the published schemas first
 * (app-tools' validators, the same ones `augur-app validate` runs), then the rules a schema can't say, each
 * refused with a plain reason, then what it only warns about. The runner checks signatures and ceilings.
 */
import { contractValidators, partProblems } from '@augur/app-tools/validate';
import type { AppManifest3, ScorePart } from '@augur/app-tools/validate';
import { APP_RELEASE_2_SCHEMA, asksOf2, type AppRelease2 } from '@augur/app-tools/release2';
import { isOfferedScope, reservedIdProblem } from '@augur/service-kit';
import { platformApps } from './manifest.ts';

/** The contract majors this registry serves (spec 11.1, 11.5). Contract 3 has no compatibility path (11.6). */
export const SERVED_CONTRACTS: readonly number[] = [3];

/** AUGUR's resource types, version 1 (spec 4.4). */
export const RESOURCE_TYPES = [
  'augur-gateway',
  'augur-database',
  'augur-bucket',
  'augur-floor-graphs',
  'augur-telemetry',
  'augur-scratch',
  'augur-files',
  'augur-outbound',
  'augur-settings',
] as const;

/** The outputs a part may read only in `files`, never in `variables` (spec 4.6). */
const SECRET_OUTPUTS: Record<string, readonly string[]> = {
  'augur-gateway': ['client_secret'],
  'augur-database': ['password'],
  'augur-bucket': ['secret_access_key'],
};

/** How many schema problems a refusal lists (spec 9.1). */
const SCHEMA_REASONS = 3;

/** What this deployment offers, which a release is checked against. By default, all of contract 3. */
export interface Offered {
  /** The resource types its runner provisions. */
  resources?: readonly string[];
  /** The contract majors it serves. */
  contracts?: readonly number[];
}

export interface ReleaseCheck {
  /** Why it can't install, each in plain words; empty when it can. */
  refusals: string[];
  /** What an admin is told, but doesn't stop it. */
  warnings: string[];
}

/** What a release file says it is, for one on a contract this AUGUR doesn't serve. */
export const contractMessage = (contract: unknown, served: readonly number[] = SERVED_CONTRACTS) =>
  `This release is on contract ${String(contract)}; this AUGUR serves ${served.join(' and ')}.`;

/** The contract a release file speaks: 2 for a v1 file, the manifest's `contract` for a v2 one. */
const contractOf = (release: Record<string, unknown>): unknown => {
  if (release.schema === 'augur.app-release/v1') return 2;
  const manifest = release.manifest as { contract?: unknown } | undefined;
  return manifest?.contract;
};

const kind = (part: ScorePart) => part.metadata.annotations?.['augur.dev/part'];
const resources = (part: ScorePart) => Object.entries(part.resources ?? {});
const isInbound = (part: ScorePart) => resources(part).some(([, r]) => r.type === 'augur-gateway' && r.params?.inbound === true);

/** JSON with object keys in order, so two values compare equal however their keys were stored (jsonb reorders them). */
export const stable = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(stable).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v)
          .sort()
          .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
          .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
          .join(',')}}`
      : JSON.stringify(v);

/** The ids used more than once in a list. */
const repeated = (ids: (string | undefined)[]) => [...new Set(ids.filter((id, i) => id !== undefined && ids.indexOf(id) !== i))] as string[];

/** The rules of 9.2 that a schema can't say. */
const ruleRefusals = (release: AppRelease2, offered: Required<Offered>): string[] => {
  const out: string[] = [];
  const m = release.manifest;
  const c = (m.contributes ?? {}) as Record<string, unknown>;
  const list = (key: string) => (Array.isArray(c[key]) ? (c[key] as Record<string, unknown>[]) : []);
  const reserved = reservedIdProblem(release.id) ?? (platformApps.some((a) => a.id === release.id) ? `"${release.id}" is one of AUGUR's own apps.` : undefined);
  if (reserved) out.push(reserved);
  if (release.id !== m.id || release.version !== m.version) out.push('The release file’s id and version must be its manifest’s.');

  const notOffered = (m.scopes ?? []).filter((s) => !isOfferedScope(s));
  if (notOffered.length) out.push(`${m.name} asks for ${notOffered.join(', ')}, which this AUGUR doesn’t offer.`);

  const parts = release.parts;
  for (const name of repeated(parts.map((p) => p.metadata.name))) out.push(`Two parts are named ${name}: each part's name is its own (spec 4.3).`);
  // The asks an admin agrees to must be what the manifest and parts say, or a part could ask for more unseen.
  if (stable(asksOf2(m, parts)) !== stable(release.asks)) out.push('The release’s asks aren’t what its manifest and parts ask for. Build the release file again with @augur/app-tools.');
  const inbound = parts.filter(isInbound);
  if (inbound.length > 1) out.push(`Only one part may take the gateway’s calls (inbound), and ${inbound.map((p) => p.metadata.name).join(' and ')} both do.`);
  for (const p of inbound) if (kind(p) !== 'service') out.push(`${p.metadata.name} takes the gateway’s calls (inbound) but is a ${kind(p) ?? 'part of no kind'}: only a service part can.`);
  for (const p of parts) if (kind(p) === 'service' && !Object.keys(p.service?.ports ?? {}).length) out.push(`${p.metadata.name} is a service part with no port in service.ports.`);
  if (m.api && !inbound.length) out.push(`The manifest has an api, but no part takes the gateway’s calls (augur-gateway with inbound: true) to serve it.`);
  if (!m.api && inbound.length) out.push(`${inbound[0]!.metadata.name} takes the gateway’s calls (inbound), but the manifest has no api to say what it serves.`);

  const secretSettings = new Set(list('settings').filter((s) => s.type === 'secret').map((s) => String(s.id)));
  for (const p of parts) {
    const types = new Map(resources(p).map(([name, r]) => [name, r.type]));
    for (const [name, type] of types) if (!offered.resources.includes(type)) out.push(`${p.metadata.name} asks for ${type} (resource ${name}), a resource type not offered by this AUGUR.`);
    for (const [container, spec] of Object.entries(p.containers ?? {})) {
      // Anywhere but `files`: a variable, the command or its arguments (spec 4.6). `$${...}` is Score's escape, not a reference.
      const places: [string, unknown][] = [
        ...Object.entries(spec.variables ?? {}).map(([name, value]): [string, unknown] => [`the variable ${name}`, value]),
        ...(spec.command ?? []).map((value): [string, unknown] => ['its command', value]),
        ...(spec.args ?? []).map((value): [string, unknown] => ['its arguments', value]),
      ];
      for (const [where, value] of places) {
        for (const [, res, output] of String(value).matchAll(/(?<!\$)\$\{resources\.([a-z0-9-]+)\.([A-Za-z0-9_]+)\}/g)) {
          const type = types.get(res!);
          const secret = (type && SECRET_OUTPUTS[type]?.includes(output!)) || (type === 'augur-settings' && secretSettings.has(output!));
          if (secret) out.push(`${p.metadata.name}’s ${container} reads the secret ${res}.${output} in ${where}: a secret arrives only as a file (files), never anywhere else.`);
        }
      }
    }
  }

  const commands = new Set(list('commands').map((x) => String(x.id)));
  for (const r of list('radial')) if (typeof r.command === 'string' && !commands.has(r.command)) out.push(`A radial action names the command ${r.command}, which the manifest doesn’t have.`);
  for (const [key, what] of [['places', 'place'], ['commands', 'command'], ['about', 'About section'], ['settings', 'setting']] as const) {
    for (const id of repeated(list(key).map((x) => (typeof x.id === 'string' ? x.id : undefined)))) out.push(`The ${what} id ${id} is used twice.`);
  }
  const bindings = m.bindings as unknown;
  const links = m.links as { entities?: unknown } | undefined;
  if (bindings !== undefined && !links?.entities) out.push('The manifest has bindings, but no links.entities to bind them to.');
  if (!m.frontend && !parts.length) out.push(`${m.name} has neither a frontend nor parts: an app needs at least one.`);
  if (m.frontend && !release.frontend) out.push(`The manifest has a frontend, but the release carries no frontend bundle.`);
  return out;
};

/** What 9.3 warns about: repeats of the app's own label or icon, a command nothing names, a fills place without a frontend. */
const ruleWarnings = (release: AppRelease2): string[] => {
  const out: string[] = [];
  const m = release.manifest as AppManifest3 & { icon?: string };
  const c = (m.contributes ?? {}) as Record<string, unknown>;
  const list = (key: string) => (Array.isArray(c[key]) ? (c[key] as Record<string, unknown>[]) : []);
  for (const [key, what] of [['places', 'place'], ['commands', 'command']] as const) {
    for (const x of list(key)) {
      if (x.label === m.name) out.push(`${m.name}’s ${what} "${String(x.label)}" has the app’s own label.`);
      else if (m.icon && x.icon === m.icon) out.push(`${m.name}’s ${what} "${String(x.label)}" has the app’s own icon.`);
    }
  }
  const named = new Set([...list('places').map((p) => p.command), ...list('radial').map((r) => r.command)].filter((x): x is string => typeof x === 'string'));
  for (const cmd of list('commands')) {
    // A command shown always is in the command palette; one for a selection needs a place or a radial action.
    if (cmd.when !== 'always' && !named.has(String(cmd.id))) out.push(`${m.name}’s command ${String(cmd.id)} is never named by a place or a radial action.`);
  }
  if (!m.frontend) for (const p of list('places')) if (p.fills) out.push(`${m.name}’s place "${String(p.label)}" says the app fills it, but the app has no frontend.`);
  return out;
};

/**
 * Checks a release file the registry is given (spec 9.1 to 9.3). One on a contract this AUGUR doesn't
 * serve is refused with that alone; one that fails the schemas with the first three reasons and paths;
 * then each rule of 9.2. Warnings come only for a release that passes the schemas.
 */
export const checkRelease = (release: unknown, offered: Offered = {}): ReleaseCheck => {
  const served = offered.contracts ?? SERVED_CONTRACTS;
  const file = (typeof release === 'object' && release !== null ? release : {}) as Record<string, unknown>;
  const contract = contractOf(file);
  if (typeof contract === 'number' && !served.includes(contract)) return { refusals: [contractMessage(contract, served)], warnings: [] };
  if (file.schema !== undefined && file.schema !== APP_RELEASE_2_SCHEMA) return { refusals: [`This is a ${String(file.schema)} file; this AUGUR installs ${APP_RELEASE_2_SCHEMA}.`], warnings: [] };
  const v = contractValidators();
  const schema = v.release(release);
  // Score's own schema too: AUGUR's part schema only narrows it (spec 4.1).
  const parts = Array.isArray(file.parts) ? (file.parts as unknown[]) : [];
  const score = parts.flatMap((p, i) => partProblems(p).filter((x) => x.startsWith('Score: ')).map((x) => `/parts/${i} ${x}`));
  const problems = [...schema, ...score];
  if (problems.length) return { refusals: problems.slice(0, SCHEMA_REASONS), warnings: [] };
  const r = release as AppRelease2;
  return { refusals: ruleRefusals(r, { resources: offered.resources ?? RESOURCE_TYPES, contracts: served }), warnings: ruleWarnings(r) };
};
