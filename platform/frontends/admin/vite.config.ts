import { defineConfig } from 'vitest/config';

// One self-contained ES module at dist/entry.js: the registry's entry URL for Admin.
export default defineConfig({
  build: {
    lib: { entry: 'src/entry.ts', formats: ['es'], fileName: () => 'entry.js' },
    target: 'es2022',
  },
  test: { environment: 'happy-dom' },
});
