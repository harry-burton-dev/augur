// The contract against the running service (dev plan, PR 3c): Schemathesis reads contracts/knowledge.openapi.yaml,
// makes requests the schema allows, and checks every answer: no 5xx, only documented status codes and content
// types, and each body the shape the contract says. On the loaded corpus, as a person standing on the team.
// It runs on main only (KG_FUZZ, with SCHEMATHESIS naming the pinned CLI the CI step installed), to keep pull
// requests' minutes down. Deprecated operations are left out: they stay as they were until the next major.
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { FastifyInstance } from 'fastify';
import { callerHeaders } from '@augur/service-kit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { knowledgeDb, loadCorpus } from './db.testing.ts';
import type { Standing } from './standing.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const FUZZ = !!process.env.KG_FUZZ;
const db = knowledgeDb(FUZZ ? DATABASE_URL : undefined);
const CONTRACT = fileURLToPath(new URL('../../../../contracts/knowledge.openapi.yaml', import.meta.url));
/** What the run checks: the contract's promises about answers, not its opinions about inputs. */
const CHECKS = ['not_a_server_error', 'status_code_conformance', 'content_type_conformance', 'response_schema_conformance'];

const standing = async (): Promise<Standing> => ({ floors: [{ id: 'org', kind: 'org' }, { id: 'team', kind: 'team', parent: 'org' }], memberOf: ['org', 'team'] });

describe.skipIf(!DATABASE_URL || !FUZZ)('the contract against the running service (Schemathesis)', () => {
  let app: FastifyInstance;
  let url: string;
  beforeAll(async () => {
    await loadCorpus(db);
    app = await buildApp({ store: db.app, standing });
    url = await app.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(async () => app?.close());

  it('answers every request the schema allows as the contract says, and never with a 5xx', async () => {
    const headers = Object.entries(callerHeaders({ id: 'alex', name: 'alex', departments: [], roles: [], workspace: { id: 'team', kind: 'team', role: 'member' } }));
    // Not spawnSync: the service answers from this same process, so the run must leave its event loop free.
    const run = await promisify(execFile)(
      process.env.SCHEMATHESIS ?? 'schemathesis',
      ['run', CONTRACT, '--url', `${url}/v1`, ...headers.flatMap(([k, v]) => ['-H', `${k}: ${v}`]), '--checks', CHECKS.join(','), '--exclude-deprecated', '--mode', 'positive', '--max-examples', '50', '--seed', '1', '--workers', '1'],
      { encoding: 'utf8', timeout: 240_000, maxBuffer: 64 * 1024 * 1024 },
    ).then(
      ({ stdout }) => ({ ok: true, out: stdout }),
      (err: { stdout?: string; stderr?: string; message: string }) => ({ ok: false, out: `${err.message}\n${err.stdout ?? ''}\n${err.stderr ?? ''}` }),
    );
    expect(run.ok, run.out).toBe(true);
  }, 300_000);
});
