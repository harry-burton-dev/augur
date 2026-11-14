---
"@augur/storage": minor
"@augur/updater": minor
---

Apps reach Postgres and the object store only through the apps' relay: it lets only an app's own login on to Postgres, never the platform's superuser or a service's, and passes on only the object store's S3 API, never its admin API. The app runner joins the relay to apps' networks as postgres and garage, and takes Postgres and Garage themselves off them.
