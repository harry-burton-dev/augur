---
title: Settings and secrets
description: How a deployment's settings are checked, where each one is kept, and the rules AUGUR applies to sign-in.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 2
---

A deployment is set up in two places: its `.env` file on the server, for what whoever runs the server
decides, and Admin → Organisation, for what the organisation's admins decide. This page says which is which,
how AUGUR checks them, and the sign-in rules it applies on every start. Every setting `.env` can hold is in
the [deployment settings](../../reference/schemas/settings/) reference.

## How settings are checked

Each service checks its settings before it starts. In production a missing one stops it, with a list of every
problem at once:

```
identity can't start until its settings are fixed:
  - KEYCLOAK_URL is not set: Keycloak as identity reaches it, such as http://keycloak:8080/sso.
```

`pc logs <service>` shows it.

Every setting is described once, in `infra/deploy/settings.schema.json`: which services read it, whether it's
required, its default, whether it's a secret, and the page that explains it. `.env.example` lists them all,
and AUGUR's own checks hold `compose.yml`, `.env.example`, these pages and the services' code to it, so a
setting this site tells you to put in `.env` always reaches the service that reads it. Compose passes each one
by name to the services that read it; only the storage job, which reads every app's secrets by the app's
name, reads the whole `.env`.

## Secrets as files

Any secret (a password, a client secret, a bucket key, `DATABASE_URL`) can be given as a file instead: set
`<NAME>_FILE` to its path inside the container, for a Docker secret or a file decrypted at deploy, and leave
`<NAME>` unset. The file's contents, less a final newline, are used.

## Organisation settings

What an admin sets in Admin → Organisation, and what a deployment's `.env` sets:

| Setting | Where | Who | Takes effect |
| --- | --- | --- | --- |
| Name, time zone, email sender | Admin → Organisation | an admin | at once in AUGUR; Keycloak's emails and sign-in pages at the next `pc up -d` |
| Logo (a PNG, up to 256 KB and 1024 px, at least 32 px tall) | Admin → Organisation | an admin | at once: sign-in pages fetch it from `/api/identity/v1/public/organisation/logo`, the only path under `/api/` that needs no sign-in |
| Sign-in notice (a terms step at sign-in) | Admin → Organisation | an admin | at the next `pc up -d`; "Ask everyone again" marks everyone at once |
| Languages offered and the default | Admin → Organisation | an admin | in Account at once; on sign-in pages at the next `pc up -d` |
| Idle accounts, two steps for everyone, leaver and Activity retention | Admin → Organisation | a deployment admin who just entered their password | Activity retention at the next nightly run; the rest at the next `pc up -d` |
| Password length, session lengths, sign-in event retention | `.env` (`REALM_*`) | whoever runs the server | at the next `pc up -d` |

What Keycloak shows is applied by the realm job, below, on every `pc up -d` and upgrade, because AUGUR's
identity service may not change how people sign in itself.

## The realm job

Keycloak reads its realm file only on its first start, so everything else about sign-in is kept as code and
applied by `keycloak-config`, a container that runs on every `pc up -d` (so on every upgrade), sets the realm
up and stops, before identity starts. It sets:

- passwords of at least 15 characters, not the username or email, checked against a breached-password list
  (`infra/deploy/keycloak/password-blacklists`) and never forced to change;
- a growing wait after 10 wrong passwords in a row, up to 15 minutes, never a permanent lock;
- a code app or a passkey offered to everyone as a second step, and asked of everyone when Admin →
  Organisation says so; passkeys in the sign-in form;
- sessions that end after 8 hours unused or 10 hours at most;
- sign-in events kept 90 days and admins' changes 365;
- the profile fields (job title, phone, pronouns, picture, language), AUGUR's roles, each AUGUR service's
  sign-in, and identity's rights.

A deployment can be stricter, never looser: `REALM_PASSWORD_MIN_LENGTH`, `REALM_PASSWORD_DENYLIST`,
`REALM_SESSION_IDLE_HOURS`, `REALM_SESSION_MAX_HOURS`, `REALM_SIGN_IN_EVENT_DAYS` and
`REALM_ADMIN_EVENT_DAYS` in `.env`. `pc logs keycloak-config` says what it changed.

It is the only part of AUGUR that signs in as Keycloak's master admin (`KEYCLOAK_ADMIN_USER`,
`KEYCLOAK_ADMIN_PASSWORD`). If you change that password in Keycloak's console, change it in `.env` too, or
the job (and so identity) won't start. If identity's log says its own sign-in lacks the rights it needs
(someone changed them in the console, say), run the job again: `pc up -d keycloak-config identity`. A change
made by hand in the console to something the job sets is put back on the next `up`.

Identity manages people in Keycloak with a sign-in of its own (`platform-identity`), which may manage people,
departments and apps' sign-ins in the `platform` realm and nothing else: it can't change the realm's settings
or how anyone signs in, and it never holds the master admin password.

## Deployment admins

Deployment admins run the deployment itself: its settings, secrets, upgrades and backups. The role is
`deployment-admin`. Identity gives it to `PLATFORM_ADMIN_USER` when nobody has it, and only a deployment admin
can give it to someone else, take it away, or turn off, re-email or reset the password of someone who has it,
so an admin can't take the deployment over.

Anyone may add a one-time code from an authenticator app, or a passkey, as a second step, and Admin →
Organisation can ask everyone for one; no role needs it on its own.

## If every deployment admin is locked out

Keycloak's own admin is the way back in. Keep its password (`KEYCLOAK_ADMIN_PASSWORD`) somewhere safe and
offline.

1. Open Keycloak's console: set `KEYCLOAK_CONSOLE=open` in `.env` and run `pc up -d`
   ([Limits at the front door](../limits/#limits-at-the-front-door)).
2. At `PLATFORM_URL/sso/admin`, sign in as `KEYCLOAK_ADMIN_USER` with `KEYCLOAK_ADMIN_PASSWORD`.
3. In the `platform` realm, open the person under **Users**, then **Credentials**, and reset their password
   or delete their second step.
4. Remove `KEYCLOAK_CONSOLE` from `.env` and run `pc up -d` again.
