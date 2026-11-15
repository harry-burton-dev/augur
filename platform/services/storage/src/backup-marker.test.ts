import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BACKUP_FILE, backupProblem, readBackupMarker } from './backup-marker.ts';

const file = 'platform-2026-11-15T020000Z.sql.gz';
const good = { at: '2026-11-15T02:00:05Z', ok: true, file, bytes: 10, objects: 'objects-2026-11-15T020000Z.tar.gz' };

describe('backupProblem (ADR 0103: data is dropped only behind a fresh backup)', () => {
  it('lets a drop go on after the backup the job took, of the database and apps’ files', () => {
    expect(BACKUP_FILE.test(file)).toBe(true);
    expect(backupProblem(good, { file }, true)).toBeUndefined();
    // With no object storage there are no apps' files to have copied.
    expect(backupProblem({ ...good, objects: undefined }, { file }, false)).toBeUndefined();
  });

  it('refuses when there is no marker, or it can’t be read', () => {
    expect(backupProblem(undefined, { file }, true)).toMatch(/No backup has been noted/);
    expect(backupProblem({ ok: 'yes' }, { file }, true)).toMatch(/can’t be read, so/);
    expect(backupProblem({ unreadable: 'EACCES' }, { file }, true)).toMatch(/can’t be read \(EACCES\)/);
  });

  it('refuses when the last backup noted is another one, such as the nightly one finishing after', () => {
    expect(backupProblem({ ...good, file: 'platform-2026-11-15.sql.gz' }, { file }, true)).toMatch(/is platform-2026-11-15\.sql\.gz, not platform-2026-11-15T020000Z/);
  });

  it('refuses after a failed backup, saying why it failed', () => {
    expect(backupProblem({ ...good, ok: false, problem: 'The database was backed up, but apps’ files could not be.' }, { file }, true)).toMatch(/failed: The database was backed up, but apps’ files could not be\. Nothing/);
    expect(backupProblem({ ...good, ok: false }, { file }, true)).toMatch(/it says no more\. Nothing/);
  });

  it('refuses a backup with no copy of apps’ files, when there is object storage', () => {
    expect(backupProblem({ ...good, objects: undefined }, { file }, true)).toMatch(/no copy of apps’ files/);
  });
});

describe('backupProblem since data was set aside', () => {
  const since = new Date('2026-11-15T02:00:00.400Z');
  it('takes any good backup taken since, and refuses one from before', () => {
    expect(backupProblem({ ...good, file: 'platform-2026-11-16.sql.gz', at: '2026-11-16T02:00:00Z' }, { since }, true)).toBeUndefined();
    expect(backupProblem({ ...good, at: '2026-11-15T02:00:00Z' }, { since }, true)).toBeUndefined();
    expect(backupProblem({ ...good, at: '2026-11-15T01:59:59Z' }, { since }, true)).toMatch(/before its data was set aside \(2026-11-15T02:00:00Z\)/);
    expect(backupProblem({ ...good, file: undefined }, { since }, true)).toMatch(/names no database dump/);
  });
});

describe('readBackupMarker', () => {
  it('reads last-backup.json from the status folder, nothing when it isn’t there, and why when it can’t be read', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'status-'));
    expect(await readBackupMarker(dir)).toBeUndefined();
    await writeFile(join(dir, 'last-backup.json'), `${JSON.stringify(good)}\n`);
    expect(await readBackupMarker(dir)).toEqual(good);
    await writeFile(join(dir, 'last-backup.json'), '{"at":');
    expect(await readBackupMarker(dir)).toEqual({ unreadable: 'not JSON' });
    const odd = await mkdtemp(join(tmpdir(), 'status-'));
    await mkdir(join(odd, 'last-backup.json'));
    expect(await readBackupMarker(odd)).toEqual({ unreadable: 'EISDIR' });
  });
});
