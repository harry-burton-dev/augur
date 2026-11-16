---
"@augur/storage": minor
---

AUGUR makes its own secrets (ADR 0107), switched on. `compose.yml` runs the `make-secrets` job first on every `up`: for each `x-generate` secret a value in `.env` wins, then the one it made before (kept in the `secrets` volume), then a new one. It writes each service only the secrets it reads into a volume of its own (`infra/deploy/made-secrets.json`), so no service has them in its environment any more (only the job and storage, for a value `.env` still sets) and a new deployment needs none of them in `.env`. Keycloak, OpenFGA and Grafana start through `secrets-env.sh`, Postgres and Garage read their files themselves, and the backup reads its own and carries the `secrets` volume in its off-server copy. This replaces the Compose `secrets:` from the earlier change, so Docker Compose 2.24 is no longer needed. Part of PER-507.
