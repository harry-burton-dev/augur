import { defineConfig } from 'vitest/config';

// Each test file rebuilds the kg schema in the test database, so files run one at a time.
export default defineConfig({ test: { fileParallelism: false, testTimeout: 60_000, hookTimeout: 120_000 } });
