import { readFileSync } from 'node:fs';

/** One setting a service reads from its environment. */
export interface Setting {
  name: string;
  /** What it is for, in words a server admin can act on. */
  about: string;
  /** In production the service won't start without it. */
  required?: boolean;
  /** Never shown, only whether it is set. It may be given as a file in `<name>_FILE`. */
  secret?: boolean;
}

/** Where a setting's value came from. */
export type SettingSource = 'environment' | 'file' | 'unset';

/** A setting as the service started with it: a secret's value is never included. */
export interface SettingState {
  name: string;
  about: string;
  required: boolean;
  secret: boolean;
  source: SettingSource;
  value?: string;
}

export class ConfigError extends Error {
  constructor(
    readonly service: string,
    readonly problems: string[],
  ) {
    super(`${service} can't start until its settings are fixed:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  }
}

/** Settings read from a file, by environment. */
const fromFiles = new WeakMap<NodeJS.ProcessEnv, Set<string>>();

/**
 * Reads a service's settings before it starts. A secret may come from a file named in `<NAME>_FILE`
 * (a Docker or Compose secret, or a file decrypted at deploy): its contents, less the final newline,
 * become `<NAME>`. In production a required setting that is missing or empty stops the service, with
 * every problem listed at once so one edit of the deployment's settings fixes them all. Elsewhere
 * the service's own local defaults apply.
 */
export const loadConfig = (service: string, settings: Setting[], env: NodeJS.ProcessEnv = process.env): SettingState[] => {
  const problems: string[] = [];
  const files = fromFiles.get(env) ?? new Set<string>();
  fromFiles.set(env, files);
  for (const { name, secret } of settings) {
    const path = env[`${name}_FILE`];
    if (!secret || !path) continue;
    if (env[name] && !files.has(name)) {
      problems.push(`${name} and ${name}_FILE are both set: keep one.`);
      continue;
    }
    try {
      env[name] = readFileSync(path, 'utf8').replace(/\r?\n$/, '');
      files.add(name);
    } catch (err) {
      problems.push(`${name}_FILE names ${path}, which can't be read (${(err as NodeJS.ErrnoException).code ?? (err as Error).message}).`);
    }
  }
  if (env.NODE_ENV === 'production') {
    for (const { name, about, required } of settings) if (required && !env[name] && !problems.some((p) => p.startsWith(`${name}_FILE`))) problems.push(`${name} is not set: ${about}`);
  }
  if (problems.length) throw new ConfigError(service, problems);
  return describeConfig(settings, env);
};

/** The settings as the service runs with them, for showing an admin: secrets only say whether they are set. */
export const describeConfig = (settings: Setting[], env: NodeJS.ProcessEnv = process.env): SettingState[] =>
  settings.map(({ name, about, required = false, secret = false }) => {
    const source: SettingSource = !env[name] ? 'unset' : fromFiles.get(env)?.has(name) ? 'file' : 'environment';
    return { name, about, required, secret, source, ...(source !== 'unset' && !secret ? { value: env[name] } : {}) };
  });

/** Settings most services share. */
export const commonSettings = {
  database: { name: 'DATABASE_URL', about: 'the Postgres address and login this service keeps its schema in.', required: true, secret: true },
  issuer: { name: 'OIDC_ISSUER', about: 'the sign-in service as tokens name it, such as https://augur.example.org/sso/realms/platform.', required: true },
  issuerInside: { name: 'OIDC_INTERNAL_URL', about: 'the sign-in service as this service reaches it, when that differs from OIDC_ISSUER (inside Docker).' },
  clientSecret: { name: 'SERVICE_CLIENT_SECRET', about: 'this service’s own sign-in secret, which identity gives its Keycloak client.', required: true, secret: true },
  identity: { name: 'IDENTITY_URL', about: 'where the identity service is, such as http://identity:8081.', required: true },
  registry: { name: 'REGISTRY_URL', about: 'where the registry is, such as http://registry:8082.', required: true },
  events: { name: 'EVENTS_URL', about: 'where the events service is, such as http://events:8084.', required: true },
  models: { name: 'MODELS_URL', about: 'where the model gateway is, such as http://models:8085.', required: true },
  permissions: { name: 'PERMISSIONS_URL', about: 'where the permissions service is, such as http://permissions:8087, asked beside each admin and lead check to compare its answer (shadow mode). Without it nothing is compared.' },
  gateway: { name: 'GATEWAY_URL', about: 'where the gateway is, to fetch the key it signs callers with (default http://gateway:8080).' },
} satisfies Record<string, Setting>;

/** As `loadConfig`, but a service that can't start says why on one screen and exits, rather than with a stack trace. */
export const loadConfigOrExit = (service: string, settings: Setting[], env: NodeJS.ProcessEnv = process.env): SettingState[] => {
  try {
    return loadConfig(service, settings, env);
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    console.error(err.message);
    process.exit(1);
  }
};
