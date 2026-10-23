---
"@augur/storage": minor
"@augur/service-kit": minor
"@augur/registry": minor
---

App storage: an app can keep its own database schema and files on the platform. A new one-shot `storage` service gives each app listed in `APP_STORAGE` a database login that owns one schema, and a bucket on Garage (the new S3-compatible object store in the deploy stack) with a key that opens only that bucket, from secrets in `.env`. Postgres gains pgvector. The service kit adds `appStorageFromEnv()`, manifests may say `"storage": { "database": true, "bucket": true }`, and the nightly backup now takes apps' files as well. See docs/app-storage.md.
