import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { backupProblem, readBackupMarker } from './backup-marker.ts';

const after = new Date('2026-11-15T02:00:00.400Z');
const good = { at: '2026-11-15T02:00:05Z', ok: true, file: 'platform-2026-11-15T020000Z.sql.gz', bytes: 10, objects: 'objects-2026-11-15T020000Z.tar.gz' };

describe('backupProblem (ADR 0103: data is dropped only behind a fresh backup)', () => {
  it('lets a drop go on after a good backup of the database and apps’ files, taken since the job started', () => {
    expect(backupProblem(good, after, true)).toBeUndefined();
    // The marker's time is to the second, so a backup in the job's first second counts.
    expect(backupProblem({ ...good, at: '2026-11-15T02:00:00Z' }, after, true)).toBeUndefined();
    // With no object storage there are no apps' files to have copied.
    expect(backupProblem({ ...good, objects: undefined }, after, false)).toBeUndefined();
  });

  it('refuses when there is no marker, or it isn’t one', () => {
    expect(backupProblem(undefined, after, true)).toMatch(/No backup has been noted/);
    expect(backupProblem({ ok: 'yes' }, after, true)).toMatch(/can’t be read/);
  });

  it('refuses after a failed backup, saying why it failed', () => {
    expect(backupProblem({ at: good.at, ok: false, problem: 'The database could not be dumped.' }, after, true)).toMatch(/failed: The database could not be dumped\./);
  });

  it('refuses a backup taken before the job started', () => {
    expect(backupProblem({ ...good, at: '2026-11-15T01:59:59Z' }, after, true)).toMatch(/2026-11-15T01:59:59Z, before .*2026-11-15T02:00:00Z/);
  });

  it('refuses a backup with no copy of apps’ files, when there is object storage', () => {
    expect(backupProblem({ ...good, objects: undefined }, after, true)).toMatch(/no copy of apps’ files/);
  });
});

describe('readBackupMarker', () => {
  it('reads last-backup.json from the status folder, and nothing when it isn’t there', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'status-'));
    expect(await readBackupMarker(dir)).toBeUndefined();
    await writeFile(join(dir, 'last-backup.json'), `${JSON.stringify(good)}\n`);
    expect(await readBackupMarker(dir)).toEqual(good);
    await writeFile(join(dir, 'last-backup.json'), '{"at":');
    expect(await readBackupMarker(dir)).toEqual({ unreadable: true });
  });
});
