---
title: If something's wrong
description: What to check when AUGUR's address, sign-in, UI kit or apps don't work.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 16
---

Start with `pc ps`, which shows each container and whether it's `healthy`, and `pc logs <service>`, which says
why one isn't. Deployment → Health says the same for each part, when you can sign in.

## The address doesn't resolve

Check that the machine named after `TS_HOSTNAME` appears in the Tailscale admin console, and that MagicDNS is
on. `pc logs tailscale` shows whether the auth key was accepted.

## Certificate errors

HTTPS Certificates must be on in the Tailscale admin console's DNS page.

## Sign-in loops, or "invalid redirect"

If you keep being told you're not signed in, or the sign-in page says the redirect is invalid, `PLATFORM_URL`
must match the address in your browser exactly, with `https` and no trailing slash.

## AUGUR could not load its UI kit

The browser couldn't fetch the kit from `KIT_URL`, or what it got didn't match the release's hashes. Open
`KIT_URL` followed by the version and `kit.json` in a browser. If it doesn't load, or differs from
`PLATFORM_URL/kit/<version>/kit.json`, fix the CDN, or remove `KIT_URL` from `.env` and run `pc up -d web`
([The UI kit](../browsers/#the-ui-kit)).

## An app is listed but won't open

If the browser console says "Refused to load the script… Content Security Policy", the app's site is allowed
in Admin but not in `APP_ORIGINS` ([Apps from another site](../day-to-day/#apps-from-another-site)).

## Apps are unavailable

Run `pc logs gateway registry`. If the gateway says the token issuer doesn't match, `PLATFORM_URL` changed
after Keycloak first started: update the **shell** client in Keycloak's console
([Sign-in](../whats-running/#sign-in)).

## A service won't start

Its log lists every setting it's missing or can't use ([How settings are checked](../settings/#how-settings-are-checked)).
