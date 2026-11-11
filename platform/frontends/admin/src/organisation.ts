import type { RemoteNode } from '@augur/mfe-sdk/sdk3';
import type { OrganisationChanges, Security } from './api.js';
import { asking, off, said, waiting } from './common.js';
import { DEPLOYMENT_ADMIN } from './people.js';
import { quill } from './quill.js';
import { pathOf, type SecurityAsk } from './routes.js';
import type { View } from './view.js';

/** Identity's bounds for idle accounts: a warning after at least a week, and a week more before the turn-off. */
export const IDLE_LIMITS = { minWarningDays: 7, noticeDays: 7, maxTurnOffDays: 730 } as const;
/** Identity's bounds for keeping leavers' accounts and Activity, in days. */
export const RETENTION_LIMITS = { leaver: { min: 7, max: 3650 }, activity: { min: 90, max: 3650 } } as const;
/** How long the sign-in notice's title and text may be. */
export const NOTICE_LIMITS = { title: 80, text: 5000 } as const;

/** Why an organisation's name wouldn't work: the server refuses a slash, and a name of only spaces. */
export const orgNameProblem = (value: string) => (!value.trim() ? 'The organisation needs a name.' : value.includes('/') ? 'The organisation’s name can’t have a / in it.' : undefined);

/** Why a number of days wouldn't work: whole days, within what identity takes. */
export const daysProblem = (min: number, max: number, value: string) => (/^\d+$/.test(value.trim()) && Number(value) >= min && Number(value) <= max ? undefined : `Whole days, from ${min} to ${max}.`);

/** A language as people read it: its own name in English, then its tag ("French, fr"). */
export const languageLabel = (tag: string) => {
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(tag);
    return name && name !== tag ? `${name}, ${tag}` : tag;
  } catch {
    return tag;
  }
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

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const APPLIES_LATER = 'Sign-in pages show it when AUGUR next starts or upgrades (the realm job applies it).';

/** What each security and retention rule is called, its bounds, and what a question about changing it says. */
const SECURITY: Record<SecurityAsk['key'], { label: string; bounds?: { min: number; max: number }; question: (value: string) => { heading: string; summary: string } }> = {
  twoStepForAll: {
    label: 'Two steps',
    question: (value) =>
      value === 'on'
        ? { heading: 'Ask everyone for two steps?', summary: 'Everyone sets up a code app or a passkey at their next sign-in. It applies when AUGUR next starts or upgrades.' }
        : { heading: 'Make two steps optional?', summary: 'Anyone may still add a second step, but nobody has to. It applies when AUGUR next starts or upgrades.' },
  },
  leaverRetentionDays: {
    label: 'Keep leavers’ accounts (days)',
    bounds: RETENTION_LIMITS.leaver,
    question: (value) => ({
      heading: `Keep leavers’ accounts ${value} days?`,
      summary: 'After this a leaver’s account is deleted and Activity keeps only an anonymous id. Leavers already past the new number are deleted within minutes, and that can’t be undone.',
    }),
  },
  activityRetentionDays: {
    label: 'Keep Activity (days)',
    bounds: RETENTION_LIMITS.activity,
    question: (value) => ({ heading: `Keep Activity ${value} days?`, summary: 'Older entries are removed at the next nightly run, and that can’t be undone.' }),
  },
};

/** The change a security question makes, from its path. */
export const securityChange = (ask: SecurityAsk): Partial<Security> | string => {
  if (ask.key === 'twoStepForAll') return ask.value === 'on' || ask.value === 'off' ? { twoStepForAll: ask.value === 'on' } : 'Two steps are on or off.';
  const b = SECURITY[ask.key].bounds!;
  const problem = daysProblem(b.min, b.max, ask.value);
  return problem ?? { [ask.key]: Number(ask.value) };
};

/**
 * The organisation's own settings (ADR 0042), each changed where it's shown and saved as it changes: its name,
 * which is its floor's name everyone sees, the time zone dates are shown in, who email from AUGUR says it is from,
 * its logo and sign-in notice, the languages it offers, and its idle-account rules. Security and retention need a
 * deployment admin and the password again, so each change is a question at a path of its own. Identity keeps them
 * all and audits each change.
 */
export const organisationPage = (v: View, ask?: SecurityAsk): RemoteNode => {
  const { organisation } = v.r;
  const wait = waiting([organisation], 'Reading the organisation’s settings');
  if (wait) return wait;
  const s = organisation.value!;
  const save = (where: string, changes: OrganisationChanges) => v.on.act(where, async () => v.on.put('organisation', await v.api.setOrganisation(changes)));
  const zones = v.r.zones.value ?? [];
  const languages = v.r.languages.value ?? [];
  const choices = [...new Set([...s.languages, ...languages])];
  const offered = v.ui.draft.offered ?? s.languages;
  const security = !v.deploymentAdmin && `Only a deployment admin can change these. Ask someone who holds the ${DEPLOYMENT_ADMIN} role.`;
  const askSecurity = (key: SecurityAsk['key'], value: string) => {
    const b = SECURITY[key].bounds;
    const problem = b && daysProblem(b.min, b.max, value);
    if (problem) {
      v.ui.problem = { where: 'security', words: problem };
      return v.on.draw();
    }
    if (String(key === 'twoStepForAll' ? (s.security.twoStepForAll ? 'on' : 'off') : s.security[key]) === value.trim()) return;
    v.on.go(pathOf({ page: 'organisation', ask: { key, value: value.trim() } }));
  };
  const days = (where: string, min: number, max: number, now: number, change: (n: number) => OrganisationChanges) => (typed: string) => {
    if (Number(typed) === now) return;
    const problem = daysProblem(min, max, typed);
    if (problem) {
      v.ui.problem = { where, words: problem };
      return v.on.draw();
    }
    save(where, change(Number(typed)));
  };

  return [
    quill('quill-section', { label: 'Name and time' }, [
      quill('quill-text-field', {
        label: 'Name',
        value: s.name,
        required: true,
        maxLength: 100,
        hint: 'The organisation’s floor: a new name renames it for everyone.',
        onCommit: (typed: string) => {
          if (typed.trim() === s.name) return;
          const problem = orgNameProblem(typed);
          if (problem) {
            v.ui.problem = { where: 'name', words: problem };
            return v.on.draw();
          }
          save('name', { name: typed.trim() });
        },
      }),
      quill('quill-select', {
        label: 'Time zone',
        options: (zones.includes(s.timeZone) ? zones : [s.timeZone, ...zones]).map((z) => ({ value: z, label: zoneLabel(z) })),
        value: s.timeZone,
        empty: 'The list of time zones couldn’t be loaded.',
        onChange: (zone: string) => zone !== s.timeZone && save('name', { timeZone: zone }),
      }),
      said(v, 'name'),
    ]),
    quill('quill-section', { label: 'Logo' }, [
      quill('quill-details', {
        items: [{ label: 'Logo', value: s.logo ? `A PNG, ${s.logo.width} by ${s.logo.height}` : undefined, note: s.logo ? 'Shown on sign-in pages' : undefined }],
        missing: 'None yet: sign-in pages show the organisation’s name on its own',
      }),
      quill('quill-file-button', { label: s.logo ? 'Replace it with a PNG' : 'Choose a PNG', kind: 'secondary', size: 'sm', accept: ['image/png'] }),
      s.logo ? quill('quill-button', { label: 'Remove the logo', kind: 'tertiary', size: 'sm', onPress: () => v.on.act('logo', async () => (await v.api.removeLogo(), v.on.put('organisation', { ...s, logo: undefined }))) }) : null,
      quill('quill-notice', { tone: 'info' }, 'PNG, up to 256 KB and 1024 px on each side, at least 32 px tall. Shown on sign-in pages at once.'),
      said(v, 'logo'),
    ]),
    quill('quill-section', { label: 'Email' }, [
      quill('quill-text-field', {
        label: 'Email from',
        value: s.sender.name,
        required: true,
        maxLength: 100,
        hint: 'The name people see on email from AUGUR',
        onCommit: (typed: string) => typed.trim() && typed.trim() !== s.sender.name && save('email', { sender: { name: typed.trim(), address: s.sender.address ?? null } }),
      }),
      quill('quill-text-field', {
        label: 'Sender address',
        type: 'email',
        optional: true,
        maxLength: 254,
        value: s.sender.address ?? '',
        hint: 'Without one, email goes from the mail relay’s own address',
        onCommit: (typed: string) => typed.trim() !== (s.sender.address ?? '') && save('email', { sender: { name: s.sender.name, address: typed.trim() || null } }),
      }),
      quill('quill-notice', { tone: 'info' }, 'AUGUR’s email picks up a change within a minute; sign-in emails pick it up when the server next restarts its services. Deployment, Health, says whether email can be sent.'),
      said(v, 'email'),
    ]),
    quill('quill-section', { label: 'Sign-in notice' }, [
      quill('quill-details', { items: [{ label: 'Version', value: s.notice.changedAt ? `${s.notice.version}, last changed ${when(s.notice.changedAt)}` : String(s.notice.version) }] }),
      quill('quill-select', {
        label: 'Notice',
        options: [
          { value: 'on', label: 'Show it before people use AUGUR', detail: 'They accept it once' },
          { value: 'off', label: 'Don’t show one' },
        ],
        value: s.notice.on ? 'on' : 'off',
        ...off(!s.notice.on && !(s.notice.title && s.notice.text) && 'Give it a title and text first.'),
        onChange: (x: string) => (x === 'on') !== s.notice.on && save('notice', { notice: { on: x === 'on' } }),
      }),
      quill('quill-text-field', { label: 'Title', optional: true, maxLength: NOTICE_LIMITS.title, value: s.notice.title ?? '', onCommit: (x: string) => x.trim() !== (s.notice.title ?? '') && save('notice', { notice: { title: x.trim() } }) }),
      quill('quill-text-field', {
        label: 'Text',
        optional: true,
        multiline: true,
        rows: 8,
        maxLength: NOTICE_LIMITS.text,
        value: s.notice.text ?? '',
        hint: 'Plain text. Leave a blank line between paragraphs.',
        onCommit: (x: string) => x.trim() !== (s.notice.text ?? '') && save('notice', { notice: { text: x.trim() } }),
      }),
      quill('quill-ask-twice', {
        label: 'Ask everyone again',
        confirm: 'Press again: everyone accepts it again at their next sign-in',
        size: 'sm',
        ...off(!s.notice.on && 'The notice isn’t shown, so there’s nothing to ask.'),
        onPress: () => save('notice', { notice: { askAgain: true } }),
      }),
      quill('quill-notice', { tone: 'info' }, `${APPLIES_LATER} Asking everyone again takes effect at once for everyone whose sign-in is on.`),
      said(v, 'notice'),
    ]),
    quill('quill-section', { label: 'Languages' }, [
      quill('quill-checkbox-group', {
        label: 'Offered',
        options: choices.map((l) => ({ value: l, label: languageLabel(l) })),
        value: offered,
        hint: languages.length ? 'People choose one of these at sign-in and in Account.' : 'The full list couldn’t be loaded, so only those offered now are here.',
        onChange: (chosen: string[]) => {
          v.ui.draft.offered = chosen;
          if (!chosen.length) {
            v.ui.problem = { where: 'languages', words: 'Offer at least one language.' };
            return v.on.draw();
          }
          const ordered = choices.filter((l) => chosen.includes(l));
          save('languages', { languages: ordered, ...(ordered.includes(s.defaultLanguage) ? {} : { defaultLanguage: ordered[0]! }) });
        },
      }),
      quill('quill-select', {
        label: 'Default',
        options: s.languages.map((l) => ({ value: l, label: languageLabel(l) })),
        value: s.defaultLanguage,
        hint: 'For anyone who hasn’t chosen',
        onChange: (x: string) => x !== s.defaultLanguage && save('languages', { defaultLanguage: x }),
      }),
      quill('quill-notice', { tone: 'info' }, APPLIES_LATER),
      said(v, 'languages'),
    ]),
    quill('quill-section', { label: 'Idle accounts' }, [
      quill('quill-select', {
        label: 'Idle accounts',
        options: [
          { value: 'on', label: 'Warn, then turn off' },
          { value: 'off', label: 'Never turn off' },
        ],
        value: s.idle.on ? 'on' : 'off',
        onChange: (x: string) => (x === 'on') !== s.idle.on && save('idle', { idle: { on: x === 'on' } }),
      }),
      quill('quill-text-field', {
        label: 'Warn after (days)',
        value: String(s.idle.warningDays),
        maxLength: 3,
        hint: 'Days without a sign-in before the warning email',
        ...off(!s.idle.on && 'Idle accounts are never turned off.'),
        onCommit: days('idle', IDLE_LIMITS.minWarningDays, IDLE_LIMITS.maxTurnOffDays - IDLE_LIMITS.noticeDays, s.idle.warningDays, (n) => ({ idle: { warningDays: n } })),
      }),
      quill('quill-text-field', {
        label: 'Turn off after (days)',
        value: String(s.idle.turnOffDays),
        maxLength: 3,
        hint: `At least ${IDLE_LIMITS.noticeDays} days after the warning. Every sign-in starts the count again`,
        ...off(!s.idle.on && 'Idle accounts are never turned off.'),
        onCommit: days('idle', IDLE_LIMITS.minWarningDays + IDLE_LIMITS.noticeDays, IDLE_LIMITS.maxTurnOffDays, s.idle.turnOffDays, (n) => ({ idle: { turnOffDays: n } })),
      }),
      quill('quill-notice', { tone: 'info' }, 'Changes apply when AUGUR next starts or upgrades. The sign-in service counts from each person’s next sign-in, and deployment admins are never turned off. Without email nobody could be warned, so nobody is turned off.'),
      said(v, 'idle'),
    ]),
    quill('quill-section', { label: 'Security and retention' }, [
      quill('quill-select', {
        label: SECURITY.twoStepForAll.label,
        options: [
          { value: 'off', label: 'Optional: anyone may add one' },
          { value: 'on', label: 'Everyone', detail: 'A code app or a passkey' },
        ],
        value: s.security.twoStepForAll ? 'on' : 'off',
        ...off(security),
        onChange: (x: string) => askSecurity('twoStepForAll', x),
      }),
      quill('quill-text-field', { label: SECURITY.leaverRetentionDays.label, value: String(s.security.leaverRetentionDays), maxLength: 4, ...off(security), onCommit: (x: string) => askSecurity('leaverRetentionDays', x) }),
      quill('quill-text-field', { label: SECURITY.activityRetentionDays.label, value: String(s.security.activityRetentionDays), maxLength: 4, ...off(security), onCommit: (x: string) => askSecurity('activityRetentionDays', x) }),
      quill(
        'quill-notice',
        { tone: 'info' },
        v.deploymentAdmin
          ? 'You may be asked for your password again before one changes.'
          : 'They change how everyone signs in and what AUGUR keeps, so they need the deployment-admin role and the password entered again. Password and session lengths are set in the server’s .env.',
      ),
      said(v, 'security'),
    ]),
    quill('quill-details', { items: [{ label: 'Last changed', value: s.updatedAt ? when(s.updatedAt) : 'Not since AUGUR was set up', note: 'Every change is in Activity' }] }),
    ask ? securityQuestion(v, ask) : null,
  ];
};

/** A security or retention change, asked at its own path: the password may be entered again first, and it comes back here. */
const securityQuestion = (v: View, ask: SecurityAsk): RemoteNode => {
  const back = pathOf({ page: 'organisation' });
  const change = securityChange(ask);
  const q = SECURITY[ask.key].question(ask.value);
  if (typeof change === 'string' || !v.deploymentAdmin)
    return quill('quill-dialog', { ...asking(v, back), heading: q.heading, cancelLabel: 'Close' }, quill('quill-notice', { tone: 'refused' }, typeof change === 'string' ? change : `Only a deployment admin can change this. Ask someone who holds the ${DEPLOYMENT_ADMIN} role.`));
  return quill('quill-dialog', {
    ...asking(v, back),
    size: 'glance',
    danger: ask.key !== 'twoStepForAll',
    eyebrow: 'Security and retention',
    heading: q.heading,
    summary: `${q.summary} You may be asked for your password first.`,
    actionLabel: 'Change it',
    busyLabel: 'Changing',
    cancelLabel: 'Keep it as it is',
    onSubmit: () => v.on.answer(back, async () => v.on.put('organisation', await v.api.setOrganisation({ security: change }))),
  });
};
