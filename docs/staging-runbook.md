# Staging and the 48-hour proof: the runbook

The steps that take the workbench to the alpha release, stand up a staging server, and prove a release on it: the break cycle, the 72-hour bake with the 48-hour run inside it, then Promote to stable. It follows [deploy.md](deploy.md) and adds only what staging needs. Each step ends with **Paste back**: the output that shows the step worked, so whoever checks the evidence never has to assume a step on a server went through.

Commands run on the server, in its AUGUR checkout, unless a step says otherwise. They use the `pc` alias:

```sh
alias pc='docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env'
```

`<alpha>` is the release being proved (an `augur@<version>` under Releases). `<tailnet>` is your tailnet name, such as `tail1234.ts.net`.

## 1. A server for staging

A Linux machine with 4 CPUs, 16 GB of memory and 200 GB of disk, Docker with the Compose plugin, and git ([deploy.md, Before you start](deploy.md#before-you-start)).

```sh
nproc; free -g | awk '/Mem:/{print $2" GB"}'; df -h --output=avail / | tail -1
docker compose version; git --version
```

**Paste back:** the five lines.

## 2. Its own place on the tailnet

In the [Tailscale admin console](https://login.tailscale.com/admin): MagicDNS and HTTPS Certificates on (they are, if the workbench works), and a new auth key, reusable and tagged (say `tag:augur`), for this server. Choose its name: `augur-staging`, unless that's taken. It goes in `.env` in step 6 as `TS_HOSTNAME`.

**Paste back:** the name you chose and your tailnet name. Never the key.

## 3. Keys and the bucket

Make each of these for staging alone, so nothing is shared with the workbench or production ([deploy.md, A staging server](deploy.md#a-staging-server)). Keep each secret in your password manager; they go into `.env` in step 6, never into chat.

1. **A read key**, only if AUGUR's packages aren't public to you: a GitHub token with only `read:packages` ([upgrade.md, The read key](upgrade.md#the-read-key)).
2. **A bucket for the off-server copy and the point-in-time archive**, with versioning on and a lifecycle rule that deletes noncurrent versions after 60 days. One bucket path holds both: the nightly copies (ADR 0060) and, every hour, the newest base backup and the WAL archive (ADR 0064). Name it, or its path, after the deployment, such as `augur-backups/augur-staging`.
3. **The bucket's key**: read, list, write and delete objects on that bucket only, and nothing that changes the bucket or deletes versions. The policy is in [deploy.md, Off-server copy](deploy.md#off-server-copy), step 2.
4. **The encryption password** for the copy: `openssl rand -hex 32`. Without it nobody can read the copies.
5. **The email relay's sign-in for staging**, if your relay gives one per sender ([deploy.md, Email](deploy.md#email)). Staging's sample people have `.invalid` addresses, so nothing reaches anyone.

**Paste back:** the bucket's address (`s3:https://…/augur-backups/augur-staging`) and the relay's host and port. No secrets.

## 4. Promote asks Backstage for bake time

Once only, for every promotion from now on ([ADR 0045](decisions/0045-promote-asks-portal-over-tailscale.md), [release-channels.md, Bake time](release-channels.md#bake-time)):

1. In Tailscale's **Access controls**, add `tag:ci` to `tagOwners`, and let `tag:ci` reach Backstage on port 443 and nothing else:
   ```json
   "tagOwners": { "tag:ci": ["autogroup:admin"] },
   "grants": [ { "src": ["tag:ci"], "dst": ["<Backstage's machine or tag>"], "ip": ["443"] } ]
   ```
   (With `acls` instead of `grants`: `{ "action": "accept", "src": ["tag:ci"], "dst": ["<Backstage's machine or tag>:443"] }`.)
2. **Settings → OAuth clients → Generate**, with the **Auth keys** write scope and the tag `tag:ci`.
3. In GitHub, `harry-burton-dev/augur` → **Settings → Secrets and variables → Actions**: the secrets `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_SECRET` from that client, and on the **Variables** tab `PORTAL_URL`, Backstage's address (`https://<Backstage's TS name>.<tailnet>`).
4. Check Backstage answers on the tailnet, from any machine on it:
   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' https://<Backstage's TS name>.<tailnet>/api/augur/bake
   ```

**Paste back:** the status code (any answer but `000` means it's reachable) and a screenshot or list of the three names on the Actions settings page, with no values.

## 5. The workbench to the alpha release

The workbench builds the alpha first, so staging installs a release that already upgraded a real server. A release says which versions it upgrades from (`upgradeFrom` in `release/augur-release.json`): 0.18.0 and later need 0.17.0 or later. A server on something older goes through **0.17.0 first**, the stepping stone, then to the alpha.

On the workbench:

```sh
grep '^PLATFORM_VERSION=' infra/deploy/.env
pc exec backup /bin/sh /backup/backup.sh --now
pc exec backup /bin/sh /backup/backup.sh --restore-test | tail -1
```

**Paste back:** the version and the last line, which ends `restored and checked`. If it says FAILED, stop here.

Then for each release in turn, the stepping stone (if the version is below 0.17.0) and then `<alpha>`: in the **Upgrade Centre**, choose **Upgrade to …**, or by hand ([upgrade.md](upgrade.md)):

```sh
v=<the release>
git fetch --tags && git checkout "augur@$v"
docker run --rm -v "$PWD:/augur:ro" -w /augur node:22-alpine node scripts/preflight.mjs
# Ready? Then:
sed -i "s/^PLATFORM_VERSION=.*/PLATFORM_VERSION=$v/" infra/deploy/.env
pc pull && pc up -d --remove-orphans
pc ps --format '{{.Service}} {{.Status}}' | sort
```

Read each release's "Release notes that need you" in [upgrade.md](upgrade.md#release-notes-that-need-you) between its version and yours first: some add a setting to `.env`.

**Paste back,** for each release: the preflight's last lines, and the `pc ps` list (every part `Up`, none `Restarting`). Then Admin → Status's heading, from the browser.

## 6. Install staging

On the staging server, follow [deploy.md](deploy.md) from **Before you start** through **First start**, with the release `augur@<alpha>`. In step 2 there, set these as well:

```sh
TS_HOSTNAME=augur-staging                # step 2's name
SERVER_RING=preview
SEED_ALLOWED=true
DEPLOYMENT_ID=augur-staging              # its entry in Backstage's org/deployments.yaml
PORTAL_URL=https://<Backstage's TS name>.<tailnet>
OFFSITE_REPOSITORY=s3:https://<endpoint>/augur-backups/augur-staging
OFFSITE_PASSWORD=<step 3's password>
OFFSITE_ACCESS_KEY_ID=<step 3's key id>
OFFSITE_SECRET_ACCESS_KEY=<step 3's key secret>
OFFSITE_REGION=<region, if the provider wants one>
```

Add `augur-staging` to Backstage's `org/deployments.yaml` before the first report arrives, and after deploy.md's step 6, copy its key into the entry's `augur.dev/report-key` annotation.

Write down every place where you did something deploy.md doesn't say, or where it said something that wasn't so. Each one is a row for the run ledger (a `docs-gap` or an `undocumented-server-step`).

**Paste back:**
```sh
docker run --rm -v "$PWD:/augur:ro" -w /augur node:22-alpine node scripts/preflight.mjs --install
pc ps --format '{{.Service}} {{.Status}}' | sort
cat infra/deploy/backups/offsite.json infra/deploy/backups/restore-test.json
```
and from the browser: Admin → Status (Backups shows the off-server copy and "Point in time"), Backstage's page for `augur-staging` (it reported within 15 minutes), and your list of deviations, even if it's empty.

## 7. Seed it

From a machine on the tailnet with Node 22 and an `im-platform` checkout (`pnpm install` once):

```sh
pnpm seed --check
pnpm seed --url https://augur-staging.<tailnet>
```

It prints an address and a code: open it, sign in as staging's admin, approve. The ledger with the sample people's one-time passwords is written to `.seed/augur-staging.<tailnet>.json`, which stays on that machine.

**Paste back:** the seed's last lines (what it made, and anything it couldn't and why). Never the ledger.

## 8. Prove the release (goal 37)

In this order. Each step starts only when the one before it is pasted back.

### 8.1 The build gate passed

The alpha's own **Release** run in GitHub, with its Deploy test, is green, and step 5 put it on the workbench.

**Paste back:** the Release run's link.

### 8.2 The break cycle

Staging runs `<alpha>`. Halt a release newer than it, then install it on staging on purpose, so staging proves it goes back by itself ([upgrade.md, Installing a halted release to test going back](upgrade.md#installing-a-halted-release-to-test-going-back), ADR 0051).

1. The broken release `B` is made for this: a newer beta that can upgrade from `<alpha>` and that fails its watch. **Actions → Halt rollout → Run workflow** with `halt`, `augur`, `B`'s version and the reason "Break cycle on staging".
2. On staging, with the updater turned on ([upgrade.md, The updater](upgrade.md#the-updater)): Upgrade Centre → AUGUR → **Install B for a test**, with the reason "Break cycle".
3. Wait for the watch (10 minutes). Staging goes back to `<alpha>` by itself, and B stays blocked.

**Paste back:**
```sh
grep '^PLATFORM_VERSION=' infra/deploy/.env                     # <alpha> again
pc logs updater --since 30m | grep -iE 'watch|went back|halted' | tail -20
```
and from Admin → Activity, the rows `platform.halted-install-requested` and the upgrade that went back. The Upgrade Centre shows B marked halted, with no **Upgrade** offered.

### 8.3 The 72-hour bake starts

The bake counts from the first record staging sent on `<alpha>` with nothing going back from it since, so it starts once 8.2 has gone back. Nothing to do but note the time.

**Paste back:** the time (UTC), and the answer of `curl -s https://<Backstage's TS name>.<tailnet>/api/augur/bake` for `<alpha>`.

### 8.4 The 48-hour run, inside the bake

From the same machine as step 7, with `augur-run` checked out beside `im-platform` (`pnpm install`, then `pnpm exec playwright install chromium` once). It has to keep running for 48 hours, so start it in `tmux` or `screen`, and keep the machine awake.

```sh
pnpm run-suite run --url https://augur-staging.<tailnet> --dry          # once, now: every scenario passes or says why not
pnpm run-suite run --url https://augur-staging.<tailnet> \
  --scenarios ../augur-folio/run/index.ts --scenarios ../augur-atlas/run/index.ts
```

Classify every ledger row as it appears ([augur-run's README, The ledger](https://github.com/harry-burton-dev/augur-run#the-ledger)). Don't install anything on staging while it runs, unless a row is classed `patch`: then the patch release `A′` is installed as an ordinary upgrade, and the bake and the run go on with `A′`.

**Paste back:** the dry run's last lines now, and when it ends, `runs/<run>/report.md` from `augur-run` (commit it there, it holds no secret).

### 8.5 Promote

Once Backstage says `<alpha>` (or `A′`) has baked 72 hours and the run passed: **Actions → Promote to stable → Run workflow** with `augur` and the version, and **Skip the bake time** left unticked.

**Paste back:** the Promote run's link. Its summary says the bake was checked, with the hours and the deployment.

## 9. Ready for testers

1. **Wipe and refresh** staging ([deploy.md, Wipe and refresh](deploy.md#wipe-and-refresh)), on the release just promoted, then copy the new reporting key into Backstage. Real people will work on it now, so before `pc up -d` set `SEED_ALLOWED=false` and don't seed it ([seed.md](seed.md#allowing-it)).
2. **Add the testers**: Admin → People → **Add a person**, each with their own email. Each gets a one-time password to sign in with, then chooses their own.

**Paste back:** the preflight's **Ready** after the wipe, Backstage showing `augur-staging` reporting again, Admin → Status showing sample data not allowed, and how many testers you added.

## The evidence checklist

What's read back to close the proof. Each line is one paste-back above.

- [ ] 1. Server size and tools
- [ ] 2. Staging's tailnet name
- [ ] 3. Bucket address and relay host (no secrets)
- [ ] 4. Backstage reachable on the tailnet, and the three Actions names set
- [ ] 5. Workbench on `<alpha>`: restore test passed first, each upgrade's preflight and `pc ps`, Status heading
- [ ] 6. Staging installed: preflight, `pc ps`, off-server copy and restore test, Status, Backstage, the list of deviations
- [ ] 7. Seed's output
- [ ] 8.1 The Release run with its Deploy test
- [ ] 8.2 Break cycle: B installed on request, staging back on `<alpha>` by itself, B blocked
- [ ] 8.3 Bake start time and Backstage's answer
- [ ] 8.4 The dry run, then the 48-hour run's `report.md`: every row of traceability.md green, no ledger row a failure or unclassified
- [ ] 8.5 Promote run with the bake checked, no override
- [ ] 9. Wiped, sample data off, reporting, testers added
