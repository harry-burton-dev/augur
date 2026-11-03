# 0056. Sample data is seeded through public APIs, only where the deployment allows it, by an admin signed in from the terminal

- **Status:** Proposed
- **Date:** 2026-11-03
- **Decided by:** Harry
- **Replaces:** none. Serves [0050](0050-alpha-proving-run.md) (the run's persona cast).

## Context

A fresh AUGUR starts empty. Local development, end-to-end tests, the demo deployment and the alpha proving run all need people, floors, documents and entities to work with (PER-184). Whatever fills a deployment must stay in step with the contracts, must never touch a deployment where real people work, and must be told apart from real data. The gateway takes only people's tokens, and the realm's clients don't let a script sign in: the shell's client allows only the browser sign-in, and direct password sign-in is off everywhere.

## Options

1. **A `pnpm seed` command that calls the public APIs as an admin.** It signs in from the terminal with a one-time code (OAuth 2.0 device authorization grant, RFC 8628) on its own public Keycloak client, and runs only where the deployment says seeding is allowed. Needs one realm client and one setting.
2. **Write straight into the databases and Keycloak.** Fast, but goes around every rule, audit and event, and drifts from the contracts.
3. **A service account for seeding.** No person signs in, but it needs a secret on the operator's machine and a way to give a non-person admin roles and floors.
4. **Paste a token from the browser.** No realm change, but clumsy, and it trains people to copy tokens around.

## Decision

Option 1:

- The seed reaches AUGUR only through the gateway, as the admin who runs it, so every change is checked, audited and announced like any other.
- A deployment allows seeding only when its `.env` sets `SEED_ALLOWED=true`. The gateway reports it on Status (`seeding`), and the seed stops before changing anything when it is off, saying who can change that. It is off unless set; the local dev stack sets it.
- The realm has a public client, `platform-cli`, with only the device grant on (codes last 5 minutes). Its tokens carry the same audience, roles and departments as the shell's.
- Everything the seed makes is marked as synthetic: sample people get addresses at a reserved domain from the data file (by default under `.invalid`, which never delivers), and every name and text comes from a data file, never from code. The seed keeps a ledger of what it made.

## Consequences

- Seeding follows the contracts by construction: when an API changes, the seed fails in the same place an app would.
- A deployment that already exists doesn't get the `platform-cli` client, because Keycloak imports the realm only once; docs/upgrade.md says how to add it by hand until the realm is held as code (ADR 0037, PER-188).
- The device grant is a phishing surface (someone can be sent a code to approve). It is limited to one client with short-lived codes; the sign-in page names the client.
- Checks: the gateway test for `seeding`, and the seed's own tests (`node --test scripts/seed*.test.mjs`).

## Links

Linear PER-184 (W6.1), PER-296 (the run suite), PER-188 (realm as code). Guide: docs/seed.md.
