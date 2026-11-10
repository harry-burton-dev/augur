// Extraction, measured on real model replies (plan PR 5). Each corpus's recording is one run of the extraction
// prompt against a real model (extraction.record.test.ts), replayed here through the whole service: the reply is
// checked, retained, resolved and stored, and what the store keeps is scored against labels written before any
// prompt saw the reports. CI never calls a model. The floors are the recorded run's own scores: a change that
// keeps less from the same replies fails, and a new prompt needs a new recording.
//
// Two corpora: draft 4's 26 port reports (its gold set, written by the hands that tuned the lab's prompt), and
// the held-out set, 15 marine-incident reports in a second domain, labelled by two labellers apart and
// adjudicated by a third, none of whom saw the prompt (fixtures/heldout).
import { existsSync, readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { knowledgeDb } from './db.testing.ts';
import { CORPORA, type Gold, type Recording, recordingPath, type Report, replaying, runCorpus, scoreStore, summary, useCorpusText } from './evaluation.testing.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);
const read = <T>(path: string) => JSON.parse(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), 'utf8')) as T;


describe.skipIf(!DATABASE_URL)('extraction on recorded model replies', () => {
  beforeEach(() => db.empty());

  for (const c of CORPORA) {
    const recorded = existsSync(recordingPath(c.name));
    it.skipIf(!recorded)(`keeps at least what the recorded run kept, on ${c.name}, and leaks nothing`, async () => {
      const reports = read<Report[]>(c.reports);
      const gold = read<Gold>(c.gold);
      const rec = JSON.parse(readFileSync(recordingPath(c.name), 'utf8')) as Recording & { floor: ReturnType<typeof summary> };
      const outcomes = await runCorpus({ app: db.app, reports, extract: replaying(rec, reports) });
      expect(outcomes.filter((o) => o.status !== 200)).toEqual([]);
      useCorpusText(reports);
      const score = await scoreStore(db.admin, gold);
      expect(score.leaks).toEqual([]);
      const now = summary(score);
      for (const k of Object.keys(rec.floor) as (keyof typeof now)[]) expect(now[k], k).toBeGreaterThanOrEqual(rec.floor[k] - 1e-9);
    }, 120_000);
  }
});
