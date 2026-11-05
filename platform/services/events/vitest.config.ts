import { defineConfig } from 'vitest/config';

// The Postgres tests in each file reset the events schema, so files run one at a time.
export default defineConfig({ test: { fileParallelism: false } });
