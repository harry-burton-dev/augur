import type { RemoteNode } from '@augur/mfe-sdk/sdk3';
import { DEFAULT_CHOICE, valueWords } from './model/app-settings.js';
import type { AllowedOrigin, AppSettingView, InstalledApp } from './model/types.js';
import { quill } from './quill.js';
import { pathOf, type AppAsk } from './routes.js';
import { when, type View } from './view.js';
import { CHANNEL, NEEDS_DEPLOYMENT_ADMIN } from './words.js';

const open = (state?: string) => state === 'requested' || state === 'running';
const WAIT = 'Wait for the server to finish its current job with this app.';

/** What an app says it fetches from the internet, and from where. */
const internetWords = (i: NonNullable<InstalledApp['internet']>) => `${i.why.length ? i.why.join('; ') : 'It doesn’t say what for'}${i.hosts.length ? ` (it names ${i.hosts.join(', ')})` : ''}.`;

/** Why the server's side of an app can't be changed now, if so: the role, or a job under way. */
const changeWhyNot = (v: View, app: InstalledApp) => (!v.may ? NEEDS_DEPLOYMENT_ADMIN : open(app.job?.state) ? WAIT : undefined);
const off = (why?: string) => (why ? { disabled: true, reason: why } : {});

/** One inline field per setting, drawn for its type, saved as soon as it changes (a choice) or is left (typing). */
const settingField = (v: View, app: InstalledApp, s: AppSettingView, why?: string): RemoteNode => {
  const needed = s.required && s.default === undefined && !s.newIn;
  const hint = [s.detail, s.newIn ? `Version ${s.newIn} needs it before it installs` : undefined];
  const common = { name: `setting:${s.id}`, required: needed, optional: !needed, ...off(why) };
  const save = (raw: string) => v.on.saveSetting(app.app, s.id, raw);
  if (s.type === 'boolean' || s.type === 'enum') {
    const options = [
      ...(s.default !== undefined ? [{ value: DEFAULT_CHOICE, label: `Its default (${valueWords(s, s.default)})` }] : []),
      ...(s.type === 'boolean'
        ? [
            { value: 'true', label: 'On' },
            { value: 'false', label: 'Off' },
          ]
        : (s.options ?? []).map((o) => ({ value: o, label: o }))),
    ];
    const now = s.set && s.value !== undefined ? String(s.value) : DEFAULT_CHOICE;
    return quill('quill-select', { ...common, label: s.label, options, value: now, ...words(hint), onChange: save });
  }
  if (s.type === 'secret')
    return quill('quill-text-field', {
      ...common,
      type: 'password',
      label: s.label,
      required: needed && !s.set,
      maxLength: 4096,
      ...words([...hint, s.set ? 'Given already: leave it empty to keep it, or type a new one to replace it' : undefined]),
      onCommit: (raw: string) => raw && save(raw),
    });
  const unit = s.type === 'number' && s.unit ? ` (${s.unit})` : '';
  return quill('quill-text-field', {
    ...common,
    label: `${s.label}${unit}`,
    maxLength: s.type === 'number' ? 20 : 500,
    value: s.set && s.value !== undefined ? String(s.value) : '',
    ...words([...hint, s.type === 'number' ? `From ${s.min} to ${s.max}` : undefined, s.default !== undefined ? `Empty is its default, ${valueWords(s, s.default)}` : undefined]),
    onCommit: save,
  });
};
const words = (parts: (string | undefined)[]) => {
  const hint = parts.filter(Boolean).join('. ');
  return hint ? { hint } : {};
};

/**
 * What the server runs for an installed app, beyond its releases: its internet, its own settings, who may try its
 * previews, its service's sign-in, and removing it. These were in Admin, Apps; they're the deployment's (ADR 0083).
 */
export const serverSections = (v: View, app: InstalledApp): RemoteNode => {
  const why = changeWhyNot(v, app);
  const ask = (kind: Exclude<AppAsk['kind'], 'roll-back'>) => () => v.on.go(pathOf({ page: 'app', app: app.app, ask: { kind } }));
  const problem = v.ui.problem?.where === 'server' ? quill('quill-notice', { tone: 'refused' }, v.ui.problem.words) : null;
  const developers = (app.developers ?? []).map((id) => ({ kind: 'person' as const, id, name: v.ui.names?.[id] ?? id }));
  return [
    app.internet
      ? quill('quill-section', { label: 'Internet' }, [
          quill('quill-details', {
            items: [
              {
                label: app.internet.allowed ? 'Allowed' : 'Off',
                value: app.internet.allowed ? internetWords(app.internet) : `It asks to reach the internet, which is off until a deployment admin allows it: ${internetWords(app.internet)}`,
                ...(app.internet.allowed && app.internet.allowedAt ? { note: `${v.nameOf(app.internet.allowedBy ?? '')}, ${when(v, app.internet.allowedAt)}` } : {}),
              },
            ],
          }),
          quill('quill-button', { label: app.internet.allowed ? 'Take the internet away' : 'Allow the internet', kind: 'secondary', size: 'sm', ...off(why), onPress: ask('internet') }),
        ])
      : null,
    app.settings?.length
      ? quill('quill-section', { label: 'Settings', count: app.settings.length }, [
          quill('quill-notice', { tone: 'info' }, 'Each is saved as soon as you change it. The parts that read it start again with it within a minute; a secret is never shown again once given.'),
          ...app.settings.map((s) => settingField(v, app, s, why)),
        ])
      : null,
    quill('quill-section', { label: 'Developers', count: developers.length || undefined }, [
      quill('quill-people-picker', {
        label: 'Developers',
        hint: 'They can switch to a preview of any pull request that changes it, for themselves; previews run only while it has developers.',
        kinds: 'people',
        multiple: true,
        value: developers,
        ...(v.ui.found ? { found: v.ui.found } : {}),
        placeholder: 'Type a name',
        ...off(v.may ? undefined : NEEDS_DEPLOYMENT_ADMIN),
        onQuery: (q: string) => v.on.findPeople(q),
        onChange: (people: { id: string; name: string }[]) => v.on.setDevelopers(app.app, people),
      }),
      app.previews?.length
        ? quill('quill-list', {
            label: 'Previews running',
            noun: ['preview', 'previews'],
            density: 'compact',
            items: app.previews.map((p) => ({ id: String(p.pr), title: `#${p.pr}${p.title ? ` ${p.title}` : ''}`, detail: [p.version, `until ${when(v, p.endsAt)}`, p.url].filter(Boolean).join(' · ') })),
          })
        : null,
    ]),
    problem,
    quill('quill-section', { label: 'On the server' }, [
      app.default ? quill('quill-notice', { tone: 'info' }, 'A default app of this deployment (DEFAULT_APPS): what it asks for was agreed by the deployment, apart from the internet, which a deployment admin allows.') : null,
      quill('quill-button', { label: 'Issue a new sign-in', kind: 'tertiary', size: 'sm', ...off(v.may ? undefined : NEEDS_DEPLOYMENT_ADMIN), onPress: ask('new-sign-in') }),
      quill('quill-button', {
        label: 'Remove from the server',
        kind: 'tertiary',
        size: 'sm',
        ...off(app.default ? 'It’s one of this deployment’s default apps: take it out of DEFAULT_APPS in .env and run pc up -d first.' : why),
        onPress: ask('remove'),
      }),
    ]),
  ];
};

/** The questions on an app's page, each at its own path so signing in again comes back to it open. */
export const appQuestion = (v: View, app: InstalledApp, ask: AppAsk, dataGraceDays?: number): RemoteNode => {
  const back = pathOf({ page: 'app', app: app.app });
  const close = () => v.on.closeDialog(back);
  const why = ask.kind === 'new-sign-in' ? (v.may ? undefined : NEEDS_DEPLOYMENT_ADMIN) : changeWhyNot(v, app);
  const common = { open: true, size: 'glance' as const, eyebrow: app.name, busy: v.ui.dialog.busy, cancelLabel: 'Not now', ...(v.ui.dialog.error ? { error: v.ui.dialog.error } : {}), onClose: close };
  const refused = (heading: string, words: string) => quill('quill-notice', { tone: 'refused', heading, action: 'Close', onAction: close }, words);
  const signIn = quill('quill-details', { items: [{ label: 'Sign-in', value: 'You may be asked for your password again.' }] });
  switch (ask.kind) {
    case 'roll-back': {
      const target = app.older?.find((o) => o.version === ask.version);
      const whyNot = why ?? (target ? undefined : `${ask.version} isn’t an earlier release of ${app.name} on its channel.`);
      if (whyNot && !v.ui.dialog.busy) return refused(`Rolling ${app.name} back to ${ask.version} can’t start now`, whyNot);
      return quill(
        'quill-dialog',
        {
          ...common,
          heading: `Roll ${app.name} back to ${ask.version}?`,
          summary: `The app runner pulls ${ask.version}, verifies its signature and starts it in place of ${app.version}. People using ${app.name} may be cut off for a moment.${app.policy === 'automatic' ? ' It’s then on hold, so it doesn’t take the newer release straight back.' : ''}`,
          actionLabel: 'Roll back',
          busyLabel: 'Starting',
          onSubmit: () => v.on.install(app.app, ask.version),
        },
        [quill('quill-details', { items: [{ label: 'Channel', value: CHANNEL[target?.channel ?? app.channel] }] }), signIn],
      );
    }
    case 'remove':
      if (why && !v.ui.dialog.busy) return refused(`${app.name} can’t be removed now`, why);
      if (app.default && !v.ui.dialog.busy) return refused(`${app.name} can’t be removed now`, 'It’s one of this deployment’s default apps: take it out of DEFAULT_APPS in .env and run pc up -d first.');
      return quill(
        'quill-dialog',
        {
          ...common,
          danger: true,
          heading: `Remove ${app.name} from the server?`,
          summary: `Its containers stop and are removed and its sign-in is taken away, so nobody can open it. Its data, settings and floors are kept ${dataGraceDays ? `for ${dataGraceDays} days` : 'for a while'}: install it again before then to get them back. After that they are deleted, a backup taken first.`,
          actionLabel: 'Remove',
          busyLabel: 'Asking',
          cancelLabel: 'Keep it',
          onSubmit: () => v.on.removeApp(app.app),
        },
        signIn,
      );
    case 'internet': {
      const i = app.internet;
      if ((why || !i) && !v.ui.dialog.busy) return refused(`${app.name}’s internet can’t be changed now`, why ?? `${app.name} doesn’t ask to reach the internet.`);
      return quill(
        'quill-dialog',
        {
          ...common,
          heading: i!.allowed ? `Take the internet from ${app.name}?` : `Let ${app.name} reach the internet?`,
          summary: i!.allowed
            ? 'Its parts that ask for it lose it within a minute, without restarting. What they fetch from outside stops.'
            : `Its parts that ask for it can reach any host on the internet within a minute, without restarting; its previews never can. ${internetWords(i!)}`,
          actionLabel: i!.allowed ? 'Turn it off' : 'Allow it',
          danger: !i!.allowed,
          busyLabel: 'Asking',
          onSubmit: () => v.on.setInternet(app.app, !i!.allowed),
        },
        signIn,
      );
    }
    case 'new-sign-in': {
      if (why && !v.ui.dialog.busy) return refused(`A new sign-in for ${app.name} can’t be issued now`, why);
      const issued = v.ui.issued?.app === app.app ? v.ui.issued : undefined;
      if (issued)
        return quill(
          'quill-dialog',
          { ...common, heading: `Give ${app.name}’s service this secret`, summary: `Set it as SERVICE_CLIENT_SECRET where the service runs, then restart it. It signs in as ${issued.clientId}.`, cancelLabel: 'Done' },
          [quill('quill-text-field', { label: 'Secret', value: issued.secret, readOnly: true }), quill('quill-notice', { tone: 'warning' }, 'It won’t be shown again. If it’s lost, issue a new one.')],
        );
      return quill('quill-dialog', {
        ...common,
        danger: true,
        heading: 'Issue a new sign-in?',
        summary: 'The app’s service signs in to AUGUR with a secret. A new one stops the old one working straight away, so the service can’t register, notify or write to the log until it’s given the new one.',
        actionLabel: 'Issue a new sign-in',
        busyLabel: 'Issuing',
        cancelLabel: 'Keep the old one',
        onSubmit: () => v.on.issueSignIn(app.app),
      });
    }
  }
};

/** The sites apps may load from besides AUGUR's own address, on Apps: allow one, and remove one. */
export const originsSection = (v: View): RemoteNode => {
  const o = v.ui.origins;
  const why = v.may ? undefined : NEEDS_DEPLOYMENT_ADMIN;
  return quill('quill-section', { label: 'Where apps load from', count: o?.list?.length || undefined }, [
    quill('quill-list', {
      label: 'Where apps load from',
      noun: ['site', 'sites'],
      density: 'compact',
      loading: !o?.list && !o?.error,
      ...(o?.error ? { error: o.error } : {}),
      empty: 'No other sites yet, so apps can only load from AUGUR’s own address.',
      items: (o?.list ?? []).map((x: AllowedOrigin) => ({
        id: x.origin,
        title: x.origin,
        detail: `Allowed by ${v.nameOf(x.addedBy)}, ${when(v, x.addedAt)}`,
        actions: [{ id: 'remove', label: 'Remove', ...off(why) }],
      })),
      onAction: ({ item }: { item: string }) => v.on.askRemoveOrigin(item),
    }),
    quill('quill-text-field', {
      name: 'origin',
      label: 'Allow a site',
      type: 'url',
      placeholder: 'https://apps.example.org',
      hint: 'An app whose entry is on another site can only register, and only open, if that site is here. The server must allow it too, so the browser will run its code (Deploy, in AUGUR’s guides).',
      value: o?.typed ?? '',
      busy: o?.busy,
      ...off(why),
      onCommit: (origin: string) => origin.trim() && v.on.allowOrigin(origin.trim()),
    }),
    o?.problem ? quill('quill-notice', { tone: 'refused' }, o.problem) : null,
    o?.removing
      ? quill('quill-dialog', {
          open: true,
          size: 'glance',
          danger: true,
          eyebrow: 'Apps',
          heading: `Stop apps loading from ${o.removing}?`,
          summary: 'An app whose entry is on that site stops opening for everyone straight away. Nothing of its data is removed, and allowing the site again brings it back.',
          actionLabel: 'Remove',
          busy: o.busy,
          busyLabel: 'Removing',
          cancelLabel: 'Keep it',
          onSubmit: () => v.on.removeOrigin(o.removing!),
          onClose: () => v.on.askRemoveOrigin(undefined),
        })
      : null,
  ]);
};
