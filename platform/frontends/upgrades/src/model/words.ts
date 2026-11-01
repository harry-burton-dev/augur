import type { Channel, Policy, Ring } from './types.js';

/** The spec's words for stored values. Never "rollback", "revert" or "downgrade". */
export const CHANNEL_WORDS: Record<Channel, string> = { stable: 'Production', beta: 'Preview', dev: 'Dev builds' };
export const RING_WORDS: Record<Ring, string> = { dev: 'Workbench', preview: 'Preview', production: 'Production' };
export const POLICY_WORDS: Record<Policy, string> = { automatic: 'Automatic', ask: 'Ask first', hold: 'Hold' };

/** Which channels a ring may follow, and why the others are greyed out. */
export const channelsFor = (ring: Ring | undefined): { channel: Channel; allowed: boolean; reason?: string }[] =>
  (['stable', 'beta', 'dev'] as Channel[]).map((channel) => {
    const allowed = ring === 'dev' || (ring === 'preview' && channel !== 'dev') || ((ring === 'production' || !ring) && channel === 'stable');
    return allowed
      ? { channel, allowed }
      : { channel, allowed, reason: `${RING_WORDS[ring ?? 'production']} servers take ${ring === 'preview' ? 'Production and Preview releases' : 'Production releases'} only (SERVER_RING in .env)` };
  });
