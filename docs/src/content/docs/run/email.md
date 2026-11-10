---
title: Set up email
description: Send AUGUR's email through the organisation's SMTP relay, so people can reset a forgotten password.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 3
---

AUGUR sends email through the organisation's own SMTP relay. Without one, AUGUR still works, but nobody can
reset a forgotten password or have their address checked, so an admin passes on one-time passwords by hand.

## Set up the relay

Set these in `.env`, then run `pc up -d`:

- `SMTP_HOST`: the relay, for example `smtp.example.org`.
- `SMTP_FROM`: the address email comes from until an admin sets the organisation's sender in Admin →
  Organisation. The relay must accept whichever address is used.
- `SMTP_PORT` and `SMTP_SECURITY`: `587` with `starttls` unless you say otherwise; `465` with `tls`; or
  `none` for a relay on a trusted network that takes plain SMTP.
- `SMTP_USER` and `SMTP_PASSWORD`, if the relay wants a sign-in. `SMTP_PASSWORD` is a secret: keep it out of
  anything you share.
- `SMTP_REPLY_TO`, optional: where replies go, if not to `SMTP_FROM`.

The [realm job](../settings/#the-realm-job) points Keycloak at the relay on every `up`, and with a relay it
turns on **Forgot password** on the sign-in page and checking a new address by email. `pc logs
keycloak-config` says when the relay changed. Without `SMTP_HOST` the job leaves a relay set by hand in
Keycloak's console as it is, and offers those two only if there is one. Keycloak's emails use AUGUR's email
theme and the realm's languages.

## Check it works

- Use **Forgot password** on the sign-in page for your own account.
- **Admin → Status** has an **Email** section: whether email can be sent, the relay and the address mail
  comes from, and when the relay was last checked (at most every 5 minutes). When the relay is set but
  doesn't answer, it says what to check: the sign-in, the host and port, or the security setting. The gateway
  reads the same `SMTP_*` settings for this check and sends nothing.

## Who email is from

Admin → Organisation sets the sender: a name (the organisation's name until changed) and, optionally, an
address. AUGUR's own email uses them within a minute. Keycloak's emails (password resets, address checks) use
them from the next run of the realm job: run `pc up -d` after changing them. Without an address, email comes
from `SMTP_FROM`. If the relay refuses the new address, Admin → Status says so.

## Emails about people's security

With a relay, Keycloak emails each person when their password, code app or passkeys change. Failed sign-ins
aren't emailed. People see this in Account → Sign-in and security, which says where the emails go or why
there are none. There is no switch to turn these emails off.

## On a developer's machine

On the local stack (`infra/docker-compose.yml`) every email goes to Mailpit instead, at
http://localhost:8025, and never leaves the machine.
