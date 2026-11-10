import { describe, expect, it } from 'vitest';
import { asksWords, featureHint, featureModeChoices } from './installs.js';

describe('what a release asks for, as the review says it', () => {
  const asks = {
    scopes: ['audit:write'],
    resources: [{ part: 'web', type: 'augur-files', params: { label: 'Templates' } }],
    limits: { web: { memory: '256Mi', cpu: '500m' }, migrate: { memory: '128Mi', cpu: '100m' } },
    floors: ['team'],
    maxUpload: 10,
    settings: ['apiKey'],
    canvas: false,
  };
  const scopes = (s: string[]) => s.join(', ');

  it('names each part’s kind, each setting’s type, the folders to fill and who signed it', () => {
    const review = { kinds: { web: 'service', migrate: 'job' }, settings: [{ id: 'apiKey', label: 'API key', type: 'secret', required: true }] };
    const words = asksWords(asks, scopes, review, { repository: 'o/r', workflow: 'release.yml' });
    expect(words).toContainEqual(expect.stringMatching(/^Its web part \(a service; 256Mi of memory, 500m CPU\)/));
    expect(words).toContainEqual(expect.stringMatching(/^Its migrate part \(a job run before each version starts; 128Mi/));
    expect(words).toContain('Offers a setting: API key (secret, required)');
    expect(words).toContain('Asks you to fill a folder: Templates');
    expect(words).toContain('Signed by o/r’s release.yml');
  });

  it('says what the asks say when there is no review', () => {
    const words = asksWords(asks, scopes);
    expect(words).toContainEqual(expect.stringMatching(/^Its web part \(256Mi of memory, 500m CPU\)/));
    expect(words).toContain('Offers a setting: apiKey');
  });

  it('names the classes and actions an app needs of the knowledge graph', () => {
    const graphs = { ...asks, resources: [{ part: 'web', type: 'augur-floor-graphs', params: { classes: ['kg:Ship', 'kg:Port'], actions: ['retain'] } }] };
    expect(asksWords(graphs, scopes).join(' ')).toContain('reads the floors’ graphs of kg:Ship and kg:Port, and takes retain');
  });
});

describe('who gets a feature preview', () => {
  const preview = { id: 'board', name: 'Board view', mode: 'opt-in' as const, ended: false, chosen: false, optedIn: 2 };
  it('offers the server’s default first, and only Off for one that has ended', () => {
    expect(featureModeChoices(preview, 'opt-in').map((c) => c.value)).toEqual(['default', 'off', 'opt-in', 'everyone', 'floors']);
    expect(featureModeChoices(preview, 'off')[0].label).toBe('As this server does: off');
    const ended = featureModeChoices({ ...preview, ended: true, until: '2026-01-01' }, 'off');
    expect(ended.filter((c) => c.disabled).map((c) => c.value)).toEqual(['opt-in', 'everyone', 'floors']);
  });

  it('says how many turned it on, and what to do once it has ended', () => {
    expect(featureHint(preview)).toBe('2 people have turned it on.');
    expect(featureHint({ ...preview, ended: true, until: '2026-01-01' })).toMatch(/should drop it or make it everyone’s/);
  });

  it('names the floors one is on for', () => {
    const names: Record<string, string> = { f: 'Finance', l: 'Legal', p: 'Payroll' };
    expect(featureHint({ ...preview, mode: 'floors', floors: ['f'] }, (id) => names[id])).toBe('On for Finance and the floors beneath, without a release; off everywhere else.');
    expect(featureHint({ ...preview, mode: 'floors', floors: ['f', 'l', 'p'] }, (id) => names[id])).toMatch(/^On for Finance, Legal and Payroll /);
  });
});
