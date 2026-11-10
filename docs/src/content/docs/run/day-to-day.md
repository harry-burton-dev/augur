---
title: Day to day
description: Starting and stopping AUGUR, trying a build before it's released, and managing apps from the server.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 8
---

Every command here runs from the checkout and uses `pc`, the alias from
[Install AUGUR, step 1](../install/#1-get-the-release):
`alias pc='docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env'`.

## Start and stop

- **Start, or apply a change to `.env`**: `pc up -d`.
- **Stop**: `pc down`. Data stays in the Compose project's volumes (`pgdata`, `wal-archive`, `garage-meta`,
  `garage-data`, and the others in `compose.yml`). `pc down -v` deletes them all.
- **Empty a server and start again**: [Wipe and refresh](../wipe-and-refresh/) keeps its settings and its
  address.

## Upgrade

Deployment (`/upgrades`) upgrades AUGUR for you. By hand, check out the release's `augur@<version>` tag, set
`PLATFORM_VERSION` to it, then run `pc pull && pc up -d --remove-orphans`. Services migrate their own database
schemas on start. The [upgrade guide](https://github.com/harry-burton-dev/augur/blob/main/docs/upgrade.md) has
the whole procedure.

## Try a change before it's released

Build the images from your checkout:

```sh
PLATFORM_VERSION=local pc -f infra/deploy/compose.build.yml up -d --build
```

Use `PLATFORM_VERSION=local` so a later pull doesn't mistake them for a release, with `NODE_AUTH_TOKEN` set in
your shell to a GitHub token with `read:packages` (the builds install the UI kit from GitHub Packages).
Deployment then shows AUGUR as built from source, based on the last release in the checkout, and offers newer
releases against that. To go back to released images without editing `.env`, upgrade from Deployment: a
workbench (`SERVER_RING=dev`) is offered the newest dev build.

## People

Admins add people, change their roles and departments, and turn their sign-in off in **Admin → People**; the
[people guide](https://github.com/harry-burton-dev/augur/blob/main/docs/people.md) has the details. Every
change is in the audit log. Keycloak's own console is rarely needed, and is closed to the network unless
`KEYCLOAK_CONSOLE=open` ([Limits at the front door](../limits/#limits-at-the-front-door)).

## Apps

No app comes with AUGUR except Home, Admin and Deployment. Each other app installs and updates itself from its
own releases once the
[app runner](https://github.com/harry-burton-dev/augur/blob/main/docs/upgrade.md#the-app-runner) is on:
install each from Deployment → Apps once. The whole loop, from a developer's pull request to your server, is in
[Ship an app](https://github.com/harry-burton-dev/augur/blob/main/docs/ship-an-app.md). Admin → Apps turns an
app off without removing it.

### Remove an app from the catalogue

To remove an app altogether, rather than turning it off:

```sh
pc exec registry node -e "fetch('http://localhost:8082/v1/apps/' + process.argv[1], { method: 'DELETE', headers: { 'x-user-id': 'server-admin', 'x-user-name': 'Server admin', 'x-user-roles': 'admin' } }).then((r) => console.log(r.status))" <app id>
```

`204` means it's gone. Removing it is recorded in the audit log.

### Apps from another site

An app whose code lives on another site (its manifest's `entry` is a full address such as
`https://apps.example.org/maps/entry.js`, not a path like `/apps/maps/entry.js`) needs that site allowed in
two places:

1. In **Admin → Apps → Where apps load from**, add `https://apps.example.org`. Until then the registry refuses
   to register the app.
2. Add it to `APP_ORIGINS` in `.env` (space separated), then run `pc up -d web`, so the browser will run its
   code.

The site must serve the entry with a CORS header such as `Access-Control-Allow-Origin: PLATFORM_URL`. Removing
a site in Admin stops offering its apps straight away; they show as **Blocked** in Apps until it's allowed
again.

## Monitoring and sample data

- **Traces, metrics and logs**: each service sends OpenTelemetry to the deployment's own Grafana stack, which
  also runs AUGUR's alert rules, or to your organisation's collector. Set `GRAFANA_ADMIN_PASSWORD` and
  `ALERT_WEBHOOK_TOKEN` in `.env`. See [Observability](https://github.com/harry-burton-dev/augur/blob/main/docs/observability.md).
- **Sample data**: a dev, staging or demo server can be filled with synthetic people, floors, documents and
  entities. See [A staging server](../staging/#sample-data).
