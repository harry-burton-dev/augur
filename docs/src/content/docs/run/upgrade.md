---
title: Upgrade AUGUR
description: Move a running server to a newer release, check it, and go back if you need to.
status: beta
checkedAgainst: 0.26.0
sidebar:
  order: 20
---

Most upgrades start from **Deployment** (`/upgrades`), which shows whether a newer release is out, what changes
in each part, and a **Needs you first** list: a release you have to go through first, settings to add, breaking
changes, and apps that won't open on the new SDK. The registry checks once a day; **Check for updates** checks straight
away.

**Upgrade to …** on that page asks the deployment's [updater](../updater/) to do the steps below for you: it asks
for your password again, then the updater takes a backup, pulls, restarts each part, watches the result and goes
back by itself if anything fails, and the page follows each step. Without the updater, an upgrade you ask for
waits: cancel it there and follow this page by hand. Before any upgrade, read the
[upgrade notes](../../release-notes/upgrade-notes/) from every release after yours.

Commands use `pc`, the alias from [Install AUGUR, step 1](../install/#1-get-the-release).

## Before you start

1. **Read what changed.** The GitHub release for the AUGUR version you're moving to, `augur@<version>` under
   Releases, gathers every part's changes, any breaking change and any new setting, and says which versions it
   upgrades from. If you're more than one release behind and it lists a breaking change, go to the release before
   it first. Look for these, which mean you have something to do:
   - **major** on a service or contract: a caller has to change. AUGUR's own frontends move with it, but anything
     you've built against that API needs checking.
   - a new or renamed setting in `infra/deploy/.env.example`: copy it into your `.env` before starting.
   - "migration" on a service: it changes its database tables when it starts. Within a major version migrations
     only add, so the release before still runs on them.
2. **Check the server can take it.** Unpack the release's deploy bundle over the server's folder (it leaves
   `.env`, `secrets/` and `backups/` alone; on a server that runs from a git checkout,
   `git fetch --tags && git checkout augur@<version>` does the same), and run its preflight, which needs nothing
   installed but Docker. Unpacking overwrites any deploy file you've changed: keep a change in `.env` or a
   `compose.override.yml` instead.
   ```sh
   v=<version>; curl -fL "https://github.com/harry-burton-dev/augur/releases/download/augur%40$v/augur-deploy-$v.tar.gz" | tar -xz && sha256sum --quiet -c SHA256SUMS
   docker run --rm -v "$PWD:/augur:ro" -w /augur node:22-alpine node scripts/preflight.mjs
   ```
   It reads your `.env`. It stops you if your version can't upgrade straight to this one (and names the release
   to go through first) or a setting this release needs isn't set, and it lists what the release breaks. Run it
   again until it says **Ready**.
3. **Check Deployment → Health and Backups.** Everything should be Running, and Backups shouldn't need a look.
   Fix that first, so a problem afterwards is clearly the upgrade's.
4. **Take a backup and test it**, so you can go back:
   ```sh
   pc exec backup /bin/sh /backup/backup.sh --now
   pc exec backup /bin/sh /backup/backup.sh --restore-test
   ```
   The last line ends with `restored and checked`. If it says FAILED, stop and look at why before upgrading.
5. **Note where you are**: the `PLATFORM_VERSION` in your `.env`. That's what you'd go back to.

## Upgrade

```sh
v=<version>                               # the release you unpacked for the preflight
sed -i "s/^PLATFORM_VERSION=.*/PLATFORM_VERSION=$v/" infra/deploy/.env
pc pull && pc up -d --remove-orphans
```

The pull fetches that release's images before anything stops. Each service migrates its own tables as it starts,
and containers whose image didn't change keep running. Keycloak and Postgres only change when their image tag in
`compose.yml` does.

## Check it worked

Every release has been upgraded to from the newest release before it, with data, and gone back from, in AUGUR's
own tests: both by code alone and by restoring the backup taken before the upgrade, as in [Going back](#going-back). Your server can still differ, so check it yourself too.

- `pc ps` shows each of AUGUR's services as `healthy` about a minute after it starts. One that stays
  `unhealthy` or `starting` is the one to look at in `pc logs`.
- Open **Deployment → Health**. Every part should be Running, with the new versions in the Version column.
- Sign in as yourself and as someone without the admin role, and open an app or two.
- A tab that was open through the upgrade, or through going back, says so in its notifications once it's
  back in view or its notifications reconnect, with a Reload button. Until someone reloads, that tab still
  runs the shell it loaded.
- `pc logs --since 10m gateway identity registry events` shouldn't show errors. Every log line carries a
  `requestId`; the same id is in the `x-request-id` header of the response, so a problem someone reports can be
  found across every service's logs.

## Upgrades that start by themselves

AUGUR and every installed app each have one record saying how they take new releases: **Automatic**, **Ask
first** or **Hold**; how far Automatic goes (patch releases only, or minor ones too); an optional pin, a version
range such as `0.13.x`; and the weekly windows an automatic upgrade may start in. Change them on each unit's
page in Deployment.

- Until an admin changes it, **AUGUR on a production server installs its patch releases by itself on Sunday at
  02:00, for two hours**. On a preview server or a workbench it installs them at any time.
- Windows are in the deployment's time zone: set `DEPLOYMENT_TIME_ZONE` in `.env`, such as `Europe/London`.
  Without it they're in UTC.
- A major release, a 0.x minor, one that needs a setting only a person can give, or one an earlier try didn't
  finish always waits for an admin. Nothing starts by itself until an admin has upgraded AUGUR on that server
  once. An upgrade an admin asks for starts at once, whatever the window.
- A failed upgrade, or one that went back by itself, stays in Deployment's **Needs you** for every admin until
  one of them marks it looked at.
- Upgrading, going back and changing how a unit takes updates need the `deployment-admin` role, and your
  password again if you last entered it more than 10 minutes ago.

## Going back

If an upgrade went back by itself, didn't install, or kept running after its watch saw a problem, start from
[When an upgrade goes back by itself](https://github.com/harry-burton-dev/augur/blob/main/docs/upgrade-went-back.md): four checks, and when a restore is worth it.

**Deployment → Go back** does this for you while no release in between is breaking. If Deployment won't open,
`/recover/` on the same address does the same with nothing but a sign-in: it shows what the server runs and asks
for the same go-back, so it needs the updater too.

By hand, code and data are separate, so going back is two steps, and the second is only needed if the new release
migrated data:

1. **Code**: the same steps with the version you noted. Unpack its deploy bundle (or
   `git checkout augur@<it>`; a release from before deploy bundles has its files in its tag's source archive, as
   in [Install AUGUR, step 1](../install/#1-get-the-release)), set `PLATFORM_VERSION` back, and run `pc up -d --remove-orphans`. The old images
   are still on the server, so nothing is downloaded.
2. **Data**, only if the older services fail on the newer tables: restore the backup you took before upgrading,
   as in [Backups](../backups/#restore-the-database-from-a-backup). Anything changed since that backup is lost,
   so check Admin → Activity first for what that is.

For one app rather than the whole of AUGUR, Deployment can go back to an earlier version of just that app
([The app runner](../app-runner/)).
