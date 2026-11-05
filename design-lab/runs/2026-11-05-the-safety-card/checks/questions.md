# Reader test: questions and answer key

Written from `source.md` before any rewrite. Line numbers are `source.md`'s
(add 52 for `docs/upgrade.md` at commit 9ad4399).

**The reader.** An admin on a single-server deployment, upgrading from
AUGUR 0.9 to the current release after two months away. They have the
server open and twenty minutes. They need to know which notes apply to
them, what to do in what order, and what will break if they skip a step.
They upgrade by hand, with the steps in the guide.

The tester gets `questions-only.md` and one text, never this file.

## How to mark
- **Right**: the answer matches the key and quotes a line that holds it.
- **Partly**: some of a several-part answer is right, none of it wrong.
- **Wrong**: any part contradicts the key, or a fact is invented.
- **Doesn't say**: the reader says the text doesn't answer it. Right only for Q8.
- **Guessed**: right, but the quoted line doesn't hold the answer.
- **Words read**: roughly how far into the text the answer was found (the
  tester gives the heading or line they stopped at; we count words to it).

## Questions

### Q1. Mandate's settings
*Which settings must you add to `.env` for Mandate when you upgrade by hand, and which of them is optional?*

**Answer:** `MANDATE_CLIENT_SECRET` and `MANDATE_DATABASE_PASSWORD` are
required; `MANDATE_BUCKET_SECRET` is optional. Make each with
`openssl rand -hex 32` and add them before `pc up -d`.
**Source:** line 9.
**Tests:** finding a setting in a note whose heading names an app, not a setting.

### Q2. Keycloak 26.8: before you start
*The release that moves Keycloak to 26.8: what must you do before you upgrade, and how should you take that release?*

**Answer:** take a backup and test it, and keep its file name
(`infra/deploy/backups/platform-<date>.sql.gz`); check that
`KEYCLOAK_ADMIN_PASSWORD` in `.env` is still Keycloak's master admin
password (put the current one there if it was changed in the console).
Take the release by hand, not in an upgrade window.
**Source:** lines 29, 31, 32.
**Tests:** steps buried in a long note; a one-way step.

### Q3. Keycloak 26.8: did it work?
*After that upgrade, how do you check the realm job worked?*

**Answer:** `pc logs keycloak-config` ends with "The platform realm is up
to date" and lists what it changed, and `pc ps -a keycloak-config` shows it
exited with 0.
**Source:** line 34.
**Tests:** a check step, which skimming readers skip.

### Q4. Going back from Keycloak 26.8
*If something goes wrong after that release, can you just go back to the release before? What do you lose?*

**Answer:** no, not with the code step alone. Keycloak's database migration
can't be undone; going back means restoring the backup taken first (stop
the services, load the backup into Postgres, `up` again). Anything changed
since the backup is lost.
**Source:** lines 29, 43 to 49.
**Tests:** the consequence; the "can't be undone" fact.

### Q5. A small server
*Your server has 6 GB of memory. Is there anything to do before upgrading?*

**Answer:** yes. Set `KEYCLOAK_MEM_LIMIT` and `FOLIO_WORKER_MEM_LIMIT`
lower in `.env` first (the new limits are 2 GB for Keycloak and 4 GB for
the rendition worker; the rule is for servers under 8 GB).
**Source:** line 25.
**Tests:** a condition inside a note headed "Nothing to do on most servers".

### Q6. Skipping a release
*What happens to a server that never runs the release that comes with the repository's new name?*

**Answer:** it refuses everything released after it (the updater and
registry only take releases signed under the new name from that release on).
**Source:** line 63.
**Tests:** what breaks if you skip a step.

### Q7. Upgrading by itself afterwards
*After this upgrade, will AUGUR start installing new releases by itself? If so, which ones and when?*

**Answer:** not until an admin has upgraded it once on that server from the
Upgrade Centre and it finished. After that, on a production server, by
default it installs patch releases by itself on Sunday at 02:00 for two
hours, in the deployment's time zone (UTC unless `DEPLOYMENT_TIME_ZONE` is
set). A 0.x minor (and a major) always waits for an admin.
**Source:** lines 71, 72, 96, 98.
**Tests:** a fact spread over two notes. Full marks need the first-upgrade
rule and the Sunday window; the time zone and 0.x minor are bonus.

### Q8. Going through a release first (the text can't answer this)
*Can you upgrade straight from 0.9 to the current release, or must you go through another release first? If so, which?*

**Answer:** the text doesn't say. The section gives a version for only a
few notes (0.16.x, 0.17.0, 0.18.0 on lines 53 and 55) and never says which
releases a 0.9 server can upgrade from. (The guide's "Before you start"
says the preflight names the release to go through; that is outside this
section.)
**Source:** none.
**Tests:** whether the text tempts the reader to guess.

## What we expect the original to do badly
Written before any test, so we can see if the guess was wrong.
- Q5 and Q6 sit in notes whose first lines say "nothing to do" or tell history.
- Q7's answer is split across two notes, about 870 words apart.
- Q8: a reader may infer "go through 0.17.0" from line 55 and get it wrong.
