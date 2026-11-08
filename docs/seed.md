# Sample data (`pnpm seed`)

A fresh AUGUR starts empty. `pnpm seed` fills a dev, staging or demo deployment with a synthetic cast: people, floors (departments and teams), and documents and entities for the apps that keep them. No app ships with AUGUR (ADR 0075), so on a deployment without an app at `/api/folio` or `/api/atlas` the seed leaves the documents and entities out, saying why. It goes only through the public APIs, as the admin who runs it, so it stays in step with the contracts and every change is audited like any other (ADR 0056).

## Allowing it

Seeding is off unless the deployment allows it:

- **Your own machine:** the local stack (`infra/docker-compose.yml`) allows it.
- **A server:** a deployment admin sets `SEED_ALLOWED=true` in `infra/deploy/.env` and runs `pc up -d`. Admin's Status shows whether it is allowed. Never set it where real people work.

On a server that existed before this setting, also add the `platform-cli` sign-in client by hand (docs/upgrade.md, "Sample data, where you allow it").

## Signing in

The seed signs you in from the terminal with a one-time code: it prints an address and a code, you open the address in any browser, sign in as an admin and approve. The token is kept only in memory while the seed runs.

## Running it

```sh
pnpm seed                                  # your local stack (gateway :8080, Keycloak :8180)
pnpm seed --url https://augur.example.ts.net
pnpm seed --check                          # checks the data file and says what it would make; calls nothing
```

`--data <file>` seeds another cast, `--ledger <file>` keeps the ledger elsewhere, and `--issuer <realm address>` names the sign-in realm when it isn't at `<url>/sso/realms/platform`. `AUGUR_TOKEN` skips the sign-in with an admin's access token, for a script that already holds one.

Running it again adds only what is missing: floors are matched by name under the same parent, people by username, documents by title in their library, and entities by kind and label. People who already exist keep their floors and roles.

## The cast

The cast is a data file, `scripts/seed/cast.json` by default. Nothing in the code names a person, floor, document or entity, so each deployment can seed its own cast with `--data`. It holds:

- `synthetic`: how everything is marked. `emailDomain` (under `.invalid` unless `emailDomainDelivers` is true, so mail to sample people never reaches anyone), `usernamePrefix` and `note`, the line added to the end of every document and entity description.
- `floors`: departments, each with `teams` inside (up to five levels).
- `people`: each with a `key` (their username is the prefix and the key), names, the `floors` they are on, and `roles`. Sample people never get `deployment-admin`.
- `documents`: per floor (`org` is the organisation's), the documents to add to that floor's library, or the one named `library`.
- `entities`: Data Atlas entities by ontology kind (`type`), with a label, aliases and description, on the organisation's floor or the one named `floor`.

`--check` lists every mistake in the file at once.

## What it can't do yet, and says so

The seed acts as the admin who runs it, so it only adds where that admin can:

- **Documents go into a library that is already on their floor.** Making a library is for the floor's leads, so where there is none, the seed says so and moves on.
- **Documents and entities on a floor the admin isn't on are left out**, with the reason. Sample people add their own once the run suite can sign them in (Linear PER-296).

## The ledger

The seed writes what it made, and each new sample person's one-time password, to `.seed/<host>.json` (ignored by git, readable by you only). Each password is written as soon as it is given, so a run that stops half way loses none. The run suite signs sample people in with them, and choosing a new password at first sign-in is part of its script. Delete the ledger when the deployment is wiped.
