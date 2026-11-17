import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSecretsFolder } from '@augur/service-kit';

/**
 * What each service is given (infra/deploy/made-secrets.json): for each service, the files in its own
 * secrets folder, each a template in which `{NAME}` stands for a secret's value.
 */
export type SecretsSpec = Record<string, Record<string, string>>;

const NAME = /^[A-Z][A-Z0-9_]*$/;
const SERVICE = /^[a-z][a-z0-9-]*$/;
const PLACE = /\{([A-Z][A-Z0-9_]*)\}/g;

/** The secrets AUGUR makes when nobody set them: the schema's `x-generate` settings. */
export const madeNames = (schema: { properties?: Record<string, { 'x-generate'?: boolean }> }) =>
  Object.entries(schema.properties ?? {})
    .filter(([, setting]) => setting['x-generate'])
    .map(([name]) => name);

/** The spec's services, each with its files: its `$comment` left out. */
export const servicesOf = (spec: SecretsSpec) => Object.entries(spec).filter(([service]) => !service.startsWith('$'));

/**
 * What is wrong with a spec, every problem at once. A placeholder names a made secret or another setting the schema
 * describes, which the job reads from .env (or a platform host's variables) and leaves empty when unset.
 */
export const specProblems = (spec: SecretsSpec, made: string[], known: string[]) => {
  const problems: string[] = [];
  for (const [service, files] of servicesOf(spec)) {
    if (!SERVICE.test(service)) problems.push(`"${service}" isn't a service name (lowercase letters, digits and dashes).`);
    for (const [file, template] of Object.entries(files)) {
      if (!NAME.test(file)) problems.push(`${service}: "${file}" isn't a setting's name (capitals, digits and underscores).`);
      for (const [, name] of template.matchAll(PLACE))
        if (!made.includes(name) && !known.includes(name)) problems.push(`${service}: ${file} uses {${name}}, which AUGUR doesn't make and settings.schema.json doesn't describe.`);
    }
  }
  return problems;
};

/**
 * Each made secret's value: what the environment sets wins (an existing server's .env, or a value set in a
 * platform host's settings), then what was made before, then a new one of 64 random hex characters.
 */
export const secretValues = (made: string[], env: Record<string, string | undefined>, before: Record<string, string>, random = () => randomBytes(32).toString('hex')) => {
  const values: Record<string, string> = {};
  const fresh: string[] = [];
  for (const name of made) {
    if (env[name]) values[name] = env[name]!;
    else if (before[name]) values[name] = before[name];
    else {
      values[name] = random();
      fresh.push(name);
    }
  }
  return { values, fresh };
};

/** A template with each `{NAME}` filled in: a made secret's value, else the environment's, else nothing. */
export const fill = (template: string, values: Record<string, string>, env: Record<string, string | undefined>) =>
  template.replace(PLACE, (_, name: string) => values[name] ?? env[name] ?? '');

/** A folder's secrets (service kit), or none when it doesn't exist yet. */
export const readFolder = (dir: string): Record<string, string> => (existsSync(dir) ? readSecretsFolder(dir) : {});

/** Writes each file whole (to a new name, then renamed over the old), and removes any other setting's file there. */
export const writeFolder = (dir: string, files: Record<string, string>, mode: number) => {
  mkdirSync(dir, { recursive: true });
  for (const [name, value] of Object.entries(files)) {
    const temp = join(dir, `.${name}.new`);
    // One left by a run that died half way may be read-only, and this job has no right to write over it.
    rmSync(temp, { force: true });
    writeFileSync(temp, value, { mode });
    renameSync(temp, join(dir, name));
  }
  for (const name of readdirSync(dir)) if (NAME.test(name) && !(name in files)) rmSync(join(dir, name));
};
