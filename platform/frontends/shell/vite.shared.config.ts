import { readKit } from '@augur/kit-bundle';
import { sharedModules as allShared } from '@augur/mfe-sdk/build';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

/**
 * The modules the shell serves once for itself and every app that the kit
 * bundle doesn't (Lit and the Lit kit, until SDK 2), built into shared-build/
 * with an import map naming each one. The shell serves them at /shared/ and
 * inlines that map into index.html, so a bare `import 'lit'` in the shell or in
 * any app resolves to the same file. React, Common and Quill come from the kit
 * bundle, served at the kit URL (ADR 0048, vite.config.ts).
 */
const fromKit = new Set(Object.keys(readKit().imports));

/**
 * React's production `react/jsx-dev-runtime` exports `jsxDEV` as undefined, so the production build
 * serves its own (src/host/jsx-dev-runtime.ts, `jsxDEV` made from `jsx`) in place of the kit's, and
 * vite.config.ts lets it win in the import map. Dev keeps the kit's development build, which has one.
 */
const JSX_DEV = 'react/jsx-dev-runtime';
const jsxDevShim = fileURLToPath(new URL('./src/host/jsx-dev-runtime.ts', import.meta.url));
const fileName = (specifier: string) => specifier.replace(/^@augur\//, '').replace(/\.js$/, '').replace(/\//g, '-');

/** Apps built before the rename import @platform/*: those keep working through SDK 1.x. */
const renamed = new Set(['@augur/ui-kit']);

const importMap = (sharedModules: readonly string[]): Plugin => ({
  name: 'shared-import-map',
  generateBundle(_options, bundle) {
    const files = new Map<string, string>();
    for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk' && chunk.isEntry) files.set(chunk.name, chunk.fileName);
    const imports = Object.fromEntries(sharedModules.map((s) => [s, `/shared/${files.get(fileName(s))}`]));
    for (const s of renamed) imports[s.replace(/^@augur\//, '@platform/')] = imports[s];
    this.emitFile({ type: 'asset', fileName: 'importmap.json', source: `${JSON.stringify({ imports }, null, 2)}\n` });
  },
});

export default defineConfig(({ mode }) => {
  const production = mode !== 'development';
  const sharedModules = allShared.filter((s) => !fromKit.has(s) || (production && s === JSX_DEV));
  return {
    plugins: [importMap(sharedModules)],
    publicDir: false,
    define: { 'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production') },
    build: {
      minify: mode !== 'development',
      outDir: 'shared-build',
      emptyOutDir: true,
      target: 'es2022',
      rollupOptions: {
        input: Object.fromEntries(sharedModules.map((s) => [fileName(s), s === JSX_DEV ? jsxDevShim : s])),
        // What the kit bundle serves stays an import, so Lit's kit and the kit share one copy.
        external: (id) => fromKit.has(id),
        // Keep every export: apps import what they like from these.
        preserveEntrySignatures: 'strict',
        output: { entryFileNames: '[name]-[hash].js', chunkFileNames: '[name]-[hash].js' },
      },
    },
  };
});
