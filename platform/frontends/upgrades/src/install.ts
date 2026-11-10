import type { RemoteNode } from '@augur/mfe-sdk/sdk3';
import type { GivenSettings } from './api.js';
import { asksWords } from './model/asks.js';
import type { AppJob, AppSettingDecl, AvailableApp } from './model/types.js';
import { quill } from './quill.js';
import { pathOf } from './routes.js';
import { HISTORY_STEP, when, type View } from './view.js';
import { CHANNEL, NEEDS_DEPLOYMENT_ADMIN } from './words.js';

const open = (job?: AppJob) => job?.state === 'requested' || job?.state === 'running';

/** A form field's name for one of a release's settings, kept apart from the dialog's other fields. */
const fieldOf = (id: string) => `setting:${id}`;

/** The required settings with no default: an install asks for them, as the app can't start without them (spec 5.3). */
export const mustFill = (settings: AppSettingDecl[] = []) => settings.filter((s) => s.required && s.default === undefined);

/** One field for each setting an install must be given: a choice for a choice, hidden typing for a secret. */
export const settingFields = (settings: AppSettingDecl[]): RemoteNode[] =>
  settings.map((s) => {
    const common = { slot: 'fields', name: fieldOf(s.id), label: s.unit ? `${s.label} (${s.unit})` : s.label, required: true, ...(s.detail ? { hint: s.detail } : {}) };
    if (s.type === 'enum') return quill('quill-select', { ...common, options: (s.options ?? []).map((o) => ({ value: o, label: o })) });
    if (s.type === 'boolean')
      return quill('quill-select', {
        ...common,
        options: [
          { value: 'true', label: 'On' },
          { value: 'false', label: 'Off' },
        ],
      });
    return quill('quill-text-field', { ...common, ...(s.type === 'secret' ? { type: 'password' } : {}) });
  });

/** The form's values as each setting's type, or why one isn't right. */
export const givenFrom = (settings: AppSettingDecl[], values: Record<string, string>): { given: GivenSettings } | { problem: string } => {
  const given: GivenSettings = {};
  for (const s of settings) {
    const text = (values[fieldOf(s.id)] ?? '').trim();
    if (!text) return { problem: `${s.label} is needed: the app can’t start without it.` };
    if (s.type === 'number') {
      const n = Number(text);
      if (!Number.isFinite(n) || (s.min !== undefined && n < s.min) || (s.max !== undefined && n > s.max))
        return { problem: `${s.label} takes a number${s.min !== undefined && s.max !== undefined ? ` from ${s.min} to ${s.max}` : ''}${s.unit ? ` ${s.unit}` : ''}.` };
      given[s.id] = n;
    } else given[s.id] = s.type === 'boolean' ? text === 'true' : text;
  }
  return { given };
};

/** Where an install or removal stands, in a line. */
const jobLine = (job: AppJob) => {
  const what = job.action === 'remove' ? 'Uninstalling' : `Installing ${job.release?.version ?? ''}`.trim();
  return job.state === 'requested' ? `${what}: queued for the app runner` : job.state === 'running' ? `${what} now` : job.state === 'failed' ? `${what} failed${job.message ? `: ${job.message}` : ''}` : what;
};

/** Why nothing can be installed now, if so: the role, or no app runner. */
const installWhyNot = (v: View) =>
  !v.may ? NEEDS_DEPLOYMENT_ADMIN : !v.data.installs?.runnerSeenAt ? 'No app runner has asked for work, so nothing can be installed yet (docs/upgrade.md, The app runner).' : undefined;

/** Apps' installing parts: what's under way, what the feed offers, installing from an address, and what's waiting or kept. */
export const installSections = (v: View): RemoteNode => {
  const i = v.data.installs;
  if (!i) return quill('quill-section', { label: 'Install apps' }, quill('quill-state', { kind: 'loading', heading: 'Reading what the app feed offers', size: 'line' }));
  const underWay = [...i.installed, ...i.available].filter((a) => open(a.job));
  const offered = i.available.filter((a) => !open(a.job));
  const waiting = (i.defaultApps ?? []).filter((d) => d.state === 'waiting');
  const whyNot = installWhyNot(v);
  return [
    !i.runnerSeenAt
      ? quill(
          'quill-notice',
          { tone: 'warning', heading: 'No app runner yet' },
          'No app runner has asked for work since the registry started, so nothing can be installed or removed. It’s the updater with APP_SECRETS_KEY set: see docs/upgrade.md, The app runner.',
        )
      : null,
    i.problem ? quill('quill-notice', { tone: 'warning' }, `Not every app release could be read. ${i.problem}`) : null,
    underWay.length
      ? quill('quill-section', { label: 'In progress', count: underWay.length }, quill('quill-check-list', { label: 'In progress', rows: underWay.map((a) => ({ id: a.app, title: a.name, detail: jobLine(a.job!), tone: 'info' as const })) }))
      : null,
    quill('quill-section', { label: 'Install from the app feed', count: offered.length || undefined }, [
      i.feed === 'off'
        ? quill('quill-notice', { tone: 'info', heading: 'The app feed is off' }, 'This server doesn’t read app releases: APP_FEEDS is off, or the release feed is a mirror and APP_FEEDS names none. Apps can still be installed from an address.')
        : quill('quill-paged-list', {
            label: 'Available apps',
            noun: 'apps',
            pageSize: HISTORY_STEP,
            empty: `Nothing new to install.${i.checkedAt ? ` Checked ${when(v, i.checkedAt)}.` : ''}`,
            items: offered.map((a) => ({
              id: `${a.app}@${a.version}`,
              title: `${a.name} ${a.version}`,
              detail: [a.description, a.problem ? `Can’t install here: ${a.problem}` : null, a.job?.state === 'failed' ? jobLine(a.job) : null].filter(Boolean).join(' · ') || undefined,
              meta: `${CHANNEL[a.channel]} channel`,
              ...(a.problem ? { status: 'failed' as const } : {}),
            })),
            onOpen: (item: string) => {
              const at = item.lastIndexOf('@');
              v.on.go(pathOf({ page: 'app', app: item.slice(0, at), install: item.slice(at + 1) }));
            },
          }),
      i.feed === 'off'
        ? null
        : quill('quill-button', { label: 'Check for new apps', kind: 'secondary', busy: v.ui.checkingApps, busyLabel: 'Checking', onPress: v.on.checkApps }),
      quill('quill-button', {
        label: 'Install from an address',
        kind: 'tertiary',
        ...(whyNot ? { disabled: true, reason: whyNot } : {}),
        onPress: () => v.on.go(pathOf({ page: 'apps', address: '' })),
      }),
      v.ui.problem?.where === 'apps' ? quill('quill-notice', { tone: 'refused' }, v.ui.problem.words) : null,
    ]),
    waiting.length
      ? quill(
          'quill-section',
          { label: 'Default apps waiting', count: waiting.length },
          quill('quill-check-list', { label: 'Default apps waiting', rows: waiting.map((d) => ({ id: d.app, title: `${d.app}: not installed yet`, detail: d.problem, tone: 'needs' as const })) }),
        )
      : null,
    i.removed?.length
      ? quill(
          'quill-section',
          { label: 'Removed, data kept', count: i.removed.length },
          quill('quill-check-list', {
            label: 'Removed, data kept',
            rows: i.removed.map((r) => ({
              id: r.app,
              title: `${r.name}: data kept until ${when(v, r.deleteAt)}`,
              detail: r.problem
                ? `Deleting its data failed ${r.failures === 1 ? 'once' : `${r.failures ?? 1} times in a row`}, and is tried again then: ${r.problem}`
                : 'Install it again before then to keep its data, settings and floors.',
              tone: (r.problem ? 'problem' : 'info') as 'problem' | 'info',
            })),
          }),
        )
      : null,
  ];
};

/** Asking to install an app the feed offers, opened at `/apps/<id>/install/<version>`. */
export const newInstallQuestion = (v: View, app: AvailableApp | undefined, id: string, version: string): RemoteNode => {
  const close = () => v.on.closeDialog(pathOf({ page: 'apps' }));
  const why = installWhyNot(v) ?? (!app ? `${id} ${version} isn’t on offer from the app feed now.` : app.problem ? `It can’t install here: ${app.problem}` : open(app.job) ? 'It’s being installed already.' : undefined);
  if (why && !v.ui.dialog.busy) return quill('quill-notice', { tone: 'refused', heading: `Installing ${app?.name ?? id} ${version} can’t start now`, action: 'Close', onAction: close }, why);
  const fill = mustFill(app!.review?.settings);
  return quill(
    'quill-dialog',
    {
      open: true,
      eyebrow: 'Apps',
      heading: `Install ${app!.name} ${version}?`,
      summary: 'The app runner checks its signature, makes what it asks for and starts it. People see it once it answers; if it doesn’t, nothing changes.',
      actionLabel: 'Install',
      busy: v.ui.dialog.busy,
      busyLabel: 'Starting',
      cancelLabel: 'Not now',
      ...(v.ui.dialog.error ? { error: v.ui.dialog.error } : {}),
      onSubmit: (values: Record<string, string>) => v.on.install(app!.app, version, fill, values ?? {}),
      onClose: close,
    },
    [
      ...settingFields(fill),
      app!.asks ? quill('quill-list', { label: 'It asks to', density: 'compact', look: 'plain', items: asksWords(app!.asks, app!.review, app!.signer).map((w, n) => ({ id: String(n), title: w })) }) : null,
      quill('quill-details', {
        items: [
          ...(app!.notesUrl ? [{ label: 'Release notes', value: app!.notesUrl }] : []),
          { label: 'Sign-in', value: `You may be asked for your password again.${fill.length ? ' The settings are typed again after.' : ''}` },
        ],
      }),
    ],
  );
};

/** Installing from a release file's address: first the address, then what the release asks for. */
export const addressQuestion = (v: View, url: string): RemoteNode => {
  const close = () => v.on.closeDialog(pathOf({ page: 'apps' }));
  const whyNot = installWhyNot(v);
  if (whyNot && !v.ui.dialog.busy) return quill('quill-notice', { tone: 'refused', heading: 'Installing from an address can’t start now', action: 'Close', onAction: close }, whyNot);
  const common = { open: true, eyebrow: 'Apps', busy: v.ui.dialog.busy, cancelLabel: 'Not now', ...(v.ui.dialog.error ? { error: v.ui.dialog.error } : {}), onClose: close };
  const read = v.ui.pasted?.url === url ? v.ui.pasted.read : undefined;
  if (!read)
    return quill(
      'quill-dialog',
      {
        ...common,
        heading: 'Install from a release file’s address',
        summary: 'For an app no feed lists: give the address of its app-release.json. It is read over https and checked as the feed’s are, and you see what it asks for before anything is installed.',
        actionLabel: 'Read it',
        busyLabel: 'Reading',
        onSubmit: (values: Record<string, string>) => v.on.readAddress((values?.url ?? '').trim()),
      },
      [
        quill('quill-text-field', { slot: 'fields', name: 'url', label: 'Release file address', type: 'url', value: url, placeholder: 'https://…/app-release.json', required: true }),
        quill('quill-details', { items: [{ label: 'Sign-in', value: 'You may be asked for your password again.' }] }),
      ],
    );
  const name = typeof read.release.manifest?.name === 'string' ? read.release.manifest.name : read.release.id;
  const fill = mustFill(read.review?.settings);
  return quill(
    'quill-dialog',
    {
      ...common,
      heading: `Install ${name} ${read.release.version}?`,
      summary: 'No feed lists it: later versions are installed the same way, from their address. The app runner checks its signature, makes what it asks for and starts it.',
      actionLabel: 'Install',
      busyLabel: 'Starting',
      onSubmit: (values: Record<string, string>) => v.on.installPasted(fill, values ?? {}),
    },
    [
      ...settingFields(fill),
      read.warnings.length ? quill('quill-notice', { tone: 'warning' }, read.warnings.join(' ')) : null,
      read.asks ? quill('quill-list', { label: 'It asks to', density: 'compact', look: 'plain', items: asksWords(read.asks, read.review, read.signer).map((w, n) => ({ id: String(n), title: w })) }) : null,
      quill('quill-details', { items: [{ label: 'Read from', value: url }] }),
    ],
  );
};
