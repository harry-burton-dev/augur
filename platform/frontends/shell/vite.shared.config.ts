import { readKit } from '@augur/kit-bundle';
import { sharedModules as allShared } from '@augur/mfe-sdk/build';
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
const sharedModules = allShared.filter((s) => !fromKit.has(s));
const fileName = (specifier: string) => specifier.replace(/^@augur\//, '').replace(/\.js$/, '').replace(/\//g, '-');

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

export default defineConfig(({ mode }) => ({
  plugins: [importMap()],
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production') },
  build: {
    minify: mode !== 'development',
    outDir: 'shared-build',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: Object.fromEntries(sharedModules.map((s) => [fileName(s), s])),
      // What the kit bundle serves stays an import, so Lit's kit and the kit share one copy.
      external: (id) => fromKit.has(id),
      // Keep every export: apps import what they like from these.
      preserveEntrySignatures: 'strict',
      output: { entryFileNames: '[name]-[hash].js', chunkFileNames: '[name]-[hash].js' },
    },
  },
}));
