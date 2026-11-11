/** How an app's own settings (contract 3, spec 5.2 to 5.4) are shown on its page and read back from a field. */
import type { AppSettingDecl, AppSettingView } from './types.js';

/** The choice that puts a setting back to its default: no option's name, which is never empty. */
export const DEFAULT_CHOICE = '';

export const valueWords = (s: AppSettingDecl, v: string | number | boolean) => (s.type === 'boolean' ? (v === true ? 'On' : 'Off') : `${v}${s.unit ? ` ${s.unit}` : ''}`);

/** A field's text as its setting's type; undefined for a number that isn't one. */
const typed = (s: AppSettingDecl, text: string): string | number | boolean | undefined => {
  if (s.type === 'number') return text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : undefined;
  if (s.type === 'boolean') return text === 'true';
  return text;
};

/** Why a number isn't one the setting takes, or nothing. */
export const numberProblem = (s: AppSettingDecl, text: string): string | undefined => {
  const n = Number(text.trim());
  const within = text.trim() !== '' && Number.isFinite(n) && (s.min === undefined || n >= s.min) && (s.max === undefined || n <= s.max);
  return within ? undefined : `${s.label} takes a number from ${s.min} to ${s.max}${s.unit ? ` ${s.unit}` : ''}.`;
};

/**
 * What one field changes, from what its setting is now: nothing when it's the same. An empty field or the
 * default choice puts an admin's value back to the default (null); a secret left empty stays as it was.
 */
export const settingChange = (s: AppSettingView, raw: string): { value: string | number | boolean | null } | { problem: string } | undefined => {
  const text = s.type === 'string' || s.type === 'secret' ? raw : raw.trim();
  if (s.type === 'secret') return text ? { value: text } : undefined;
  if (text === DEFAULT_CHOICE) return s.set ? { value: null } : undefined;
  if (s.type === 'number') {
    const problem = numberProblem(s, text);
    if (problem) return { problem };
  }
  const v = typed(s, text);
  if (v === undefined) return undefined;
  if (s.set ? v === s.value : v === s.default) return undefined;
  return { value: v };
};
