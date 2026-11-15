import type { AppManifest3 } from '@augur/app-tools/validate';

/** The fields contract 3 hasn't frozen, which a manifest sets under `provisional` (manifest-3.schema.json). */
export const PROVISIONAL_FIELDS = ['requiredRole', 'links'] as const;
type Field = (typeof PROVISIONAL_FIELDS)[number];
export type Provisional = { requiredRole?: string; links?: { entities?: boolean } };

const blockOf = (m: AppManifest3) => (typeof m.provisional === 'object' && m.provisional !== null ? (m.provisional as Record<string, unknown>) : {});

/**
 * The provisional fields this registry reads, from `provisional` or, for one more release, from the top of the
 * manifest. A field under `provisional` it doesn't know is left out: an app that sets a newer one installs here without it.
 */
export const provisionalOf = (m: AppManifest3): Provisional => {
  const block = blockOf(m);
  const out: Record<string, unknown> = {};
  for (const f of PROVISIONAL_FIELDS) {
    const value = block[f] ?? m[f];
    if (value !== undefined) out[f] = value;
  }
  return out as Provisional;
};

/** Provisional fields the manifest sets at its top level: still read, with a warning, for one more release. */
export const topLevelProvisional = (m: AppManifest3): Field[] => PROVISIONAL_FIELDS.filter((f) => m[f] !== undefined);

/** Fields AUGUR had and took out, accepted and ignored for a release so a manifest that still sets one installs: `bindings` (D6). */
export const RETIRED_FIELDS = ['bindings'] as const;

/** The retired fields the manifest still sets, at its top or under `provisional`. */
export const retiredSet = (m: AppManifest3): string[] => RETIRED_FIELDS.filter((f) => m[f] !== undefined || blockOf(m)[f] !== undefined);

/** The fields under `provisional` this registry doesn't know, and so leaves out. */
export const unknownProvisional = (m: AppManifest3): string[] =>
  Object.keys(blockOf(m)).filter((k) => !(PROVISIONAL_FIELDS as readonly string[]).includes(k) && !(RETIRED_FIELDS as readonly string[]).includes(k));

/** Provisional fields set both at the top and under `provisional`, which the registry refuses rather than guess between. */
export const setTwice = (m: AppManifest3): Field[] => PROVISIONAL_FIELDS.filter((f) => m[f] !== undefined && blockOf(m)[f] !== undefined);
