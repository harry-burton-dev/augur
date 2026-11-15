---
title: The app runner
description: How AUGUR installs, upgrades and removes apps from their signed releases, which publishers it trusts, and where apps come from.
status: beta
checkedAgainst: 0.26.0
sidebar:
  order: 23
---

No app ships inside AUGUR. Every app, Home, Admin and Deployment aside, is installed from a signed release by
the app runner, a part of the [updater](../updater/). You install apps in **Deployment → Apps**, and an installed
app's releases are on its page in Deployment. Its settings, internet, developers, previews and removal are on
its row in **Admin → Apps**. No app needs a change to `compose.yml` or `.env`.

The runner keeps apps in a Compose project of their own, `augur-apps`, written in `infra/deploy/apps/`
(`compose.yml`, `state.json` and `files/`, which holds the files each part reads, its secrets among them).
Don't edit those files: every install writes them again.

## Turn it on

With the [updater](../updater/#turn-it-on) running, add three settings to `.env` and run `pc up -d`:

```sh
APP_SECRETS_KEY=<openssl rand -hex 32>
FRONTENDS_BUCKET_SECRET=<openssl rand -hex 32>
APP_PUBLISHERS=harry-burton-dev/augur-app-template
```

- `APP_SECRETS_KEY` is the key every app's database password, bucket secret and sign-in are worked out from.
  Keep it as safe as `POSTGRES_PASSWORD` and never change it once apps are installed: they would lose their
  database login and bucket key until each is installed again.
- `FRONTENDS_BUCKET_SECRET` is the registry's key to the bucket that keeps each version of each app's
  frontend, served at `/apps/<id>/<version>/`. Without it no app can install, and the install says so before
  anything of it runs.
- `APP_PUBLISHERS` is [who the runner trusts](#who-it-trusts).

## Who it trusts

The runner installs a release only when its signer is in `APP_PUBLISHERS`, split by commas or spaces, each as
`owner/repo` or `owner/repo/.github/workflows/<file>`. Nobody else is trusted, so list every repository you
install apps from, the app template's (or your fork of it) among them. Every part's image, and the frontend
bundle, must carry that workflow's signature, and the release must be on app contract 3: an older release is
listed with why it can't install.

An app's id belongs to the repository whose release first installed under it. A release under that id signed by
another repository is refused with why, even after the app was removed and its data has gone: a different
publisher's app needs an id of its own. Renaming the repository counts as another publisher too: there is no way yet
to move an id to a new repository.

## Where apps come from

**Deployment → Apps** lists, under **Install from the app feed**, the released apps that aren't installed, each
with **Install** and what it asks for. The registry reads the feeds every 15 minutes, or at once with **Check for
new apps**.

- By default it reads the same releases as AUGUR's own upgrades, with the same [read key](../releases/#the-read-key).
- `APP_FEEDS` names other feeds instead, split by commas or spaces, each an `https://`, `oci://` or mirror's
  `file:///` address. `APP_FEED_URL`, its old name, is still read when `APP_FEEDS` isn't set. `off` turns the
  feeds off, and they are off by themselves when the [release feed](../releases/#the-release-feed) is a mirror.
- A feed on GitHub's container registry must be signed by its own repository's Release feed workflow, and the
  read key is sent only to GitHub.
- When one feed can't be read, Deployment → Apps says which, and the others' releases are still offered. Nothing
  installs by itself until every feed reads again.
- For an app no feed lists, **Install from an address** reads a release file from an address you paste.

## Default apps

`DEFAULT_APPS` names the apps this deployment always has, split by commas or spaces. On its next read of the
feeds the registry installs each one that isn't installed, from its newest stable release, with its asks agreed
by the deployment rather than an admin; reaching the internet still needs a deployment admin. A default app
can't be removed while it's named: take it out of `DEFAULT_APPS` and run `pc up -d` first. One the feed doesn't
have yet, or that needs a setting filled in first, waits under **Default apps waiting**, which says why. Empty, the default,
installs nothing.

## What an install does

A first install, an upgrade and going back to an older version all take the same steps. Deployment → Apps
follows each one under **In progress**, and asks for your password again before anything is installed or removed.

1. **Verify.** The signer is in `APP_PUBLISHERS` and every image carries its signature.
2. **Storage.** Each part gets what its Score file asks for, held to the deployment's
   [ceilings](https://github.com/harry-burton-dev/augur/blob/main/docs/app-storage.md#limits-and-ceilings). A
   part that asks for more stops the install here, naming the ceiling.
3. **Sign-in.** Identity sets the app's sign-in to its worked-out secret.
4. **Start.** Each image is pulled, and refused if it runs as root. Job parts, a migration say, run to the end
   first. Then the new version starts beside the old one, on a read-only filesystem, with no host folders and no
   added powers.
5. **Health.** Every service part must answer `/healthz` within its time (3 minutes unless the app or
   `APP_READY_SECONDS` says otherwise, never more than 10). If one doesn't, the new version is removed and the old
   one carries on.
6. **Switch.** The gateway is pointed at the new version.
7. **Watch.** For 5 minutes every service part must keep answering. Two misses in a row and the runner goes back
   to the old version, and says why. A first install has nothing to go back to, so it isn't watched.
8. **Retire.** The old version runs 10 more minutes for anyone still holding it, then stops.

How an installed app takes new releases is set on its page in Deployment: **Automatic** (the default) installs
a fix or feature that asks for nothing new, **Ask first** waits for you, and **Hold** offers none. An app's own
settings are filled in under Admin → Apps, never in `.env`.

**Remove from the server**, in Admin → Apps, stops an app's containers and takes its sign-in away. Removing an
app needs a deployment admin. Its data is kept for a grace period, listed in Deployment → Apps under
**Removed, data kept**, and then deleted: see
[When an app is removed](https://github.com/harry-burton-dev/augur/blob/main/docs/app-storage.md#when-an-app-is-removed).
Every install, update, removal and choice is in Activity.

## Each app's network

Each app runs on a network of its own, `app-<id>`, from which nothing reaches the internet. The gateway joins
every app's network, and Postgres, Garage and the telemetry store join only those of apps that ask for them, so
one app can't reach another or a store it wasn't given. An app that asks for the internet stays off it until a
deployment admin allows it in Admin → Apps.

Containers from before the app contract stay on AUGUR's own network, the one the updater is on, usually
`platform_default`; `APPS_NETWORK` names another. While they run, `pc down` can't remove that network: stop them
first with `docker compose -p augur-apps -f infra/deploy/apps/compose.yml down`.

Docker's default address pools hold about 30 networks, so a server with more apps than that needs larger
`default-address-pools` in `/etc/docker/daemon.json`.

## Apps made before the app contract

An app on app contract 2 that AUGUR didn't make doesn't open: code in the shell's page runs as the shell, with
the person's sign-in, so every other app runs in the sandbox. It stays in the app bar and says why. While its
team moves it to the app contract you can let it load in the page on this server: name it in `IN_PAGE_APPS`
(ids split by commas or spaces), then `pc up -d registry`. Take it out once the app is released on the app
contract.

`IN_PAGE_APPS` is going: a coming release removes it, and then no app AUGUR didn't make loads into the
shell's page. Until then, Deployment's **Needs you** lists every app still on contract 2 and whether it opens
only because `IN_PAGE_APPS` names it, and the registry's log says which apps the setting lets in each time
it starts.
