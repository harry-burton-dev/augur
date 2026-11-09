// What the generated contract still lacks against draft 4's openapi.yaml, the seam's target (dev plan, PR 2).
// The list is written out here so it can only shrink on purpose: PR 3 empties it, and from then on the
// generated contract is the source and oasdiff guards it. The inputs of actions still to come (LATER) go with
// the pull request that adds each action. A path or a required field added to the service
// makes this fail until it is taken off the list.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { CATALOGUE } from './actions.ts';
import { buildApp } from './app.ts';

type Doc = { paths: Record<string, Record<string, unknown>>; components: { schemas: Record<string, { required?: string[] }> } };
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const target = parse(readFileSync(new URL('./fixtures/draft4-openapi.yaml', import.meta.url), 'utf8')) as Doc;

/** AUGUR's name for a field draft 4 named otherwise: every AUGUR service's problems carry `reason` (service kit). */
const SAME = new Map([['Problem.code', 'Problem.reason']]);
/**
 * What draft 4 asks for that the seam leaves out on purpose. A floor's name is identity's: the shell already
 * has it (/me/workspaces), and the service, asking identity as itself, is never told a personal floor's.
 */
const ON_PURPOSE = new Set(['Floor.name']);
/** Draft 4 mirrors each action's input under components; here the catalogue is their only source. */
const pascal = (name: string) => name.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase());
const inputs = () => CATALOGUE.flatMap((a) => ((a.input as { required?: string[] }).required ?? []).map((f) => `${pascal(a.name)}Input.${f}`));

/** `get /floors/{floor}/entities` for each operation, and `Schema.field` for each required field. */
const surface = (doc: Doc) => [
  ...Object.entries(doc.paths).flatMap(([path, ops]) => METHODS.filter((m) => m in ops).map((m) => `${m} ${path.replace(/:(\w+)/g, '{$1}')}`)),
  ...Object.entries(doc.components?.schemas ?? {}).flatMap(([name, s]) => (s.required ?? []).map((f) => `${name}.${f}`)),
];

describe('the seam against draft 4', () => {
  it('lacks only what PR 3 adds', async () => {
    const app = await buildApp({ store: {} as never });
    await app.ready();
    const made = app.swagger() as unknown as Doc;
    made.paths = Object.fromEntries(Object.entries(made.paths).map(([p, ops]) => [p.replace(/^\/v1/, ''), ops]));
    const have = new Set([...surface(made), ...inputs()]);
    const missing = surface(target).filter((x) => !have.has(SAME.get(x) ?? x) && !ON_PURPOSE.has(x));
    await app.close();
    expect(missing).toEqual([...GAP, ...LATER]);
  });
});

/** The gap, as of PR 3a. Each line goes as PR 3b and 3c add it. */
const GAP = [
  // Paths
  'get /floors/{floor}/entities/{id}/subgraph',
  'get /floors/{floor}/entities/{id}/summary',
  'get /floors/{floor}/queue',
  'get /floors/{floor}/conflicts',
  'post /floors/{floor}/query',
  'post /floors/{floor}/recall',
  'get /floors/{floor}/known-entities',
  'get /floors/{floor}/lookup',
  'get /floors/{floor}/export',
  // Required fields of the objects those paths answer with
  'Summary.entity', 'Summary.floor', 'Summary.state',
  'Subgraph.nodes', 'Subgraph.edges',
  'Queue.floor', 'Queue.items',
  'ConflictList.floor', 'ConflictList.conflicts', 'ConflictList.possibleDuplicates',
  'QueryResult.entities',
  'RecallResult.hits',
];

/** The inputs of the actions that come with their own pull requests: publish to undo in PR 6, reflect in 7, adopt and dismiss in 8. */
const LATER = [
  'PublishInput.source', 'PublishInput.to',
  'DisputeInput.belief', 'DisputeInput.reason',
  'SettleInput.dispute', 'SettleInput.outcome',
  'RetractInput.observation', 'RetractInput.why',
  'RaiseInput.belief', 'RaiseInput.why',
  'EndInput.belief', 'EndInput.at', 'EndInput.why',
  'MergeInput.senior', 'MergeInput.junior', 'MergeInput.why',
  'SplitInput.merge', 'SplitInput.why',
  'RetireInput.entity', 'RetireInput.why',
  'UndoInput.action', 'UndoInput.why',
  'ForgetInput.observation',
  'AdoptInput.term', 'AdoptInput.kind', 'AdoptInput.iri', 'AdoptInput.label',
  'DismissInput.term', 'DismissInput.kind', 'DismissInput.why',
  'ReflectInput.entity',
];
