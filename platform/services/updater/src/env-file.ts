import { isAbsolute, join, normalize } from 'node:path';

/**
 * The deployment's settings file, infra/deploy/.env, as Compose reads it: KEY=value lines, with
 * comments and blank lines kept as they are when a value is changed.
 */

/** A setting's value, without the quotes around it; undefined when it isn't set. */
export const envValue = (text: string, key: string): string | undefined => {
  let value: string | undefined;
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (match?.[1] !== key) continue;
    // The last one wins, as in Compose.
    value = match[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return value;
};

/**
 * The compose files a deployment runs, under `dir`: those COMPOSE_FILE names in its .env, separated by `:` as
 * Compose reads them on Linux, or else compose.yml. Each must be a file in
 * the deployment's folder, where the updater checks and writes the release's (compose.proxy.yml, say).
 */
export const composeFiles = (dir: string, text: string): string[] => {
  const names = (envValue(text, 'COMPOSE_FILE') ?? '').split(':').map((n) => n.trim()).filter(Boolean);
  for (const name of names) {
    if (isAbsolute(name) || normalize(name).split(/[\\/]/).includes('..')) throw new Error(`COMPOSE_FILE names ${name}: name only files in the deployment's folder, such as compose.yml:compose.proxy.yml.`);
  }
  return (names.length ? names : ['compose.yml']).map((name) => join(dir, name));
};

/** The text with `key` set to `value`: its line changed in place, or added at the end. */
export const withEnvValue = (text: string, key: string, value: string): string => {
  const pattern = new RegExp(`^(\\s*(?:export\\s+)?${key}\\s*=).*$`, 'm');
  if (pattern.test(text)) return text.replace(new RegExp(pattern.source, 'gm'), (_, start: string) => `${start}${value}`);
  return `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${key}=${value}\n`;
};

/**
 * A value as it's written into .env: as it is when it's plain, otherwise in single quotes, which
 * Compose reads as written (no `$` interpolation). Undefined for one that can't be written: over
 * more than one line, or with a single quote in it as well as something that needs quoting.
 */
export const envQuoted = (value: string): string | undefined => {
  if (/[\r\n]/.test(value)) return undefined;
  if (/^[A-Za-z0-9_.:/@+,=-]*$/.test(value)) return value;
  return value.includes("'") ? undefined : `'${value}'`;
};
