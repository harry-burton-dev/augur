import { defineConfig } from 'vitest/config';

// One self-contained ES module at dist/entry.js: the entry URL in this app's manifest.
export default defineConfig({
  build: {
    lib: { entry: 'src/entry.ts', formats: ['es'], fileName: () => 'entry.js' },
    target: 'es2022',
  },
  test: { environment: 'happy-dom' },
});
