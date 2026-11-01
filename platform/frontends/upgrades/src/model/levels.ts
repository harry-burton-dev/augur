import semver from 'semver';
import type { Halted } from './types.js';

export type Level = 'patch' | 'minor' | 'major';

/** How far a release is from what runs: a patch, a minor or a major. Below 1.0 a minor counts as major, as semver's caret does. */
export const levelFrom = (running: string, to: string): Level => {
  const diff = semver.diff(semver.coerce(running) ?? running, semver.coerce(to) ?? to);
  if (!diff || diff === 'patch' || diff === 'prepatch' || diff === 'prerelease') return 'patch';
  if (diff === 'minor' || diff === 'preminor') return semver.major(semver.coerce(running)!) === 0 ? 'major' : 'minor';
  return 'major';
};

/** The newest release a pin allows, leaving out halted ones. No pin allows anything. */
export const newestAllowed = <R extends { version: string; halted?: Halted }>(releases: R[], pin?: string): R | undefined =>
  releases
    .filter((r) => !r.halted && (!pin || semver.satisfies(r.version, pin, { includePrerelease: true })))
    .sort((a, b) => semver.rcompare(a.version, b.version))[0];

/** The common pins offered for what runs: this patch line, this minor line, or exactly this version. */
export const pinChoices = (running: string): { range: string; label: string }[] => {
  const v = semver.coerce(running)!;
  return [
    { range: `${v.major}.${v.minor}.x`, label: `Patches of ${v.major}.${v.minor}` },
    { range: `${v.major}.x`, label: `Anything in ${v.major}.x` },
    { range: running, label: `Exactly ${running}` },
  ];
};

/** Whether a typed range is one the updater can follow. */
export const validPin = (range: string): boolean => semver.validRange(range) !== null;
