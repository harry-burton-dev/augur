---
title: Glossary
description: The words AUGUR's documentation uses, in one place.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 4
---

### Admin

Someone who manages people, teams and apps in Admin. A **deployment admin** also runs the deployment
itself: its settings, upgrades and backups.

### App

Something people use in AUGUR, built in its own repository and installed from an app feed. See
[concepts](../concepts/#apps).

### App contract

What an app and AUGUR promise each other: the manifest, the Score files, the gateway's API, the SDK and the
kit. An app names the contract major it speaks.

### App feed

Where a deployment finds the apps it can install and their releases.

### Backstage

The organisation's portal above every deployment. Each deployment reports to it what it runs, and it raises
the alarm when one stops reporting.

### Backup

The nightly copy of the whole database, with apps' files. The **restore test** loads it into a throwaway
database each week, and the **off-server copy** keeps both somewhere else.

### Bake

The hours a release runs on a preview server before it can be made stable.

### Channel

Which releases a deployment is offered: **stable**, **beta** or **dev**.

### Deployment

One install of AUGUR, on one server.

### Deployment (app)

The platform app where deployment admins see what's new, upgrade, and go back to an earlier release. It was
called the Upgrade Centre.

### Domain event

A record that something happened, published on a **topic** for others to follow.

### Floor

A level of the organisation: your own, a team's, or the organisation's. See [concepts](../concepts/#floors).

### Front door

The `web` container, the only part of a deployment anyone reaches. It serves the shell and the apps, and
passes `/api` to the gateway and `/sso` to sign-in.

### Gateway

The one way into AUGUR's APIs and every app's service, at `/api`.

### Keycloak

The sign-in service. Its **realm** holds the people and the rules for signing in.

### Manifest

An app's `manifest.json`: what the shell draws for the app before its code runs. See the
[reference](../../reference/schemas/app-manifest/).

### Part

One container of an app, described by a Score file: its service, a worker, or a job.

### `pc`

The alias for `docker compose` with a deployment's own files, made in
[Install AUGUR, step 1](../../run/install/#1-get-the-release).

### Pillar app, platform app

The two kinds of app. Platform apps help people use and manage AUGUR; pillar apps are the foundation of what
the organisation produces with it.

### Point-in-time restore

Putting the database back as it was at any moment in the last 7 days, from a nightly **base backup** and the
**WAL**, Postgres's record of every change. See [Restore to a point in time](../../run/restore-to-a-point-in-time/).

### Preflight

The check run before an install or an upgrade (`scripts/preflight.mjs`).

### Read key

The GitHub token a deployment uses to see and pull releases that aren't public to it.

### Realm job

The `keycloak-config` container, which applies AUGUR's sign-in rules to Keycloak on every start. See
[Settings and secrets](../../run/settings/#the-realm-job).

### Release

One version of AUGUR, tagged `augur@<version>`, with signed images. An app's releases are its own.

### Ring

What kind of server a deployment is: `dev` (a workbench AUGUR is built on), `preview` (a staging server)
or `production`.

### Shell

The web page people open: it signs them in and draws every app's frame.

### Tailnet

A private Tailscale network. Today a deployment is reached only from devices on its tailnet.

### Updater

The optional container that applies upgrades and installs apps from their releases.
