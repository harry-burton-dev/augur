import { Select, TextField } from '@augur/app-kit';
import type { AppSettingDecl, AppSettingView } from './api.js';
import { DEFAULT_CHOICE, fieldName, numberCheck, valueWords } from './settings-form.js';

/** One field per setting, each drawn for its type, with its detail, unit, bounds or options and whether it's required. */
export function SettingFields({ settings }: { settings: (AppSettingDecl & Partial<Pick<AppSettingView, 'set' | 'value' | 'newIn'>>)[] }) {
  return (
    <>
      {settings.map((s) => {
        const name = fieldName(s.id);
        // A setting only a newer version asks for doesn't hold up a change to the version that runs.
        const needed = s.required && s.default === undefined && !s.newIn;
        const hint = [s.detail, s.newIn ? `Version ${s.newIn} needs it before it installs` : undefined].filter(Boolean).join('. ') || undefined;
        if (s.type === 'boolean' || s.type === 'enum') {
          const options = [
            ...(s.default !== undefined ? [{ value: DEFAULT_CHOICE, label: `Its default (${valueWords(s, s.default)})` }] : []),
            ...(s.type === 'boolean' ? [{ value: 'true', label: 'On' }, { value: 'false', label: 'Off' }] : (s.options ?? []).map((o) => ({ value: o, label: o }))),
          ];
          const now = s.set && s.value !== undefined ? String(s.value) : s.default !== undefined ? DEFAULT_CHOICE : null;
          return <Select key={s.id} name={name} label={s.label} hint={hint} options={options} required={needed} optional={!needed} defaultValue={now} />;
        }
        if (s.type === 'secret')
          return (
            <TextField
              key={s.id}
              name={name}
              type="password"
              label={s.label}
              hint={[hint, s.set ? 'Given already: leave it empty to keep it, or type a new one to replace it' : undefined].filter(Boolean).join('. ') || undefined}
              required={needed && !s.set}
              optional={!needed}
              maxLength={4096}
            />
          );
        const unit = s.type === 'number' && s.unit ? ` (${s.unit})` : '';
        return (
          <TextField
            key={s.id}
            name={name}
            label={`${s.label}${unit}`}
            hint={[hint, s.type === 'number' ? `From ${s.min} to ${s.max}` : undefined, s.default !== undefined ? `Empty is its default, ${valueWords(s, s.default)}` : undefined].filter(Boolean).join('. ') || undefined}
            required={needed}
            optional={!needed}
            maxLength={s.type === 'number' ? 20 : 500}
            defaultValue={s.set && s.value !== undefined ? String(s.value) : ''}
            validate={s.type === 'number' ? numberCheck(s) : undefined}
          />
        );
      })}
    </>
  );
}
