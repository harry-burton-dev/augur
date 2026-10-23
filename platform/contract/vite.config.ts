import { isSharedModule } from '@augur/mfe-sdk/build';
import { defineConfig } from 'vite';

// The reference app, built the way every app is: one ES module, the kit and Lit left to the shell.
export default defineConfig({
  build: {
    lib: { entry: 'reference-app/frontend/src/entry.ts', formats: ['es'], fileName: () => 'entry.js' },
    target: 'es2022',
    rollupOptions: { external: isSharedModule },
  },
});
