# App storage

An app can keep its own data on the platform: a **database schema** in the platform's Postgres, and a **bucket** in its object store. Both belong to the app alone. The app's database login owns its schema and can't read anyone else's, and its bucket key opens only its bucket. The platform never reads either.

## What an app gets

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

Say what the app keeps in its manifest, so admins can see it:

```json
"storage": { "database": true, "bucket": true }
```

## Giving an app its storage (admins)

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

To change a secret, put the new one in `.env`, `pc up -d`, and restart the app. The database password changes in place; a new bucket secret makes a new key (its id is printed again) and removes the old one. Removing an app from `APP_STORAGE` leaves its data alone.

A pull request's preview of an app gets scratch storage under its own id, such as `notes-pr12` (login `app_notes_pr12`, schema `notes_pr12`, bucket `notes-pr12`), made and taken away by the app runner ([app-previews.md](app-previews.md)). Taking it away runs the storage container with `APP_STORAGE_DROP=notes-pr12`, which drops that schema and login and empties and deletes that bucket. It only ever takes an id of that shape, so an app's own storage can't be dropped this way.

Both stores are inside the compose network only: an app hosted elsewhere can't reach them.

## Backups

The nightly backup takes apps' schemas with the rest of the database, and apps' files as `objects-YYYY-MM-DD.tar.gz` beside it (see [Running AUGUR on your own server](deploy.md#backups)).

## Locally

`docker compose -f infra/docker-compose.yml up` runs Postgres with pgvector, Garage (S3 at http://localhost:3900, admin API at :3903 with token `platform-local-only`) and the `storage` service; set `APP_STORAGE` and the app's secrets on `storage` there to try it.
