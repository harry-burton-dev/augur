import { Details, Dialog, Notice, Section, Select, TextField, type PageAction } from '@augur/app-kit';
import { useCallback, useEffect, useState } from 'react';
import type { AdminApi, Organisation as Settings, OrganisationChanges } from './api.js';
import { Page, Problem } from './parts.js';

/** Whether an organisation's name would work: the server refuses a slash, and a name of only spaces. */
export const orgNameCheck = (value: string) => (value.includes('/') ? { state: 'error' as const, message: 'The organisation’s name can’t have a / in it.' } : null);

/** Identity's bounds for idle accounts: a warning after at least a week, and a week more before the turn-off. */
export const IDLE_LIMITS = { minWarningDays: 7, noticeDays: 7, maxTurnOffDays: 730 } as const;

/** Whether a number of days would work: whole days, within what identity takes. */
export const daysCheck = (min: number, max: number) => (value: string) =>
  /^\d+$/.test(value.trim()) && Number(value) >= min && Number(value) <= max ? null : { state: 'error' as const, message: `Whole days, from ${min} to ${max}.` };

/** What the form changes, from what it holds now: only what differs, so an unchanged form sends nothing. */
export const changesFrom = (now: Settings, values: Record<string, string>): OrganisationChanges => {
  const name = (values.name ?? now.name).trim();
  const timeZone = values.timeZone || now.timeZone;
  const senderName = (values.senderName ?? now.sender.name).trim();
  const senderAddress = (values.senderAddress ?? now.sender.address ?? '').trim();
  const changes: OrganisationChanges = {};
  if (name && name !== now.name) changes.name = name;
  if (timeZone !== now.timeZone) changes.timeZone = timeZone;
  if ((senderName && senderName !== now.sender.name) || senderAddress !== (now.sender.address ?? '')) {
    changes.sender = { name: senderName || now.sender.name, address: senderAddress || null };
  }
  const idle: NonNullable<OrganisationChanges['idle']> = {};
  if (values.idleOn !== undefined && (values.idleOn === 'on') !== now.idle.on) idle.on = values.idleOn === 'on';
  for (const key of ['warningDays', 'turnOffDays'] as const) {
    const raw = values[key]?.trim();
    if (raw && Number(raw) !== now.idle[key]) idle[key] = Number(raw);
  }
  if (Object.keys(idle).length) changes.idle = idle;
  return changes;
};

/** A time zone as people read it: its name, then its offset now ("Europe/London, UTC+0"). */
export const zoneLabel = (zone: string, at = new Date()) => {
  if (zone === 'UTC') return zone;
  try {
    const offset = new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value;
    const words = zone.replace(/_/g, ' ');
    return offset && offset !== zone ? `${words}, ${offset.replace('GMT', 'UTC')}` : words;
  } catch {
    return zone;
  }
};

const changed = (s: Settings) =>
  s.updatedAt ? `Last changed ${new Date(s.updatedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Not changed since AUGUR was set up';

/**
 * The organisation's own settings (ADR 0042): its name, which is its floor's name everyone sees, the time
 * zone dates are shown in, and who email from AUGUR says it is from. Identity keeps them and audits each
 * change; any part of AUGUR reads them from /organisation.
 */
export function Organisation({ api }: { api: AdminApi }) {
  const [settings, setSettings] = useState<Settings>();
  const [zones, setZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSettings(await api.organisation());
      // without the list the zone in force is still offered, so the form still opens
      setZones(await api.timeZones().catch(() => []));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => void load(), [load]);

  const why = error ? 'The organisation’s settings couldn’t be loaded. Try again first.' : 'Wait for the settings to load.';
  const actions: PageAction[] = error
    ? [{ id: 'retry', label: 'Try again' }]
    : [{ id: 'change', label: 'Change', disabled: loading || !settings, reason: why }];
  const zoneOptions = (settings && !zones.includes(settings.timeZone) ? [settings.timeZone, ...zones] : zones).map((z) => ({ value: z, label: zoneLabel(z) }));

  return (
    <Page
      heading="Organisation"
      summary="Its name, the time zone dates are shown in, who AUGUR’s email says it is from, and when idle accounts are turned off. Only an admin changes them; every change is in Activity."
      actions={actions}
      onAction={(a) => (a.id === 'retry' ? void load() : setEditing(true))}
    >
      {error ? <Problem>{error}</Problem> : null}
      {loading && !settings ? <p className="admin-quiet">Loading the organisation’s settings…</p> : null}
      {settings ? (
        <>
          <Section label="Name and time" count={-1} limit={0}>
            <Details
              items={[
                { label: 'Name', value: settings.name, note: 'The organisation’s floor' },
                { label: 'Time zone', value: zoneLabel(settings.timeZone) },
              ]}
            />
          </Section>
          <Section label="Email" count={-1} limit={0}>
            <Details
              missing="Not set"
              items={[
                { label: 'From', value: settings.sender.name },
                { label: 'Address', value: settings.sender.address },
              ]}
            />
            <Notice tone="info" heading="Email from AUGUR uses these.">
              Without an address, email goes from the mail relay’s own. AUGUR’s email picks up a change within a minute; sign-in emails pick it up when the server next restarts its services. Admin → Status says whether email can be sent.
            </Notice>
          </Section>
          <Section label="Idle accounts" count={-1} limit={0}>
            <Details
              items={
                settings.idle.on
                  ? [
                      { label: 'Warned', value: `After ${settings.idle.warningDays} days without a sign-in`, note: 'By email' },
                      { label: 'Turned off', value: `After ${settings.idle.turnOffDays} days without a sign-in` },
                    ]
                  : [{ label: 'Idle accounts', value: 'Never turned off' }]
              }
            />
            <Notice tone="info" heading="Changes apply when AUGUR next starts or upgrades.">
              The sign-in service counts from each person’s next sign-in, and deployment admins are never turned off. Without email nobody could be warned, so nobody is turned off: Admin → Status says whether email works.
            </Notice>
          </Section>
          <p className="admin-quiet">{changed(settings)}</p>
        </>
      ) : null}
      {editing && settings ? (
        <Dialog
          open
          eyebrow="Organisation"
          heading="Change the organisation’s settings"
          summary="A new name renames the organisation’s floor for everyone."
          actionLabel="Save"
          busyLabel="Saving…"
          onSubmit={async (values) => {
            const changes = changesFrom(settings, values);
            if (Object.keys(changes).length) setSettings(await api.setOrganisation(changes));
          }}
          onClose={() => setEditing(false)}
          fields={
            <>
              <TextField name="name" label="Name" required maxLength={100} defaultValue={settings.name} validate={orgNameCheck} />
              <Select name="timeZone" label="Time zone" required options={zoneOptions} defaultValue={settings.timeZone} empty="The list of time zones couldn’t be loaded." />
              <TextField name="senderName" label="Email from" required maxLength={100} defaultValue={settings.sender.name} hint="The name people see on email from AUGUR" />
              <TextField name="senderAddress" label="Sender address" optional type="email" maxLength={254} defaultValue={settings.sender.address ?? ''} hint="Optional. Without one, email goes from the mail relay’s own address" />
              <Select
                name="idleOn"
                label="Idle accounts"
                required
                options={[
                  { value: 'on', label: 'Warn, then turn off' },
                  { value: 'off', label: 'Never turn off' },
                ]}
                defaultValue={settings.idle.on ? 'on' : 'off'}
              />
              <TextField name="warningDays" label="Warn after (days)" required maxLength={3} defaultValue={String(settings.idle.warningDays)} validate={daysCheck(IDLE_LIMITS.minWarningDays, IDLE_LIMITS.maxTurnOffDays - IDLE_LIMITS.noticeDays)} hint="Days without a sign-in before the warning email" />
              <TextField
                name="turnOffDays"
                label="Turn off after (days)"
                required
                maxLength={3}
                defaultValue={String(settings.idle.turnOffDays)}
                validate={daysCheck(IDLE_LIMITS.minWarningDays + IDLE_LIMITS.noticeDays, IDLE_LIMITS.maxTurnOffDays)}
                hint={`At least ${IDLE_LIMITS.noticeDays} days after the warning. Every sign-in starts the count again`}
              />
            </>
          }
        />
      ) : null}
    </Page>
  );
}
