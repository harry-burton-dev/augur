# Sample data (`pnpm seed`)

A fresh AUGUR starts empty. `pnpm seed` fills a dev, staging or demo deployment with a synthetic cast: people, floors (departments and teams), Artifacts documents and Data Atlas entities. It goes only through the public APIs, as the admin who runs it, so it stays in step with the contracts and every change is audited like any other (ADR 0052).

## Allowing it

Seeding is off unless the deployment allows it:

- **Your own machine:** the local stack (`infra/docker-compose.yml`) allows it.
- **A server:** a deployment admin sets `SEED_ALLOWED=true` in `infra/deploy/.env` and runs `pc up -d`. Admin's Status shows whether it is allowed. Never set it where real people work.

On a server that existed before this setting, also add the `platform-cli` sign-in client by hand (docs/upgrade.md, "Sample data, where you allow it").

## Signing in

The seed signs you in from the terminal with a one-time code: it prints an address and a code, you open the address in any browser, sign in as an admin and approve. The token is kept only in memory while the seed runs.
