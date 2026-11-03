import type { Gate } from './roles.js';
import type { PlatformUpdates } from './types.js';
import { RING_WORDS } from './words.js';

/** The registry's limits on the reason for installing a halted release (ADR 0051). */
export const REASON_MIN = 10;
export const REASON_MAX = 500;

/** What's wrong with a reason for installing a halted release, or nothing when it will do. */
export const reasonProblem = (text: string): string | undefined => {
  const reason = text.trim();
  if (!reason) return 'Say why you’re installing it. The reason goes to the audit log with your name.';
  if (/[\r\n]/.test(reason)) return 'Keep the reason to one line.';
  if (reason.length < REASON_MIN) return `Say a little more: at least ${REASON_MIN} characters.`;
  if (reason.length > REASON_MAX) return `Keep the reason to ${REASON_MAX} characters or fewer.`;
  return undefined;
};

/** Said when the registry doesn't answer `haltedInstall`: it was built before ADR 0051. */
export const TOO_OLD = 'The AUGUR on this server is too old to install a halted release for a test. Upgrade it first.';

/**
 * Why a halted release can't be installed for a test from here now, or nothing when it can.
 * The server comes first, since no role changes it; then the role, then an upgrade under way.
 */
export const haltedInstallWhyNot = (u: Pick<PlatformUpdates, 'haltedInstall' | 'ring' | 'upgrade'>, gate: Gate): string | undefined => {
  const h = u.haltedInstall;
  if (!h) return TOO_OLD;
  if (!h.allowed)
    return h.why ?? `Only ${RING_WORDS.dev} and ${RING_WORDS.preview} servers install a halted release, and this is a ${RING_WORDS[u.ring ?? 'production']} server (SERVER_RING in .env).`;
  if (!gate.allowed) return gate.reason;
  if (u.upgrade?.state === 'requested' || u.upgrade?.state === 'running') return 'Wait for the upgrade under way to finish.';
  return undefined;
};
