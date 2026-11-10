// Records extraction's replies from a real model, once per prompt version, for extraction.eval.test.ts to
// replay. It runs only when asked (RECORD_EXTRACTION=1), on a machine that can reach a models service:
//
//   RECORD_EXTRACTION=1 DATABASE_URL=<a scratch Postgres> MODELS_URL=http://models:8085 \
//   SERVICE_CLIENT_SECRET=<the knowledge client's> OIDC_ISSUER=... OIDC_INTERNAL_URL=... \
//   [EVAL_MODELS_FLOOR=<a floor with models on>] pnpm --filter @augur/knowledge exec vitest run src/extraction.record.test.ts
//
// Or straight to an OpenAI-compatible chat endpoint, when the deployment's models service has no model yet: the
// replies measure the prompt and the model, not the path to them.
//
//   RECORD_EXTRACTION=1 DATABASE_URL=... CHAT_URL=http://litellm:4000/v1/chat/completions CHAT_MODEL=<name> \
//   [CHAT_API_KEY=...] pnpm --filter @augur/knowledge exec vitest run src/extraction.record.test.ts
//
// It writes fixtures/recordings/<corpus>-<prompt version>.json with the replies and the run's scores, which become
// the replay's floors. Nothing is recorded for a corpus whose run leaks or fails.
import { readFileSync, writeFileSync } from 'node:fs';
import { askModel, platformCredentialsFromEnv } from '@augur/service-kit';
import { beforeEach, describe, expect, it } from 'vitest';
import { knowledgeDb } from './db.testing.ts';
import { CORPORA, type Gold, recording, recordingPath, type Report, runCorpus, scoreStore, summary, useCorpusText } from './evaluation.testing.ts';
import { PROMPT_VERSION } from './extract.ts';

const { DATABASE_URL, MODELS_URL, RECORD_EXTRACTION, EVAL_MODELS_FLOOR, CHAT_URL, CHAT_MODEL, CHAT_API_KEY } = process.env;
const on = RECORD_EXTRACTION === '1' && !!DATABASE_URL && (!!MODELS_URL || (!!CHAT_URL && !!CHAT_MODEL));

type Messages = { role: 'system' | 'user'; content: string }[];
/** One question to an OpenAI-compatible endpoint, deterministic as it allows. */
const chat = async (messages: Messages) => {
  const res = await fetch(CHAT_URL!, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(CHAT_API_KEY ? { authorization: `Bearer ${CHAT_API_KEY}` } : {}) },
    body: JSON.stringify({ model: CHAT_MODEL, messages, temperature: 0 }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`The chat endpoint answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { model?: string; choices: { message: { content: string } }[] };
  return { model: body.model ?? CHAT_MODEL, content: body.choices[0]!.message.content };
};
const db = knowledgeDb(on ? DATABASE_URL : undefined);
const read = <T>(path: string) => JSON.parse(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), 'utf8')) as T;

describe.skipIf(!on)('recording extraction from a real model', () => {
  beforeEach(() => db.empty());
  for (const c of CORPORA) {
    it(`records ${c.name}`, async () => {
      const reports = read<Report[]>(c.reports);
      let model: string | undefined;
      let real: (messages: Messages) => Promise<string>;
      if (MODELS_URL) {
        const credentials = platformCredentialsFromEnv('knowledge');
        if (!credentials) throw new Error('SERVICE_CLIENT_SECRET (and the OIDC settings) are needed to ask the models service.');
        real = async (messages) => {
          const answer = await askModel({ modelsUrl: MODELS_URL, credentials, workspace: EVAL_MODELS_FLOOR, messages });
          model ??= (answer as { model?: string }).model;
          return answer.message.content;
        };
      } else {
        real = async (messages) => {
          const answer = await chat(messages);
          model ??= answer.model;
          return answer.content;
        };
      }
      const rec = recording(real, reports);
      const outcomes = await runCorpus({ app: db.app, reports, extract: rec.extract });
      useCorpusText(reports);
      const score = await scoreStore(db.admin, read<Gold>(c.gold));
      writeFileSync(new URL(`${recordingPath(c.name).pathname}.report.json`, 'file:'), JSON.stringify({ outcomes, score }, null, 1));
      expect(outcomes.filter((o) => o.status !== 200)).toEqual([]);
      expect(score.leaks).toEqual([]);
      writeFileSync(recordingPath(c.name), `${JSON.stringify({ promptVersion: PROMPT_VERSION, model, via: MODELS_URL ? 'models service' : 'chat endpoint', recordedAt: new Date().toISOString(), floor: summary(score), replies: rec.replies }, null, 1)}\n`);
    }, 1_800_000);
  }
});
