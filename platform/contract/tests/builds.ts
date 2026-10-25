import { test } from '@playwright/test';

/** Skips a check for frozen builds from before the SDK minor that added what it checks. */
export const since = (minor: string) => {
  const built = /^sdk-(\d+\.\d+)$/.exec(process.env.CONTRACT_TARGET ?? '')?.[1];
  const older = built !== undefined && built.localeCompare(minor, undefined, { numeric: true }) < 0;
  test.skip(older, `the build from sdk-${built} predates SDK ${minor}`);
};

/** Whether Folio, the app that ships with AUGUR, is in the catalogue beside the reference app this run. */
export const folioOn = process.env.CONTRACT_FOLIO === 'on';
