import { isSharedModule } from '@augur/mfe-sdk/build';
import { defineConfig, type Plugin } from 'vite';

// Deployment under the app contract (contract 3): one ES module, dist/sandbox.js, which the shell runs
// in a web worker of its own: no DOM, no network, no token. The worker has no import map, so what the
// entry imports is bundled into it, and React and the kits, which only the shell's page has, can't be
// imported at all: the app draws Quill's remote elements by name (`@augur/app-kit/remote` types them).
const pageOnly = (): Plugin => ({
  name: 'page-only-modules',
  enforce: 'pre',
  resolveId(id) {
    if (isSharedModule(id)) {
      this.error(`${id} is only on the shell's page, and Deployment's frontend runs in a worker: draw Quill's remote elements by name (\`@augur/app-kit/remote\`).`);
    }
  },
});

export default defineConfig({
  plugins: [pageOnly()],
  build: {
    lib: { entry: 'src/sandbox/entry.ts', formats: ['es'], fileName: () => 'sandbox.js' },
    target: 'es2022',
    // The page's entry.js is built first, into the same folder.
    emptyOutDir: false,
  },
});
