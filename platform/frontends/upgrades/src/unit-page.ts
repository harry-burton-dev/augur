import type { RemoteListItem } from '@augur/app-kit/remote';
import type { RemoteNode } from '@augur/mfe-sdk/sdk3';
import { endingOf, flowSteps } from './model/flow.js';
import { haltedInstallWhyNot, REASON_MAX } from './model/halted.js';
import { levelFrom } from './model/levels.js';
import { gateFor } from './model/roles.js';
import type { AppJob, GoBackTarget, InstalledApp, OverviewUnit, Upgrade } from './model/types.js';
import { AUGUR } from './units.js';
import { quill } from './quill.js';
import { appQuestion, registeredPage, serverSections } from './app-server.js';
import { pathOf, type AppAsk, type Ask } from './routes.js';
import { entriesOf, historyList, rowsOf, statusOf, when, type View } from './view.js';
import { CHANNEL, NEEDS_DEPLOYMENT_ADMIN, STEP } from './words.js';

const busy = (state?: string) => state === 'requested' || state === 'running';
const levelWord = (running: string, to: string) => ({ patch: 'Patch', minor: 'Minor', major: 'Major' })[levelFrom(running, to)];

/** An upgrade as the updater reports it, step by step, and how it ended. One that hasn't started can be cancelled. */
const following = (v: View, up: Upgrade, running: string): RemoteNode => {
  const steps = flowSteps(up);
  const ending = endingOf(up, running);
  const failed = steps.find((s) => s.state === 'failed');
  const u = v.data.updates!;
  return quill('quill-section', { label: `Upgrade to ${up.version}` }, [
    quill('quill-details', {
      items: [
        { label: 'Started by', value: v.nameOf(up.requestedBy, up.requestedByName), note: when(v, up.requestedAt) },
        ...(up.backup ? [{ label: 'Backup', value: up.backup }] : []),
      ],
    }),
    up.state === 'requested' && !up.steps.length
      ? quill(
          'quill-notice',
          { tone: u.updaterSeenAt ? 'info' : 'warning' },
          u.updaterSeenAt ? 'Queued. The updater picks it up within a minute.' : 'No updater has polled for work yet. Cancel this and upgrade by hand (docs/upgrade.md).',
        )
      : null,
    // A failed step shows as where it stopped; the ending below says what happened.
    quill('quill-steps', { label: 'Steps', steps: steps.map((s) => ({ label: s.message ? `${STEP[s.step]}: ${s.message}` : STEP[s.step], state: s.state === 'failed' ? 'now' : s.state })) }),
    up.watch?.checks.length
      ? quill('quill-check-list', {
          label: 'Watch checks',
          rows: up.watch.checks.map((c) => ({ id: c.name, title: c.name, detail: `${String(c.value)} (limit ${String(c.threshold)})${c.ok ? '' : ', over the limit'}`, tone: c.ok ? ('ok' as const) : ('problem' as const) })),
        })
      : null,
    ending
      ? quill(
          'quill-notice',
          { tone: ending.kind === 'failed' ? 'refused' : ending.kind === 'went-back' ? 'warning' : 'info', heading: failed ? `Stopped at: ${STEP[failed.step]}` : undefined },
          ending.kind === 'went-back' ? `Rolled back automatically to ${up.from}: ${up.message ?? `the upgrade to ${up.version} didn’t finish.`}` : ending.words,
        )
      : null,
    up.state === 'requested'
      ? quill('quill-ask-twice', { label: 'Cancel the upgrade', confirm: 'Cancel it', size: 'sm', disabled: !v.may, ...(v.may ? {} : { reason: NEEDS_DEPLOYMENT_ADMIN }), onPress: v.on.cancel })
      : null,
    up.state === 'running' ? quill('quill-notice', { tone: 'info' }, 'It can’t be stopped partway: it finishes, or rolls back automatically.') : null,
    v.ui.problem?.where === 'cancel' ? quill('quill-notice', { tone: 'refused' }, v.ui.problem.words) : null,
  ]);
};

/** A failed or rolled-back result nobody has reviewed yet, with the way to mark it reviewed for every admin. */
const review = (v: View, unit: OverviewUnit): RemoteNode => {
  const r = unit.lastResult;
  if (!r || r.seenBy || (r.state !== 'failed' && r.state !== 'rolled-back')) return null;
  const heading = r.state === 'failed' ? `The last ${r.kind === 'upgrade' ? 'upgrade' : 'install'} failed` : 'The last upgrade rolled back automatically';
  const body = [r.message, `${when(v, r.finishedAt)}.`, v.may ? '' : NEEDS_DEPLOYMENT_ADMIN].filter(Boolean).join(' ');
  return [
    quill('quill-notice', { tone: 'needs', heading, ...(v.may ? { action: 'Mark as reviewed', onAction: () => v.on.markSeen(r.kind, r.id) } : {}) }, body),
    v.ui.problem?.where === 'seen' ? quill('quill-notice', { tone: 'refused' }, v.ui.problem.words) : null,
  ];
};

/** What a unit is set to, at the top of its page. */
const facts = (v: View, unit: OverviewUnit, running: string, extra: { label: string; value: string; note?: string }[] = []): RemoteNode =>
  quill('quill-details', {
    items: [
      { label: 'Running', value: running },
      { label: 'Status', value: statusOf(v, rowsOf(v).find((r) => r.id === unit.unit)!, unit) },
      { label: 'Release channel', value: CHANNEL[unit.desired.channel] },
      { label: 'Update policy', value: unit.policy, ...(unit.automatic?.takes || unit.automatic?.waits ? { note: unit.automatic.takes ?? unit.automatic.waits } : {}) },
      ...extra,
    ],
  });

const rollBackItem = (g: GoBackTarget, why: string | undefined): RemoteListItem => ({
  id: g.version,
  title: g.version,
  detail: g.halted ? `Release halted: ${g.halted.reason}` : g.problem ? g.problem : g.breakingAfter ? `Blocked: ${g.breakingAfter} is a breaking change in between` : 'Can roll back straight away',
  actions: [{ id: 'roll-back', label: `Roll back to ${g.version}`, ...(why ? { disabled: true, reason: why } : {}) }],
});

/** AUGUR's page: what runs, available updates and breaking changes, upgrade, roll back, and its upgrade history. */
export const augurPage = (v: View, ask?: Ask): RemoteNode => {
  const u = v.data.updates!;
  const unit = v.data.overview!.units.find((x) => x.unit === AUGUR);
  if (!unit) return quill('quill-state', { kind: 'error', heading: 'The registry didn’t list AUGUR', body: 'Check it with `pc logs registry`.' });
  const gate = gateFor(v.may);
  const running = u.running.version;
  const underWay = busy(u.upgrade?.state);
  const releases = [...(u.available ? [u.available] : []), ...u.newer.filter((r) => r.version !== u.available?.version)];
  const upgradeWhyNot = (version: string): string | undefined =>
    !v.may ? NEEDS_DEPLOYMENT_ADMIN : underWay ? 'Wait for the upgrade in progress to finish.' : !u.next ? 'Nothing can be upgraded to right now: check for updates first.' : version !== u.next ? `Upgrade to ${u.next} first: AUGUR upgrades one release at a time.` : undefined;
  const testWhyNot = haltedInstallWhyNot(u, gate);
  const rollBackWhyNot = (g: GoBackTarget): string | undefined =>
    !v.may
      ? NEEDS_DEPLOYMENT_ADMIN
      : g.halted
        ? `Release halted: ${g.halted.reason}`
        : g.problem
          ? g.problem
          : g.breakingAfter
            ? `${g.breakingAfter} is a breaking change in between, so rolling back needs the backup (docs/upgrade.md).`
            : underWay
              ? 'Wait for the upgrade in progress to finish.'
              : undefined;
  const prep = u.needsYou.filter((n) => n.kind !== 'halted');
  return [
    u.running.build === 'source'
      ? quill(
          'quill-notice',
          { tone: 'info', heading: 'Built from source' },
          `This server runs AUGUR built from source, so it carries the version of the last release it’s based on (${running}). Upgrading replaces the build with released images.`,
        )
      : null,
    facts(v, unit, running),
    u.upgrade ? following(v, u.upgrade, running) : null,
    review(v, unit),
    quill('quill-section', { label: 'Available updates', count: releases.length || undefined }, [
      quill('quill-list', {
        label: 'Available updates',
        noun: ['release', 'releases'],
        empty: 'Up to date.',
        items: releases.map((r): RemoteListItem => {
          const breaking = r.breaking.length;
          const why = r.halted ? testWhyNot : upgradeWhyNot(r.version);
          return {
            id: r.version,
            title: `AUGUR ${r.version}`,
            detail: r.halted
              ? `Release halted: ${r.halted.reason}. It isn’t offered.`
              : [levelWord(running, r.version), `${CHANNEL[r.channel]} channel`, breaking ? `${breaking} breaking ${breaking === 1 ? 'change' : 'changes'}` : '', r.notesUrl ? `Release notes: ${r.notesUrl}` : '']
                  .filter(Boolean)
                  .join(' · '),
            ...(r.released ? { meta: when(v, r.released) } : {}),
            ...(r.halted ? { status: 'failed' as const } : breaking ? { status: 'warning' as const } : {}),
            actions: [r.halted ? { id: 'test', label: 'Install for a test', ...(why ? { disabled: true, reason: why } : {}) } : { id: 'upgrade', label: `Upgrade to ${r.version}`, ...(why ? { disabled: true, reason: why } : {}) }],
          };
        }),
        onAction: ({ item, action }: { item: string; action: string }) => v.on.go(pathOf({ page: 'augur', ask: { kind: action === 'test' ? 'test' : 'upgrade', version: item } })),
      }),
      prep.length
        ? quill('quill-list', {
            label: 'Before you upgrade',
            density: 'compact',
            look: 'plain',
            items: prep.map((n, i) => ({ id: `${n.kind}-${n.key ?? i}`, title: n.message, ...(n.kind === 'breaking' ? { status: 'warning' as const } : {}) })),
          })
        : null,
    ]),
    quill('quill-section', { label: 'Roll back' }, [
      quill('quill-list', {
        label: 'Roll back',
        noun: ['release', 'releases'],
        empty: 'There’s no earlier release on this channel to roll back to.',
        items: (u.goBack ?? []).slice(0, 5).map((g) => rollBackItem(g, rollBackWhyNot(g))),
        onAction: ({ item }: { item: string }) => v.on.go(pathOf({ page: 'augur', ask: { kind: 'roll-back', version: item } })),
      }),
    ]),
    historyList(v, AUGUR, 'Upgrade history', entriesOf(v)),
    ask ? augurQuestion(v, ask, { upgradeWhyNot, testWhyNot, rollBackWhyNot }) : null,
  ];
};

/** The question a path asks, if it may be asked now; otherwise why not, where the dialog would be. */
const augurQuestion = (
  v: View,
  ask: Ask,
  why: { upgradeWhyNot: (version: string) => string | undefined; testWhyNot?: string; rollBackWhyNot: (g: GoBackTarget) => string | undefined },
): RemoteNode => {
  const u = v.data.updates!;
  const back = pathOf({ page: 'augur' });
  const close = () => v.on.closeDialog(back);
  const common = { open: true, eyebrow: 'AUGUR', busy: v.ui.dialog.busy, busyLabel: 'Starting', cancelLabel: 'Not now', ...(v.ui.dialog.error ? { error: v.ui.dialog.error } : {}), onClose: close };
  const signInHint = 'You may be asked for your password again.';
  if (ask.kind === 'upgrade') {
    const whyNot = why.upgradeWhyNot(ask.version);
    if (whyNot && !v.ui.dialog.busy) return quill('quill-notice', { tone: 'refused', heading: `Upgrading to ${ask.version} can’t start now`, action: 'Close', onAction: close }, whyNot);
    const fields = u.needsYou.filter((n) => n.kind === 'setting' && n.key && !n.madeUp);
    const notes = u.available?.version === ask.version ? u.available.notesUrl : u.newer.find((r) => r.version === ask.version)?.notesUrl;
    return quill(
      'quill-dialog',
      {
        ...common,
        heading: `Upgrade to AUGUR ${ask.version}?`,
        summary: `It backs up first and verifies the backup restores, then deploys ${ask.version} and monitors it for 10 minutes. If anything fails, it rolls back to ${u.running.version} automatically.`,
        actionLabel: 'Upgrade',
        onSubmit: (values: Record<string, string>) => v.on.upgrade(ask.version, Object.fromEntries(Object.entries(values).filter(([k]) => fields.some((f) => f.key === k)))),
      },
      [
        ...fields.map((n) =>
          quill('quill-text-field', {
            slot: 'fields',
            name: n.key!,
            label: n.key!,
            hint: n.required ? 'Required. Leave it empty if it’s already in .env.' : 'Optional.',
          }),
        ),
        quill('quill-choice', {
          slot: 'fields',
          name: 'when',
          label: 'When',
          value: 'now',
          options: [
            { value: 'now', label: 'Upgrade now', detail: 'Expect a minute or two of downtime while the services restart.' },
            { value: 'window', label: 'In the next maintenance window', disabled: true, reason: 'Scheduling an upgrade for a window is coming with the updater’s scheduling. Until then, Automatic takes releases in its window when the policy allows it.' },
          ],
        }),
        quill('quill-list', {
          label: 'Before you upgrade',
          density: 'compact',
          look: 'plain',
          empty: 'Nothing needs doing first.',
          items: u.needsYou.map((n, i) => ({ id: `${n.kind}-${n.key ?? i}`, title: n.message })),
        }),
        quill('quill-details', {
          items: [...(notes ? [{ label: 'Release notes', value: notes }] : []), { label: 'Sign-in', value: `${signInHint} Settings typed here are typed again after.` }],
        }),
      ],
    );
  }
  if (ask.kind === 'roll-back') {
    const target = (u.goBack ?? []).find((g) => g.version === ask.version);
    const whyNot = target ? why.rollBackWhyNot(target) : `${ask.version} isn’t a release AUGUR can roll back to from here.`;
    if (whyNot && !v.ui.dialog.busy) return quill('quill-notice', { tone: 'refused', heading: `Rolling back to ${ask.version} can’t start now`, action: 'Close', onAction: close }, whyNot);
    return quill(
      'quill-dialog',
      {
        ...common,
        heading: `Roll back to AUGUR ${ask.version}?`,
        summary: `Expect a minute or two of downtime while the services restart. It backs up first, as an upgrade does. The code rolls back to ${ask.version}; the data stays as ${u.running.version} left it, since no breaking change is in between.`,
        actionLabel: 'Roll back',
        onSubmit: () => v.on.rollBack(ask.version),
      },
      quill('quill-details', { items: [{ label: 'Sign-in', value: signInHint }] }),
    );
  }
  const release = u.newer.find((r) => r.version === ask.version && r.halted);
  const whyNot = !release ? `${ask.version} isn’t a halted release on this channel.` : why.testWhyNot;
  if (whyNot && !v.ui.dialog.busy) return quill('quill-notice', { tone: 'refused', heading: `${ask.version} can’t be installed for a test now`, action: 'Close', onAction: close }, whyNot);
  return quill(
    'quill-dialog',
    {
      ...common,
      danger: true,
      heading: `Install AUGUR ${ask.version} for a test?`,
      summary: `Its publisher halted this release: ${release?.halted?.reason ?? ''}. Install it only to test that AUGUR rolls back automatically. It upgrades as any release does, and is monitored as any release is; if it passes, it stays until someone rolls back.`,
      actionLabel: 'Install for a test',
      onSubmit: (values: Record<string, string>) => v.on.test(ask.version, values.reason ?? ''),
    },
    [
      quill('quill-text-field', { slot: 'fields', name: 'reason', label: 'Why you’re installing it', hint: 'One line. It goes to the audit log with your name and the version.', required: true, maxLength: REASON_MAX }),
      quill('quill-details', { items: [{ label: 'Sign-in', value: `${signInHint} The reason is typed again after.` }] }),
    ],
  );
};

/** An app's job, as the app runner reports it, in a line. */
const jobWords = (job: AppJob): string => {
  const what = job.action === 'remove' ? 'Uninstalling' : `Installing ${job.release?.version ?? 'it'}`;
  switch (job.state) {
    case 'requested':
      return `${what}: queued for the server.`;
    case 'running':
      return `${what} now.`;
    case 'done':
      return job.action === 'remove' ? 'Uninstalled.' : `Installed ${job.release?.version ?? ''}.`;
    case 'failed':
      return `${what} failed${job.message ? `: ${job.message}` : '.'}`;
    default:
      return `${what} was cancelled.`;
  }
};

/** An app's page: what runs, its update, rolling back, what the server runs for it, and its install history. */
export const appPage = (v: View, id: string, install?: string, ask?: AppAsk): RemoteNode => {
  const unit = v.data.overview!.units.find((x) => x.unit === id);
  const app: InstalledApp | undefined = v.data.installs?.installed.find((a) => a.app === id);
  // Not installed by the app runner: an app its own service registers, or nothing.
  if (!unit && !app) return registeredPage(v, id, ask);
  const running = app?.version ?? unit!.running;
  const jobBusy = busy(app?.job?.state);
  const installWhyNot = !v.may ? NEEDS_DEPLOYMENT_ADMIN : jobBusy ? 'Wait for the server to finish its current job with this app.' : !app ? 'The app runner hasn’t answered, so nothing can be installed now.' : undefined;
  const update = app?.update;
  const back = pathOf({ page: 'app', app: id });
  return [
    unit ? facts(v, unit, running, app ? [{ label: 'Installed', value: when(v, app.installedAt) }] : []) : null,
    app?.job ? quill('quill-notice', { tone: app.job.state === 'failed' ? 'refused' : 'info' }, `${jobWords(app.job)}${app.job.finishedAt ? ` ${when(v, app.job.finishedAt)}.` : ''}`) : null,
    app?.halted ? quill('quill-notice', { tone: 'needs', heading: 'It runs a halted release' }, app.halted.reason) : null,
    unit ? review(v, unit) : null,
    quill('quill-section', { label: 'Available updates', count: update ? 1 : undefined }, [
      quill('quill-list', {
        label: 'Available updates',
        noun: ['release', 'releases'],
        empty: 'Up to date.',
        items: update
          ? [
              {
                id: update.version,
                title: `${app!.name} ${update.version}`,
                detail: update.halted
                  ? `Release halted: ${update.halted.reason}. It isn’t offered.`
                  : [levelWord(running, update.version), `${CHANNEL[update.channel]} channel`, ...update.needs, update.notesUrl ? `Release notes: ${update.notesUrl}` : ''].filter(Boolean).join(' · '),
                ...(update.halted ? { status: 'failed' as const } : update.needs.length ? { status: 'needs' as const } : {}),
                actions: update.halted ? [] : [{ id: 'install', label: `Install ${update.version}`, ...(installWhyNot ? { disabled: true, reason: installWhyNot } : {}) }],
              },
            ]
          : [],
        onAction: ({ item }: { item: string }) => v.on.go(pathOf({ page: 'app', app: id, install: item })),
      }),
    ]),
    quill('quill-section', { label: 'Roll back' }, [
      quill('quill-list', {
        label: 'Roll back',
        noun: ['release', 'releases'],
        empty: 'There’s no earlier release on this channel to roll back to.',
        items: (app?.older ?? []).slice(0, 5).map((o) => ({
          id: o.version,
          title: o.version,
          detail: `${CHANNEL[o.channel]} channel`,
          actions: [{ id: 'roll-back', label: `Roll back to ${o.version}`, ...(installWhyNot ? { disabled: true, reason: installWhyNot } : {}) }],
        })),
        onAction: ({ item }: { item: string }) => v.on.go(pathOf({ page: 'app', app: id, ask: { kind: 'roll-back', version: item } })),
      }),
    ]),
    app ? serverSections(v, app) : null,
    historyList(v, id, 'Install history', entriesOf(v), v.data.jobsError),
    install && app ? installQuestion(v, app, install, installWhyNot, back) : null,
    ask && app ? appQuestion(v, app, ask, v.data.installs?.dataGraceDays) : null,
  ];
};

const installQuestion = (v: View, app: InstalledApp, version: string, whyNot: string | undefined, back: string): RemoteNode => {
  const close = () => v.on.closeDialog(back);
  const offered = app.update && !app.update.halted && app.update.version === version;
  const why = whyNot ?? (offered ? undefined : `${version} isn’t the update on offer for ${app.name}.`);
  if (why && !v.ui.dialog.busy) return quill('quill-notice', { tone: 'refused', heading: `Installing ${app.name} ${version} can’t start now`, action: 'Close', onAction: close }, why);
  return quill(
    'quill-dialog',
    {
      open: true,
      eyebrow: app.name,
      heading: `Install ${app.name} ${version}?`,
      summary: `The server pulls ${version}, verifies its signature and starts it in place of ${app.version}. People using ${app.name} may be cut off for a moment.`,
      actionLabel: 'Install',
      busy: v.ui.dialog.busy,
      busyLabel: 'Starting',
      cancelLabel: 'Not now',
      ...(v.ui.dialog.error ? { error: v.ui.dialog.error } : {}),
      onSubmit: () => v.on.install(app.app, version),
      onClose: close,
    },
    [
      app.update?.needs.length
        ? quill('quill-list', { label: 'It waited for approval because', density: 'compact', look: 'plain', items: app.update.needs.map((n, i) => ({ id: String(i), title: n })) })
        : null,
      quill('quill-details', { items: [{ label: 'Sign-in', value: 'You may be asked for your password again.' }] }),
    ],
  );
};
