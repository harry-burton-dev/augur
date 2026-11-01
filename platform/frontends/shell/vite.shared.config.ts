import { createRequire } from 'node:module';
import { sharedModules } from '@augur/mfe-sdk/build';
import { defineConfig, type Plugin } from 'vite';

/**
 * The modules the shell serves once for itself and every app (the kits, Lit
 * and React), built into shared-build/ with an import map naming each one. The
 * shell serves them at /shared/ and inlines that map into index.html, so a
 * bare `import 'lit'` in the shell or in any app resolves to the same file.
 */
const fileName = (specifier: string) => specifier.replace(/^@augur\//, '').replace(/\.js$/, '').replace(/\//g, '-');

/**
 * React ships as CommonJS, which Rollup turns into a module with only a
 * default export. Each one is served through a small module that names every
 * export too, so `import { useState } from 'react'` works from the import map.
 */
const commonJs = new Set(['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client']);
const require = createRequire(import.meta.url);
const VIRTUAL = 'augur-shared:';
const namedExports = (): Plugin => ({
  name: 'shared-named-exports',
  resolveId: (id) => (id.startsWith(VIRTUAL) ? `\0${id}` : undefined),
  load(id) {
    if (!id.startsWith(`\0${VIRTUAL}`)) return;
    const specifier = id.slice(VIRTUAL.length + 1);
    const names = Object.keys(require(specifier) as object).filter((n) => n !== 'default' && /^[A-Za-z_$][\w$]*$/.test(n));
    return `import * as all from '${specifier}';\nconst m = all.default ?? all;\nexport default m;\nexport const { ${names.join(', ')} } = m;\n`;
  },
});

/** Apps built before the rename import @platform/*: those keep working through SDK 1.x. */
const renamed = new Set(['@augur/ui-kit']);

const importMap = (): Plugin => ({
  name: 'shared-import-map',
  generateBundle(_options, bundle) {
    const files = new Map<string, string>();
    for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk' && chunk.isEntry) files.set(chunk.name, chunk.fileName);
    const imports = Object.fromEntries(sharedModules.map((s) => [s, `/shared/${files.get(fileName(s))}`]));
    for (const s of renamed) imports[s.replace(/^@augur\//, '@platform/')] = imports[s];
    this.emitFile({ type: 'asset', fileName: 'importmap.json', source: `${JSON.stringify({ imports }, null, 2)}\n` });
  },
});

// `--mode development` (the shell's dev server) builds React's development copy, which the
// dev server's JSX (react/jsx-dev-runtime) and its warnings need.
export default defineConfig(({ mode }) => ({
  plugins: [namedExports(), importMap()],
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production') },
  build: {
    minify: mode !== 'development',
    outDir: 'shared-build',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: Object.fromEntries(sharedModules.map((s) => [fileName(s), commonJs.has(s) ? `${VIRTUAL}${s}` : s])),
      // Keep every export: apps import what they like from these.
      preserveEntrySignatures: 'strict',
      output: { entryFileNames: '[name]-[hash].js', chunkFileNames: '[name]-[hash].js' },
    },
  },
}));
