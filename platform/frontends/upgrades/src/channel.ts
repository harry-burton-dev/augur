import type { RemoteNode } from '@augur/mfe-sdk/sdk3';
import type { DesiredState, PipelineLine, Stage } from './model/types.js';
import { RING_WORDS } from './model/words.js';
import { quill } from './quill.js';
import { pathOf } from './routes.js';
import type { SettingsView } from './settings.js';
import { HISTORY_STEP, paged, when } from './view.js';
import { CHANNEL } from './words.js';

/** The pipeline's stages in the channels' words: main, then the newest beta or stable, then the newest stable. */
const STAGES: Stage[] = ['dev', 'preview', 'production'];
const STAGE: Record<Stage, string> = { dev: 'Main', preview: CHANNEL.beta, production: CHANNEL.stable };

/** Which stage this server's version of a unit sits at: a dev build counts as main. */
export const stageOf = (u: PipelineLine['units'][number]): Stage | undefined => {
  if (!u.running) return undefined;
  if (u.devBuild?.version === u.running || /-dev\.\d+$/.test(u.running)) return 'dev';
  return STAGES.find((s) => u.versions[s] === u.running);
};

/** Every change of a unit's release channel, newest first: each saved record compared with the one before it. */
export const channelChanges = (history: Record<string, DesiredState[]>, names: Record<string, string>) =>
  Object.entries(history)
    .flatMap(([unit, records]) => {
      const sorted = [...records].sort((a, b) => Date.parse(a.setAt) - Date.parse(b.setAt));
      return sorted.slice(1).flatMap((r, i) => (r.channel === sorted[i]!.channel ? [] : [{ unit, name: names[unit] ?? unit, from: sorted[i]!.channel, to: r.channel, by: r.setBy, at: r.setAt }]));
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

/** The line from main to stable, or why it can't be shown. */
const theLine = (v: SettingsView, l?: PipelineLine): RemoteNode => {
  if (!l || l.feed === 'off')
    return quill(
      'quill-notice',
      { tone: 'info', heading: 'The path to stable can’t be shown' },
      'This deployment has no pipeline feed: it’s read beside the release feed, a mirror has none, and PIPELINE_FEED_URL=off turns it off (docs/release-channels.md, The pipeline feed).',
    );
  const gh = l.repository ? `https://github.com/${l.repository}` : undefined;
  const pulls = [
    ...(l.pulls?.versionPackages ? [{ id: 'version-packages', title: 'Version packages is open', detail: `Merging it cuts the next versions on main · #${l.pulls.versionPackages.number} ${l.pulls.versionPackages.url}` }] : []),
    ...(l.pulls?.promoteToPreview ? [{ id: 'promote-preview', title: `Promote to ${CHANNEL.beta} is open`, detail: `#${l.pulls.promoteToPreview.number} ${l.pulls.promoteToPreview.url}` }] : []),
    ...(l.pulls?.promoteToProduction ?? []).map((p) => ({ id: `promote-${p.number}`, title: `Promote ${l.units.find((x) => x.id === p.unit)?.name ?? p.unit} ${p.version} to ${CHANNEL.stable} is open`, detail: `#${p.number} ${p.url}` })),
  ];
  return [
    l.problem ? quill('quill-notice', { tone: 'warning' }, `${l.problem}${l.units.length ? ' This is from the last read that worked.' : ''}`) : null,
    quill('quill-table', {
      label: 'Path to stable',
      noun: 'component',
      columns: [
        { key: 'component', label: 'Component' },
        ...STAGES.map((s) => ({ key: s, label: STAGE[s] })),
        { key: 'here', label: 'This server', wrap: true },
      ],
      rows: l.units.map((u) => {
        const here = stageOf(u);
        return {
          id: u.id,
          component: u.waiting.length ? `${u.name} (${u.waiting.length === 1 ? '1 change' : `${u.waiting.length} changes`} waiting)` : u.name,
          dev: u.devBuild ? `${u.versions.dev ?? '—'}, dev build ${u.devBuild.version}` : (u.versions.dev ?? '—'),
          preview: u.versions.preview ?? '—',
          production: u.versions.production ?? '—',
          here: !u.running ? 'Not installed' : here ? `${u.running}, at ${STAGE[here]}` : `${u.running}, at none of the stages`,
        };
      }),
      empty: 'The pipeline feed lists nothing yet.',
      ...paged(l.units.length),
    }),
    quill('quill-check-list', {
      label: 'Between the stages',
      rows: [
        ...l.steps.map((s) => ({
          id: `${s.from}-${s.to}`,
          title: s.merged ? `${s.merged === 1 ? '1 pull request' : `${s.merged} pull requests`} on ${STAGE[s.from]} that ${STAGE[s.to]} hasn’t got` : `${STAGE[s.to]} has everything on ${STAGE[s.from]}`,
          ...(s.merged && gh ? { detail: `${gh}/compare/${s.to}...${s.from}` } : {}),
          tone: (s.merged ? 'info' : 'ok') as 'info' | 'ok',
        })),
        ...pulls.map((p) => ({ ...p, tone: 'needs' as const })),
      ],
    }),
    quill(
      'quill-notice',
      { tone: 'info' },
      `Merging and promoting happen in GitHub; only the release owner makes a release stable.${v.data.updates?.portalUrl ? ` Backstage shows every deployment: ${v.data.updates.portalUrl}` : ''}${l.generatedAt ? ` As of ${when(v, l.generatedAt)}.` : ''}`,
    ),
  ];
};

/** Release channel: what this deployment tracks, each release's path to stable, and every change of channel. */
export const channelPage = (v: SettingsView): RemoteNode => {
  const o = v.data.overview!;
  const u = v.data.updates!;
  const names = Object.fromEntries(o.units.map((x) => [x.unit, x.name]));
  const changes = v.settings.history ? channelChanges(v.settings.history, names) : undefined;
  return [
    quill('quill-section', { label: 'This deployment' }, [
      quill('quill-details', {
        items: [
          { label: 'Release channel', value: CHANNEL[u.channel], ...(u.channelNote ? { note: u.channelNote } : {}) },
          { label: 'Server', value: RING_WORDS[o.ring], note: 'The kind of server (SERVER_RING) bounds which channels it may follow.' },
        ],
      }),
      quill('quill-table', {
        label: 'Each component’s channel',
        noun: 'component',
        columns: [
          { key: 'component', label: 'Component' },
          { key: 'channel', label: 'Release channel' },
          { key: 'running', label: 'Running' },
        ],
        rows: o.units.map((x) => ({ id: x.unit, component: x.name, channel: CHANNEL[x.desired.channel], running: x.running })),
        ...paged(o.units.length),
      }),
      quill('quill-button', {
        label: 'Change in Settings',
        kind: 'secondary',
        disabled: !v.may,
        ...(v.may ? {} : { reason: 'Only someone with the deployment-admin role can change the release channel.' }),
        onPress: () => v.on.go(pathOf({ page: 'settings' })),
      }),
    ]),
    quill('quill-section', { label: 'Path to stable' }, theLine(v, u.line)),
    quill('quill-section', { label: 'Channel changes', count: changes?.length || undefined }, [
      v.settings.missing.length ? quill('quill-notice', { tone: 'warning' }, `The settings history of ${v.settings.missing.map((m) => names[m] ?? m).join(', ')} couldn’t be read, so its changes are missing below.`) : null,
      !changes
        ? quill('quill-state', { kind: 'loading', heading: 'Reading the channel changes', size: 'line' })
        : quill('quill-paged-list', {
            label: 'Channel changes',
            noun: 'changes',
            pageSize: HISTORY_STEP,
            empty: 'No component’s release channel has changed here yet.',
            items: changes.map((c) => ({ id: `${c.unit}-${c.at}`, title: `${c.name}: ${CHANNEL[c.from]} to ${CHANNEL[c.to]}`, meta: `${v.nameOf(c.by)}, ${when(v, c.at)}` })),
          }),
    ]),
  ];
};
