---
title: Sign in with Entra
description: Let people sign in to AUGUR with the organisation's Microsoft Entra account.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 4
---

People can sign in with the organisation's Microsoft Entra account instead of a password kept by AUGUR. The
sign-in page then offers "{organisation} account" beside the password.

## Register AUGUR in Entra

1. In the Microsoft Entra admin centre, open **App registrations → New registration** and register AUGUR:
   **Accounts in this organizational directory only** (single tenant), and the web redirect URI
   `PLATFORM_URL/sso/realms/platform/broker/entra/endpoint`, for example
   `https://augur.example.org/sso/realms/platform/broker/entra/endpoint`.
2. Under **Certificates & secrets**, make a client secret. Under **Token configuration**, add the optional
   claims `email`, `given_name` and `family_name` to the ID token.
3. To choose who may sign in, open the app in **Enterprise applications**, turn on **Assignment required**,
   then assign the people or groups.
4. In `.env` set `ENTRA_TENANT_ID` (the tenant's id from its Overview, a GUID, not its domain),
   `ENTRA_CLIENT_ID` (the registration's Application (client) id) and `ENTRA_CLIENT_SECRET` (the secret; keep
   it out of anything you share). All three, or none. Then run `pc up -d`.
5. Check `pc logs keycloak-config | grep -i entra`: the first run says the organisation's sign-in was set up.

## What happens at the first sign-in

The first time someone signs in through Entra, they're linked to the AUGUR account with the same email, with
no AUGUR password asked for, or a new account is made for them if nobody has that email.

Only the organisation's own tenant can sign in, but an address can still change hands there, so an account
that signs in with two steps is never linked this way: once two steps for everyone is on, everyone with an
account is refused with a message saying why, and goes on signing in with their password and second step.

Once linked, their name and email follow Entra at every sign-in, and their second step is Entra's own, under
the organisation's Conditional Access. Admin → People shows the link in Activity ("linked to the
organisation's sign-in"). An account made this way starts with no roles or teams, so an admin gives them.

## Turn it off

Take the three settings out of `.env` and run `pc up -d`. The sign-in is turned off without being deleted, so
the links come back if it was a mistake. Someone removed in Entra can't sign in any more, but their AUGUR
account stays until an admin runs the leaver flow or it turns off for being idle.
