import pg from 'pg';
import { loadConfigOrExit } from '@augur/service-kit';
import { migrate } from './store.ts';

// The knowledge service's schema, brought up to date by Postgres's admin login, then this job stops. It runs
// on every `up`, before the service starts. It is the only part of the knowledge service that holds the admin
// login: kg_owner and kg_app are roles it makes, and the service itself signs in as kg_app.
loadConfigOrExit('knowledge-migrate', [
  { name: 'DATABASE_URL', about: 'Postgres’s admin login, which makes the kg schema and its roles.', required: true, secret: true },
  { name: 'KNOWLEDGE_DATABASE_PASSWORD', about: 'the password the knowledge service signs in to Postgres with, as kg_app.', required: true, secret: true },
]);

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await migrate(admin, { password: process.env.KNOWLEDGE_DATABASE_PASSWORD ?? '' });
  console.log('The knowledge graph’s schema is up to date.');
} finally {
  await admin.end();
}
