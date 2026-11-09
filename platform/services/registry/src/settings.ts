/**
 * An app's own settings on contract 3 (spec 5.2 to 5.5): what its manifest declares (`contributes.settings`,
 * typed string, number, boolean, enum or secret), the values a deployment admin gives them, and how Admin → Apps
 * is shown them. A value is kept as text, the way it reaches a part; a secret's is never shown again once given.
 */
import Type from 'typebox';
import type { AppManifest3 } from '@augur/app-tools/validate';

/** One setting as the manifest declares it (manifest-3.schema.json, `$defs/setting`). */
export interface DeclaredSetting {
  id: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'secret';
  detail?: string;
  unit?: string;
  min?: number;
  max?: number;
  options?: string[];
  default?: string | number | boolean;
  required?: boolean;
}

/** An admin's value for one of an app's settings, as the registry keeps it. */
export interface StoredSettingValue {
  app: string;
  setting: string;
  /** As text, the way a part reads it: `365`, `true`, `warm`. */
  value: string;
  secret: boolean;
  setBy: string;
  setAt: string;
  /** Since when no release the app runs declares it: kept KEEP_REMOVED_MS from then, in case it comes back. */
  removedAt?: string;
}

/** The longest value a string setting takes (as the manifest's longest default). */
export const MAX_STRING = 500;
/** The longest secret: a key or a token, never a file. */
export const MAX_SECRET = 4096;
/** How long a value is kept after the release an app runs stops declaring its setting (spec 5.5). */
export const KEEP_REMOVED_MS = 30 * 24 * 60 * 60 * 1000;

export const declaredSettings = (manifest: Pick<AppManifest3, 'contributes'>): DeclaredSetting[] => (manifest.contributes?.settings ?? []) as DeclaredSetting[];

/**
 * What a value may be sent as: the setting's own type, or null to take an admin's value away. Left untyped in the
 * schema so nothing is coerced on the way in (a number sent stays a number); settingValueProblem checks it.
 */
export const SettingValueBody = Type.Unsafe<string | number | boolean | null>({ description: 'Text, a number, true or false, or null for the default' });
/** Values given with an install, by setting id. */
export const GivenSettings = Type.Record(Type.String({ pattern: '^[a-z][a-zA-Z0-9]{0,39}$' }), Type.Unsafe<string | number | boolean>({ description: 'Of the setting’s own type' }), {
  maxProperties: 20,
  description: 'Values for the release’s settings, by id: each of its own type. A required setting with no default needs one here unless an admin already gave it',
});

/** Why `value` isn't one `setting` takes, in plain words naming the setting; undefined when it is. */
export const settingValueProblem = (setting: DeclaredSetting, value: unknown): string | undefined => {
  const name = setting.label;
  switch (setting.type) {
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${name} is a number.`;
      const { min, max } = setting;
      if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
        const unit = setting.unit ? ` ${setting.unit}` : '';
        return `${name} is from ${min} to ${max}${unit}: ${value} is outside that.`;
      }
      return undefined;
    }
    case 'boolean':
      return typeof value === 'boolean' ? undefined : `${name} is on or off (true or false).`;
    case 'enum':
      return typeof value === 'string' && setting.options?.includes(value) ? undefined : `${name} is one of ${(setting.options ?? []).join(', ')}.`;
    case 'string':
      if (typeof value !== 'string') return `${name} is text.`;
      if (value.length > MAX_STRING) return `${name} is at most ${MAX_STRING} characters.`;
      if (setting.required && !value.trim()) return `${name} must be filled in.`;
      return undefined;
    case 'secret':
      if (typeof value !== 'string' || !value) return `${name} is a secret: give its value as text.`;
      return value.length > MAX_SECRET ? `${name} is at most ${MAX_SECRET} characters.` : undefined;
    default:
      return `${name} is of a type this AUGUR doesn’t know (${String((setting as { type: unknown }).type)}).`;
  }
};

/** A value as text, the way it's kept and a part reads it. */
export const asText = (value: string | number | boolean) => String(value);

/** A kept value back as its setting's type, for a form to show. */
const typed = (setting: DeclaredSetting, text: string): string | number | boolean =>
  setting.type === 'number' ? Number(text) : setting.type === 'boolean' ? text === 'true' : text;

/** The required settings with neither a value nor a default: the app doesn't start without them (spec 5.3). */
export const missingRequired = (declared: DeclaredSetting[], has: (id: string) => boolean) =>
  declared.filter((s) => s.required === true && s.default === undefined && !has(s.id));

/** Why an app can't start for want of its settings, naming each one and where to fill it in. */
export const missingMessage = (name: string, missing: DeclaredSetting[]) =>
  `${name} needs ${missing.map((s) => s.label).join(', ')} before it can start. A deployment admin fills ${missing.length === 1 ? 'it' : 'them'} in under Admin → Apps.`;

/**
 * Each setting as Admin → Apps draws its form: what the manifest says of it, and the admin's value, if one
 * was given. A secret says only that it was set, by whom and when, never its value.
 */
export const settingsView = (declared: DeclaredSetting[], stored: StoredSettingValue[]) =>
  declared.map((s) => {
    const kept = stored.find((v) => v.setting === s.id);
    return {
      id: s.id,
      label: s.label,
      type: s.type,
      ...(s.detail ? { detail: s.detail } : {}),
      ...(s.unit ? { unit: s.unit } : {}),
      ...(s.min !== undefined ? { min: s.min } : {}),
      ...(s.max !== undefined ? { max: s.max } : {}),
      ...(s.options ? { options: s.options } : {}),
      ...(s.default !== undefined ? { default: s.default } : {}),
      required: s.required === true,
      set: Boolean(kept),
      // Never a secret's, by its type now or by how it was kept.
      ...(kept && s.type !== 'secret' && !kept.secret ? { value: typed(s, kept.value) } : {}),
      ...(kept ? { setBy: kept.setBy, setAt: kept.setAt } : {}),
    };
  });

const scalar = Type.Union([Type.String(), Type.Number(), Type.Boolean()]);
/** One setting as Admin → Apps is shown it. */
export const SettingView = Type.Object(
  {
    id: Type.String(),
    label: Type.String(),
    type: Type.Enum(['string', 'number', 'boolean', 'enum', 'secret']),
    detail: Type.Optional(Type.String()),
    unit: Type.Optional(Type.String()),
    min: Type.Optional(Type.Number()),
    max: Type.Optional(Type.Number()),
    options: Type.Optional(Type.Array(Type.String())),
    default: Type.Optional(scalar),
    required: Type.Boolean({ description: 'The app doesn’t start until it has a value' }),
    set: Type.Boolean({ description: 'Whether an admin gave it a value; otherwise its default is in force' }),
    value: Type.Optional(Type.Union([scalar], { description: 'The admin’s value; never given for a secret' })),
    setBy: Type.Optional(Type.String()),
    setAt: Type.Optional(Type.String({ format: 'date-time' })),
    newIn: Type.Optional(Type.String({ description: 'Asked for only by this newer version, which needs it before it installs' })),
  },
  { description: 'One of the app’s settings, as its form shows it' },
);
