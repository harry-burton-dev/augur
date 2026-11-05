import type { NewAuditEntry } from '@augur/service-kit';
import type { Directory } from './directory.ts';
import { DELETING_STEPS, type DeletingStep, type LifecycleStore } from './lifecycle.ts';
import type { PreferenceStore } from './store.ts';
import type { WorkspaceStore } from './workspaces.ts';

/**
 * Deleting a leaver's account (ADR 0072), once the organisation's leaver retention has passed or when a
 * deployment admin deletes them at once. The steps run in order and each is kept, so a failure resumes where
 * it stopped: Activity loses their personal values (the events service's redaction), identity forgets their
 * preferences, request to leave and teams, then Keycloak deletes the account. Only then are they marked deleted
 * and `person.deleted` recorded, which followers hear as `platform.person.deleted`. Their id stays in Activity,
 * now pseudonymous: nothing that maps it back to them is kept.
 */

/** What a deleted person's own floor is called from then on. */
export const DELETED_NAME = 'Deleted person';

export interface DeletionDeps {
  directory: Pick<Directory, 'deletePerson'>;
  lifecycle: Pick<LifecycleStore, 'get' | 'deleting' | 'deleted' | 'dueDeletions'>;
  store?: Pick<PreferenceStore, 'forget'>;
  workspaces?: Pick<WorkspaceStore, 'forgetPerson'>;
  /** Asks the events service to remove their personal values from Activity and delete their notifications. */
  redact: (person: string) => Promise<unknown>;
  audit?: (entry: NewAuditEntry) => Promise<unknown>;
  now?: () => string;
}

const after = (done: DeletingStep | undefined, step: DeletingStep) => (done ? DELETING_STEPS.indexOf(done) >= DELETING_STEPS.indexOf(step) : false);

/** Deletes one leaver's account, resuming where an earlier try stopped. `by` is who chose Delete now, if anyone. */
export const deleteAccount = async (deps: DeletionDeps, person: string, by?: string) => {
  const { directory, lifecycle, store, workspaces, redact, audit, now = () => new Date().toISOString() } = deps;
  const kept = (await lifecycle.get([person])).get(person);
  if (!kept?.left || kept.deletedAt) return false;
  let done = kept.deletingStep;
  const step = async (name: DeletingStep, fn: () => Promise<unknown>) => {
    if (after(done, name)) return;
    await fn();
    await lifecycle.deleting(person, name);
    done = name;
  };
  await step('redacted', () => redact(person));
  await step('tidied', async () => {
    await store?.forget(person);
    await workspaces?.forgetPerson(person, DELETED_NAME);
  });
  await step('keycloak-deleted', () => directory.deletePerson(person));
  await lifecycle.deleted(person, now());
  await audit?.({
    actor: by ? { id: by, kind: 'user' } : { id: 'identity', kind: 'service' },
    app: 'identity',
    action: 'person.deleted',
    target: person,
    detail: { ...(by ? { now: true } : {}) },
  });
  return true;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Deletes every leaver who left more than `days` ago. One that fails (the events service out of reach) keeps
 * its step and is tried again next time; the rest still run. Returns who was deleted.
 */
export const deleteDueLeavers = async (deps: DeletionDeps, days: number, at = new Date(), warn: (m: string) => void = () => undefined) => {
  const gone: string[] = [];
  for (const person of await deps.lifecycle.dueDeletions(new Date(at.getTime() - days * DAY).toISOString())) {
    try {
      if (await deleteAccount(deps, person)) gone.push(person);
    } catch (err) {
      warn(`A leaver's account (${person}) wasn't deleted yet; identity tries again in five minutes (${(err as Error).message}).`);
    }
  }
  return gone;
};
