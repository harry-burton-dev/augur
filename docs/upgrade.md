# Upgrading AUGUR

Moving a running server from one release to the next. Commands use the `pc` alias from [deploy.md](deploy.md):

```sh
alias pc='docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env'
```

## Before you start

1. **Read what changed.** The GitHub release for the AUGUR version you're moving to, `augur@<version>` under Releases, gathers every part's changes, any breaking change and any new setting, and says which versions it upgrades from. If you're more than one release behind and it lists a breaking change, go to the release before it first. Each package's `CHANGELOG.md` has the detail. Look for these, which mean you have something to do:
   - **major** on a service or contract: a caller has to change. The platform's own frontends move with it, but anything you've built against that API needs checking ([versioning.md](versioning.md)).
   - a new or renamed setting in `infra/deploy/.env.example`: copy it into your `.env` before starting.
   - "migration" on a service: it changes its database tables when it starts. Migrations only add; none removes data.
2. **Check Admin → Status.** Everything should be Running and the heading shouldn't say "Backups need a look". Fix that first, so a problem afterwards is clearly the upgrade's.
3. **Take a backup and test it**, so you can go back:
   ```sh
   rm -f infra/deploy/backups/platform-$(date -u +%Y-%m-%d).sql.gz   # today's, so a fresh one is taken
   pc exec backup /bin/sh /backup/backup.sh --once
   pc exec backup /bin/sh /backup/backup.sh --restore-test
   ```
   The last line ends with `restored and checked`. If it says FAILED, stop and look at why before upgrading.
4. **Note where you are**: `git rev-parse HEAD`. That's what you'd go back to.

## Upgrade

```sh
git pull
pc up -d --build --remove-orphans
```

Images are rebuilt from the repo, each service migrates its own tables as it starts, and containers that didn't change keep running. Keycloak and Postgres only change when their image tag in `compose.yml` does.

## Check

- Open **Admin → Status**. Give it a minute: every part should be Running, with the new versions in the Version column.
- Sign in as yourself and as someone without the admin role, and open an app or two.
- `pc logs --since 10m gateway identity registry events` shouldn't show errors. Every log line carries a `requestId`; the same id is in the `x-request-id` header of the response, so a problem someone reports can be found across every service's logs.

## Release notes that need you

- **Each service signs in as itself** (the release that removes the shared token): `SERVICE_TOKEN` is gone. Before upgrading, add `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET` and `EVENTS_CLIENT_SECRET` to `.env` (`openssl rand -hex 32` for each), and remove `SERVICE_TOKEN`. Identity makes the matching Keycloak clients when it starts. An app with its own service needs a sign-in from Admin, Apps (**Issue a new sign-in**) as its `SERVICE_CLIENT_SECRET`.

### Renamed to AUGUR

Nothing to do: the upgrade is the usual `git pull` and `pc up -d --build`. The shell, page title and Admin say AUGUR, and packages are `@augur/*`. Your server's identifiers are left alone so nobody is signed out and no data moves: the Keycloak realm is still `platform`, the database and Compose project are still `platform`, the `.env` keys keep their `PLATFORM_` names, and your address stays `https://platform.<tailnet>.ts.net`.

Two optional touches:

- **Sign-in page title**: Keycloak only reads the realm file on first start, so your sign-in page still says "Platform". In the Keycloak console (`PLATFORM_URL/sso/admin`), open the `platform` realm, **Realm settings**, and set **Display name** to `AUGUR`.
- **Address**: to be at `https://augur.<tailnet>.ts.net`, set `TS_HOSTNAME=augur` and change `PLATFORM_URL` to match in `.env`, then in the Keycloak console update the **shell** client's redirect URIs and web origins to the new address before `pc up -d`. Everyone signs in again.

## Going back

Code and data are separate, so going back is two steps, and the second is only needed if the new release migrated data:

1. **Code**: `git checkout <the commit you noted> && pc up -d --build --remove-orphans`.
2. **Data**, only if the older services fail on the newer tables: restore the backup you took before upgrading, as in [deploy.md](deploy.md#backups). Anything changed since that backup is lost, so check Admin → Activity first for what that is.

For one app rather than the whole platform, Admin → Apps can give the shell an earlier version of the app instead ([versioning.md](versioning.md#going-back-to-an-earlier-app-version)).
