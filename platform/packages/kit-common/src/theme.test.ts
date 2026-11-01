import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

const dist = join(dirname(fileURLToPath(import.meta.url)), '../dist');
const require = createRequire(import.meta.url);
const read = (file: string) => readFileSync(file, 'utf8');

/** Tailwind's utilities for the given classes, under Common's theme and a kit's own set. */
const css = async (kit: 'shell' | 'app', classes: string[]) => {
  const source = `@import 'tailwindcss/utilities' layer(utilities);\n@import './theme.css';\n@import './theme-${kit}.css';`;
  const compiler = await compile(source, {
    base: dist,
    loadStylesheet: async (id: string, base: string) => {
      const path = id.startsWith('.') ? join(base, id) : require.resolve(id.endsWith('.css') ? id : `${id}.css`);
      return { path, base: dirname(path), content: read(path) };
    },
  });
  return compiler.build(classes);
};

describe('the Tailwind theme', () => {
  it('makes a utility of each AUGUR token, pointing at its CSS variable', async () => {
    const out = await css('app', ['bg-slate', 'text-ink', 'p-4', 'gap-edge', 'rounded-card', 'shadow-raised', 'font-sans', 'max-w-read', 'tracking-caps', 'ease-out']);
    expect(out).toContain('background-color: var(--slate)');
    expect(out).toContain('color: var(--ink)');
    expect(out).toContain('padding: var(--space-4)');
    expect(out).toContain('gap: var(--edge)');
    expect(out).toContain('border-radius: var(--radius-card)');
    expect(out).toContain('max-width: var(--measure-read)');
    expect(out).toContain('letter-spacing: var(--tracking-caps)');
  });

  it('gives a type role its leading, tracking and weight with its size', async () => {
    const out = await css('app', ['text-body', 'text-hero']);
    expect(out).toContain('font-size: var(--type-body)');
    expect(out).toContain('line-height: var(--tw-leading, var(--leading-body))');
    expect(out).toContain('letter-spacing: var(--tw-tracking, var(--tracking-hero))');
    expect(out).toContain('font-weight: var(--tw-font-weight, var(--weight-hero))');
  });

  it("has none of Tailwind's own palette or scales", async () => {
    const out = await css('app', ['bg-red-500', 'text-gray-900', 'p-9', 'rounded-lg', 'max-w-md', 'font-serif', 'shadow-lg']);
    expect(out).not.toMatch(/background-color|color:|padding|border-radius|max-width|font-family|box-shadow/);
  });

  it('writes no variables of its own: tokens.css has them all', async () => {
    expect(await css('app', ['font-sans', 'ease-out', 'shadow-raised'])).not.toMatch(/:root|--font-sans:|--ease-out:/);
  });

  it("gives each kit its own set: Aerie the shell's, Quill the app's", async () => {
    expect(await css('shell', ['max-w-card', 'bg-floor-you-low'])).toContain('var(--measure-card)');
    expect(await css('app', ['max-w-card', 'bg-floor-you-low'])).not.toContain('var(--measure-card)');
    expect(await css('app', ['max-w-rail'])).toContain('var(--measure-rail)');
    expect(await css('shell', ['max-w-rail'])).not.toContain('var(--measure-rail)');
  });
});
