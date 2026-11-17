---
"@augur/storage": minor
"@augur/service-kit": minor
"@augur/updater": patch
---

The code for AUGUR making its own secrets (ADR 0107), not yet switched on. The service kit takes each file in the folder `SECRETS_DIR` names as the setting it is named after. The storage image gains the `make-secrets` job (`node dist/secrets-job.js`): for each `x-generate` secret, a value in the environment wins, then the one it made before, then a new one, and it writes each service its own folder as `infra/deploy/made-secrets.json` will say. The updater runs that job before every other part when a release has it. Nothing changes on a server until the next pull request adds the job to `compose.yml`. Part of PER-507.
