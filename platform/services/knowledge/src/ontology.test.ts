// Ontology admin (plan PR 8): the first adopt pass measured on draft 4's corpus, adopt and dismiss taken as an
// ontology admin over HTTP, and the ontology exported as OWL. Done for the plan means fewer of the corpus's
// claims fall to kg:note than the 32.7% draft 4 measured, and the store still conforms to the shapes
// (shacl.test.ts loads the same corpus after the same pass).
import { readFileSync } from 'node:fs';
import { Parser, Store } from 'n3';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { knowledgeDb, loadCorpus } from './db.testing.ts';
import { as, client, type Client, key, own, people, report } from './http.testing.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);
const { reset, standing } = people();

/** Draft 4's load, as recorded: how many claims it kept, and how many fell to kg:note under the base profile alone. */
const recorded = (() => {
  const steps = JSON.parse(readFileSync(new URL('./fixtures/load-actions.json', import.meta.url), 'utf8')) as { sql: string }[];
  const claims = steps.filter((s) => s.sql.includes('kg.act_retain('));
  return { claims: claims.length, notes: claims.filter((s) => s.sql.includes(`'kg:note'`)).length };
})();
const pct = (n: number, of: number) => `${((100 * n) / of).toFixed(1)}%`;

describe('the corpus as draft 4 recorded it', () => {
  it('had 32.7% of its claims fall to kg:note', () => {
    expect(recorded).toEqual({ claims: 336, notes: 110 });
    expect(pct(recorded.notes, recorded.claims)).toBe('32.7%');
  });
});

describe.skipIf(!DATABASE_URL)('the first adopt pass, on the corpus', () => {
  beforeAll(async () => {
    await loadCorpus(db);
  });

  it('keeps fewer of the corpus’s claims as kg:note, and says what is left', async () => {
    const [{ claims, notes }] = (await db.admin.query<{ claims: number; notes: number }>(
      `select count(*)::int as claims, count(*) filter (where predicate = 'kg:note')::int as notes from kg.observations`,
    )).rows as [{ claims: number; notes: number }];
    const filed = (await db.admin.query<{ predicate: string; n: number }>(
      `select predicate, count(*)::int as n from kg.observations where ontology_version >= 1 and predicate in
         (select iri from kg.predicates where since_version is not null) group by predicate order by n desc, predicate`,
    )).rows;
    // The figures, for the record (the pull request quotes them).
    console.info(`first adopt pass: ${notes} of ${claims} claims fall to kg:note (${pct(notes, claims)}), from ${recorded.notes} (${pct(recorded.notes, recorded.claims)}); filed under ${filed.map((f) => `${f.predicate} ${f.n}`).join(', ')}`);
    expect(claims).toBe(recorded.claims);
    expect(notes).toBe(79);
    expect(notes / claims).toBeLessThan(recorded.notes / recorded.claims);
    // Each claim the pass files keeps the name it was asked by, so nothing about what the source said is lost.
    const asked = (await db.admin.query<{ n: number }>(`select count(*)::int as n from kg.observations where predicate in ('kg:status', 'kg:reason') and value ? 'asked'`)).rows[0]!.n;
    expect(asked).toBeGreaterThan(0);
  });

  it('is in the ontology’s versions and the audit, as adopt', async () => {
    const versions = (await db.admin.query<{ n: number }>('select count(*)::int as n from kg.ontology_versions')).rows[0]!.n;
    expect(versions).toBe(1 + 7);
    const adopts = (await db.admin.query<{ person: string; n: number }>(`select person, count(*)::int as n from kg.actions where kind = 'adopt' group by person`)).rows;
    expect(adopts).toEqual([{ person: 'the knowledge service', n: 7 + 17 }]);
  });
});

describe.skipIf(!DATABASE_URL)('adopt and dismiss, as an ontology admin', () => {
  let svc: Client;
  const act = async (action: string, body: unknown, roles: string[] = ['admin']) => {
    const r = await svc.app.inject({ method: 'POST', url: `/v1/actions/${action}`, headers: { ...as('alice', own.alice, { roles }), 'idempotency-key': key() }, payload: body as object });
    return { status: r.statusCode, body: r.json() };
  };
  const ontology = async () => (await svc.get('alice', '/v1/ontology', own.alice)).json();
  const candidates = async () => (await svc.get('alice', '/v1/ontology/candidates', own.alice)).json().candidates as { term: string; status: string; askedBy: number; adoptedAs?: string; dismissedWhy?: string }[];
  /** A claim the ontology has no predicate for, as extraction keeps it: under kg:note, with the name it asked by. */
  const noted = (ref: string, asked: string) => ({
    ...report(ref),
    observations: [{ subject: 'ship', predicate: 'kg:note', kind: 'property', value: { v: 'under tow', asked }, quote: 'under tow', modality: 'reported' }],
    proposals: [{ term: asked, kind: 'predicate', parent: 'kg:note', why: 'extraction asked for it' }],
  });
  const predicateOf = async (observation: string) => (await svc.get('alice', `/v1/floors/${own.alice}/observations/${observation}`, own.alice)).json().predicate as string;

  beforeAll(async () => {
    await db.rebuild();
    svc = await client({ store: db.app, standing });
  });
  beforeEach(async () => {
    reset();
    await db.empty();
  });

  it('is refused to anyone who isn’t one, saying who can change that', async () => {
    const refused = await act('adopt', { term: 'towStatus', kind: 'predicate', iri: 'kg:towStatus', label: 'tow status', datatype: 'text' }, []);
    expect(refused.status).toBe(403);
    expect(refused.body.whoCanChange).toMatch(/admin/);
    expect((await ontology()).predicates.find((p: { iri: string }) => p.iri === 'kg:towStatus')).toBeUndefined();
  });

  it('adopts a predicate, and files what later asks for it under it', async () => {
    const before = (await act('retain', noted('T1', 'towStatus'))).body.effects.observations[0];
    expect(await predicateOf(before)).toBe('kg:note');
    const version = (await ontology()).version;

    const adopted = await act('adopt', { term: 'towStatus', kind: 'predicate', iri: 'kg:towStatus', label: 'tow status', datatype: 'text', singleValued: true });
    expect(adopted.status, JSON.stringify(adopted.body)).toBe(200);
    expect(adopted.body.effects).toEqual({ predicates: ['kg:towStatus'], ontologyVersions: [String(Number(version) + 1)] });
    const now = await ontology();
    expect(now.version).toBe(String(Number(version) + 1));
    expect(now.predicates.find((p: { iri: string }) => p.iri === 'kg:towStatus')).toMatchObject({ kind: 'property', datatype: 'text', singleValued: true, status: 'accepted', sinceVersion: now.version });
    expect((await candidates()).find((c) => c.term === 'towStatus')).toMatchObject({ status: 'adopted', adoptedAs: 'kg:towStatus' });

    // What was kept before stays as it was; what comes after is kept under the predicate, and isn't asked for again.
    expect(await predicateOf(before)).toBe('kg:note');
    const after = (await act('retain', noted('T2', 'towStatus'))).body.effects.observations[0];
    expect(await predicateOf(after)).toBe('kg:towStatus');
    expect((await candidates()).find((c) => c.term === 'towStatus')!.askedBy).toBe(1);
  });

  it('takes a term as another name for a predicate it has, in the same version', async () => {
    const version = (await ontology()).version;
    const adopted = await act('adopt', { term: 'towingState', kind: 'predicate', iri: 'kg:status', label: 'status' });
    expect(adopted.status, JSON.stringify(adopted.body)).toBe(200);
    expect(adopted.body.effects.ontologyVersions).toEqual([version]);
    expect((await ontology()).predicates.find((p: { iri: string }) => p.iri === 'kg:status').askedAs).toContain('towingState');
    const filed = (await act('retain', noted('T3', 'towingState'))).body.effects.observations[0];
    expect(await predicateOf(filed)).toBe('kg:status');
    // A property can't be taken as a link.
    expect((await act('adopt', { term: 'towedBy', kind: 'predicate', iri: 'kg:status', label: 'status', range: 'kg:Vehicle' })).status).toBe(403);
  });

  it('dismisses a term, saying why, and stops counting it', async () => {
    await act('retain', noted('T4', 'mood'));
    const dismissed = await act('dismiss', { term: 'mood', kind: 'predicate', why: 'Not something the graph keeps about a ship.' });
    expect(dismissed.status, JSON.stringify(dismissed.body)).toBe(200);
    await act('retain', noted('T5', 'mood'));
    expect((await candidates()).find((c) => c.term === 'mood')).toMatchObject({ status: 'dismissed', askedBy: 1, dismissedWhy: 'Not something the graph keeps about a ship.' });
    // Only a term that waits can be dismissed.
    expect((await act('dismiss', { term: 'mood', kind: 'predicate', why: 'again' })).status).toBe(403);
    expect((await act('dismiss', { term: 'neverAsked', kind: 'predicate', why: 'never asked' })).status).toBe(403);
  });

  it('adopts a class under one the ontology has', async () => {
    const adopted = await act('adopt', { term: 'Tug', kind: 'class', iri: 'kg:Tug', label: 'tug', parent: 'kg:Ship' });
    expect(adopted.status, JSON.stringify(adopted.body)).toBe(200);
    expect((await svc.get('alice', '/v1/ontology/classes/kg:Tug', own.alice)).json()).toMatchObject({ parent: 'kg:Ship', status: 'accepted', kind: 'continuant' });
    expect((await act('adopt', { term: 'Barge', kind: 'class', iri: 'kg:Barge', label: 'barge', parent: 'kg:NoSuchClass' })).status).toBe(403);
  });

  it('exports the ontology as OWL, with the adopted terms and the names they are asked by', async () => {
    await act('adopt', { term: 'towStatus', kind: 'predicate', iri: 'kg:towStatus', label: 'tow status', datatype: 'text', singleValued: true });
    const r = await svc.get('alice', '/v1/ontology/owl', own.alice);
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toMatch(/^text\/turtle/);
    const owl = new Store(new Parser().parse(r.body));
    const KG = 'urn:augur:kg:';
    const OWL = 'http://www.w3.org/2002/07/owl#';
    const has = (s: string, p: string, o: string) => owl.countQuads(s, p, o, null) > 0;
    const TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    expect(has(`${KG}ontology`, TYPE, `${OWL}Ontology`)).toBe(true);
    expect(has(`${KG}towStatus`, TYPE, `${OWL}DatatypeProperty`)).toBe(true);
    expect(has(`${KG}towStatus`, TYPE, `${OWL}FunctionalProperty`)).toBe(true);
    expect(has(`${KG}callsAt`, TYPE, `${OWL}ObjectProperty`)).toBe(true);
    expect(has(`${KG}Ship`, TYPE, `${OWL}Class`)).toBe(true);
    expect(owl.getObjects(`${KG}reason`, 'http://www.w3.org/2004/02/skos/core#hiddenLabel', null).map((o) => o.value)).toContain('delayCause');
    // Never a candidate: only what the ontology has.
    expect(owl.countQuads(`${KG}mood`, null, null, null)).toBe(0);
  });
});
