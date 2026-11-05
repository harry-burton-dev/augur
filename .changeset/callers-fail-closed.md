---
'@augur/service-kit': minor
---

Signed-caller checks fail closed: `callerCheckFromEnv` checks callers against the gateway's key unless `AUGUR_INSECURE_DEV_CALLERS=1` is set (as `pnpm dev:app` does) or a test runner sets `NODE_ENV=test`, and always in production. Before, a service without `NODE_ENV=production` believed any `x-user-*` headers.
