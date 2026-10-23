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

/** The text with `key` set to `value`: its line changed in place, or added at the end. */
export const withEnvValue = (text: string, key: string, value: string): string => {
  const pattern = new RegExp(`^(\\s*(?:export\\s+)?${key}\\s*=).*$`, 'm');
  if (pattern.test(text)) return text.replace(new RegExp(pattern.source, 'gm'), `$1${value}`);
  return `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${key}=${value}\n`;
};
