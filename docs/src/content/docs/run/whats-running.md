---
title: What runs on a server
description: The containers a deployment runs, what each one does, and how they reach each other.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 11
---

A deployment is one server running AUGUR's containers with Docker Compose, from `infra/deploy/compose.yml`.
Only the front door can be reached from outside; everything else talks on the Compose networks.
[Concepts](../../get-started/concepts/) explains how the parts fit together.

## Services

AUGUR's services are identity, registry, events, permissions, knowledge, models and the gateway. Only the
gateway is reachable, and only through `/api`. Services talk to each other on the Compose network, each signed
in as itself: the [realm job](../settings/#the-realm-job) makes each service's Keycloak sign-in from its
`*_CLIENT_SECRET` on every `up`.

The models service, AUGUR's gateway to language models, is off until you set a model and turn it on (see
[Agents and models](https://github.com/harry-burton-dev/augur/blob/main/docs/agents.md)).

## Permissions

The permissions service answers who may do what, from relationships OpenFGA keeps in Postgres. It copies the
floors, the positions on them and who holds each from identity as soon as identity announces a change (a
handover counts within a couple of seconds), and in full every `PERMISSIONS_COPY_SECONDS` (300) to put right
anything an announcement missed. A copy that would take away more than half of what it holds at once is held
back and logged, and Status shows how the last copy went.

It also copies who holds the Keycloak roles `admin`, `deployment-admin` and `publisher`, with each admin as an
admin persona. For now the events, identity, registry and models services ask it beside each of their own admin and
lead checks and compare the answers, without acting on its answer
([Observability](https://github.com/harry-burton-dev/augur/blob/main/docs/observability.md#what-the-alert-rules-read)).

Admin personas are kept here too. Someone who holds one signs in again, gives a reason, and acts as it for at
most `PERSONA_DEPLOYMENT_ADMIN_MINUTES` (60) as a deployment admin or `PERSONA_ORG_ADMIN_MINUTES` (480) as an
org admin. Starting and ending one is in the audit log. While someone acts as one, the shell says so on every
call, and the gateway checks the session is still live before it passes the persona on beside the person; an
ended session, or a call made for an app, is refused.

## Apps

Home, Admin and Deployment come with AUGUR. No other app does: an admin installs each from the app feed, and
the app runner gives it its own container, sign-in, schema and bucket
([Ship an app](https://github.com/harry-burton-dev/augur/blob/main/docs/ship-an-app.md)).

## The front door

The `web` container is nginx, serving the shell and the apps' frontends, with `/api` and `/sso` behind it.
Each build of an app's frontend is kept in Garage's `augur-frontends` bucket and served from a folder of its
own, `/apps/<id>/<version>_<digest>/`, so it never changes under someone using it, and a new build of the same
version reaches browsers straight away.

The shell's page has a Content Security Policy: the browser runs only scripts from AUGUR's own address, the
shell's own inline scripts (its import map and the note shown if the kit can't be loaded), the kit's site when
`KIT_URL` names another, and the sites in `APP_ORIGINS`, and the page talks only to AUGUR (plus those sites).
Fonts come from Google Fonts. Its limits are in [Limits and health](../limits/#limits-at-the-front-door).

## Storage

Postgres (with pgvector) holds every service's and app's schema. Garage holds apps' files, reachable only
inside the Compose network. The `storage` job gives each app in `APP_STORAGE` its own login, schema and bucket
([App storage](https://github.com/harry-burton-dev/augur/blob/main/docs/app-storage.md)).

## Sign-in

Keycloak is imported on first start from `infra/deploy/keycloak/platform-realm.json`, with no test users, then
kept up to date by the [realm job](../settings/#the-realm-job). Keycloak reads that file only once. If you
change `PLATFORM_URL` later, update the **shell** client's redirect URIs and web origins in Keycloak's console.

## Sign-in pages and emails

AUGUR's own Keycloak image (`keycloak`, built and signed with each release) carries AUGUR's sign-in and email
theme, and the realm job turns it on.

- The pages show the organisation's name and logo as Admin → Organisation keeps them (`ORG_NAME` until the
  realm job first runs). `ORG_LOGO_URL`, if set, replaces the logo. The shell's logo button, which starts
  the app bar and goes to the desktop, shows `ORG_LOGO_URL` too: from this site, a `data:` URL or an
  address in `APP_ORIGINS`, as the page's security policy allows. Unset, it shows a placeholder mark.
- The product's name is the realm's display name, which the realm job sets from `ORG_PRODUCT_NAME` (default
  `AUGUR`), so emails' subjects and passkey prompts show it too.
- They are offered in the languages an admin chooses in Admin → Organisation, else those in `REALM_LANGUAGES`
  (default `en`; any language Keycloak has, the first being the default), with a language menu when there is
  more than one. Each person's choice is kept as their `locale`, and people choose from the same languages in
  Account. Every word on them is Keycloak's own, so each language is complete.

On a Keycloak without the theme, such as Keycloak's own image, the realm job leaves Keycloak's look and says
so in `pc logs keycloak-config`.
