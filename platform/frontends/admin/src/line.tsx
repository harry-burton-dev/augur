import { Notice, Rows, Section, Status } from '@augur/app-kit';
import { useEffect, useState } from 'react';
import type { AdminApi, PipelineLine, PlatformUpdates } from './api.js';
import { Line, Page, Problem, Quiet } from './parts.js';

const BRANCHES = ['dev', 'preview', 'production'] as const;
const branchWord = { dev: 'Dev', preview: 'Preview', production: 'Production' } as const;

/** Each unit's system in the company's Backstage, by the catalog's names (catalog/, `pnpm catalog`). */
export const portalLink = (portalUrl: string | undefined, unit: string) => (portalUrl ? `${portalUrl}/catalog/default/system/${unit === 'augur' ? 'augur-platform' : unit}` : undefined);

/** Which branch this server's version of a unit is: a dev build counts as dev. Undefined when it's none of them. */
export const placeOf = (u: PipelineLine['units'][number]): (typeof BRANCHES)[number] | undefined => {
  if (!u.running) return undefined;
  if (u.devBuild?.version === u.running || /-dev\.\d+$/.test(u.running)) return 'dev';
  return BRANCHES.find((b) => u.versions[b] === u.running);
};

const Cell = ({ text, here, sub }: { text?: string | null; here: boolean; sub?: string }) => (
  <span className="admin-line-cell" data-here={here ? 'true' : undefined}>
    <span>{text ?? '—'}</span>
    {sub ? <Quiet>{sub}</Quiet> : null}
  </span>
);

const Out = ({ href, children }: { href: string; children: string }) => (
  <a href={href} target="_blank" rel="noopener">
    {children}
  </a>
);

/**
 * The line from dev to production: each unit's version on each branch, where this server is on it, and
 * what's waiting between the branches. It shows and links, and never acts: merging and promoting stay in
 * GitHub (docs/release-channels.md).
 */
export function TheLine({ line: l, portalUrl }: { line?: PipelineLine; portalUrl?: string }) {
  if (!l || l.feed === 'off') {
    return (
      <Section label="The line" count={-1} limit={0}>
        <p data-line-off className="admin-flat admin-muted">
          This server has no pipeline feed, so where each part is between dev, preview and production can’t be shown. It’s read beside the release feed on GitHub’s container registry; a mirror has none, and{' '}
          <code>PIPELINE_FEED_URL=off</code> turns it off.
        </p>
      </Section>
    );
  }
  const gh = l.repository ? `https://github.com/${l.repository}` : undefined;
  return (
    <Section label="The line" count={-1} limit={0}>
      <div data-line className="admin-stack-wide">
        {l.problem ? <Status status="warning" label={`${l.problem}${l.units.length ? ' This is from the last read that worked.' : ''}`} /> : null}
        <div className="admin-line-scroll">
          <div className="admin-line-grid admin-line-head">
            <span>Part</span>
            {BRANCHES.map((b) => (
              <span key={b}>{branchWord[b]}</span>
            ))}
            <span>This server</span>
          </div>
          {l.units.map((u) => {
            const here = placeOf(u);
            const link = portalLink(portalUrl, u.id);
            return (
              <div key={u.id} data-unit={u.id} className="admin-line-grid">
                <span className="admin-line-cell">
                  {link ? <Out href={link}>{u.name}</Out> : u.name}
                  {u.waiting.length ? <Quiet>{u.waiting.length === 1 ? '1 change waiting' : `${u.waiting.length} changes waiting`}</Quiet> : null}
                </span>
                <Cell text={u.versions.dev} here={here === 'dev'} sub={u.devBuild ? `dev build ${u.devBuild.version}` : undefined} />
                <Cell text={u.versions.preview} here={here === 'preview'} />
                <Cell text={u.versions.production} here={here === 'production'} />
                <Cell text={u.running ?? 'Not on this server'} here={false} sub={u.running && !here ? 'on none of the branches' : undefined} />
              </div>
            );
          })}
        </div>
        {l.steps.map((s) => (
          <Line key={`${s.from}-${s.to}`} data-step={`${s.from}-${s.to}`} end={s.merged && gh ? <Out href={`${gh}/compare/${s.to}...${s.from}`}>See them on GitHub</Out> : undefined}>
            {s.merged ? `${s.merged === 1 ? '1 pull request' : `${s.merged} pull requests`} on ${branchWord[s.from]} that ${branchWord[s.to]} hasn’t got` : `${branchWord[s.to]} has everything on ${branchWord[s.from]}`}
          </Line>
        ))}
        {l.pulls?.versionPackages ? <Line end={<Out href={l.pulls.versionPackages.url}>{`#${l.pulls.versionPackages.number}`}</Out>}>Version packages is open: merging it cuts the versions on dev</Line> : null}
        {l.pulls?.promoteToPreview ? <Line end={<Out href={l.pulls.promoteToPreview.url}>{`#${l.pulls.promoteToPreview.number}`}</Out>}>Promote to preview is open</Line> : null}
        {(l.pulls?.promoteToProduction ?? []).map((p) => (
          <Line key={p.number} end={<Out href={p.url}>{`#${p.number}`}</Out>}>
            Promote {p.unit} {p.version} to production is open
          </Line>
        ))}
        <p className="admin-flat admin-muted">
          Merging and promoting happen in GitHub
          {portalUrl ? (
            <>
              , and the company portal shows every deployment: <Out href={portalUrl}>open Backstage</Out>
            </>
          ) : null}
          . {l.generatedAt ? `As of ${new Date(l.generatedAt).toLocaleString()}.` : null}
        </p>
      </div>
    </Section>
  );
}

/**
 * From dev to production. Upgrading, going back and the history moved to the
 * Upgrade Centre (ADR 0030), which this page sends you to; the line, which the
 * Upgrade Centre doesn't show yet, stays here.
 */
export function Pipeline({ api, openUpgrades }: { api: AdminApi; openUpgrades: () => void }) {
  const [updates, setUpdates] = useState<PlatformUpdates>();
  const [error, setError] = useState('');
  useEffect(() => {
    api.updates().then(setUpdates, (err: Error) => setError(err.message));
  }, [api]);
  return (
    <Page heading="From dev to production" summary="Where each part of AUGUR is between dev, preview and production, and what this server runs.">
      <Notice tone="info" heading="Upgrading moved to the Upgrade Centre." action="Open the Upgrade Centre" onAction={openUpgrades}>
        <span data-moved>Upgrade, hold or go back there, for AUGUR and each app, and see every upgrade asked for.</span>
      </Notice>
      <Problem>{error}</Problem>
      {updates ? <TheLine line={updates.line} portalUrl={updates.portalUrl} /> : error ? null : <Rows loading count={3} />}
    </Page>
  );
}
