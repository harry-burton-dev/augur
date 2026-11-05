# Answers (from text.md only)

## 1. Mandate settings for a by-hand upgrade
- Answer: Add `MANDATE_CLIENT_SECRET` and `MANDATE_DATABASE_PASSWORD` (both required) to `.env` before `pc up -d`. `MANDATE_BUCKET_SECRET` is the optional one ("if you want it").
- Quote: "by hand, add `MANDATE_CLIENT_SECRET` and `MANDATE_DATABASE_PASSWORD` (required) and, if you want it, `MANDATE_BUCKET_SECRET` (optional) to `.env` before `pc up -d`."
- Heading: "Mandate now ships with AUGUR" (the "Do:" bullet).
- Found at: line 26.
- Guess/conflict: none. The heading's verdict says "Do before (by hand)" while the bullet says before `pc up -d`. These agree.

## 2. Keycloak 26.8 release: before upgrading, and how to take it
- Answer: Before upgrading, take a backup and test it, keeping the file name `infra/deploy/backups/platform-<date>.sql.gz`. Also check `KEYCLOAK_ADMIN_PASSWORD` in `.env` is still Keycloak's master admin password. Take the release by hand, not in an upgrade window.
- Quotes: "Take a backup and test it ("Before you start", step 4)." / "Check `KEYCLOAK_ADMIN_PASSWORD` in `.env` is still Keycloak's master admin password. If you changed it in the console, put the current one in `.env`." / "Upgrade by hand, not in an upgrade window."
- Heading: "Keycloak moves to 26.8: back up, take it by hand, and it can't be undone" (Do, before you upgrade, steps 1 to 3).
- Found at: lines 48-53.
- Guess/conflict: The text points to "Before you start", step 4, which is not in the text I was given. So I don't know how to take or test the backup. Step 3 is labelled "Do", not "Do, before you upgrade", but it is clearly about the upgrade itself.

## 3. Checking the realm job worked
- Answer: `pc logs keycloak-config` should end with "The platform realm is up to date" and list what it changed. `pc ps -a keycloak-config` should show it exited with 0. If identity's log says it lacks rights, run `pc up -d keycloak-config identity`.
- Quote: "`pc logs keycloak-config` ends with "The platform realm is up to date" and lists what it changed; `pc ps -a keycloak-config` shows it exited with 0. [open: what to do if not.]"
- Heading: same Keycloak card, "Check: 4." (the identity rights fix is the next bullet, "If identity's log says it lacks rights").
- Found at: lines 54-55.
- Guess/conflict: What to do if the check fails is marked [open], so the text doesn't say. The only fix given is for the identity "lacks rights" case.

## 4. Can you go back to the release before? What do you lose?
- Answer: No, not by simply setting the version back. The only way back is a restore of the step 1 backup, and anything done since the backup is lost. The heading says it "can't be undone".
- Quotes: "**Way back** only with a restore; anything since the backup is lost" and "a restore of the backup from step 1. Set `PLATFORM_VERSION` back, check out that release's deploy files, then ... `pc stop ...`, `gunzip -c ... | pc exec -T postgres psql ...`, `pc up -d --remove-orphans`".
- Heading: Keycloak card, the "From ... Way back" line, and its "Way back:" bullet. Line 68 supports it: "Going back past 0.18.0 needs the Keycloak 26.8 restore first."
- Found at: line 49, then 56-61.
- Guess/conflict: none. The new sign-in theme card says its own way back "works", but that is a different card.

## 5. Server with 6 GB of memory
- Answer: Yes. Before you upgrade, set `KEYCLOAK_MEM_LIMIT` and `FOLIO_WORKER_MEM_LIMIT` lower in `.env`, because the server has less than 8 GB.
- Quote: "**If** your server has less than 8 GB of memory: before you upgrade, set `KEYCLOAK_MEM_LIMIT` and `FOLIO_WORKER_MEM_LIMIT` lower in `.env` (deploy.md, "Logs, memory and health"). Otherwise nothing to do. [open: what happens if you don't.]"
- Heading: "Logs, memory and health now have limits".
- Found at: line 44.
- Guess/conflict: The text doesn't say what happens if you skip it, and doesn't say what values to use. Line 45 gives the default limits (Keycloak 2 GB, rendition worker 4 GB, observability 2 GB), so "lower" is relative to those, but no number is given. deploy.md is not in the text.

## 6. A server that never runs the release that comes with the repository's new name
- Answer: The server refuses everything released after that release.
- Quote: "**Skip it and** the server refuses everything released after it."
- Heading: "Don't skip the release that comes with the repository's new name".
- Found at: line 77.
- Guess/conflict: Line 78 is self-contradictory: it says a server must run this release "before the rename", but the rename already happened on 5 November 2026. The text marks this [open]. I don't know whether a server on 0.9 is already too late, or which release this is (its "From" is [open]).

## 7. Will AUGUR start installing new releases by itself afterwards?
- Answer: Not automatically at first. AUGUR doesn't upgrade itself until an admin has upgraded it once from the Upgrade Centre and that upgrade finished. After that, on a production server it installs its own patch releases by itself, on Sunday at 02:00 for two hours, in the deployment's time zone (UTC if `DEPLOYMENT_TIME_ZONE` isn't set). On a preview server or the workbench it can do so at any time. Apps install their patch and minor releases at any time. A 0.x minor (such as 0.9 to 0.10) always waits for an admin under Needs you.
- Quotes: "AUGUR doesn't upgrade itself on a server, dev builds included, until an admin has upgraded it there once from the Upgrade Centre and it finished." / "on a production server, AUGUR installs its patch releases by itself on Sunday at 02:00, for two hours, in the deployment's time zone. On a preview server or the workbench, at any time. Apps keep theirs: patch and minor releases at any time" / "A 0.x minor (0.3 to 0.4) counts as a major: Automatic takes only 0.x patches".
- Headings: "Automatic upgrades wait for your first one, and a 0.x minor always waits"; "Upgrades follow each unit's policy and window; set your time zone" (The default).
- Found at: lines 83-84, then 104-106.
- Guess/conflict: I had to infer that a by-hand upgrade does not count as the "first one", because the text says "from the Upgrade Centre". It doesn't say what a by-hand upgrade does. The text doesn't say whether this server has already had an Upgrade Centre upgrade ("A server that already had one carries on"). The section on the rename release says to "run it" and the Keycloak card forbids using an upgrade window, so the two cards pull in different directions on whether you can use the Upgrade Centre.

## 8. Straight from 0.9 to current, or via another release?
- Answer: The text doesn't say. It never gives a supported upgrade path or a minimum starting version. It does say one release can't be skipped (the rename release, which would otherwise leave the server refusing later releases), but that release isn't identified, and its "From" is [open]. So I can't name an intermediate release.
- Quote: "**Skip it and** the server refuses everything released after it." (line 77) / "[open: the note says a server must run this release "before the rename" ...]" (line 78). Also, only two cards name releases: `augur@0.18.0` (Keycloak) and `augur@0.17.0` (apps from own repositories).
- Heading: "Don't skip the release that comes with the repository's new name".
- Found at: lines 75-78 (hint only).
- Guess/conflict: This is a guess as far as any route goes. Most cards say "From [open]", so I can't tell which of them are newer than 0.9. The rename card plus the Keycloak "can't be undone" card suggest the safe move is to ask someone, but the text doesn't say that.

## Closing
Hardest to find: Q8 and Q7. The text never says whether there is an upgrade path from 0.9, and the by-hand versus Upgrade Centre distinction behind the automatic-upgrade answer is spread over three cards. Most cards also say "From [open]", so I couldn't tell which cards apply to 0.9. If I had trusted my first reading, I would have started upgrading with the Upgrade Centre or a skim of "Do before" lines and missed that the Keycloak release needs a tested backup first and must be done by hand, and I would have assumed I could roll back with `PLATFORM_VERSION` (no, a restore is needed and recent data is lost). I would also have assumed the 6 GB limit and the rename-release note were clear when both are marked [open].
