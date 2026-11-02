/** The spec's eight unit states, in the order they win when several hold. */
export type UnitState = 'running' | 'watching' | 'halted' | 'held' | 'waiting-you' | 'waiting-window' | 'update-available' | 'up-to-date';

/** Each state in words, with an icon and a tone, never colour alone (WCAG 1.4.1). */
export const STATE_LOOK: Record<UnitState, { words: string; icon: string; tone: 'neutral' | 'info' | 'good' | 'warn' | 'danger' }> = {
  running: { words: 'Running now', icon: 'loader', tone: 'info' },
  watching: { words: 'Watching after upgrade', icon: 'eye', tone: 'info' },
  halted: { words: 'Halted', icon: 'octagon-alert', tone: 'danger' },
  held: { words: 'Held', icon: 'pause', tone: 'neutral' },
  'waiting-you': { words: 'Waiting for you', icon: 'hand', tone: 'warn' },
  'waiting-window': { words: 'Waiting for its window', icon: 'clock', tone: 'neutral' },
  'update-available': { words: 'Update available', icon: 'arrow-up-circle', tone: 'info' },
  'up-to-date': { words: 'Up to date', icon: 'check', tone: 'good' },
};

