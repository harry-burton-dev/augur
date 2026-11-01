import type { Level } from './levels.js';
import type { Channel, Policy, Window } from './types.js';
import { CHANNEL_WORDS } from './words.js';

const DAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

const end = (start: string, hours: number) => {
  const [h, m] = start.split(':').map(Number);
  const mins = (h! * 60 + m! + hours * 60) % (24 * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
};

export const windowWords = (windows: Window[] | 'any'): string =>
  windows === 'any' || !windows.length ? 'at any time' : `on ${windows.map((w) => `${DAYS[w.day]} ${w.start}–${end(w.start, w.hours)}`).join(' and ')}`;

/**
 * The one sentence that sums up a unit's settings, kept on screen while they're edited.
 * "AUGUR takes patch releases from Production by itself on Sundays 02:00–04:00. Minors and majors wait for you."
 */
export const policySentence = (s: { name: string; channel: Channel; policy: Policy; automaticUpTo?: Exclude<Level, 'major'>; windows: Window[] | 'any'; pin?: string }): string => {
  const from = CHANNEL_WORDS[s.channel];
  const pin = s.pin ? ` within ${s.pin}` : '';
  if (s.policy === 'hold') return `${s.name} is held: no new release from ${from} is offered by itself.`;
  if (s.policy === 'ask') return `${s.name} waits for you before taking any release from ${from}${pin}.`;
  const upTo = s.automaticUpTo ?? 'patch';
  const taken = upTo === 'patch' ? 'patch releases' : 'patch and minor releases';
  const waiting = upTo === 'patch' ? 'Minors and majors wait for you.' : 'Majors wait for you.';
  return `${s.name} takes ${taken} from ${from}${pin} by itself ${windowWords(s.windows)}. ${waiting}`;
};
