import { defineConfig } from 'vitest/config';

// The tests share one Postgres schema, so their files run one after another.
export default defineConfig({ test: { fileParallelism: false } });
