import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RESERVED_APP_IDS, reservedIdProblem } from './reserved.js';

const repo = new URL('../../../../', import.meta.url);

describe('the ids AUGUR keeps', () => {
  it('refuses a platform part’s id, and the beginnings kept for the platform and the database, saying what has it', () => {
    expect(reservedIdProblem('identity')).toBe('"identity" is kept for the identity service, a part of AUGUR. Choose another id for the app.');
    expect(reservedIdProblem('keycloak')).toContain('the sign-in service');
    expect(reservedIdProblem('augur-frontends')).toContain('starts with augur-');
    expect(reservedIdProblem('pg-stats')).toContain('the database’s own schemas');
    // A retired or removed app's data waits under retired_<id> and retired-<id> (ADR 0103).
    expect(reservedIdProblem('retired-notes')).toContain('apps’ data set aside');
    expect(reservedIdProblem('retired')).toContain('apps’ data set aside');
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

  it('keeps the first part of every path the front door serves itself, since an app is served at /<id>', () => {
    const nginx = readFileSync(new URL('infra/deploy/nginx.conf', repo), 'utf8');
    const firsts: string[] = [];
    const unread: string[] = [];
    for (const [line, modifier = '', path] of nginx.matchAll(/^\s*location\s+(=|~\*?|\^~)?\s*(\S+)\s*\{/gm)) {
      if (path === '/' || path.startsWith('@')) continue;
      // An exact location may end after its first part (= /recover); any other must have a slash after it
      // (/legal/, ~ ^/sso/(admin…)), or it would also catch every id that begins with it.
      const first = (modifier.startsWith('~') ? path.replace(/^\^/, '') : path).match(modifier === '=' ? /^\/([^/]+)(?:\/|$)/ : /^\/([^/]+)\//)?.[1];
      // A first part that isn't a plain name (~ ^/(a|b)/, a capital under ~*) can't be checked here: say so, don't skip it.
      if (first && /^[a-z0-9-]+$/.test(first)) firsts.push(first);
      else unread.push(line.trim());
    }
    expect(unread).toEqual([]);
    expect(firsts).toContain('api');
    expect([...new Set(firsts)].filter((first) => !Object.hasOwn(RESERVED_APP_IDS, first))).toEqual([]);
  });
});
