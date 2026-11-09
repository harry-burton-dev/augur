import { SDK_VERSION } from '@augur/mfe-sdk';
import semver from 'semver';

/**
 * An app's `sdk` range that this shell's SDK satisfies, whatever its major. Test fixtures for an
 * app that opens use it, so the release that moves the SDK to a new major can't break them.
 */
export const CURRENT_SDK = `^${semver.major(SDK_VERSION)}.0.0`;
