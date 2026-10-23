import { ruleChain, type FloorPlace, type Scope } from '@platform/service-kit';
import { floorKindsOf } from './manifest.ts';
import type { AppRecord, FloorRule } from './store.ts';

/** Whether an app is on for a floor, and why, in the order the reasons are checked. */
export type FloorState =
  | { on: false; why: 'turned-off' }
  | { on: false; why: 'not-for-this-kind' }
  | { on: false; why: 'blocked'; by: string }
  | { on: boolean; why: 'set-here' | 'set-above'; by: string }
  | { on: true; why: 'approved' };

/**
 * Whether an app is on for a floor. An app an admin has turned off is off
 * everywhere, and one is only ever on the kinds of floor its manifest names.
 * Then the guardrails: a block on the floor or any floor above wins. Then the
 * nearest install, from the floor itself upwards, skipping one above that
 * doesn't carry on. With no rule anywhere, an approved app is on, as it was
 * before floors.
 */
export const floorState = (record: AppRecord, place: FloorPlace, rules: FloorRule[]): FloorState => {
  if (!record.enabled) return { on: false, why: 'turned-off' };
  if (!floorKindsOf(record.entry).includes(place.kind)) return { on: false, why: 'not-for-this-kind' };
  const chain = ruleChain(place);
  const mine = rules.filter((r) => r.app === record.entry.id);
  const block = mine.find((r) => r.state === 'blocked' && chain.includes(r.workspace));
  if (block) return { on: false, why: 'blocked', by: block.workspace };
  for (let i = chain.length - 1; i >= 0; i--) {
    const here = i === chain.length - 1;
    const install = mine.find((r) => r.workspace === chain[i] && r.state !== 'blocked' && (here || r.carriesOn));
    if (install) return { on: install.state === 'on', why: here ? 'set-here' : 'set-above', by: install.workspace };
  }
  return { on: true, why: 'approved' };
};

/** What an app may use: what it asks for and an admin has granted. */
export const usableScopes = (record: AppRecord): Scope[] => (record.entry.scopes ?? []).filter((s) => record.grantedScopes.includes(s));

/** What an app asks for that no admin has granted yet. */
export const awaitingScopes = (record: AppRecord): Scope[] => (record.entry.scopes ?? []).filter((s) => !record.grantedScopes.includes(s));
