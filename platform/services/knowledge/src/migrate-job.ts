import pg from 'pg';
import { loadConfigOrExit } from '@augur/service-kit';
import { fileLedger, reapplyForgets } from './ledger.ts';
import { migrate } from './store.ts';

// The knowledge service's schema, brought up to date by Postgres's admin login, then this job stops. It runs
// on every `up`, before the service starts. It is the only part of the knowledge service that holds the admin
// login: kg_owner and kg_app are roles it makes, and the service itself signs in as kg_app.
loadConfigOrExit('knowledge-migrate', [
  { name: 'DATABASE_URL', about: 'Postgres’s admin login, which makes the kg schema and its roles.', required: true, secret: true },
  { name: 'KNOWLEDGE_DATABASE_PASSWORD', about: 'the password the knowledge service signs in to Postgres with, as kg_app.', required: true, secret: true },
  { name: 'KNOWLEDGE_LEDGER_DIR', about: 'the folder the knowledge service writes each forget to; what it names is forgotten again here after a restore.', required: true },
]);

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await migrate(admin, { password: process.env.KNOWLEDGE_DATABASE_PASSWORD ?? '' });
  console.log('The knowledge graph’s schema is up to date.');
  // After a restore the database may hold words people had forgotten since that backup: forget them again.
  const dir = process.env.KNOWLEDGE_LEDGER_DIR;
  if (dir) {
    const ledger = fileLedger(dir);
    const { forgottenAgain, written } = await reapplyForgets(admin, ledger);
    console.log(`The forget ledger (${ledger.file}) is in step: ${forgottenAgain.length} forgotten again, ${written.length} written into it from the database.`);
  } else {
    console.warn('KNOWLEDGE_LEDGER_DIR is not set: nothing forgotten since a restored backup is forgotten again.');
  }
} finally {
  await admin.end();
}
