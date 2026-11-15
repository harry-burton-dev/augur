// The backup container's note of its last run (infra/deploy/backup/backup.sh writes last-backup.json in the status
// folder). Data is dropped only behind a fresh one (ADR 0103): a good backup of the database and of apps' files,
// taken since the job that drops it started.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Where compose.yml mounts the backup container's results (backups/status), read only. */
export const BACKUP_STATUS_DIR = '/backup-status';

/** What backup.sh writes: when, whether it worked, the dump's file and, when there is object storage, the files' tarball. */
export interface BackupMarker {
  at: string;
  ok: boolean;
  file?: string;
  bytes?: number;
  objects?: string;
  problem?: string;
}

/** The marker in `dir`, nothing when there is none, or `{ unreadable }` when the file isn't JSON. */
export async function readBackupMarker(dir: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(join(dir, 'last-backup.json'), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { unreadable: true };
  }
}

const isMarker = (m: unknown): m is BackupMarker =>
  typeof m === 'object' && m !== null && typeof (m as BackupMarker).at === 'string' && typeof (m as BackupMarker).ok === 'boolean' && !Number.isNaN(Date.parse((m as BackupMarker).at));

/**
 * Why nothing may be dropped yet, or nothing when the last backup is a good one of the database and (with object
 * storage) apps' files, taken at or after `after`. The marker's time is to the second, so `after` is too.
 */
export function backupProblem(marker: unknown, after: Date, objects: boolean): string | undefined {
  if (marker === undefined) return 'No backup has been noted yet (backups/status/last-backup.json is missing), so nothing was dropped.';
  if (!isMarker(marker)) return 'The note of the last backup (backups/status/last-backup.json) can’t be read, so nothing was dropped.';
  const since = new Date(Math.floor(after.getTime() / 1000) * 1000);
  if (!marker.ok) return `The last backup, at ${marker.at}, failed: ${marker.problem ?? 'it says no more'} Nothing was dropped.`;
  if (Date.parse(marker.at) < since.getTime()) return `The last backup was at ${marker.at}, before this started at ${since.toISOString().replace('.000Z', 'Z')}, so it may not hold everything that would go. Nothing was dropped.`;
  if (!marker.file) return `The last backup, at ${marker.at}, names no database dump. Nothing was dropped.`;
  if (objects && !marker.objects) return `The last backup, at ${marker.at}, holds no copy of apps’ files. Nothing was dropped.`;
  return undefined;
}
