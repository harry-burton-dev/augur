# App storage

An app can keep its own data on the platform: a **database schema** in the platform's Postgres, and a **bucket** in its object store. Both belong to the app alone. The app's database login owns its schema and can't read anyone else's, and its bucket key opens only its bucket. The platform never reads either.

## What a part asks for

On app contract 3 each part of an app says what it needs in its Score file's `resources`, and reads what it gets as `${resources.<name>.<output>}` in its `variables`, `command`, `args` and `files`. The app runner's provisioners give it this, and nothing it didn't ask for:

| Type | Params | What the part reads |
| --- | --- | --- |
| `augur-gateway` | `inbound` (true for the one part the gateway sends `/api/<id>/*` to) | `url`, `public_url`, `client_id`, `client_secret` (secret), `token_url`, `caller_keys_url`, `inbound` |
| `augur-database` | `connections` (1 to 100) | `host`, `port`, `name`, `user` (`app_<id>`), `schema` (`<id>`), `password` (secret), `connections` |
| `augur-bucket` | none | `endpoint`, `region`, `bucket` (`<id>`), `access_key_id`, `secret_access_key` (secret) |
| `augur-scratch` | `size` (`<n>Mi` or `<n>Gi`) | the folder itself, as a volume's `source: ${resources.<name>}`, writable |
| `augur-files` | `label`, `detail` | the folder itself, read-only, which an admin fills |
| `augur-telemetry` | none | `otlp_endpoint` (where AUGUR's own services send telemetry; empty without a collector), `service_name` |
| `augur-floor-graphs` | `classes` (the class IRIs it needs, such as `kg:Ship`), `actions` (the actions it takes, such as `retain`): the registry refuses an install where the deployment's knowledge graph lacks one, saying which | `url`, the floor graphs API through the gateway |
| `augur-outbound` | `hosts`, `why` | nothing; Admin shows the ask |
| `augur-settings` | `ids` | one output per setting: the value a deployment admin gave it in Admin → Apps, else the manifest's default, else empty (secret for a `secret` setting, read only in `files`); a required setting with neither stops the install. A changed value starts again the parts that read it |

A secret output may be read only in `files`: the runner refuses a part that reads one in a variable, its command or its arguments. Each file a part names is written in `infra/deploy/apps/files/` and mounted into its container as a Compose secret; the Compose project and `state.json` hold no secret. Score's `$${` is a literal `${`.

The login, schema and bucket are the same for every part of an app, and both slots of an upgrade share them. A scratch or files folder is a Docker volume of its own for each part and resource, `app-<id>-<part>-<resource>`, kept across upgrades; a preview's go when it's taken away. Docker doesn't cap a volume's size, so `size` is held to the deployment's ceiling when the app installs, not enforced on the disk. Until Admin can fill an `augur-files` folder, put files in it from the server: `docker run --rm -v app-<id>-<part>-<resource>:/f -v "$PWD":/from:ro alpine cp -r /from/. /f/`.

A part that asks for nothing gets nothing: no store, no sign-in, no secrets, no folders, and no addresses of AUGUR's services. Each app's parts are on a network of their own, which the gateway joins, and Postgres, the object store and the collector only when a part asks for them; nothing on it reaches the internet.

## Limits and ceilings

Each part's Score file sets `resources.limits.memory` and `resources.limits.cpu`, and the runner applies them to its container. A deployment holds those asks to its ceilings, set in `.env`:

| Setting | Default | What it caps |
| --- | --- | --- |
| `APP_PART_MEMORY_CEILING` | `2Gi` | memory, one part |
| `APP_PART_CPU_CEILING` | `2` | CPU, one part |
| `APP_MEMORY_CEILING` | `4Gi` | memory, an app's parts together |
| `APP_CPU_CEILING` | `4` | CPU, an app's parts together |
| `APP_SCRATCH_CEILING` | `1Gi` | scratch space, an app's parts together |
| `APP_DATABASE_CONNECTIONS` | `30` | the app's database login, every part and both slots together; parts that ask for `connections` may not ask for more between them |
| `APP_READY_SECONDS` | `180` | how long a part has to answer `/healthz`, or a job to finish, when its file sets no `augur.dev/ready-seconds` (never more than 600) |

A release that asks above a ceiling stops at the install's storage step, before anything starts, with the ceiling and the ask named. To let it in, raise the setting and ask again.

## How the storage container makes them

### What an app gets

| | What it is | The app's service reads |
| --- | --- | --- |
| Database | A login `app_<id>` that owns the schema `<id>` (dashes become `_`), with that schema first on its search path. Postgres has [pgvector](https://github.com/pgvector/pgvector), so the app can `create table … (embedding vector(1024))`, and [pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html), for names spelt nearly alike (`similarity(label, $1)`, and `gin (label gin_trgm_ops)` indexes). | `DATABASE_URL` |
| Jobs | A second schema, `<id>_jobs`, owned by the same login, where the service kit keeps the app's background and scheduled jobs ([jobs.md](jobs.md)). | `DATABASE_URL` |
| Bucket | A bucket named `<id>` on [Garage](https://garagehq.deuxfleurs.fr/), an S3-compatible store, and a key that can read and write only that bucket. | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |

`appStorageFromEnv()` from `@augur/service-kit` reads them, ready for `pg` and an S3 client:

```ts
import pg from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { appStorageFromEnv } from '@augur/service-kit';

const { databaseUrl, bucket } = appStorageFromEnv();
const db = new pg.Pool({ connectionString: databaseUrl });
const s3 = new S3Client({ endpoint: bucket!.endpoint, region: bucket!.region, forcePathStyle: true,
  credentials: { accessKeyId: bucket!.accessKeyId, secretAccessKey: bucket!.secretAccessKey } });
// s3.send(new PutObjectCommand({ Bucket: bucket!.name, Key: 'a/b.pdf', Body }))
```

The app creates its own tables, in its own migrations, when its service starts, as the platform's services do.

The login may hold at most 30 connections at once (`APP_DATABASE_CONNECTIONS` in `.env`), so an app that leaks them runs out alone, and AUGUR's services keep theirs (ADR 0073). Keep the app's pools well under it, counting its workers and its jobs.

An app's storage that can't be made (a missing or short password, a bad id, a bucket Garage refuses) never stops AUGUR: the storage job sets up the platform's own first, skips that app, says why in `pc logs storage`, and the app alone doesn't start until it's fixed.

Say what the app keeps in its manifest, so admins can see it:

```json
"storage": { "database": true, "bucket": true }
```

### Giving an app its storage (admins)

The `storage` service makes each app's login, schema, bucket and key from `.env` on every `up`, then stops. For an app with id `notes`:

1. Add to `infra/deploy/.env`, with `openssl rand -hex 32` for each secret:
   ```sh
   APP_STORAGE=notes
   NOTES_DATABASE_PASSWORD=…
   NOTES_BUCKET_SECRET=…
   ```
   `APP_STORAGE` lists every app with storage, space separated. Each app's settings start with its id in capitals, with `_` for `-`.
2. `pc up -d`. `pc logs storage` says what it made.
3. Give the app's service these settings (in its own compose service, beside `SERVICE_CLIENT_SECRET`):
   ```yaml
   DATABASE_URL: postgres://app_notes:${NOTES_DATABASE_PASSWORD}@postgres:5432/platform
   S3_ENDPOINT: http://garage:3900
   S3_BUCKET: notes
   S3_ACCESS_KEY_ID: …   # pc logs storage prints it: "opened by key GK…"
   S3_SECRET_ACCESS_KEY: ${NOTES_BUCKET_SECRET}
   ```

With `APP_SECRETS_KEY` set in `.env` (`openssl rand -hex 32`), an app's two secrets don't have to be written there at all: the storage container works each one out from that key and the app's id (`appSecretFor` in the service kit), and so does the app runner when it installs the app, so it can hand the app the same ones. A secret written in `.env` still wins, so apps set up the old way keep theirs. Changing `APP_SECRETS_KEY` changes every worked-out secret at once.

To change a secret, put the new one in `.env`, `pc up -d`, and restart the app. The database password changes in place; a new bucket secret makes a new key (its id is printed again) and removes the old one. A removed key's id is gone for good: Garage never takes it back, so putting an old secret back in `.env` fails with words saying so, and only a new secret helps. Removing an app from `APP_STORAGE` leaves its data alone.

A pull request's preview of an app gets scratch storage under its own id, such as `notes-pr12` (login `app_notes_pr12`, schema `notes_pr12`, bucket `notes-pr12`), made and taken away by the app runner ([app-previews.md](app-previews.md)). Taking it away runs the storage container with `APP_STORAGE_DROP=notes-pr12`, which drops that schema and login and empties and deletes that bucket. It only ever takes an id of that shape, so an app's own storage can't be dropped this way. No storage is made or dropped under an id a part of AUGUR answers to (`identity`, `public`, `augur-…`; `RESERVED_APP_IDS` in `@augur/service-kit`), so an app's schema never sits among the platform's own.

An app AUGUR no longer runs can have its data taken away once on each server: its id in `RETIRED_APPS` (set in `compose.yml` by the release that took the app out, ADR 0075) makes the storage job drop its schemas and login and empty and delete its bucket, then note it in `public.storage_retired_apps`, so a new app given the same id later is never touched. The app's bucket key stays, opening nothing: a deleted key's id can never be used again, and the id comes from the app's secret, so deleting it would stop the app's storage being set up again with the same secret (going back to the release before, or installing the app again). An id that's also in `APP_STORAGE` is kept, and noted as kept. If taking one fails, `pc logs storage` says why and the job tries again on the next `up`.

Both stores are inside the compose network only: an app hosted elsewhere can't reach them.

## When an app is removed

Removing an app from the server (Admin → Apps, **Remove from the server**) stops its parts and takes its sign-in away at once, so nothing of it can call AUGUR. Its data stays for `APP_DATA_GRACE_DAYS` days (30 when unset, from 1 to 365): its schema and login, its bucket, its scratch folders, the values of its settings and its floors' grants. Admin → Apps lists it under **Removed, data kept** with the day they go. Installing it again before then keeps everything and calls the deletion off.

When the day comes, the app runner takes a backup, then runs the storage container with `APP_STORAGE_RETIRE=<id>`, which drops the app's schemas and login and empties and deletes its bucket, the way `RETIRED_APPS` does, and notes it in `public.storage_retired_apps`. The runner removes its scratch volumes and makes sure its sign-in is gone, and the registry forgets its settings, developers, floors, how it followed updates and its catalogue entry. A try that fails is tried again an hour later, then two hours, and so on up to once a day, each after a backup; Admin → Apps shows why it failed. A waiting deletion can't be cancelled: install the app again to keep its data. The backup is the only copy left after that.

The folders an admin fills for an app (`augur-files`) are not deleted: they are the admin's own files, and stay in their Docker volumes (labelled `augur.app=<id>`) until you remove them with `docker volume rm`.

## Backups

The nightly backup takes apps' schemas with the rest of the database, and apps' files as `objects-YYYY-MM-DD.tar.gz` beside it (see [Backups](src/content/docs/run/backups.md)).

## Locally

`docker compose -f infra/docker-compose.yml up` runs Postgres with pgvector, Garage (S3 at http://localhost:3900, admin API at :3903 with token `platform-local-only`) and the `storage` service; set `APP_STORAGE` and the app's secrets on `storage` there to try it.
