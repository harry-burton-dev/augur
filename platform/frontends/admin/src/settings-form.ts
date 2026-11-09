/** How Admin → Apps shows an app's own settings (contract 3) and reads its form back (spec 5.2 to 5.4). */
import type { AppSettingDecl, AppSettingView, GivenSettings } from './api.js';

/** A field's name in the form: its setting's id, kept apart from any other field the dialog has. */
export const fieldName = (id: string) => `setting:${id}`;
/** The choice that puts a setting back to its default: no option's name, which is never empty. */
export const DEFAULT_CHOICE = '';

export const valueWords = (s: AppSettingDecl, v: string | number | boolean) => (s.type === 'boolean' ? (v === true ? 'On' : 'Off') : `${v}${s.unit ? ` ${s.unit}` : ''}`);

/** What a setting is now, in a few words: the admin's value, or its default; a secret only whether it was given. */
export const settingNow = (s: AppSettingView) => {
  if (s.type === 'secret') return s.set ? `Given${s.setAt ? ` ${new Date(s.setAt).toLocaleDateString()}` : ''}` : s.required ? 'Not given yet: the app needs it to start' : 'Not given';
  if (s.set && s.value !== undefined) return valueWords(s, s.value);
  if (s.default !== undefined) return `${valueWords(s, s.default)} (its default)`;
  return s.required ? 'Not given yet: the app needs it to start' : 'Empty';
};

/** The required settings with no default: an install asks for them, as the app can't start without them (spec 5.3). */
export const mustFill = (settings: AppSettingDecl[]) => settings.filter((s) => s.required && s.default === undefined);

/** What a number setting takes, said as the field's check. */
export const numberCheck = (s: AppSettingDecl) => (value: string) => {
  const n = Number(value.trim());
  const within = value.trim() !== '' && Number.isFinite(n) && (s.min === undefined || n >= s.min) && (s.max === undefined || n <= s.max);
  return within ? null : { state: 'error' as const, message: `A number from ${s.min} to ${s.max}${s.unit ? ` ${s.unit}` : ''}.` };
};

/** A field's text as its setting's type; undefined for a number that isn't one. */
const typed = (s: AppSettingDecl, text: string): string | number | boolean | undefined => {
  if (s.type === 'number') return text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : undefined;
  if (s.type === 'boolean') return text === 'true';
  return text;
};

/**
 * What the form changes, from what each setting is now: only what differs, so an unchanged form sends nothing.
 * An empty field or the default choice puts an admin's value back to the default (null); a secret left empty
 * stays as it was.
 */
export const settingChanges = (settings: AppSettingView[], values: Record<string, string>) => {
  const out: { id: string; value: string | number | boolean | null }[] = [];
  for (const s of settings) {
    const raw = values[fieldName(s.id)];
    if (raw === undefined) continue;
    const text = s.type === 'string' || s.type === 'secret' ? raw : raw.trim();
    if (s.type === 'secret') {
      if (text) out.push({ id: s.id, value: text });
      continue;
    }
    if (text === DEFAULT_CHOICE) {
      if (s.set) out.push({ id: s.id, value: null });
      continue;
    }
    const v = typed(s, text);
    if (v === undefined) continue;
    if (s.set ? v === s.value : v === s.default) continue;
    out.push({ id: s.id, value: v });
  }
  // Secrets last: one may ask for the password again, and what came before it is kept by then.
  return [...out.filter((c) => settings.find((s) => s.id === c.id)?.type !== 'secret'), ...out.filter((c) => settings.find((s) => s.id === c.id)?.type === 'secret')];
};

/** The values an install gives, from its form's fields for the settings it must fill. */
export const givenSettings = (settings: AppSettingDecl[], values: Record<string, string>): GivenSettings => {
  const out: GivenSettings = {};
  for (const s of settings) {
    const raw = values[fieldName(s.id)];
    if (raw === undefined || raw === '') continue;
    const v = typed(s, raw);
    if (v !== undefined) out[s.id] = v;
  }
  return out;
};

