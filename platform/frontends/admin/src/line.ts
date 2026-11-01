import { html, nothing } from 'lit';
import type { PipelineLine } from './api.js';
import { line, section } from './parts.js';

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

const cell = (text: string | null | undefined, here: boolean, sub?: string) =>
  html`<span
    data-here=${here ? 'true' : nothing}
    style="display:flex;flex-direction:column;padding:var(--space-2);border-radius:var(--radius-inset);${here ? 'background:color-mix(in srgb, var(--accent, var(--ink)) 12%, transparent);font-weight:600' : ''}"
  >
    <span>${text ?? '—'}</span>
    ${sub ? html`<span style="color:var(--ink-muted);font-size:var(--type-small);font-weight:400">${sub}</span>` : nothing}
  </span>`;

/**
 * The line from dev to production: each unit's version on each branch, where this server is on it, and
 * what's waiting between the branches. It shows and links, and never acts: merging and promoting stay in
 * GitHub (docs/release-channels.md).
 */
export const lineSection = (l: PipelineLine | undefined, portalUrl?: string) => {
  if (!l || l.feed === 'off') {
    return section(
      'The line',
      html`<p data-line-off style="margin:0;color:var(--ink-muted)">
        This server has no pipeline feed, so where each part is between dev, preview and production can’t be shown. It’s read beside the release feed on
        GitHub’s container registry; a mirror has none, and <code>PIPELINE_FEED_URL=off</code> turns it off.
      </p>`,
    );
  }
  const gh = l.repository ? `https://github.com/${l.repository}` : undefined;
  const grid = 'display:grid;grid-template-columns:minmax(120px,1.2fr) repeat(4,minmax(90px,1fr));gap:var(--space-1);align-items:start';
  return section(
    'The line',
    html`<div data-line style="display:flex;flex-direction:column;gap:var(--space-3)">
      ${l.problem ? html`<ui-status status="warning" label=${`${l.problem}${l.units.length ? ' This is from the last read that worked.' : ''}`}></ui-status>` : nothing}
      <div style="overflow-x:auto">
        <div style="${grid};color:var(--ink-muted);font-size:var(--type-small);border-bottom:1px solid var(--hairline)">
          <span style="padding:var(--space-2)">Part</span>
          ${BRANCHES.map((b) => html`<span style="padding:var(--space-2)">${branchWord[b]}</span>`)}
          <span style="padding:var(--space-2)">This server</span>
        </div>
        ${l.units.map((u) => {
          const here = placeOf(u);
          const link = portalLink(portalUrl, u.id);
          return html`<div data-unit=${u.id} style="${grid};border-bottom:1px solid var(--hairline);color:var(--ink)">
            <span style="display:flex;flex-direction:column;padding:var(--space-2)">
              ${link ? html`<a href=${link} target="_blank" rel="noopener" style="color:var(--ink)">${u.name}</a>` : u.name}
              ${u.waiting.length ? html`<span style="color:var(--ink-muted);font-size:var(--type-small)">${u.waiting.length === 1 ? '1 change waiting' : `${u.waiting.length} changes waiting`}</span>` : nothing}
            </span>
            ${cell(u.versions.dev, here === 'dev', u.devBuild ? `dev build ${u.devBuild.version}` : undefined)}
            ${cell(u.versions.preview, here === 'preview')}
            ${cell(u.versions.production, here === 'production')}
            ${cell(u.running ?? 'Not on this server', false, u.running && !here ? 'on none of the branches' : undefined)}
          </div>`;
        })}
      </div>
      ${l.steps.map((s) =>
        line(
          html`<span data-step=${`${s.from}-${s.to}`}>
            ${s.merged
              ? `${s.merged === 1 ? '1 pull request' : `${s.merged} pull requests`} on ${branchWord[s.from]} that ${branchWord[s.to]} hasn’t got`
              : `${branchWord[s.to]} has everything on ${branchWord[s.from]}`}
          </span>`,
          s.merged && gh ? html`<a href=${`${gh}/compare/${s.to}...${s.from}`} target="_blank" rel="noopener">See them on GitHub</a>` : undefined,
        ),
      )}
      ${l.pulls?.versionPackages
        ? line('Version packages is open: merging it cuts the versions on dev', html`<a href=${l.pulls.versionPackages.url} target="_blank" rel="noopener">#${l.pulls.versionPackages.number}</a>`)
        : nothing}
      ${l.pulls?.promoteToPreview ? line('Promote to preview is open', html`<a href=${l.pulls.promoteToPreview.url} target="_blank" rel="noopener">#${l.pulls.promoteToPreview.number}</a>`) : nothing}
      ${(l.pulls?.promoteToProduction ?? []).map((p) => line(`Promote ${p.unit} ${p.version} to production is open`, html`<a href=${p.url} target="_blank" rel="noopener">#${p.number}</a>`))}
      <p style="margin:0;color:var(--ink-muted);font-size:var(--type-small)">
        Merging and promoting happen in GitHub${portalUrl ? html`, and the company portal shows every deployment: <a href=${portalUrl} target="_blank" rel="noopener">open Backstage</a>` : nothing}.
        ${l.generatedAt ? `As of ${new Date(l.generatedAt).toLocaleString()}.` : nothing}
      </p>
    </div>`,
  );
};
