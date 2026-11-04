import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Tokens only (docs/shell-principles.md): a colour or a duration in a part's
 * CSS or markup is a token. The React kits hold to it in augur-kit; this holds
 * the Lit kit here and AUGUR's own frontends (the shell, Home, Admin, the
 * Upgrade Centre) to it too.
 */
const here = dirname(fileURLToPath(import.meta.url));
const platform = join(here, '../../..');
const frontends = join(platform, 'frontends');
const roots = [here, ...readdirSync(frontends).map((f) => join(frontends, f, 'src'))].filter((d) => existsSync(d));
const skip = new Set(['node_modules', 'dist', 'stories', 'shared-build']);
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    if (skip.has(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

/**
 * Files allowed raw values, and why. Keep this short: each entry is a TODO.
 * - base.css sets the motion tokens themselves to near zero under reduced motion.
 * - wave.ts holds the water engine's presets, from the design tool's Wave
 *   Background Tuner (27 colours). TODO: take them from the token files.
 */
const allowed = new Set(['ui-kit/src/base.css', 'ui-kit/src/components/wave.ts'].map((f) => join(platform, 'packages', f)));

const files = roots
  .flatMap(walk)
  .filter((f) => /\.(ts|tsx|css)$/.test(f) && !/\.(test|stories)\./.test(f) && !allowed.has(f))
  .map((f) => relative(platform, f));

/** Comments go, and so do masks: a mask's black is an alpha channel, not a colour anyone sees. */
const strip = (text: string) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(-webkit-)?mask(-image)?:[^;]*;/g, '');

const RAW_COLOUR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/i;
/** A length of time that isn't zero: zero means "at once", which needs no token. */
const RAW_DURATION = /(?<![\w.-])(?!0+(\.0+)?m?s\b)\d+(\.\d+)?m?s\b(?!\w)/;

describe('tokens only', () => {
  it('finds the files it checks', () => {
    expect(files.some((f) => f.startsWith('frontends/shell/'))).toBe(true);
    expect(files.some((f) => f.startsWith('packages/ui-kit/'))).toBe(true);
  });

  it.each(files)('%s has no raw colour', (file) => {
    expect(strip(readFileSync(join(platform, file), 'utf8'))).not.toMatch(RAW_COLOUR);
  });

  it.each(files)('%s has no raw duration', (file) => {
    expect(strip(readFileSync(join(platform, file), 'utf8'))).not.toMatch(RAW_DURATION);
  });

  it('tells a raw value from a token', () => {
    expect('color: #34D399;').toMatch(RAW_COLOUR);
    expect('transition: opacity 280ms;').toMatch(RAW_DURATION);
    expect('transition: visibility 0s var(--motion-calm);').not.toMatch(RAW_DURATION);
    expect(strip('mask-image: linear-gradient(#000 0 0);')).not.toMatch(RAW_COLOUR);
  });
});
