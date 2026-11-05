# Answers

## 1. Mandate settings (found at line 9)
Add `MANDATE_CLIENT_SECRET` and `MANDATE_DATABASE_PASSWORD` (required) and `MANDATE_BUCKET_SECRET` (optional), each from `openssl rand -hex 32`, before `pc up -d`.
Quote: "New settings: `MANDATE_CLIENT_SECRET` and `MANDATE_DATABASE_PASSWORD` (required), and `MANDATE_BUCKET_SECRET` (optional). ... by hand, add them to `.env` (`openssl rand -hex 32`) before `pc up -d`."
Heading: "Mandate ships with AUGUR".
Guess/conflict: none. Other releases in the text also add required settings (line 3, 103, 173, 177, 187, 193), but the question is about Mandate.

## 2. Keycloak 26.8 release, before upgrading (found at lines 29-33)
Take a backup and test it, keeping the file name `infra/deploy/backups/platform-<date>.sql.gz`. Check that `KEYCLOAK_ADMIN_PASSWORD` in `.env` is still Keycloak's master admin password. Take the release by hand, not in an upgrade window.
Quotes: "Take this release by hand, with the steps above, rather than leaving it to an upgrade window." / "1. Take a backup and test it (step 4 above). Keep the file name..." / "2. Check `KEYCLOAK_ADMIN_PASSWORD` in `.env` is still Keycloak's master admin password."
Heading: "Keycloak 26.8 and the realm job".
Guess/conflict: "the steps above" and "step 4 above" point at text that isn't in what I was given. I can't see how to take or test the backup. Line 217 says the updater also takes a backup and test-restores it, so the by-hand backup may be a separate step.

## 3. Checking the realm job (found at line 34)
`pc logs keycloak-config` should end with "The platform realm is up to date" and list what it changed. `pc ps -a keycloak-config` should show it exited with 0.
Quote: "4. Check: `pc logs keycloak-config` ends with "The platform realm is up to date" and lists what it changed, and `pc ps -a keycloak-config` shows it exited with 0."
Heading: "Keycloak 26.8 and the realm job".
Guess/conflict: none.

## 4. Going back after the Keycloak release (found at lines 29 and 43)
No. Keycloak's database migration on its first 26.8 start can't be undone. Going back means restoring the step-1 backup: set `PLATFORM_VERSION` back, check out that release's deploy files, stop the listed services, pipe the backup into psql, then `pc up -d --remove-orphans`. You lose everything changed since the backup.
Quotes: "that can't be undone: going back to the release before means restoring Keycloak's database from the backup you take first." / "(anything changed since is lost)".
Heading: "Keycloak 26.8 and the realm job", under "Going back".
Guess/conflict: the "Going back" paragraph in the Artifacts section (line 55) says "Going back past 0.18.0 is the exception: Keycloak 26.8's database needs the restore". So the Keycloak 26.8 release looks like 0.18.0, but that is inferred. The text never states it. The "usual code step in [Going back]" section isn't in the text. The restore command stops the services but doesn't say what happens to a restored `keycloak-config` or the other changes. Nothing says how much you lose in hours.

## 5. 6 GB of memory (found at line 25)
Yes. Before upgrading, set `KEYCLOAK_MEM_LIMIT` and `FOLIO_WORKER_MEM_LIMIT` lower in `.env`. The new limits are 2 GB for Keycloak, 4 GB for Artifacts' rendition worker and 2 GB for the observability stack.
Quote: "On a server with less than 8 GB of memory, set `KEYCLOAK_MEM_LIMIT` and `FOLIO_WORKER_MEM_LIMIT` lower in `.env` first (docs/deploy.md, "Logs, memory and health")."
Heading: "Log limits, memory limits and healthchecks".
Guess/conflict: the text doesn't say what "lower" means (what values). It also doesn't say whether the observability stack needs a setting; only two are named. I'd have to look in docs/deploy.md, which I wasn't given.

## 6. Never running the release that comes with the rename (found at line 63)
The server refuses everything released after the rename, and so can't take later releases.
Quote: "A server must run this release **before** the rename, or it refuses everything released after it."
Heading: "AUGUR's repository gets a new name".
Guess/conflict: unclear. The rename happened on 5 November 2026, which is today. "Before the rename" is ambiguous for a server that is only now upgrading. It's also unclear whether you can recover by upgrading later. The text doesn't say. Line 217 mentions a refusal of unknown images, which is a different thing.

## 7. Will AUGUR install new releases by itself after this upgrade? (found at lines 71-72 and 96)
Not at first. AUGUR doesn't upgrade itself, dev builds included, until an admin has upgraded it on that server once from the Upgrade Centre and it finished. After that, on a production server, it installs patch releases only (a 0.x minor counts as a major and waits under Needs you) by itself on Sunday at 02:00 for two hours, in the deployment's time zone (UTC unless `DEPLOYMENT_TIME_ZONE` is set). On a preview server or the workbench it installs them at any time. Apps keep what they had: patch and minor releases, at any time.
Quotes: "Automatic waits for one upgrade by hand. On each server, AUGUR doesn't upgrade by itself ... until an admin has upgraded it there once from the Upgrade Centre and it finished." / "**AUGUR on a production server installs its patch releases by itself on Sunday at 02:00, for two hours**".
Headings: "The first upgrade on each server is yours, and a 0.x minor waits for you"; "Upgrades follow each unit's policy and window".
Guess/conflict: two things.
- Line 72 says Automatic takes "only 0.x patches, for AUGUR and apps alike". Line 96 says apps keep "patch and minor releases". These disagree for apps.
- My upgrade is by hand, not from the Upgrade Centre. The text says "upgraded it there once from the Upgrade Centre". So a by-hand upgrade probably doesn't unlock automatic upgrades. The text doesn't say outright.
- I don't know whether an admin on my server already upgraded from the Upgrade Centre in the past two months.

## 8. Straight from 0.9 to current? (no answer in the text)
The text doesn't say.
Evidence checked: releases are named only in passing (0.16.x, 0.16.1, 0.17.0, 0.18.0 at lines 53-55), and "a breaking release lies between" appears in the going-back context (line 88). Line 217 says the updater refuses a release it can't upgrade from. None of these gives a required stepping-stone release, and 0.9 isn't mentioned anywhere.
Heading: none.
Guess/conflict: I'm not guessing. The release notes list many releases that "need you" (service secrets, database logins, Folio, Atlas, Auspex, Mandate, Keycloak 26.8) and several say "upgraded by hand" (lines 185, 193). That suggests several steps, but it's inference. The doc never says whether skipping is allowed.

## Hardest to find and what I'd have got wrong
Hardest to find was Q8, whose answer isn't there, and Q2, because the Keycloak steps lean on "the steps above" and "step 4 above", which aren't in the text. The text is also a stack of releases rather than one upgrade, so it never says which items apply to a 0.9 server or in what order. On a first reading I'd have taken "Nothing to do yourself" in the Mandate section and "Nothing to do" lines elsewhere as covering my by-hand upgrade, and I'd have missed that line 71 makes Automatic wait for an Upgrade Centre upgrade. I'd also have skipped the memory limits at line 25 on a 6 GB server, and I'd have trusted that I could "just go back" when the Keycloak migration makes that a database restore.

## Line numbers (first found)
Q1: 9. Q2: 29-33. Q3: 34. Q4: 29, then 43-49. Q5: 25. Q6: 63. Q7: 71-72, then 96. Q8: not found (read all 327 lines).
