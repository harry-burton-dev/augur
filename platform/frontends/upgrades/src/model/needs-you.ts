import type { InstalledApp, Overview } from './types.js';

/** One thing waiting on a person: why it's there, and one action. */
export interface NeedsYouItem {
  key: string;
  kind: 'halted' | 'failed' | 'went-back' | 'approval';
  /** "augur" or an app id. */
  unit: string;
  title: string;
  why: string;
  action: { verb: string; to: string };
  /** A finished result someone can mark looked at, for every admin. */
  result?: { kind: 'upgrade' | 'app-job'; id: string };
}

const unitPath = (unit: string) => (unit === 'augur' ? '/augur' : `/apps/${unit}`);

/**
 * Everything waiting on a person across AUGUR and the apps, worst first: what the
 * registry lists (a halted release being run, a failed or went-back result nobody has
 * looked at), then app releases that wait for a person whatever their policy.
 */
export const needsYou = (overview: Overview, apps: InstalledApp[]): NeedsYouItem[] => {
  const name = (unit: string) => overview.units.find((u) => u.unit === unit)?.name ?? unit;
  const rank = { halted: 0, failed: 1, 'went-back': 2 } as const;
  const listed: NeedsYouItem[] = [...overview.needsYou]
    .sort((a, b) => rank[a.kind] - rank[b.kind])
    .map((n) => ({
      key: `${n.kind}-${n.unit}-${n.result?.id ?? ''}`,
      kind: n.kind,
      unit: n.unit,
      title: n.kind === 'halted' ? `${name(n.unit)} runs a halted release` : n.kind === 'failed' ? `${name(n.unit)}’s upgrade stopped partway` : `${name(n.unit)} went back by itself`,
      why: n.message,
      action: n.kind === 'halted' ? { verb: 'Move off it', to: unitPath(n.unit) } : { verb: 'Open the log', to: n.result ? `/history#${n.result.id}` : '/history' },
      result: n.result,
    }));
  const approvals: NeedsYouItem[] = apps
    .filter((app) => app.update?.needs.length && !app.update.halted)
    .map((app) => ({
      key: `approval-${app.app}-${app.update!.version}`,
      kind: 'approval',
      unit: app.app,
      title: `${app.name} ${app.update!.version} is waiting for you`,
      why: app.update!.needs.join(' '),
      action: { verb: 'Review', to: unitPath(app.app) },
    }));
  return [...listed, ...approvals];
};
