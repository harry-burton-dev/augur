# Answers (from text.md only)

## 1. Mandate settings for .env by hand; which is optional
Add `MANDATE_CLIENT_SECRET` and `MANDATE_DATABASE_PASSWORD` (required) and `MANDATE_BUCKET_SECRET` (optional), before `pc up -d`.
- Quote: "add `MANDATE_CLIENT_SECRET` and `MANDATE_DATABASE_PASSWORD` (required) and, if you want it, `MANDATE_BUCKET_SECRET` (optional) to `.env` before `pc up -d`."
- Heading: Card 2, "Mandate now ships with AUGUR" (also table in A1.3, row "MANDATE_CLIENT_SECRET...").
- First found: line 42-43 (A1.3 table); confirmed line 183. No guess, no disagreement.

## 2. Keycloak 26.8 release: before upgrade, and how to take it
Before: take a backup and test it, keep its file name; check `KEYCLOAK_ADMIN_PASSWORD` in `.env` is still Keycloak's master admin password. Take the release by hand, not in an upgrade window.
- Quote: "Take a backup and test it ... Keep the file name: `infra/deploy/backups/platform-<date>.sql.gz`." / "Check `KEYCLOAK_ADMIN_PASSWORD` in `.env` is still Keycloak's master admin password." / "Upgrade by hand, not in an upgrade window."
- Heading: Card 6 "Keycloak moves to 26.8: back up, take it by hand, and it can't be undone"; also A1.1, A1.2, A2.
- First found: line 26-35 (A1.1/A1.2), line 89 (A2). No guess.

## 3. Checking the realm job worked
Run `pc logs keycloak-config`, which should end with "The platform realm is up to date" and list what changed; and `pc ps -a keycloak-config` should show it exited with 0. If identity's log says it lacks rights, run `pc up -d keycloak-config identity`. What to do if the checks fail otherwise: the text doesn't say.
- Quote: "`pc logs keycloak-config` ends with "The platform realm is up to date" and lists what it changed. `pc ps -a keycloak-config` shows it exited with 0. [open: what to do if either doesn't.]"
- Heading: A4. Check (also card 6, "Check: 4.").
- First found: line 103-107. No guess.

## 4. Going back after the Keycloak 26.8 release
No, not simply. Going back needs a restore of the backup from A1.1; anything changed since the backup is lost. Also set `PLATFORM_VERSION` back, check out that release's deploy files, then run the stop / gunzip-psql restore / `pc up -d --remove-orphans` commands.
- Quote: "**A restore of the backup from A1.1.** Anything changed since is lost. Set `PLATFORM_VERSION` back, check out that release's deploy files, then the commands below"
- Heading: A5. If you need to go back (also card 6 "Way back").
- First found: line 117. No guess.

## 5. Server with 6 GB of memory
Yes. Before upgrading, set `KEYCLOAK_MEM_LIMIT` and `FOLIO_WORKER_MEM_LIMIT` lower in `.env` (deploy.md, "Logs, memory and health"), since the new limits are Keycloak 2 GB, rendition worker 4 GB, observability 2 GB. What happens if you don't: the text doesn't say.
- Quote: "If your server has less than 8 GB of memory ... set `KEYCLOAK_MEM_LIMIT` and `FOLIO_WORKER_MEM_LIMIT` lower in `.env`" and "[open: what happens if you don't.]"
- Heading: A1.5 (card 5 "Logs, memory and health now have limits").
- First found: line 56-60. Note: the text doesn't give what "lower" values to use (points to deploy.md, which I wasn't given).

## 6. Server that never runs the release that comes with the repository's new name
The server refuses everything released after it.
- Quote: "**Skip it and the server refuses everything released after it.**"
- Heading: A2 table, first row (card 9 "Don't skip the release that comes with the repository's new name").
- First found: line 88. Disagreement/unclear: the text says to run it "before the rename", but the rename already happened (5 Nov 2026), so it's unclear what to do for a server not yet on it. Text flags this itself with [open]. It also doesn't say which release that is (no version given).

## 7. Will AUGUR start installing new releases by itself after the upgrade?
Not at first. It waits until an admin has upgraded it once from the Upgrade Centre and it finished. After that, by default, a production server installs AUGUR's patch releases by itself on Sunday at 02:00 for two hours, in the deployment's time zone (UTC without `DEPLOYMENT_TIME_ZONE`). A preview server or workbench takes them any time. Majors, 0.x minors, releases needing a setting only you can give, or ones an earlier try didn't finish always wait for an admin. Setting policy to Ask first stops all auto-upgrades.
- Quote: "AUGUR won't upgrade by itself yet. It waits until an admin has upgraded it once on this server from the Upgrade Centre and it finished." / "a production server installs AUGUR's patch releases by itself on Sunday at 02:00, for two hours..."
- Heading: A6. After the upgrade (cards 10, 13).
- First found: line 131-140. Slight ambiguity: whether my by-hand upgrade counts as the "first upgrade" - the text says it must be from the Upgrade Centre, so a by-hand upgrade evidently does not count (my inference from the wording).

## 8. Straight from 0.9, or via another release?
The text doesn't say. It explicitly marks this open.
- Quote: "[open: whether you can upgrade straight from your release to the current one, or must go through one in between. These notes don't say.]" and "[open: if you are several releases behind, whether each must be taken in turn.]"
- Heading: "What these notes don't tell you" and A2.
- First found: line 14-15, 93. Not guessed. (Also the text never names the "current release" version.)

## Closing
Hardest to find: the answer to Q8 (and the version of the rename release), because the text says plainly it doesn't know; and Q5's consequence/values. If I had trusted my first reading, I would have run the Keycloak 26.8 upgrade through the Upgrade Centre or an upgrade window, or skipped the backup / the `KEYCLOAK_ADMIN_PASSWORD` check (making it irreversible), and I would have assumed my by-hand upgrade turned on automatic upgrades, or that Mandate's bucket secret was required. I might also have skipped the rename release thinking the rename was already past.
