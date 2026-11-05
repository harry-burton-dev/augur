import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

/**
 * The one module the shell serves itself rather than from the kit bundle: React's production
 * `react/jsx-dev-runtime` exports `jsxDEV` as undefined, so the production build serves its own
 * (src/host/jsx-dev-runtime.ts, `jsxDEV` made from `jsx`) in place of the kit's, built into
 * shared-build/ with an import map naming it. The shell serves it at /shared/ and vite.config.ts lets
 * it win in the import map. Dev keeps the kit's development build, which has a real one, and doesn't
 * run this. Everything else an app shares comes from the kit bundle at the kit URL (ADR 0048).
 */
const JSX_DEV = 'react/jsx-dev-runtime';
const jsxDevShim = fileURLToPath(new URL('./src/host/jsx-dev-runtime.ts', import.meta.url));
const NAME = 'react-jsx-dev-runtime';

const importMap = (): Plugin => ({
  name: 'shared-import-map',
  generateBundle(_options, bundle) {
    const chunk = Object.values(bundle).find((c) => c.type === 'chunk' && c.isEntry && c.name === NAME);
    if (!chunk) throw new Error(`${JSX_DEV} wasn't built.`);
    const imports = { [JSX_DEV]: `/shared/${chunk.fileName}` };
    this.emitFile({ type: 'asset', fileName: 'importmap.json', source: `${JSON.stringify({ imports }, null, 2)}\n` });
  },
});

export default defineConfig({
  plugins: [importMap()],
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'shared-build',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: { [NAME]: jsxDevShim },
      // React stays an import, so the stand-in uses the kit's one copy.
      external: (id) => id === 'react' || id.startsWith('react/'),
      preserveEntrySignatures: 'strict',
      output: { entryFileNames: '[name]-[hash].js', chunkFileNames: '[name]-[hash].js' },
    },
  },
});
