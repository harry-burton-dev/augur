import { useMemo, useState, type ReactNode } from 'react';
import { ApiError, type UpgradesApi } from './api.js';
import { Muted } from './look.js';
import { pinChoices } from './model/levels.js';
import { DAY_NAMES, desiredProblems, MAX_WINDOWS, policySentence, timeZones } from './model/sentence.js';
import { formatWhen, nextWindows } from './model/time.js';
import type { AutomaticLevel, Channel, DesiredStateInput, Overview, OverviewUnit, Policy, Ring, Window } from './model/types.js';
import { CHANNEL_WORDS, channelsFor, POLICY_WORDS } from './model/words.js';
import { AUGUR } from './units.js';

type Draft = DesiredStateInput & { timeZone: string };

const POLICY_HINT: Record<Policy, string> = {
  automatic: 'Releases install by themselves, as far as you allow below.',
  ask: 'Each new release waits for an admin to start it.',
  hold: 'Nothing new is offered until you take this off.',
};

const draftOf = (u: OverviewUnit): Draft => ({
  channel: u.desired.channel,
  policy: u.desired.policy,
  automaticUpTo: u.desired.automaticUpTo,
  ...(u.desired.pin ? { pin: u.desired.pin } : {}),
  windows: u.desired.windows.map((w) => ({ ...w })),
  timeZone: u.desired.timeZone,
});

/** The fields the registry stores, in a fixed order, to tell whether anything changed. */
const same = (a: Draft, b: Draft) =>
  JSON.stringify([a.channel, a.policy, a.automaticUpTo, a.pin ?? '', a.windows, a.timeZone]) ===
  JSON.stringify([b.channel, b.policy, b.automaticUpTo, b.pin ?? '', b.windows, b.timeZone]);

const inputClass = 'border border-hairline rounded-inset bg-surface-inset text-ink px-2 py-1 text-body';

const Field = ({ legend, children, note, disabled }: { legend: string; children: ReactNode; note?: ReactNode; disabled?: boolean }) => (
  <fieldset className="flex flex-col gap-2 border-0 p-0 m-0 disabled:opacity-60" disabled={disabled}>
    <legend className="text-small text-ink-muted mb-2">{legend}</legend>
    {children}
    {note && <span className="text-small text-ink-muted">{note}</span>}
  </fieldset>
);

const Choice = ({ name, checked, onChange, disabled, label, hint }: { name: string; checked: boolean; onChange: () => void; disabled?: boolean; label: string; hint?: string }) => (
  <label className="flex gap-2 items-baseline">
    <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} />
    <span>
      {label}
      {hint && <span className="text-ink-muted"> · {hint}</span>}
    </span>
  </label>
);

/**
 * How one unit takes new releases: channel, policy, how far Automatic goes, a pin and the weekly
 * windows. The sentence for what's set now and for what saving would set stay side by side, with
 * the next three windows, so the person sees the effect before saving (spec: "Settings").
 */
export const SettingsEditor = (p: {
  unit: OverviewUnit;
  ring: Ring;
  deploymentZone: string;
  now: Date;
  api: UpgradesApi;
  took: (o: Overview) => void;
  onDone: () => void;
}) => {
  const start = useMemo(() => draftOf(p.unit), [p.unit]);
  const [draft, setDraft] = useState<Draft>(start);
  const [customPin, setCustomPin] = useState(() => (start.pin && !pinChoices(p.unit.running).some((c) => c.range === start.pin) ? start.pin : ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const isAugur = p.unit.unit === AUGUR;
  const zones = useMemo(() => timeZones(p.deploymentZone, start.timeZone, 'UTC'), [p.deploymentZone, start.timeZone]);
  const choices = pinChoices(p.unit.running);
  const pinMode = !draft.pin ? 'none' : choices.some((c) => c.range === draft.pin) ? draft.pin : 'custom';
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setWindow = (i: number, patch: Partial<Window>) => set({ windows: draft.windows.map((w, j) => (j === i ? { ...w, ...patch } : w)) });

  const problems = desiredProblems(draft);
  const unchanged = same(draft, start);
  const automatic = draft.policy === 'automatic';
  const next = automatic ? nextWindows(draft.windows, draft.timeZone, p.now, 3) : [];
  const saveReason = unchanged ? 'Nothing has changed yet.' : problems.length ? problems.join(' ') : undefined;

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const { pin, ...rest } = draft;
      p.took(await p.api.setDesired(p.unit.unit, pin ? { ...rest, pin } : rest));
      p.onDone();
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      aria-label={`Settings for ${p.unit.name}`}
      className="flex flex-col gap-5 border border-hairline rounded-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!saveReason) void save();
      }}
    >
      <Field
        legend="Releases from"
        note={isAugur ? 'AUGUR’s channel is set by RELEASE_CHANNEL in the server’s .env (docs/upgrade.md), so it can’t be changed here.' : undefined}
      >
        {channelsFor(p.ring).map((c) => {
          const allowed = isAugur ? c.channel === start.channel : c.allowed;
          return (
            <Choice
              key={c.channel}
              name="channel"
              checked={draft.channel === c.channel}
              disabled={!allowed}
              onChange={() => set({ channel: c.channel as Channel })}
              label={CHANNEL_WORDS[c.channel]}
              hint={!allowed && !isAugur ? c.reason : undefined}
            />
          );
        })}
      </Field>

      <Field legend="How new releases arrive">
        {(['automatic', 'ask', 'hold'] as Policy[]).map((policy) => (
          <Choice key={policy} name="policy" checked={draft.policy === policy} onChange={() => set({ policy })} label={POLICY_WORDS[policy]} hint={POLICY_HINT[policy]} />
        ))}
      </Field>

      <Field legend="Automatic takes" disabled={!automatic} note={!automatic ? 'Only Automatic uses this.' : 'A major release always waits for an admin.'}>
        {(['patch', 'minor'] as AutomaticLevel[]).map((level) => (
          <Choice
            key={level}
            name="automaticUpTo"
            checked={draft.automaticUpTo === level}
            onChange={() => set({ automaticUpTo: level })}
            label={level === 'patch' ? 'Patch releases only' : 'Patch and minor releases'}
          />
        ))}
      </Field>

      <Field legend="Stay within" note="A pin keeps this unit inside a range of versions, whatever the policy.">
        <Choice name="pin" checked={pinMode === 'none'} onChange={() => set({ pin: undefined })} label="Any version" />
        {choices.map((c) => (
          <Choice key={c.range} name="pin" checked={pinMode === c.range} onChange={() => set({ pin: c.range })} label={c.label} hint={c.range} />
        ))}
        <label className="flex gap-2 items-baseline">
          <input type="radio" name="pin" checked={pinMode === 'custom'} onChange={() => set({ pin: customPin || choices[0]!.range })} />
          <span>A range of your own</span>
          <input
            className={inputClass}
            aria-label="Version range"
            placeholder="^1.2.0"
            value={pinMode === 'custom' ? draft.pin : customPin}
            onChange={(e) => {
              setCustomPin(e.target.value);
              set({ pin: e.target.value || undefined });
            }}
          />
        </label>
      </Field>

      <Field
        legend="When Automatic may start"
        disabled={!automatic}
        note={!automatic ? 'Only Automatic uses windows. An upgrade an admin starts runs when they ask.' : 'An upgrade an admin starts runs when they ask, whatever the windows.'}
      >
        <Choice name="any" checked={draft.windows.length === 0} onChange={() => set({ windows: [] })} label="At any time" />
        <Choice
          name="any"
          checked={draft.windows.length > 0}
          onChange={() => draft.windows.length === 0 && set({ windows: [{ day: 0, start: '02:00', hours: 2 }] })}
          label="Only in these weekly windows"
        />
        {draft.windows.map((w, i) => (
          <div key={i} className="flex flex-wrap gap-3 items-center pl-5" data-window={i}>
            <select className={inputClass} aria-label="Day" value={w.day} onChange={(e) => setWindow(i, { day: Number(e.target.value) })}>
              {DAY_NAMES.map((d, day) => (
                <option key={d} value={day}>
                  {d}
                </option>
              ))}
            </select>
            <span>from</span>
            <input className={inputClass} type="time" aria-label="Starts at" step={60} value={w.start} onChange={(e) => setWindow(i, { start: e.target.value })} />
            <span>for</span>
            <input
              className={`${inputClass} w-[6ch]`}
              type="number"
              aria-label="Hours"
              min={1}
              max={24}
              value={w.hours}
              onChange={(e) => setWindow(i, { hours: Number(e.target.value) })}
            />
            <span>hours</span>
            <ui-button kind="ghost" size="small" onClick={() => set({ windows: draft.windows.filter((_, j) => j !== i) })}>
              Remove
            </ui-button>
          </div>
        ))}
        {draft.windows.length > 0 && (
          <span className="pl-5">
            <ui-button
              kind="secondary"
              size="small"
              disabled={draft.windows.length >= MAX_WINDOWS || undefined}
              reason={draft.windows.length >= MAX_WINDOWS ? `At most ${MAX_WINDOWS} windows.` : undefined}
              onClick={() => set({ windows: [...draft.windows, { day: (draft.windows.at(-1)!.day + 1) % 7, start: draft.windows.at(-1)!.start, hours: draft.windows.at(-1)!.hours }] })}
            >
              Add a window
            </ui-button>
          </span>
        )}
        <label className="flex flex-wrap gap-2 items-baseline">
          <span>Time zone</span>
          <select className={inputClass} aria-label="Time zone" value={draft.timeZone} onChange={(e) => set({ timeZone: e.target.value })}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z === p.deploymentZone ? `${z} (this deployment’s)` : z}
              </option>
            ))}
          </select>
        </label>
      </Field>

      <div className="flex flex-col gap-2 border-t border-hairline pt-4" aria-live="polite">
        <p className="m-0">
          <span className="text-ink-muted">Now: </span>
          {p.unit.policy}
        </p>
        <p className="m-0" data-after>
          <span className="text-ink-muted">After you save: </span>
          {unchanged ? 'the same.' : policySentence(draft)}
        </p>
        {automatic && draft.windows.length > 0 && next.length > 0 && (
          <div>
            <span className="text-ink-muted text-small">The next windows</span>
            <ul className="m-0 pl-5">
              {next.map((o) => (
                <li key={o.start.toISOString()}>{formatWhen(o.start, draft.timeZone, p.now)}</li>
              ))}
            </ul>
          </div>
        )}
        {problems.map((m) => (
          <p key={m} className="m-0 text-danger">
            {m}
          </p>
        ))}
      </div>

      {error && (
        <p role="alert" className="m-0 text-danger">
          {error}
          {/Nothing was changed/.test(error) ? '' : ' Nothing was changed.'}
        </p>
      )}
      <div className="flex gap-3">
        <ui-button kind="primary" disabled={saveReason ? true : undefined} reason={saveReason} busy={saving || undefined} busy-label="Saving" onClick={() => !saveReason && void save()}>
          Save settings
        </ui-button>
        <ui-button kind="secondary" onClick={p.onDone}>
          Cancel
        </ui-button>
      </div>
      {!unchanged && <Muted>Saving is kept in this unit’s history with your name.</Muted>}
    </form>
  );
};
