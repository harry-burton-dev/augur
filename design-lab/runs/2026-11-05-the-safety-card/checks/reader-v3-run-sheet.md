# Answers (reader c)

## 1. Mandate settings in .env (found ~line 39)
Add `MANDATE_CLIENT_SECRET` and `MANDATE_DATABASE_PASSWORD` (required). `MANDATE_BUCKET_SECRET` is optional.
Quote: "| `MANDATE_CLIENT_SECRET`, `MANDATE_DATABASE_PASSWORD` | Mandate ships with AUGUR | yes |" and "| `MANDATE_BUCKET_SECRET` | Mandate | optional |"
Heading: 1.3 Add these settings to `.env`.
Guess/conflict: none. (Line 33-34: by hand you add the secrets before `pc up -d`; make them with `openssl rand -hex 32`, line 17.)

## 2. Keycloak 26.8 release (found line 25, 27-30, 87)
Before upgrading: take and test a backup and note its file name (1.1), and check `KEYCLOAK_ADMIN_PASSWORD` in `.env` is still the master admin password (1.2). Take the release by hand, not in an upgrade window.
Quote: "By hand, not in an upgrade window, after 1.1 and 1.2"
Heading: 2. Releases you must not skip or leave to a window (also 1.1, 1.2).
Guess/conflict: none.

## 3. Checking the realm job (found ~line 101)
`pc logs keycloak-config` should end with "The platform realm is up to date" and list what changed; `pc ps -a keycloak-config` should show it exited with 0.
Quote: "`pc logs keycloak-config` ends with "The platform realm is up to date"" / "`pc ps -a keycloak-config` shows it exited with 0."
Heading: 4. Check.
Note: the text doesn't say what to do if either check fails ("[open: what to do if either doesn't.]"). Only the identity-lacks-rights case has a fix.

## 4. Going back after Keycloak 26.8 (found ~line 115)
No. You must restore the backup from 1.1 (set `PLATFORM_VERSION` back, check out that release's deploy files, run the commands). Anything changed since the backup is lost.
Quote: "**A restore of the backup from 1.1.** Anything changed since is lost."
Heading: 5. If you need to go back (also 1.1: "Keycloak 26.8 can't be undone without it").
Guess/conflict: none.

## 5. 6 GB memory (found line 53-57)
Yes. Because it has under 8 GB, set `KEYCLOAK_MEM_LIMIT` and `FOLIO_WORKER_MEM_LIMIT` lower in `.env`. New limits are Keycloak 2 GB, Artifacts' rendition worker 4 GB, observability stack 2 GB.
Quote: "**1.5 If your server has less than 8 GB of memory**, set `KEYCLOAK_MEM_LIMIT` and `FOLIO_WORKER_MEM_LIMIT` lower in `.env`"
Heading: 1.5.
The text doesn't say what happens if you don't ("[open: what happens if you don't.]"). It also doesn't give the values to set, only the new defaults. I am inferring "lower" means below those limits.

## 6. Never running the rename release (found line 86)
The server refuses everything released after it.
Quote: "**Skip it and the server refuses everything released after it.**"
Heading: 2. Releases you must not skip or leave to a window.
Conflict: the table says "Run it" but the note says "before the rename", which "has already happened" (open item). It's unclear how to run it now if you're already past it; the text doesn't say. Also the rename is dated 5 November 2026.

## 7. Automatic installs after upgrade (found ~line 129-138)
Not at first. AUGUR waits until an admin has upgraded it once from the Upgrade Centre and it finished. After that, by default, a production server installs AUGUR's patch releases by itself on Sunday at 02:00 for two hours, in the deployment's time zone (UTC if `DEPLOYMENT_TIME_ZONE` is unset). Preview servers or the workbench take them at any time. Major releases, 0.x minors, releases needing a setting only you can give, or ones an earlier try didn't finish always wait for an admin. Set the policy to Ask first to stop automatic installs.
Quote: "**AUGUR won't upgrade by itself yet.** It waits until an admin has upgraded it once on this server from the Upgrade Centre and it finished." / "a production server installs AUGUR's patch releases by itself on Sunday at 02:00, for two hours"
Heading: 6. After the upgrade.
Conflict: I'm on a hand upgrade, so it's unclear whether a hand upgrade counts as "upgraded once". The text says the Upgrade Centre must be used, and the updater is optional set-up (section 7), so I'd have to do one Upgrade Centre upgrade (which needs the updater set up). Partly inferred. Also: since 0.x versions are "0.x minor" releases and always wait, patch auto-installs only matter on a 0.x line for patches.

## 8. Straight from 0.9? (found lines 13-14, 91)
The text doesn't say. It explicitly flags this as open: "whether you can upgrade straight from your release to the current one, or must go through one in between. These notes don't say." Also open whether each release must be taken in turn. Known hard requirements: run the rename release, and take Keycloak 26.8 by hand.
Heading: "What these notes don't tell you" and section 2 final [open].
Guess: none made.

## Summary
Hardest to find: whether 0.9 can go straight to current (only an "open" note says the text doesn't know), and what to do when the realm check fails or when memory limits aren't set. If I'd trusted my first reading, I would have treated the table's "Required?" as covering everything in 1.3 and skipped the Keycloak/backup prep, or I'd have expected AUGUR to auto-install patches right after a hand upgrade (it won't until one Upgrade Centre upgrade), and I'd have assumed I could roll back Keycloak 26.8 by checking out the old release (it needs a database restore and loses later changes).
