import { defineConfig } from 'vitest/config';

// One file at a time: the Postgres tests in sessions.test.ts and grants.test.ts share the permissions schema.
export default defineConfig({ test: { fileParallelism: false } });
