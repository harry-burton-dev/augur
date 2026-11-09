import type { Outcome } from '../model/history.js';
import type { UnitState } from '../model/states.js';
import type { Channel, Policy, UpgradeStep } from '../model/types.js';

/**
 * The words Deployment uses: the ones release and operations people use (update available, breaking
 * change, roll back, release channel, maintenance window), since the people who run a deployment
 * are its experts.
 */
export const CHANNEL: Record<Channel, string> = { stable: 'Stable', beta: 'Beta', dev: 'Dev' };
export const POLICY: Record<Policy, string> = { automatic: 'Automatic', ask: 'Manual approval', hold: 'On hold' };

/** Each unit state, and the kit's status mark for it: a word and a shape, never colour alone. */
export const STATE: Record<UnitState, { words: string; status: 'needs' | 'running' | 'queued' | 'paused' | 'done' | 'failed' | 'warning' }> = {
  running: { words: 'Upgrading', status: 'running' },
  watching: { words: 'Monitoring after upgrade', status: 'running' },
  halted: { words: 'Release halted', status: 'failed' },
  held: { words: 'On hold', status: 'paused' },
  'waiting-you': { words: 'Needs approval', status: 'needs' },
  'waiting-window': { words: 'Scheduled for the next window', status: 'queued' },
  'update-available': { words: 'Update available', status: 'warning' },
  'up-to-date': { words: 'Up to date', status: 'done' },
};

export const OUTCOME: Record<Outcome, { words: string; status: 'running' | 'done' | 'failed' | 'warning' | 'paused' }> = {
  done: { words: 'Succeeded', status: 'done' },
  'went-back': { words: 'Rolled back automatically', status: 'warning' },
  failed: { words: 'Failed', status: 'failed' },
  cancelled: { words: 'Cancelled', status: 'paused' },
  'under-way': { words: 'In progress', status: 'running' },
  changed: { words: 'Changed', status: 'done' },
};

/** Each step the updater reports. */
export const STEP: Record<UpgradeStep['step'], string> = {
  preflight: 'Pre-flight checks',
  backup: 'Back up and verify the backup',
  pull: 'Pull the new images',
  'roll-forward': 'Deploy the new version',
  verify: 'Health checks',
  watch: 'Monitor for 10 minutes',
  'roll-back': 'Roll back',
};

/** Said wherever a change needs deployment-admin and the person doesn't hold it (ADR 0022, 0084). */
export const NEEDS_DEPLOYMENT_ADMIN = 'Needs the deployment-admin role. Ask a deployment admin.';
