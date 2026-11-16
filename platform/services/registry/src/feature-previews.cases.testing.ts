import type { Ring } from './ring.ts';
import type { FeaturePreviewMode } from './store.ts';

/**
 * Today's feature preview behaviour as a table (PER-498): whether one preview is on for one person, for each
 * mix of an admin's choice, the server's ring, where the person stands, whether they turned it on, and the
 * preview's last day. The values are what previewsOnFor does now, so another way of deciding (a flag file,
 * a flag service) can be held to it. Plain data on purpose: nothing here calls the registry.
 */

/** The app whose manifest declares the preview. */
export const APP = 'notes';

/** The one preview the app's manifest declares. */
export const DECLARED = 'board';

/** The person asking. */
export const PERSON = 'u-2';

/** The clock for every case that doesn't set its own: late on 15 November 2026 (UTC), so "today" is the 15th. */
export const NOW = '2026-11-15T23:30:00Z';

/**
 * Rule chains, from the org down to the floor someone stands on: the org, Finance with Payroll beneath it,
 * Legal, and someone's own floor (under the org).
 */
export const CHAINS = {
  none: [],
  org: ['o'],
  finance: ['o', 'f'],
  payroll: ['o', 'f', 'p'],
  legal: ['o', 'l'],
  personal: ['o', 'm'],
} as const satisfies Record<string, readonly string[]>;

export interface Choice {
  readonly mode: FeaturePreviewMode;
  readonly floors?: readonly string[];
}

export interface OptIn {
  readonly person: string;
  readonly app: string;
  readonly preview: string;
}

export interface PreviewCase {
  readonly name: string;
  readonly ring: Ring;
  /**
   * The clock, an ISO instant. A preview's last day is compared with its UTC date (ended() in feature-previews.ts),
   * so an evaluator that can't freeze its clock (a flag service) needs it passed in, not its own time.
   */
  readonly now: string;
  /** Admins' choices, by preview id; a declared preview without one takes the ring's default. */
  readonly chosen: Readonly<Record<string, Choice>>;
  /** Everyone's opt-ins for the app (and others). The registry is asked only for PERSON's (featureOptIns({ person })). */
  readonly optIns: readonly OptIn[];
  /** Where PERSON stands. */
  readonly chain: readonly string[];
  /** The last day (YYYY-MM-DD) of DECLARED, the one preview the manifest declares. */
  readonly until?: string;
  /** The ids on for PERSON. */
  readonly expected: readonly string[];
  /** Set when the route or store can't produce this state today (a defensive row): a new evaluator may skip it on purpose. */
  readonly unreachable?: string;
}

/** Shorthand for a row about DECLARED alone: chose it, opted in to it, and whether it's on. */
type Row = Pick<PreviewCase, 'name' | 'ring' | 'until' | 'unreachable'> &
  Partial<Pick<PreviewCase, 'now' | 'chain' | 'optIns'>> & { choose?: Choice; optedIn?: boolean; on: boolean };
const mine = (preview = DECLARED, app = APP): OptIn => ({ person: PERSON, app, preview });
const row = ({ choose, optedIn, on, ...r }: Row): PreviewCase => ({
  now: NOW,
  chain: CHAINS.none,
  chosen: choose ? { [DECLARED]: choose } : {},
  optIns: optedIn ? [mine()] : [],
  expected: on ? [DECLARED] : [],
  ...r,
});

export const cases: readonly PreviewCase[] = [
  // Nobody has chosen: the ring's default. Opt-in on dev and preview servers, off on production.
  row({ name: 'dev, no choice, not opted in', ring: 'dev', on: false }),
  row({ name: 'dev, no choice, opted in', ring: 'dev', optedIn: true, on: true }),
  row({ name: 'preview, no choice, not opted in', ring: 'preview', on: false }),
  row({ name: 'preview, no choice, opted in', ring: 'preview', optedIn: true, on: true }),
  row({ name: 'production, no choice, not opted in', ring: 'production', on: false }),
  row({ name: 'production, no choice, opted in', ring: 'production', optedIn: true, on: false }),

  // An admin chose off: off on every ring, whoever turned it on.
  row({ name: 'dev, off, not opted in', ring: 'dev', choose: { mode: 'off' }, on: false }),
  row({ name: 'dev, off, opted in', ring: 'dev', choose: { mode: 'off' }, optedIn: true, on: false }),
  row({ name: 'preview, off, not opted in', ring: 'preview', choose: { mode: 'off' }, on: false }),
  row({ name: 'preview, off, opted in', ring: 'preview', choose: { mode: 'off' }, optedIn: true, on: false }),
  row({ name: 'production, off, not opted in', ring: 'production', choose: { mode: 'off' }, on: false }),
  row({ name: 'production, off, opted in', ring: 'production', choose: { mode: 'off' }, optedIn: true, on: false }),

  // An admin chose opt-in: on for those who turned it on, production included.
  row({ name: 'dev, opt-in, not opted in', ring: 'dev', choose: { mode: 'opt-in' }, on: false }),
  row({ name: 'dev, opt-in, opted in', ring: 'dev', choose: { mode: 'opt-in' }, optedIn: true, on: true }),
  row({ name: 'preview, opt-in, not opted in', ring: 'preview', choose: { mode: 'opt-in' }, on: false }),
  row({ name: 'preview, opt-in, opted in', ring: 'preview', choose: { mode: 'opt-in' }, optedIn: true, on: true }),
  row({ name: 'production, opt-in, not opted in', ring: 'production', choose: { mode: 'opt-in' }, on: false }),
  row({ name: 'production, opt-in, opted in', ring: 'production', choose: { mode: 'opt-in' }, optedIn: true, on: true }),
  row({ name: 'preview, opt-in, opted in to a preview of that name in another app', ring: 'preview', choose: { mode: 'opt-in' }, optIns: [mine(DECLARED, 'other')], on: false }),

  row({ name: 'preview, opt-in, someone else opted in', ring: 'preview', choose: { mode: 'opt-in' }, optIns: [{ person: 'u-3', app: APP, preview: DECLARED }], on: false }),
  row({ name: 'preview, no choice, someone else opted in', ring: 'preview', optIns: [{ person: 'u-3', app: APP, preview: DECLARED }], on: false }),

  // An admin chose everyone: on on every ring.
  row({ name: 'dev, everyone, not opted in', ring: 'dev', choose: { mode: 'everyone' }, on: true }),
  row({ name: 'dev, everyone, opted in', ring: 'dev', choose: { mode: 'everyone' }, optedIn: true, on: true }),
  row({ name: 'preview, everyone, not opted in', ring: 'preview', choose: { mode: 'everyone' }, on: true }),
  row({ name: 'preview, everyone, opted in', ring: 'preview', choose: { mode: 'everyone' }, optedIn: true, on: true }),
  row({ name: 'production, everyone, not opted in', ring: 'production', choose: { mode: 'everyone' }, on: true }),
  row({ name: 'production, everyone, opted in', ring: 'production', choose: { mode: 'everyone' }, optedIn: true, on: true }),

  // An admin chose floors: on for a chosen floor and those beneath it, nowhere else; turning it on doesn't count.
  row({ name: 'floors [f], on Finance (the chosen floor)', ring: 'production', choose: { mode: 'floors', floors: ['f'] }, chain: CHAINS.finance, on: true }),
  row({ name: 'floors [f], on Payroll (beneath it)', ring: 'production', choose: { mode: 'floors', floors: ['f'] }, chain: CHAINS.payroll, on: true }),
  row({ name: 'floors [f], on Legal (unrelated)', ring: 'production', choose: { mode: 'floors', floors: ['f'] }, chain: CHAINS.legal, on: false }),
  row({ name: 'floors [f], on the org (above it)', ring: 'production', choose: { mode: 'floors', floors: ['f'] }, chain: CHAINS.org, on: false }),
  row({ name: 'floors [f], on a personal floor', ring: 'production', choose: { mode: 'floors', floors: ['f'] }, chain: CHAINS.personal, on: false }),
  row({ name: 'floors [f], on no floor', ring: 'production', choose: { mode: 'floors', floors: ['f'] }, on: false }),
  row({ name: 'floors [f], on Legal, opted in', ring: 'preview', choose: { mode: 'floors', floors: ['f'] }, chain: CHAINS.legal, optedIn: true, on: false }),
  row({ name: 'floors [f], on no floor, opted in', ring: 'dev', choose: { mode: 'floors', floors: ['f'] }, optedIn: true, on: false }),
  row({ name: 'floors [f], on Payroll, dev server', ring: 'dev', choose: { mode: 'floors', floors: ['f'] }, chain: CHAINS.payroll, on: true }),
  row({ name: 'floors [o], on a personal floor (under the org)', ring: 'production', choose: { mode: 'floors', floors: ['o'] }, chain: CHAINS.personal, on: true }),
  row({ name: 'floors [l, p], on Payroll', ring: 'preview', choose: { mode: 'floors', floors: ['l', 'p'] }, chain: CHAINS.payroll, on: true }),
  row({ name: 'floors [l, p], on Finance (above Payroll)', ring: 'preview', choose: { mode: 'floors', floors: ['l', 'p'] }, chain: CHAINS.finance, on: false }),
  row({ name: 'floors with none listed, on Finance', unreachable: 'the route refuses floors without a floor (bad_floors)', ring: 'production', choose: { mode: 'floors' }, chain: CHAINS.finance, on: false }),
  row({ name: 'floors [], on Finance', unreachable: 'the route refuses floors without a floor (bad_floors)', ring: 'production', choose: { mode: 'floors', floors: [] }, chain: CHAINS.finance, on: false }),
  row({ name: 'floors listed but mode everyone, on Legal', unreachable: 'the route refuses floors with another mode, and the store drops them', ring: 'production', choose: { mode: 'everyone', floors: ['f'] }, chain: CHAINS.legal, on: true }),

  // Its last day: on up to and including it, off after it for everyone.
  row({ name: 'everyone, until in the future', ring: 'production', choose: { mode: 'everyone' }, until: '2026-12-31', on: true }),
  row({ name: 'everyone, until today', ring: 'production', choose: { mode: 'everyone' }, until: '2026-11-15', on: true }),
  row({ name: 'everyone, until yesterday', ring: 'production', choose: { mode: 'everyone' }, until: '2026-11-14', on: false }),
  row({ name: 'everyone, until today, its last second (UTC)', ring: 'production', choose: { mode: 'everyone' }, until: '2026-11-15', now: '2026-11-15T23:59:59Z', on: true }),
  row({ name: 'everyone, until yesterday, just after midnight (UTC)', ring: 'production', choose: { mode: 'everyone' }, until: '2026-11-15', now: '2026-11-16T00:00:30Z', on: false }),
  row({ name: 'everyone, until today, just after midnight (UTC)', ring: 'production', choose: { mode: 'everyone' }, until: '2026-11-15', now: '2026-11-15T00:00:30Z', on: true }),
  row({ name: 'everyone, until long past', ring: 'dev', choose: { mode: 'everyone' }, until: '2020-01-01', on: false }),
  row({ name: 'no choice, opted in, until today', ring: 'preview', optedIn: true, until: '2026-11-15', on: true }),
  row({ name: 'no choice, opted in, until yesterday', ring: 'preview', optedIn: true, until: '2026-11-14', on: false }),
  row({ name: 'opt-in, opted in, until in the future', ring: 'production', choose: { mode: 'opt-in' }, optedIn: true, until: '2027-01-01', on: true }),
  row({ name: 'floors [f], on Payroll, until today', ring: 'production', choose: { mode: 'floors', floors: ['f'] }, chain: CHAINS.payroll, until: '2026-11-15', on: true }),
  row({ name: 'floors [f], on Payroll, until yesterday', ring: 'production', choose: { mode: 'floors', floors: ['f'] }, chain: CHAINS.payroll, until: '2026-11-14', on: false }),

  // A preview the manifest doesn't declare: never on, whatever an admin or the person chose for it, and the declared one is left alone.
  { name: 'undeclared, admin chose everyone; declared one chose everyone', ring: 'production', now: NOW, chain: CHAINS.none, chosen: { ghost: { mode: 'everyone' }, [DECLARED]: { mode: 'everyone' } }, optIns: [], expected: [DECLARED] },
  { name: 'undeclared, admin chose everyone; declared one no choice', ring: 'production', now: NOW, chain: CHAINS.none, chosen: { ghost: { mode: 'everyone' } }, optIns: [], expected: [] },
  { name: 'undeclared, opted in; declared one opted in', ring: 'dev', now: NOW, chain: CHAINS.none, chosen: {}, optIns: [mine('ghost'), mine()], expected: [DECLARED] },
  { name: 'undeclared, opted in; declared one not', ring: 'dev', now: NOW, chain: CHAINS.none, chosen: {}, optIns: [mine('ghost')], expected: [] },
  { name: 'undeclared, floors [f], on Finance; declared one opt-in, opted in', ring: 'preview', now: NOW, chain: CHAINS.finance, chosen: { ghost: { mode: 'floors', floors: ['f'] }, [DECLARED]: { mode: 'opt-in' } }, optIns: [mine()], expected: [DECLARED] },
];
