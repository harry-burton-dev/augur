/**
 * The runner's provisioners, one per resource type AUGUR offers (spec 4.4, 4.6, 10.2), and the
 * ceilings an app's asks are held to (spec 7). Provisioning works out every part's outputs and volumes
 * before anything starts, and refuses the whole release, with plain reasons, for a type not offered,
 * a param not taken or a value not allowed, or an ask above a ceiling (spec 10.3).
 */
import { envValue } from '../env-file.ts';
import { bytesOf, bytesWords, containerOf, cpuWords, milliCpuOf, PartRefused, type ScorePart } from '../score.ts';
import { bucket } from './bucket.ts';
import { appConnections, database } from './database.ts';
import { files } from './files.ts';
import { floorGraphs } from './floor-graphs.ts';
import { gateway } from './gateway.ts';
import { outbound } from './outbound.ts';
import { scratch } from './scratch.ts';
import { settings } from './settings.ts';
import { isPlainObject, type AppSecrets, type Need, type Output, type ProvisionContext, type Provisioner, type Volume } from './types.ts';
import { telemetry } from './telemetry.ts';
import type { AppManifest3 } from '@augur/app-tools/validate';

export type { AppSecrets, Need, Output, ProvisionContext, Provisioner, Volume };

export const PROVISIONERS: Record<string, Provisioner> = Object.fromEntries([gateway, database, bucket, scratch, files, telemetry, floorGraphs, outbound, settings].map((p) => [p.type, p]));

/** What one app's parts get: each part's outputs and volumes by resource name, and the platform work they need. */
export interface Provisioned {
  outputs: Record<string, Record<string, Record<string, Output>>>;
  volumes: Record<string, Record<string, Volume>>;
  needs: Need[];
  /** The login's connection cap (spec 7.3), when a part asks for the database. */
  connections?: number;
}

export interface AppUnit {
  app: string;
  storageId: string;
  manifest: AppManifest3;
  parts: ScorePart[];
  env: string;
  secrets: AppSecrets;
  settings?: Record<string, string>;
  /** For a pull request's preview: secret settings arrive empty, required or not. */
  withholdSecrets?: boolean;
}

/** Every part's outputs and volumes; throws PartRefused with every reason at once when anything is refused. */
export const provisionParts = (unit: AppUnit): Provisioned => {
  const problems: string[] = [];
  const result: Provisioned = { outputs: {}, volumes: {}, needs: [] };
  const needs = new Set<Need>();
  for (const part of unit.parts) {
    const name = part.metadata.name;
    result.outputs[name] = {};
    result.volumes[name] = {};
    for (const [resource, ask] of Object.entries(part.resources ?? {})) {
      const p = PROVISIONERS[ask.type];
      if (!p) {
        problems.push(`${name} asks for ${resource} of type ${ask.type}: resource type not offered by this AUGUR.`);
        continue;
      }
      if ('class' in ask || 'id' in ask) problems.push(`${name}’s ${resource} names a class or an id: one app never shares a resource with another (spec 4.4).`);
      const params = isPlainObject(ask.params) ? ask.params : {};
      const ctx: ProvisionContext = {
        app: unit.app,
        storageId: unit.storageId,
        part: name,
        resource,
        params,
        env: unit.env,
        manifest: unit.manifest,
        secrets: unit.secrets,
        settings: unit.settings,
        ...(unit.withholdSecrets ? { withholdSecrets: true } : {}),
      };
      const unknown = Object.keys(params).filter((k) => !p.params.includes(k));
      if (unknown.length) problems.push(`${name}’s ${resource} (${p.type}) doesn’t take ${unknown.join(', ')}${p.params.length ? `; it takes ${p.params.join(', ')}` : '; it takes no params'}.`);
      const bad = p.check(params, ctx);
      problems.push(...bad.map((b) => `${name}’s ${resource} (${p.type}): ${b}`));
      if (unknown.length || bad.length) continue;
      try {
        result.outputs[name][resource] = p.outputs(ctx);
      } catch (err) {
        problems.push((err as Error).message);
        continue;
      }
      const { volume } = p.compose(ctx);
      if (volume) result.volumes[name][resource] = volume;
      for (const n of p.needs) needs.add(n);
    }
  }
  problems.push(...connectionProblems(unit));
  if (problems.length) throw new PartRefused([...new Set(problems)].join(' '));
  result.needs = [...needs];
  if (needs.has('storage') && unit.parts.some((p) => Object.values(p.resources ?? {}).some((r) => r.type === 'augur-database'))) result.connections = appConnections(unit.env);
  return result;
};

/**
 * Spec 7.3: the login holds at most APP_DATABASE_CONNECTIONS at once, shared by every part (and both
 * slots, during a switch). Parts that say how many they need may not ask for more than that between them;
 * the others share what's left.
 */
const connectionProblems = (unit: AppUnit) => {
  const asked = unit.parts.flatMap((p) =>
    Object.values(p.resources ?? {})
      .filter((r) => r.type === 'augur-database' && typeof r.params?.connections === 'number')
      .map((r) => ({
        part: p.metadata.name,
        n: r.params!.connections as number,
      })),
  );
  const cap = appConnections(unit.env);
  const sum = asked.reduce((a, b) => a + b.n, 0);
  return sum > cap
    ? [`The parts ask for ${sum} database connections between them (${asked.map((a) => `${a.part} ${a.n}`).join(', ')}), above this deployment’s ${cap} per app (APP_DATABASE_CONNECTIONS in .env).`]
    : [];
};

/** The least memory and CPU Docker gives a container a limit of: below these, 0 among them, is no limit at all or refused. */
export const MIN_MEMORY = 6 * 2 ** 20;
export const MIN_CPU = 10;

/** The deployment's ceilings (spec 7.2), from .env, with their defaults. */
export const CEILING_DEFAULTS = {
  APP_PART_MEMORY_CEILING: '2Gi',
  APP_PART_CPU_CEILING: '2',
  APP_MEMORY_CEILING: '4Gi',
  APP_CPU_CEILING: '4',
  APP_SCRATCH_CEILING: '1Gi',
} as const;
type Ceiling = keyof typeof CEILING_DEFAULTS;

const ceiling = (env: string, key: Ceiling, parse: (q: string) => number | undefined) => parse(envValue(env, key) || CEILING_DEFAULTS[key]) ?? parse(CEILING_DEFAULTS[key])!;

/**
 * Why an app's asks don't fit this deployment's ceilings, one reason each, naming the ceiling and the ask;
 * empty when they fit. Each part's limits are its own; the app's totals are every part's together.
 */
export const ceilingProblems = (parts: ScorePart[], env: string, volumes?: Provisioned['volumes']): string[] => {
  const out: string[] = [];
  const partMemory = ceiling(env, 'APP_PART_MEMORY_CEILING', bytesOf);
  const partCpu = ceiling(env, 'APP_PART_CPU_CEILING', milliCpuOf);
  let memory = 0;
  let cpu = 0;
  for (const part of parts) {
    const { limits } = containerOf(part).spec.resources;
    const m = bytesOf(limits.memory);
    const c = milliCpuOf(limits.cpu);
    if (m === undefined) out.push(`${part.metadata.name}’s memory limit ${limits.memory} isn’t an amount such as 512Mi.`);
    if (c === undefined) out.push(`${part.metadata.name}’s CPU limit ${limits.cpu} isn’t an amount such as 500m or 1.`);
    // Docker reads 0 as no limit at all, and refuses less than these.
    if (m !== undefined && m < MIN_MEMORY) out.push(`${part.metadata.name}’s memory limit ${limits.memory} is below the ${bytesWords(MIN_MEMORY)} a container needs.`);
    if (c !== undefined && c < MIN_CPU) out.push(`${part.metadata.name}’s CPU limit ${limits.cpu} is below the ${cpuWords(MIN_CPU)} a container may be given.`);
    if (m !== undefined && m > partMemory)
      out.push(`${part.metadata.name} asks for ${limits.memory} of memory, above this deployment’s ceiling of ${bytesWords(partMemory)} a part (APP_PART_MEMORY_CEILING in .env).`);
    if (c !== undefined && c > partCpu) out.push(`${part.metadata.name} asks for ${cpuWords(c)}, above this deployment’s ceiling of ${cpuWords(partCpu)} a part (APP_PART_CPU_CEILING in .env).`);
    memory += m ?? 0;
    cpu += c ?? 0;
  }
  const appMemory = ceiling(env, 'APP_MEMORY_CEILING', bytesOf);
  const appCpu = ceiling(env, 'APP_CPU_CEILING', milliCpuOf);
  if (memory > appMemory) out.push(`Its parts ask for ${bytesWords(memory)} of memory together, above this deployment’s ceiling of ${bytesWords(appMemory)} an app (APP_MEMORY_CEILING in .env).`);
  if (cpu > appCpu) out.push(`Its parts ask for ${cpuWords(cpu)} together, above this deployment’s ceiling of ${cpuWords(appCpu)} an app (APP_CPU_CEILING in .env).`);
  const scratchTotal = Object.values(volumes ?? {})
    .flatMap((v) => Object.values(v))
    .reduce((a, v) => a + (v.size ?? 0), 0);
  const scratchCeiling = ceiling(env, 'APP_SCRATCH_CEILING', bytesOf);
  if (scratchTotal > scratchCeiling)
    out.push(`Its parts ask for ${bytesWords(scratchTotal)} of scratch space together, above this deployment’s ceiling of ${bytesWords(scratchCeiling)} an app (APP_SCRATCH_CEILING in .env).`);
  return out;
};
