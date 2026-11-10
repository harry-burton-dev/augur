// Records extraction's replies from a real model, once per prompt version, for extraction.eval.test.ts to
// replay. It runs only when asked (RECORD_EXTRACTION=1), on a machine that can reach a models service:
//
//   RECORD_EXTRACTION=1 DATABASE_URL=<a scratch Postgres> MODELS_URL=http://models:8085 \
//   SERVICE_CLIENT_SECRET=<the knowledge client's> OIDC_ISSUER=... OIDC_INTERNAL_URL=... \
//   [EVAL_MODELS_FLOOR=<a floor with models on>] pnpm --filter @augur/knowledge exec vitest run src/extraction.record.test.ts
//
// It writes fixtures/recordings/<corpus>-<prompt version>.json with the replies and the run's scores, which become
// the replay's floors. Nothing is recorded for a corpus whose run leaks or fails.
import { readFileSync, writeFileSync } from 'node:fs';
import { askModel, platformCredentialsFromEnv } from '@augur/service-kit';
import { beforeEach, describe, expect, it } from 'vitest';
import { knowledgeDb } from './db.testing.ts';
import { CORPORA, type Gold, recording, recordingPath, type Report, runCorpus, scoreStore, summary, useCorpusText } from './evaluation.testing.ts';
import { PROMPT_VERSION } from './extract.ts';

const { DATABASE_URL, MODELS_URL, RECORD_EXTRACTION, EVAL_MODELS_FLOOR } = process.env;
const on = RECORD_EXTRACTION === '1' && !!DATABASE_URL && !!MODELS_URL;
const db = knowledgeDb(on ? DATABASE_URL : undefined);
const read = <T>(path: string) => JSON.parse(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), 'utf8')) as T;

describe.skipIf(!on)('recording extraction from a real model', () => {
  beforeEach(() => db.empty());
  for (const c of CORPORA) {
    it(`records ${c.name}`, async () => {
      const credentials = platformCredentialsFromEnv('knowledge');
      if (!credentials) throw new Error('SERVICE_CLIENT_SECRET (and the OIDC settings) are needed to ask the models service.');
      const reports = read<Report[]>(c.reports);
      let model: string | undefined;
      const real = async (messages: { role: 'system' | 'user'; content: string }[]) => {
        const answer = await askModel({ modelsUrl: MODELS_URL!, credentials, workspace: EVAL_MODELS_FLOOR, messages });
        model ??= (answer as { model?: string }).model;
        return answer.message.content;
      };
      const rec = recording(real, reports);
      const outcomes = await runCorpus({ app: db.app, reports, extract: rec.extract });
      useCorpusText(reports);
      const score = await scoreStore(db.admin, read<Gold>(c.gold));
      writeFileSync(new URL(`${recordingPath(c.name).pathname}.report.json`, 'file:'), JSON.stringify({ outcomes, score }, null, 1));
      expect(outcomes.filter((o) => o.status !== 200)).toEqual([]);
      expect(score.leaks).toEqual([]);
      writeFileSync(recordingPath(c.name), `${JSON.stringify({ promptVersion: PROMPT_VERSION, model, recordedAt: new Date().toISOString(), floor: summary(score), replies: rec.replies }, null, 1)}\n`);
    }, 1_800_000);
  }
});
