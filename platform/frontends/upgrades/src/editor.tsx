import { Button, Choice, Select, TextField } from '@augur/app-kit';
import { useMemo, useState } from 'react';
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
  const pinProblem = problems.find((m) => m.includes('version range'));
  const unchanged = same(draft, start);
  const automatic = draft.policy === 'automatic';
  const full = draft.windows.length >= MAX_WINDOWS;
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
      <Choice
        label="Releases from"
        name="channel"
        hint={isAugur ? 'AUGUR’s channel is set by RELEASE_CHANNEL in the server’s .env (docs/upgrade.md).' : undefined}
        value={draft.channel}
        onChange={(v) => set({ channel: v as Channel })}
        options={channelsFor(p.ring).map((c) => {
          const allowed = isAugur ? c.channel === start.channel : c.allowed;
          return {
            value: c.channel,
            label: CHANNEL_WORDS[c.channel],
            disabled: !allowed,
            reason: allowed ? undefined : isAugur ? 'Change RELEASE_CHANNEL in .env to follow this.' : c.reason,
          };
        })}
      />

      <Choice
        label="How new releases arrive"
        name="policy"
        value={draft.policy}
        onChange={(v) => set({ policy: v as Policy })}
        options={(['automatic', 'ask', 'hold'] as Policy[]).map((policy) => ({ value: policy, label: POLICY_WORDS[policy], detail: POLICY_HINT[policy] }))}
      />

      <Choice
        label="Automatic takes"
        name="automaticUpTo"
        hint="A major release always waits for an admin."
        disabled={!automatic}
        reason={automatic ? undefined : 'Only Automatic uses this.'}
        value={draft.automaticUpTo}
        onChange={(v) => set({ automaticUpTo: v as AutomaticLevel })}
        options={[
          { value: 'patch', label: 'Patch releases only' },
          { value: 'minor', label: 'Patch and minor releases' },
        ]}
      />

      <div className="flex flex-col gap-3">
        <Choice
          label="Stay within"
          name="pin"
          hint="A pin keeps this unit inside a range of versions, whatever the policy."
          value={pinMode}
          onChange={(v) => set({ pin: v === 'none' ? undefined : v === 'custom' ? customPin || choices[0]!.range : v })}
          options={[
            { value: 'none', label: 'Any version' },
            ...choices.map((c) => ({ value: c.range, label: c.label, detail: c.range })),
            { value: 'custom', label: 'A range of your own', detail: 'Type it below, such as ^1.2.0' },
          ]}
        />
        <TextField
          label="Version range"
          placeholder="^1.2.0"
          value={pinMode === 'custom' ? (draft.pin ?? '') : customPin}
          state={pinMode === 'custom' && pinProblem ? 'error' : undefined}
          message={pinMode === 'custom' ? pinProblem : undefined}
          onChange={(v) => {
            setCustomPin(v);
            set({ pin: v || undefined });
          }}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Choice
          label="When Automatic may start"
          name="when"
          hint="An upgrade an admin starts runs when they ask, whatever the windows."
          disabled={!automatic}
          reason={automatic ? undefined : 'Only Automatic uses windows.'}
          value={draft.windows.length ? 'windows' : 'any'}
          onChange={(v) => set({ windows: v === 'any' ? [] : draft.windows.length ? draft.windows : [{ day: 0, start: '02:00', hours: 2 }] })}
          options={[
            { value: 'any', label: 'At any time' },
            { value: 'windows', label: 'Only in these weekly windows' },
          ]}
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
            <Button kind="ghost" size="sm" onPress={() => set({ windows: draft.windows.filter((_, j) => j !== i) })}>
              Remove
            </Button>
          </div>
        ))}
        {draft.windows.length > 0 && (
          <span className="pl-5">
            <Button
              kind="secondary"
              size="sm"
              disabled={full}
              reason={full ? `At most ${MAX_WINDOWS} windows.` : undefined}
              onPress={() => set({ windows: [...draft.windows, { day: (draft.windows.at(-1)!.day + 1) % 7, start: draft.windows.at(-1)!.start, hours: draft.windows.at(-1)!.hours }] })}
            >
              Add a window
            </Button>
          </span>
        )}
        <Select
          label="Time zone"
          hint="Windows are read in this zone."
          value={draft.timeZone}
          onChange={(v) => set({ timeZone: v })}
          options={zones.map((z) => ({ value: z, label: z === p.deploymentZone ? `${z} (this deployment’s)` : z }))}
        />
      </div>

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
        <Button kind="primary" disabled={Boolean(saveReason)} reason={saveReason} busy={saving} busyLabel="Saving" onPress={() => void save()}>
          Save settings
        </Button>
        <Button kind="secondary" onPress={p.onDone}>
          Cancel
        </Button>
      </div>
      {!unchanged && <Muted>Saving is kept in this unit’s history with your name.</Muted>}
    </form>
  );
};
