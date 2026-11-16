// The backup container's note of its last run (infra/deploy/backup/backup.sh writes last-backup.json in the status
// folder). Data is dropped only behind a fresh one (ADR 0103): the backup the job that drops it just took, which
// worked and holds the database and, with object storage, apps' files.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Where compose.yml mounts the backup container's results (backups/status), read only. */
export const BACKUP_STATUS_DIR = '/backup-status';

/** The name backup.sh gives a dump it takes on demand (`--now`): platform-2026-11-15T020000Z.sql.gz. */
export const BACKUP_FILE = /^platform-\d{4}-\d{2}-\d{2}T\d{6}Z\.sql\.gz$/;

/** What backup.sh writes: when, whether it worked, the dump's file and, when there is object storage, the files' tarball. */
export interface BackupMarker {
  at: string;
  ok: boolean;
  file?: string;
  objects?: string;
  problem?: string;
}

/** The marker in `dir`, nothing when there is none, or `{ unreadable }` with why when it can't be read. */
export async function readBackupMarker(dir: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(join(dir, 'last-backup.json'), 'utf8')) as unknown;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    return { unreadable: (err as NodeJS.ErrnoException).code ?? 'not JSON' };
  }
}

const isMarker = (m: unknown): m is BackupMarker => typeof m === 'object' && m !== null && typeof (m as BackupMarker).at === 'string' && typeof (m as BackupMarker).ok === 'boolean';

/**
 * Why nothing may be dropped yet, or nothing when the last backup noted worked, holds apps' files (with object storage)
 * and is the one wanted: `file`, the one the job just took, or any taken `since` the data was set aside, which nothing
 * has written to since. The marker's time is to the second, so `since` is too.
 */
export function backupProblem(marker: unknown, want: { file: string } | { since: Date }, objects: boolean): string | undefined {
  if (marker === undefined) return 'No backup has been noted (backups/status/last-backup.json is missing), so nothing was dropped.';
  if (!isMarker(marker)) {
    const why = typeof marker === 'object' && marker !== null && 'unreadable' in marker ? ` (${String((marker as { unreadable: unknown }).unreadable)})` : '';
    return `The note of the last backup (backups/status/last-backup.json) can’t be read${why}, so nothing was dropped.`;
  }
  if ('file' in want && marker.file !== want.file) return `The last backup noted, at ${marker.at}, is ${marker.file ?? 'not a dump'}, not ${want.file}, the one taken for this. Nothing was dropped.`;
  if (!marker.ok) return `The backup at ${marker.at} failed: ${marker.problem ?? 'it says no more.'} Nothing was dropped.`;
  if ('since' in want) {
    const since = new Date(Math.floor(want.since.getTime() / 1000) * 1000);
    if (Number.isNaN(Date.parse(marker.at)) || Date.parse(marker.at) < since.getTime())
      return `The last backup, at ${marker.at}, was taken before its data was set aside (${since.toISOString().replace('.000Z', 'Z')}), so it may not hold it. Nothing was dropped.`;
    if (!marker.file) return `The backup at ${marker.at} names no database dump. Nothing was dropped.`;
  }
  if (objects && !marker.objects) return `The backup at ${marker.at} holds no copy of apps’ files. Nothing was dropped.`;
  return undefined;
}
