// The forget ledger, kept outside Postgres (plan PR 6, requirement 15). Forgetting clears an observation's
// words for good, but a restore from backup, or to a point in time, would bring them back with the rows. So
// each forget is also written to a file on a volume of its own, before the forget commits, and the migrate
// job forgets again, on every start, whatever the file names that the database doesn't. It holds ids only.
import { mkdir, open, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type pg from 'pg';
import { isUuid } from './ids.ts';

export interface ForgetLedger {
  /** The file, for logs and the docs. */
  readonly file: string;
  /** Adds forgotten observations, and returns once they are on disk. */
  append(observations: readonly string[]): Promise<void>;
  /** Every observation it names, once each. */
  read(): Promise<string[]>;
}

export const LEDGER_FILE = 'forget-ledger.jsonl';

export const fileLedger = (dir: string): ForgetLedger => {
  const file = join(dir, LEDGER_FILE);
  return {
    file,
    async append(observations) {
      if (!observations.length) return;
      await mkdir(dir, { recursive: true });
      const handle = await open(file, 'a+', 0o600);
      try {
        // A write cut short by a crash leaves a line without its end: start on a line of our own.
        const { size } = await handle.stat();
        const last = Buffer.alloc(1);
        if (size > 0) await handle.read(last, 0, 1, size - 1);
        const at = new Date().toISOString();
        const lines = observations.map((observation) => `${JSON.stringify({ observation, at })}\n`).join('');
        await handle.write(`${size > 0 && last[0] !== 0x0a ? '\n' : ''}${lines}`);
        await handle.sync();
      } finally {
        await handle.close();
      }
    },
    async read() {
      let text: string;
      try {
        text = await readFile(file, 'utf8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw err;
      }
      const found = new Set<string>();
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          const { observation } = JSON.parse(line) as { observation?: unknown };
          if (typeof observation === 'string' && isUuid(observation)) found.add(observation);
        } catch {
          // A line cut short by a crash names nothing; the forget it began never committed.
        }
      }
      return [...found];
    },
  };
};

/**
 * Brings the database and the file into step, as Postgres's admin login: forgets again each observation the
 * file names and the database holds unforgotten (it was restored), and writes into the file each one the
 * database's own ledger has and the file lacks (the volume was lost or made afresh).
 */
export const reapplyForgets = async (admin: pg.Pool | pg.ClientBase, ledger: ForgetLedger) => {
  const named = await ledger.read();
  const again = (await admin.query<{ id: string }>('select kg.reapply_forgets($1::uuid[]) as id', [named])).rows.map((r) => r.id);
  const have = new Set(named);
  const written = (await admin.query<{ id: string }>('select kg.forgotten_ids() as id')).rows.map((r) => r.id).filter((id) => !have.has(id));
  await ledger.append(written);
  return { forgottenAgain: again, written };
};
