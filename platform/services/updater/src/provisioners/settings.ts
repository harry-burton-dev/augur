/**
 * augur-settings: the values the admin gave the app's settings (spec 4.6, 5.3), one output per setting
 * id, secret for a `secret` setting. A setting with no value takes its manifest default; an optional one
 * with neither is empty; a required one with neither stops the install with a plain reason.
 * Admin → Apps forms for the values arrive with P4; until then every setting has its default.
 */
import type { Provisioner } from './types.ts';

type Setting = {
  id: string;
  label: string;
  type: string;
  default?: unknown;
  required?: boolean;
};

export const settings: Provisioner = {
  type: 'augur-settings',
  uri: 'template://augur/settings',
  params: ['ids'],
  check: ({ ids }, { manifest }) => {
    if (ids === undefined) return [];
    if (!Array.isArray(ids) || !ids.every((i) => typeof i === 'string')) return ['ids is a list of setting ids.'];
    const declared = new Set((manifest.contributes?.settings ?? []).map((s) => s.id));
    const unknown = ids.filter((i) => !declared.has(i));
    return unknown.length ? [`${unknown.join(', ')} ${unknown.length === 1 ? 'isn’t a setting' : 'aren’t settings'} the manifest declares.`] : [];
  },
  needs: [],
  outputs: ({ manifest, params, settings: values = {} }) => {
    const all = (manifest.contributes?.settings ?? []) as Setting[];
    const ids = Array.isArray(params.ids) ? (params.ids as string[]) : all.map((s) => s.id);
    const out: Record<string, { value: string; secret?: boolean }> = {};
    for (const s of all.filter((x) => ids.includes(x.id))) {
      const value = values[s.id] ?? (s.default === undefined ? undefined : String(s.default));
      if (value === undefined && s.required) throw new Error(`${manifest.name} needs its ${s.label} before it can start. An admin fills it in under Admin → Apps.`);
      out[s.id] = {
        value: value ?? '',
        ...(s.type === 'secret' ? { secret: true } : {}),
      };
    }
    return out;
  },
  compose: () => ({}),
};
