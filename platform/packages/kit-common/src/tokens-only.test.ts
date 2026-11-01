import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Tokens only (docs/shell-principles.md): a colour or a duration in a part's markup or CSS is a token.
const src = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(src).filter((f) => /\.(tsx|css)$/.test(f) && !/\.(test|stories)\./.test(f));
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('tokens only', () => {
  it.each(files)('%s has no raw colour', (file) => {
    expect(strip(readFileSync(join(src, file), 'utf8'))).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/i);
  });

  it.each(files)('%s has no raw duration', (file) => {
    expect(strip(readFileSync(join(src, file), 'utf8'))).not.toMatch(/(?<![\w-])\d+(\.\d+)?m?s\b(?!\w)/);
  });

  it.each(files.filter((f) => f.endsWith('.tsx')))('%s uses Tailwind values only from the theme', (file) => {
    const arbitrary = [...strip(readFileSync(join(src, file), 'utf8')).matchAll(/className="[^"]*"/g)].flatMap((m) => m[0].match(/\[[^\]]*\]/g) ?? []);
    expect(arbitrary.filter((v) => !v.includes('var(--'))).toEqual([]);
  });
});
