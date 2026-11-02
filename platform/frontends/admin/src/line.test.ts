import { render } from 'lit';
import { describe, expect, it } from 'vitest';
import type { PipelineLine } from './api.js';
import { lineSection, placeOf, portalLink } from './line.js';

const line: PipelineLine = {
  feed: 'on',
  repository: 'o/r',
  generatedAt: '2026-10-30T22:00:00Z',
  units: [
    { id: 'augur', name: 'AUGUR', versions: { dev: '0.13.0', preview: '0.12.0', production: '0.11.0' }, devBuild: { version: '0.13.1-dev.4' }, waiting: ['a', 'b'], previews: [], running: '0.13.1-dev.4' },
    { id: 'mandate', name: 'Mandate', versions: { dev: '0.1.5', preview: '0.1.4', production: null }, waiting: [], previews: [], running: '0.1.4' },
    { id: 'notes', name: 'Notes', versions: { dev: '0.2.0', preview: null, production: null }, waiting: [], previews: [] },
  ],
  steps: [
    { from: 'dev', to: 'preview', merged: 3, pulls: [] },
    { from: 'preview', to: 'production', merged: 0, pulls: [] },
  ],
  pulls: { versionPackages: { number: 9, title: 'Version packages', url: 'https://github.com/o/r/pull/9' }, promoteToProduction: [] },
};

describe('the line', () => {
  it('puts this server on the branch whose version it runs, a dev build on dev', () => {
    expect(line.units.map(placeOf)).toEqual(['dev', 'preview', undefined]);
  });

  it('links each part to its system in the company portal, when there is one', () => {
    expect(portalLink('https://portal.example', 'augur')).toBe('https://portal.example/catalog/default/system/augur-platform');
    expect(portalLink('https://portal.example', 'mandate')).toBe('https://portal.example/catalog/default/system/mandate');
    expect(portalLink(undefined, 'augur')).toBeUndefined();
  });

  it('shows each part on each branch, what is waiting, and links to GitHub for the rest', () => {
    const el = document.createElement('div');
    render(lineSection(line, 'https://portal.example'), el);
    expect(el.querySelector('[data-unit="augur"] [data-here]')?.textContent).toContain('0.13.0');
    expect(el.querySelector('[data-unit="mandate"] [data-here]')?.textContent).toContain('0.1.4');
    expect(el.querySelector('[data-unit="notes"]')?.textContent).toContain('Not on this server');
    expect(el.querySelector('[data-unit="augur"]')?.textContent).toContain('2 changes waiting');
    expect(el.querySelector('[data-step="dev-preview"]')?.textContent).toContain('3 pull requests on Dev that Preview hasn’t got');
    expect([...el.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(
      expect.arrayContaining(['https://portal.example/catalog/default/system/augur-platform', 'https://github.com/o/r/compare/preview...dev', 'https://github.com/o/r/pull/9', 'https://portal.example']),
    );
  });

  it('says why it can’t be shown when there is no pipeline feed', () => {
    const el = document.createElement('div');
    render(lineSection({ feed: 'off', units: [], steps: [] }), el);
    expect(el.querySelector('[data-line-off]')?.textContent).toContain('PIPELINE_FEED_URL=off');
  });
});
