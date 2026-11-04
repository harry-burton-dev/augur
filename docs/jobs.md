# Background and scheduled jobs

A service's background work (a reminder every quarter hour, a document to render, a clear-out of
what's past its retention) goes through the service kit's `jobs`. They run on
[DBOS Transact](https://docs.dbos.dev/) (ADR 0014), kept in the service's own Postgres: no new
service, nothing else to run.

```ts
import { createJobs } from '@augur/service-kit';

const jobs = createJobs({ app: manifest.id, databaseUrl, log: app.log, audit });

// Started on demand: queued, then taken by one instance.
const render = jobs.define<{ document: string; workspace: string }>(
  'render',
  async ({ document }, { step }) => {
    const pdf = await step('convert', () => convert(document));
    await step('keep', () => store.keepRendition(document, pdf));
  },
  { concurrency: 2, floor: (input) => input.workspace },
);

// On a schedule: once per tick across every instance.
jobs.schedule('remind-late', '*/15 * * * *', async () => remindLate());

await jobs.launch();                                   // after defining them all
const runId = await jobs.start(render, { document, workspace }, { id: `render-${document}` });
await jobs.status(runId);                              // { state: 'queued' | 'running' | 'done' | 'failed' | 'cancelled' }
await jobs.cancel(runId);
```

## What a job promises

- **It finishes.** When the service stops halfway through a run, it carries on from its last finished
  step when it starts again, on this version or the next one.
- **A step may run twice.** DBOS keeps each finished `step`'s result, but the step that was running
  when the service stopped runs again. Make every step safe to repeat; put anything that isn't (a
  mail, a call to another service) in its own step. A step's result must be JSON.
- **A started job with an `id` runs once.** Starting it again returns the same run.
- **Every run is in the audit log.** When a run ends, the app, as itself, records `job.<name>.done`
  or `job.<name>.failed` (with the reason), on the floor `floor` names.
- **A job is renamed when its steps change order.** Runs resume across versions, so a job whose steps
  are reordered between releases gets a new name.

## Where jobs are kept

In the schema `<app's schema>_jobs` (`team-notes` → `team_notes_jobs`), apart from the app's own
tables. On a server the storage service makes it for the app's login along with its own schema
([app-storage.md](app-storage.md)). Without a database, as under `pnpm dev:app`, started jobs run at
once in memory and scheduled ones don't run (the log says so); tests use `memoryJobs()`, whose
`runScheduled(name)` runs a scheduled job by hand.

DBOS stays behind this interface: apps never import it.
