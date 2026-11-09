// Gold-30: 30 hand-labelled claims from the corpus, scored against the loaded store (draft 4's score30.py,
// its "loaded store" column). This proves the store keeps what extraction gave it: value and unit apart,
// modality, valid time. It does not measure extraction: the corpus, the labels and the prompt came from the
// same hands, and the loader took modality and time from the data scientist's gold where it matched. The
// held-out set (N6, PR 5) is what will measure extraction. The figures are a floor, never a target.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { knowledgeDb, loadCorpus } from './db.testing.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

interface Gold {
  id: string;
  report: string;
  kind: 'link' | 'property' | 'absent';
  subject: string;
  pred: string[];
  object?: string;
  value?: string;
  unit?: string | null;
  validAt: string | null;
  modality: string;
  case: string;
}

describe.skipIf(!DATABASE_URL)('gold-30 on the loaded store', () => {
  const score = { found: 0, unit: 0, modality: 0, time: 0 };
  const misses: string[] = [];
  beforeAll(async () => {
    await loadCorpus(db);
    const gold = fixture('gold30.json').items as Gold[];
    const runLabels = fixture('run-entity-labels.json') as Record<string, string>;
    const { rows: labels } = await db.admin.query<{ name: string; entity: string }>('select name, entity from kg.entity_names where is_label');
    const byLabel = new Map(labels.map((r) => [r.name, r.entity]));
    const ent = (key?: string) => (key ? byLabel.get(runLabels[key] ?? '') : undefined);

    for (const g of gold) {
      if (g.kind === 'absent') {
        const { rows } = await db.admin.query(`select count(*)::int as n from kg.entity_names where name ilike '%vantor%'`);
        const ok = rows[0].n === 0;
        for (const k of Object.keys(score) as (keyof typeof score)[]) score[k] += ok ? 1 : 0;
        if (!ok) misses.push(`${g.id} present`);
        continue;
      }
      const subject = ent(g.subject);
      const ref = g.report === 'R14' ? 'R13' : g.report;
      const version = g.report === 'R14' ? 2 : 1;
      const { rows: events } = await db.admin.query<{ subject: string }>(`select o.subject from kg.observations o where o.predicate = 'kg:hasParticipant' and o.object = $1`, [subject]);
      const { rows } = await db.admin.query<{ pred: string; val: { v: unknown; unit?: string } | null; obj: string | null; mod: string; vf: string | null }>(
        `select o.predicate as pred, o.value as val, o.object as obj, o.modality as mod, to_char(lower(o.valid) at time zone 'UTC', 'YYYY-MM-DD') as vf
         from kg.observations o join kg.sources s on s.id = o.source
         where s.ref = $1 and s.version = $2 and (o.subject = $3 or o.subject = any($4::uuid[]))`,
        [ref, version, subject, events.map((e) => e.subject)],
      );
      const stems = (extra: string[] = []) => (pred: string) => [...g.pred, ...extra].some((p) => pred.toLowerCase().includes(p));
      const d = rows.find((r) => {
        if (g.kind === 'link') return r.obj === ent(g.object) && stems()(r.pred);
        const v = g.value!;
        if (!r.val) return false;
        if (v.startsWith('n:')) return typeof r.val.v === 'number' && r.val.v === Number(v.slice(2)) && stems(['occurs'])(r.pred);
        if (v.startsWith('d:')) return String(r.val.v) === v.slice(2);
        if (v.startsWith('b:')) return typeof r.val.v === 'boolean' && r.val.v === (v === 'b:true') && stems(['damaged', 'forsale'])(r.pred);
        return false;
      });
      const got = {
        found: !!d,
        unit: !!d && (g.unit == null || d.val?.unit === g.unit),
        modality: !!d && d.mod === g.modality,
        time: !!d && (g.validAt === null || d.vf === g.validAt),
      };
      for (const k of Object.keys(score) as (keyof typeof score)[]) {
        score[k] += got[k] ? 1 : 0;
        if (!got[k]) misses.push(`${g.id} ${k} (${g.case})`);
      }
    }
  });

  it('matches draft 4: found 30, unit 30, modality 29, time 30', () => {
    expect({ score, misses }).toEqual({ score: { found: 30, unit: 30, modality: 29, time: 30 }, misses: [expect.stringMatching(/ modality /)] });
  });
});
