import { test } from '@playwright/test';

/**
 * The SDK minor this run's frozen build was built against ("1.3"), or undefined for today's build.
 * A frozen folder stands for every later minor whose build was byte-for-byte the same (freeze.mjs),
 * so it is named for the oldest of them.
 */
export const frozenBuild = /^sdk-(\d+\.\d+)$/.exec(process.env.CONTRACT_TARGET ?? '')?.[1];

/** Skips a check for frozen builds from before the SDK minor that added what it checks. */
export const since = (minor: string) => {
  const older = frozenBuild !== undefined && frozenBuild.localeCompare(minor, undefined, { numeric: true }) < 0;
  test.skip(older, `the build from sdk-${frozenBuild} predates SDK ${minor}`);
};
