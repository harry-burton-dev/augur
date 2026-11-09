/**
 * What the runner reads from a part's Score workload (score.dev/v1b1, one container per part; spec
 * section 4): its kind, port, readiness time, limits and how `${...}` placeholders are filled in. The
 * schemas are app-tools' (P0); the rules a schema can't say are here.
 */
import { partProblems, type ScorePart } from '@augur/app-tools/validate';

export type { ScorePart };
export type PartKind = 'service' | 'worker' | 'job';

/** The deployment's default readiness wait, without `augur.dev/ready-seconds` or APP_READY_SECONDS (spec 7.7). */
export const DEFAULT_READY_SECONDS = 180;
/** No part waits longer than this, whatever it or the deployment says (spec 7.7). */
export const MAX_READY_SECONDS = 600;
/** Where every service part answers its version (spec 4.5). */
export const HEALTH_PATH = '/healthz';

export const partKind = (part: ScorePart): PartKind => (part.metadata.annotations?.['augur.dev/part'] as PartKind | undefined) ?? 'worker';

/** The one container of a part (spec 4.2, D3-A), with its name. */
export const containerOf = (part: ScorePart) => {
  const [name, spec] = Object.entries(part.containers)[0]!;
  return { name, spec };
};

/** The port a service part answers on inside its container: its one `service.ports` entry. */
export const partPort = (part: ScorePart): number | undefined => {
  const port = Object.values(part.service?.ports ?? {})[0];
  return port ? (port.targetPort ?? port.port) : undefined;
};

/** How long the runner waits for a part (a service's /healthz, a job's exit), in seconds: its own ask, else the deployment's, never past the ceiling. */
export const readySeconds = (part: ScorePart, deploymentDefault = DEFAULT_READY_SECONDS) => {
  const asked = Number(part.metadata.annotations?.['augur.dev/ready-seconds']);
  const seconds = Number.isFinite(asked) && asked > 0 ? asked : deploymentDefault;
  return Math.min(Math.max(1, Math.trunc(seconds)), MAX_READY_SECONDS);
};

const BYTE_UNITS: Record<string, number> = {
  '': 1,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  Ki: 2 ** 10,
  Mi: 2 ** 20,
  Gi: 2 ** 30,
  Ti: 2 ** 40,
};
/** A memory amount in the units Score and Kubernetes allow (512Mi, 1G, 536870912), in bytes; undefined when it doesn't parse. */
export const bytesOf = (q: string | number | undefined): number | undefined => {
  const m = /^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|k|K|M|G|T)?$/.exec(String(q ?? '').trim());
  return m ? Math.round(Number(m[1]) * BYTE_UNITS[m[2] ?? '']!) : undefined;
};
/** A CPU amount (1, 0.5, 500m) in thousandths of a CPU; undefined when it doesn't parse. */
export const milliCpuOf = (q: string | number | undefined): number | undefined => {
  const m = /^(\d+(?:\.\d+)?)(m)?$/.exec(String(q ?? '').trim());
  return m ? Math.round(m[2] ? Number(m[1]) : Number(m[1]) * 1000) : undefined;
};
/** Bytes as people read them: 512Mi, 1.5Gi. */
export const bytesWords = (bytes: number) => {
  for (const [unit, size] of [
    ['Gi', 2 ** 30],
    ['Mi', 2 ** 20],
    ['Ki', 2 ** 10],
  ] as const) {
    if (bytes >= size) return `${Number((bytes / size).toFixed(2))}${unit}`;
  }
  return `${bytes} bytes`;
};
export const cpuWords = (milli: number) => `${Number((milli / 1000).toFixed(3))} CPU`;

/** One output a resource gives a part (spec 4.6); a secret one may only be read in `files`. */
export interface Output {
  value: string;
  secret?: boolean;
}

/** Where a placeholder is read: a secret output may only fill a file (spec 4.6, 10.7). */
export type Place = 'file' | 'variable' | 'command' | 'volume';

export class PartRefused extends Error {}

/**
 * Fills in a value's `${...}` placeholders: `${resources.<name>.<output>}` from the part's resources,
 * `${metadata.name}`, and `$${` as Score's escape for a literal `${`. Throws, naming the part, for a
 * placeholder nothing fills or a secret read anywhere but a file.
 */
export const substitute = (text: string, part: string, outputs: Record<string, Record<string, Output>>, where: Place, label: string): string =>
  text.replace(/\$(\$?)\{([^}]*)\}/g, (whole, escaped: string, ref: string) => {
    if (escaped) return whole.slice(1);
    if (ref === 'metadata.name') return part;
    const m = /^resources\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_]+)$/.exec(ref);
    if (!m) throw new PartRefused(`${part} reads \${${ref}} in ${label}, which nothing fills in: only \${resources.<name>.<output>} and \${metadata.name} are.`);
    const output = outputs[m[1]!]?.[m[2]!];
    if (!output) {
      throw new PartRefused(
        outputs[m[1]!] ? `${part} reads \${${ref}} in ${label}, but ${m[1]} has no output ${m[2]}.` : `${part} reads \${${ref}} in ${label}, but it asks for no resource named ${m[1]}.`,
      );
    }
    if (output.secret && where !== 'file') throw new PartRefused(`${part} reads the secret ${m[1]}.${m[2]} in ${label}: a secret arrives only as a file (files), never anywhere else.`);
    return output.value;
  });

/** A volume's `source`: `${resources.<name>}`, the resource itself (spec 4.6, augur-scratch and augur-files). */
export const volumeResource = (source: string) => /^\$\{resources\.([A-Za-z0-9_-]+)\}$/.exec(source)?.[1];

/**
 * Why the runner won't run a part, beyond its schemas: Score's own and AUGUR's (app-tools), then a
 * probe the runner doesn't wait on (spec 4.11). Empty when it runs.
 */
export const partRefusals = (part: ScorePart): string[] => {
  const name = part.metadata?.name ?? 'A part';
  const schema = partProblems(part);
  if (schema.length) return schema.slice(0, 3).map((p) => `${name}: ${p}`);
  const out: string[] = [];
  const { spec } = containerOf(part);
  const probe = (spec.readinessProbe as { httpGet?: { path?: string; port?: number } } | undefined)?.httpGet;
  const port = partPort(part);
  if (probe && partKind(part) === 'service' && (probe.path !== HEALTH_PATH || (probe.port !== undefined && probe.port !== port))) {
    out.push(`${name}’s readinessProbe asks for ${probe.path} on port ${probe.port}, but the runner waits on ${HEALTH_PATH} on port ${port} (spec 4.11).`);
  }
  if (Object.keys(part.containers).length !== 1) out.push(`${name} has ${Object.keys(part.containers).length} containers: a part is one container (spec 4.2).`);
  return out;
};
