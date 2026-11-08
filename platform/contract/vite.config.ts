import { defineConfig } from 'vite';

// The reference app, built the way an app on the contract is released: one ES module for the shell's
// worker, with everything it imports bundled (only the shell's page has React and the kit).
export default defineConfig({
  build: {
    lib: { entry: 'reference-app/frontend/src/entry.ts', formats: ['es'], fileName: () => 'entry.js' },
    target: 'es2022',
  },
});
