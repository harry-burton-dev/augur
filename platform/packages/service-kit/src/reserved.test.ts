import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RESERVED_APP_IDS, reservedIdProblem } from './reserved.js';

const repo = new URL('../../../../', import.meta.url);

describe('the ids AUGUR keeps', () => {
  it('refuses a platform part’s id, and the beginnings kept for the platform and the database, saying what has it', () => {
    expect(reservedIdProblem('identity')).toBe('"identity" is kept for the identity service, a part of AUGUR. Choose another id for the app.');
    expect(reservedIdProblem('keycloak')).toContain('the sign-in service');
    expect(reservedIdProblem('augur-frontends')).toContain('starts with augur-');
    expect(reservedIdProblem('pg-stats')).toContain('the database’s own schemas');
    expect(reservedIdProblem('notes')).toBeUndefined();
    expect(reservedIdProblem('storage-test-1')).toBeUndefined();
    expect(reservedIdProblem('constructor')).toBeUndefined();
  });

  it('keeps the ids of .env settings shaped like an app’s own, and the jobs schemas', () => {
    expect(reservedIdProblem('frontends')).toContain('FRONTENDS_BUCKET_SECRET');
    expect(reservedIdProblem('entra')).toContain('ENTRA_CLIENT_SECRET');
    expect(reservedIdProblem('notes-jobs')).toContain('ends with -jobs');
    expect(reservedIdProblem('jobs')).toBeUndefined();
  });

  it('keeps every platform service’s and platform app’s id', () => {
    const dirs = (path: string) => readdirSync(new URL(path, repo), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const id of [...dirs('platform/services/'), ...dirs('platform/frontends/')]) expect(Object.keys(RESERVED_APP_IDS)).toContain(id);
  });
});
