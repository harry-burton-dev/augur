import { Checkbox, CheckboxGroup, Details, Dialog, DropZone, Notice, Section, Select, TextField, type PageAction } from '@augur/app-kit';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, type AdminApi, type Organisation as Settings, type OrganisationChanges, type Security, type SignInNotice } from './api.js';
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

/** Identity's bounds for keeping leavers' accounts and Activity, in days. */
export const RETENTION_LIMITS = { leaver: { min: 7, max: 3650 }, activity: { min: 90, max: 3650 } } as const;
/** How long the sign-in notice's title and text may be. */
export const NOTICE_LIMITS = { title: 80, text: 5000 } as const;
/** The role that changes security and retention, after entering the password again (ADR 0022). */
export const DEPLOYMENT_ADMIN = 'deployment-admin';

/** The sign-in notice's changes from the form: only what differs, and whether to ask everyone again. */
export const noticeChangesFrom = (now: SignInNotice, values: Record<string, string>): NonNullable<OrganisationChanges['notice']> | undefined => {
  const changes: NonNullable<OrganisationChanges['notice']> = {};
  const on = values.noticeOn === undefined ? now.on : values.noticeOn === 'on';
  if (on !== now.on) changes.on = on;
  const title = values.noticeTitle?.trim();
  const text = values.noticeText?.trim();
  if (title !== undefined && title !== (now.title ?? '')) changes.title = title;
  if (text !== undefined && text !== (now.text ?? '')) changes.text = text;
  if (on && values.askAgain === 'yes') changes.askAgain = true;
  return Object.keys(changes).length ? changes : undefined;
};

/** Security and retention's changes from the form: only what differs. */
export const securityChangesFrom = (now: Security, values: Record<string, string>): Partial<Security> | undefined => {
  const changes: Partial<Security> = {};
  if (values.twoStepForAll !== undefined && (values.twoStepForAll === 'on') !== now.twoStepForAll) changes.twoStepForAll = values.twoStepForAll === 'on';
  for (const key of ['leaverRetentionDays', 'activityRetentionDays'] as const) {
    const raw = values[key]?.trim();
    if (raw && Number(raw) !== now[key]) changes[key] = Number(raw);
  }
  return Object.keys(changes).length ? changes : undefined;
};

/** A language as people read it: its own name in English, then its tag ("French, fr"). */
export const languageLabel = (tag: string) => {
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(tag);
    return name && name !== tag ? `${name}, ${tag}` : tag;
  } catch {
    return tag;
  }
};

/** Where the password is entered again before security and retention change; back to the same form after. */
const SECURITY_DRAFT = 'augur-admin-security-draft';
const signInAgain = (values: Record<string, string>) => {
  try {
    window.sessionStorage.setItem(SECURITY_DRAFT, JSON.stringify(values));
  } catch {
    // Without storage the form opens with the values in force; nothing was saved either way.
  }
  window.location.assign(`/auth/again?return=${encodeURIComponent(`${window.location.pathname}?edit=security`)}`);
};
/** The form's values from before entering the password again, once. */
const securityDraft = (): Record<string, string> | undefined => {
  try {
    const raw = window.sessionStorage.getItem(SECURITY_DRAFT);
    window.sessionStorage.removeItem(SECURITY_DRAFT);
    return raw ? (JSON.parse(raw) as Record<string, string>) : undefined;
  } catch {
    return undefined;
  }
};

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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

const changed = (s: Settings) => (s.updatedAt ? `Last changed ${when(s.updatedAt)}` : 'Not changed since AUGUR was set up');

type Editing = 'general' | 'notice' | 'languages' | 'security';

/**
 * The organisation's own settings (ADR 0042): its name, which is its floor's name everyone sees, the time
 * zone dates are shown in, who email from AUGUR says it is from, its logo and sign-in notice, the languages
 * it offers, and its security and retention rules. Identity keeps them and audits each change; any part of
 * AUGUR reads them from /organisation. `roles` are the signed-in admin's, to say who can change what.
 */
export function Organisation({ api, roles = [] }: { api: AdminApi; roles?: string[] }) {
  const [settings, setSettings] = useState<Settings>();
  const [zones, setZones] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [offered, setOffered] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Editing>();
  const [draft, setDraft] = useState<Record<string, string>>();
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState('');
  const deploymentAdmin = roles.includes(DEPLOYMENT_ADMIN);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const now = await api.organisation();
      setSettings(now);
      // without the lists the values in force are still offered, so the forms still open
      setZones(await api.timeZones().catch(() => []));
      setLanguages(await api.signInLanguages().catch(() => []));
      // Back from entering the password again: the security form, as it was left.
      const params = new URLSearchParams(window.location.search);
      if (params.get('edit') === 'security') {
        params.delete('edit');
        const rest = params.toString();
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
        setDraft(securityDraft());
        setEditing('security');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => void load(), [load]);

  const save = async (changes: OrganisationChanges, values: Record<string, string> = {}) => {
    if (!Object.keys(changes).length) return;
    try {
      setSettings(await api.setOrganisation(changes));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'sign_in_again') {
        signInAgain(values);
        return false;
      }
      throw err;
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file || !settings) return;
    setLogoBusy(true);
    setLogoError('');
    try {
      const logo = await api.setLogo(file);
      setSettings({ ...settings, logo });
    } catch (err) {
      setLogoError((err as Error).message);
    } finally {
      setLogoBusy(false);
    }
  };
  const removeLogo = async () => {
    if (!settings) return;
    setLogoError('');
    try {
      await api.removeLogo();
      setSettings({ ...settings, logo: undefined });
    } catch (err) {
      setLogoError((err as Error).message);
    }
  };

  const why = error ? 'The organisation’s settings couldn’t be loaded. Try again first.' : 'Wait for the settings to load.';
  const actions: PageAction[] = error
    ? [{ id: 'retry', label: 'Try again' }]
    : [{ id: 'change', label: 'Change', disabled: loading || !settings, reason: why }];
  const zoneOptions = (settings && !zones.includes(settings.timeZone) ? [settings.timeZone, ...zones] : zones).map((z) => ({ value: z, label: zoneLabel(z) }));
  const languageChoices = settings ? [...new Set([...settings.languages, ...languages])] : languages;
  const sentence = (s: Settings) => (s.notice.changedAt ? `Version ${s.notice.version}, last changed ${when(s.notice.changedAt)}` : `Version ${s.notice.version}`);
  const appliesLater = 'Sign-in pages show it when AUGUR next starts or upgrades (the realm job applies it).';

  return (
    <Page
      heading="Organisation"
      summary="Its name, time zone, email sender, logo, sign-in notice and languages, and how long accounts and Activity are kept. Admins change them; security and retention need a deployment admin. Every change is in Activity."
      actions={actions}
      onAction={(a) => (a.id === 'retry' ? void load() : setEditing('general'))}
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
          <Section label="Logo" count={-1} limit={0} {...(settings.logo ? { action: 'Remove', onAction: () => void removeLogo() } : {})}>
            {settings.logo ? (
              <img className="admin-logo" src={settings.logo.url} alt={`${settings.name}’s logo`} width={settings.logo.width} height={settings.logo.height} />
            ) : (
              <p className="admin-quiet">No logo yet: sign-in pages show the organisation’s name on its own.</p>
            )}
            <DropZone
              compact
              multiple={false}
              accept="image/png"
              heading={settings.logo ? 'Drop a PNG here to replace it' : 'Drop a PNG here'}
              hint="PNG, up to 256 KB and 1024 px on each side, at least 32 px tall. Shown on sign-in pages at once."
              action="Choose a PNG"
              busy={logoBusy}
              onFiles={(files) => void upload(files[0])}
              onReject={() => setLogoError('That isn’t a PNG. Save the logo as a PNG and try again.')}
            />
            <Problem>{logoError}</Problem>
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
          <Section label="Sign-in notice" count={-1} limit={0} action="Change notice" onAction={() => setEditing('notice')}>
            <Details
              missing="None"
              items={
                settings.notice.on
                  ? [
                      { label: 'Shown', value: 'Before people first use AUGUR', note: 'They accept it once' },
                      { label: 'Title', value: settings.notice.title },
                      { label: 'Version', value: sentence(settings) },
                    ]
                  : [{ label: 'Shown', value: 'Not shown', note: 'Nobody is asked' }]
              }
            />
            <Notice tone="info" heading="People read and accept it at sign-in.">
              {appliesLater} Asking everyone again takes effect at once for everyone whose sign-in is on.
            </Notice>
          </Section>
          <Section label="Languages" count={-1} limit={0} action="Change languages" onAction={() => {
            setOffered(settings.languages);
            setEditing('languages');
          }}>
            <Details
              items={[
                { label: 'Offered', value: settings.languages.map(languageLabel).join('; ') },
                { label: 'Default', value: languageLabel(settings.defaultLanguage), note: 'Until someone chooses' },
              ]}
            />
            <Notice tone="info" heading="People choose from these in Account at once.">
              {appliesLater}
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
          <Section label="Security and retention" count={-1} limit={0} {...(deploymentAdmin ? { action: 'Change rules', onAction: () => setEditing('security') } : {})}>
            <Details
              items={[
                { label: 'Two steps', value: settings.security.twoStepForAll ? 'Everyone' : 'Optional', note: 'A code app or a passkey' },
                { label: 'Leavers', value: `Kept ${settings.security.leaverRetentionDays} days after they leave` },
                { label: 'Activity', value: `Kept ${settings.security.activityRetentionDays} days` },
              ]}
            />
            {deploymentAdmin ? (
              <Notice tone="info" heading="You’ll enter your password again to change these.">
                Two steps for everyone applies when AUGUR next starts or upgrades; Activity’s retention at the next nightly run. Leavers already past their days are deleted within minutes of lowering the number, and that can’t be undone.
              </Notice>
            ) : (
              <Notice tone="info" heading="Only a deployment admin can change these.">
                They change how everyone signs in and what AUGUR keeps, so they need the deployment-admin role and the password entered again. Password and session lengths are set in the server’s .env (AUGUR’s docs, Settings and secrets).
              </Notice>
            )}
          </Section>
          <p className="admin-quiet">{changed(settings)}</p>
        </>
      ) : null}
      {editing === 'general' && settings ? (
        <Dialog
          open
          eyebrow="Organisation"
          heading="Change the organisation’s settings"
          summary="A new name renames the organisation’s floor for everyone."
          actionLabel="Save"
          busyLabel="Saving…"
          onSubmit={(values) => save(changesFrom(settings, values))}
          onClose={() => setEditing(undefined)}
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
      {editing === 'notice' && settings ? (
        <Dialog
          open
          eyebrow="Organisation"
          heading="Change the sign-in notice"
          summary="People read and accept it before they first use AUGUR. Leave a blank line between paragraphs."
          actionLabel="Save"
          busyLabel="Saving…"
          onSubmit={(values) => {
            const notice = noticeChangesFrom(settings.notice, values);
            return save(notice ? { notice } : {});
          }}
          onClose={() => setEditing(undefined)}
          fields={
            <>
              <Select
                name="noticeOn"
                label="Notice"
                required
                options={[
                  { value: 'on', label: 'Show it before people use AUGUR' },
                  { value: 'off', label: 'Don’t show one' },
                ]}
                defaultValue={settings.notice.on ? 'on' : 'off'}
              />
              <TextField name="noticeTitle" label="Title" optional maxLength={NOTICE_LIMITS.title} defaultValue={settings.notice.title ?? ''} hint="Needed when the notice is shown" />
              <TextField name="noticeText" label="Text" optional multiline rows={8} maxLength={NOTICE_LIMITS.text} defaultValue={settings.notice.text ?? ''} hint="Plain text. Needed when the notice is shown" />
              <Select
                name="askAgain"
                label="Who is asked"
                required
                options={[
                  { value: 'no', label: 'New people, and anyone not yet asked' },
                  { value: 'yes', label: 'Everyone again, at their next sign-in' },
                ]}
                defaultValue={settings.notice.on ? 'no' : 'yes'}
                hint="Ask everyone again when the notice changes in substance"
              />
            </>
          }
        />
      ) : null}
      {editing === 'languages' && settings ? (
        <Dialog
          open
          eyebrow="Organisation"
          heading="Change the languages offered"
          summary="People choose one of these at sign-in and in Account. Every word on the sign-in pages comes in each of them."
          actionLabel="Save"
          busyLabel="Saving…"
          onSubmit={(values) => {
            const chosen = languageChoices.filter((l) => offered.includes(l));
            if (!chosen.length) throw new Error('Offer at least one language.');
            const defaultLanguage = values.defaultLanguage && chosen.includes(values.defaultLanguage) ? values.defaultLanguage : chosen[0]!;
            const changes: OrganisationChanges = {};
            if (chosen.join() !== settings.languages.join()) changes.languages = chosen;
            if (defaultLanguage !== settings.defaultLanguage) changes.defaultLanguage = defaultLanguage;
            return save(changes);
          }}
          onClose={() => setEditing(undefined)}
          fields={
            <>
              <CheckboxGroup label="Offered" value={offered} onChange={setOffered} hint={languages.length ? undefined : 'The full list couldn’t be loaded, so only those offered now are here.'}>
                {languageChoices.map((l) => (
                  <Checkbox key={l} value={l}>
                    {languageLabel(l)}
                  </Checkbox>
                ))}
              </CheckboxGroup>
              <Select
                name="defaultLanguage"
                label="Default"
                required
                options={(offered.length ? languageChoices.filter((l) => offered.includes(l)) : settings.languages).map((l) => ({ value: l, label: languageLabel(l) }))}
                defaultValue={settings.defaultLanguage}
                hint="For anyone who hasn’t chosen; if it isn’t offered, the first one offered is"
              />
            </>
          }
        />
      ) : null}
      {editing === 'security' && settings ? (
        <Dialog
          open
          eyebrow="Organisation"
          heading="Change security and retention"
          summary="These change how everyone signs in and what AUGUR keeps. You may be asked for your password first; what you entered here is kept until you’re back."
          actionLabel="Save"
          busyLabel="Saving…"
          onSubmit={(values) => {
            const security = securityChangesFrom(settings.security, values);
            return save(security ? { security } : {}, values);
          }}
          onClose={() => {
            setEditing(undefined);
            setDraft(undefined);
          }}
          fields={
            <>
              <Select
                name="twoStepForAll"
                label="Two steps"
                required
                options={[
                  { value: 'off', label: 'Optional: anyone may add one' },
                  { value: 'on', label: 'Everyone' },
                ]}
                defaultValue={draft?.twoStepForAll ?? (settings.security.twoStepForAll ? 'on' : 'off')}
                hint="Everyone sets up a code app or a passkey at their next sign-in"
              />
              <TextField
                name="leaverRetentionDays"
                label="Keep leavers’ accounts (days)"
                required
                maxLength={4}
                defaultValue={draft?.leaverRetentionDays ?? String(settings.security.leaverRetentionDays)}
                validate={daysCheck(RETENTION_LIMITS.leaver.min, RETENTION_LIMITS.leaver.max)}
                hint="After this a leaver’s account is deleted and Activity keeps only an anonymous id"
              />
              <TextField
                name="activityRetentionDays"
                label="Keep Activity (days)"
                required
                maxLength={4}
                defaultValue={draft?.activityRetentionDays ?? String(settings.security.activityRetentionDays)}
                validate={daysCheck(RETENTION_LIMITS.activity.min, RETENTION_LIMITS.activity.max)}
                hint="Older entries are removed every night"
              />
            </>
          }
        />
      ) : null}
    </Page>
  );
}
