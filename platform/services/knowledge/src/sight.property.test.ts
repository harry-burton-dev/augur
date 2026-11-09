// The fence against its reference oracle (oracle.testing.ts): random floor trees, memberships, posts, holds
// and raises, written through the actions, then every person standing on every floor compared with what the
// rules say they see. Few worlds on a pull request, many on main (KG_PROPERTY_RUNS).
import fc from 'fast-check';
import { describe, it } from 'vitest';
import { knowledgeDb } from './db.testing.ts';
import { fenceHolds } from './oracle.testing.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);
const RUNS = Number(process.env.KG_PROPERTY_RUNS ?? 30);

describe.skipIf(!DATABASE_URL)('sight, against the oracle', () => {
  it(`every viewer sees exactly what the rules say, over ${RUNS} random worlds`, async () => {
    await fc.assert(fenceHolds(db), { numRuns: RUNS });
  }, 600_000);
});
