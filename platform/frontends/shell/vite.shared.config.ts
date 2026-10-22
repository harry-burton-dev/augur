import { sharedModules } from '@platform/mfe-sdk/build';
import { defineConfig, type Plugin } from 'vite';

/**
 * The modules the shell serves once for itself and every app (the kit and
 * Lit), built into public/shared with an import map naming each one. The
 * shell's own build inlines that map into index.html, so a bare `import 'lit'`
 * in the shell or in any app resolves to the same file.
 */
const fileName = (specifier: string) => specifier.replace(/^@platform\//, '').replace(/\.js$/, '').replace(/\//g, '-');

const importMap = (): Plugin => ({
  name: 'shared-import-map',
  generateBundle(_options, bundle) {
    const files = new Map<string, string>();
    for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk' && chunk.isEntry) files.set(chunk.name, chunk.fileName);
    const imports = Object.fromEntries(sharedModules.map((s) => [s, `/shared/${files.get(fileName(s))}`]));
    this.emitFile({ type: 'asset', fileName: 'importmap.json', source: `${JSON.stringify({ imports }, null, 2)}\n` });
  },
});

export default defineConfig({
  plugins: [importMap()],
  publicDir: false,
  build: {
    outDir: 'public/shared',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: Object.fromEntries(sharedModules.map((s) => [fileName(s), s])),
      // Keep every export: apps import what they like from these.
      preserveEntrySignatures: 'strict',
      output: { entryFileNames: '[name]-[hash].js', chunkFileNames: '[name]-[hash].js' },
    },
  },
});
