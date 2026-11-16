---
title: The updater
description: The optional container that upgrades AUGUR and installs apps for you, what it checks, and how to turn it on.
status: beta
checkedAgainst: 0.26.0
sidebar:
  order: 21
---

The updater is an optional container that runs an upgrade asked for with **Upgrade to …** in Deployment, goes
back by itself when one fails, and runs the [app runner](../app-runner/) that installs apps. Without it, every
upgrade is [done by hand](../upgrade/).

## Turn it on

It drives Docker, which can start any container, so it has the run of the server. Only it can reach Docker
(through `docker-proxy`, on a network of their own), and only an admin who has just entered their password can
ask it for anything.

1. In `.env`, turn it on and tell it where it is. `PLATFORM_DIR` is the full path of `infra/deploy` on the
   server; it's mounted at that same path, so Compose's `./` paths still name your files.
   ```sh
   COMPOSE_PROFILES=updater
   PLATFORM_DIR=/home/you/augur/infra/deploy
   UPDATER_CLIENT_SECRET=<openssl rand -hex 32>
   ```
2. It runs as user 1000 and writes `.env` and the deploy files, so user 1000 has to be able to write
   `infra/deploy`. On most servers that's the first account, so if `id -u` prints 1000 and you own the folder
   there's nothing to do; otherwise `sudo setfacl -R -m u:1000:rwX -m d:u:1000:rwX infra/deploy`.
3. For private images, the deployment's [read key](../releases/#the-read-key), which the updater signs in with.
   (Servers from before read keys used a read:packages token as `infra/deploy/secrets/image-pull-token`, owned by
   user 1000, with `IMAGE_PULL_USER=<its GitHub username>` in `.env`.)
4. Run `pc up -d`. The realm job makes the updater's sign-in, and an upgrade you ask for starts within half a
   minute.

Docker must be listening on `/var/run/docker.sock` (rootless Docker isn't). From then on, upgrade from Deployment,
or by hand; both work. An upgrade waiting in Deployment while you upgrade by hand is best cancelled first.

## What an upgrade does

It checks every image is signed by AUGUR's Release workflow and is the one the release names, checks the settings
it needs are set, and checks there are at least 2 GiB free in `infra/deploy`. Then it takes a backup and
test-restores it, pulls, restarts Keycloak (waiting up to five minutes, as its first start on a new Keycloak minor
migrates its database), reruns the storage job and restarts identity, registry, events, models, gateway and web
in turn, waiting for each to answer on its new version. Each part gets up to 5 minutes, as services migrate their
databases on their first start.

If one doesn't answer, it puts every part back on the release you were on, and Deployment says why and which
backup was taken. With a breaking release in between, it doesn't once any part has restarted on the new release,
since the old one may not read what was migrated: Deployment says the server is partly on the new release, for
you to decide.

A release with an image for something the server runs that this updater doesn't know is refused before anything
changes, and Deployment says which; that release is upgraded by hand.

## The watch after an upgrade

An upgrade isn't done once every part answers: the updater watches it for 10 more minutes. Every half minute it
signs in as itself, with a fresh token (so Keycloak and its database must both work), and checks how AUGUR's own
services' calls went at the gateway; apps are counted apart, so an app's errors can't send AUGUR back. Every two
minutes it checks every part is still ready. If sign-in fails twice in a row, a part stops answering, or more than
5% of at least 20 calls fail, it goes back to the release it came from, and Deployment says what it saw. If a
breaking release lies between, it doesn't go back: it says what it saw, and the release keeps running for you to
decide.

With fewer than 20 calls in the 10 minutes, as is usual in a night-time window, the result says it was too quiet
to judge errors, and a light watch goes on: every 5 minutes it counts AUGUR's calls since its last look, until
there have been 20, for at most a day. If too many failed by then, AUGUR doesn't go back by itself, because
people's work is on the new release: it shows in **Needs you** for an admin to decide. Going back to an earlier
release isn't watched. The updater does nothing else while it watches, so an app install asked for meanwhile
starts after.

To see what the watch would see right now, after an upgrade by hand say, run one look of it:

```sh
pc exec -T updater node dist/index.js check
```

It prints one line of JSON: `ok`, what it looked at, and each problem in a sentence, and exits 1 when there's any.
Unlike the watch, it doesn't let sign-in miss once or wait for a part to come back.

## Settings and deploy files

Settings entered in Deployment only add. One that says what the server trusts (`SERVER_RING`, `IMAGE_SIGNER`,
`PLATFORM_IMAGES`, `APP_SECRETS_KEY`, any `COMPOSE_*` and the like), one `.env` already has, or one that isn't a
plain setting name is refused. **Upgrade to …** has a field for each new setting a release adds; what you type
goes to the updater (never stored, and only the setting's name is audited) and into `.env`. A new required
setting whose name ends in `_SECRET`, `_PASSWORD` or `_TOKEN` gets no field: the updater makes one up and says
which it made.

`.env` is written whole and renamed into place. Where the updater can't keep the file's owner it writes it in
place instead, keeping `.env.before-upgrade` beside it until the write checks out: if a message says that file
holds the old settings, copy it over `.env` first. While an upgrade runs it keeps a note of it in
`infra/deploy/.updater-upgrade.json`: if the updater or the server restarts partway, it goes back using it. Don't
delete it during an upgrade; it goes when the upgrade ends.

Each release's updater image carries that release's deploy files (`infra/deploy`). When the release you upgrade to
changes some, the updater checks each against the signed release file, writes them into `infra/deploy`, then
starts anything they add and recreates anything that mounts a changed file. Going back puts the old files back.
It stops, and Deployment says why, when:

- a file the release changes has been **edited on the server**. The updater never overwrites your edits: put the
  file back as your release has it (from its deploy bundle, or `git checkout augur@<version> -- infra/deploy/<file>`
  in a checkout), and keep your change in `.env` or a `compose.override.yml` instead;
- a **new required setting that only you can give** (an address, say) wasn't entered.

After the updater has written deploy files, the server's `infra/deploy` is the new release's, ahead of the bundle
you unpacked or your git checkout. That's expected. Don't unpack an older bundle, `git checkout` or `git pull` over
it; to match the rest of the folder, unpack the bundle of the version you now run.
