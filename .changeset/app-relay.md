---
"@augur/storage": minor
"@augur/updater": minor
---

Apps reach Postgres and the object store only through relays: db-relay lets only an app's own login on to Postgres, never the platform's superuser or a service's, and bucket-relay passes on only the object store's S3 API, never its admin API. The app runner joins each relay to the networks of the apps that ask for its store, under the store's name, then takes Postgres and Garage themselves off them.
