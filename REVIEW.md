# Reviewing a change to AUGUR

Read this before reviewing, and before opening a pull request. AGENTS.md has the rules for writing code; this
file has what a review looks for and what each pull request needs before it merges. The Review workflow checks
the parts a machine can (`scripts/review-tier.mjs`).

## Tiers

The paths a pull request changes set its tier (`.github/review-tiers.json`). Its tier is its highest path.

- **Low**: docs, tests, stories, changesets only. Merges on green CI.
- **Medium**: everything else. Needs the description's sections and a pre-merge review.
- **High**: the updater and anything on the release path, identity, permissions, the gateway, events, the
  registry, service-kit, migrations and stores, the SDK's public contract, app-tools, `infra/`, `release/` and
  `.github/`. Needs what Medium needs, under 400 changed lines (or a reason), and:
  - **the deploy test before the merge** where the change runs on a server (`deployTest`): CI's `deploy-test` job;
  - **Harry's ok** on his paths (`harryOk`: the release path, the updater, sign-in, permissions, backups and
    workflows). In this order:
    1. Merge fresh `origin/main` and push. Wait for CI to be green, with only the Review check red.
    2. Ask Harry the three questions below in the thread, and wait for his "ok".
    3. Add the `harry-ok` label, and nothing else. Never add it without his ok. The Review check records the
       change he said ok to and turns green.
    4. Merge. If you must push first: merging main again keeps the label; a push that changes the change takes
       it off, and he is asked again. If the check says his ok is still being recorded, re-run it once the
       "Harry's ok recorded" comment is there. A label that was never recorded comes off; add it again once.

The Review check catches mistakes; it is not a wall against a hostile pull request, whose own workflows run with
the same token. Harry reading the three answers is the gate; the check makes sure he is asked.

A bot's pull request (Renovate) has no description to check: CI, the deploy test where it applies, and Harry's
ok on his paths are its gates.

## The next rules and the auto-ok log

Harry's ok is meant for changes that are hard to undo, widen who can do what, or change these rules. Most High
pull requests are neither, so `next` in `.github/review-tiers.json` holds the rules that take over after a
shadow week (PER-438):

- **Harry's ok** only on migrations, backups and Postgres, the release path and its workflows, the updater,
  sign-in and permissions, and these rules; and on any workflow or local action that gains privilege (adds
  `permissions:`, a `write` scope, `secrets`, `id-token` or `pull_request_target`, or takes away a `permissions:`
  block or a `read` scope) or uses an action no workflow used before.
- **High without his ok** for the rest of today's High paths: the deploy test, the description's sections and
  the `/code-review` run are their gates, and they merge on green.
- **Not counted:** generated files (`notCount`: the migrations lock, `release/kit.json`, the pnpm lockfile)
  don't set the tier, nor do files only renamed (`ignoreRenames`), though a rename still counts for Harry's ok.
  The deploy test harness, `docs/release-channels.md` and the PR template are no longer High.

Until the switch, the Review check reports what the next rules make of each pull request, but only the
current rules decide it. When a pull request merges, the Review workflow's record job writes an **auto-ok
record** on it (a comment and the `auto-ok` label) if it waited for Harry's ok and the next rules wouldn't have
asked him: what merged, the paths that set its tier, its checks, and its Not run, How to undo and Risk. That is
the log of what he would have been spared, and the control centre reads it. The record reads the merge
against the commit before it, so it needs a squash or a merge commit, not a rebase merge.

If Harry reads a record and would not have said ok, he adds the `harry-would-not` label. That is a miss: the
rule that let it through is tightened before the switch, or, after it, by the next pull request to this file.
The switch itself moves `next` to the top of the tiers file with `autoOk: true`, which is a change to the rules
and needs his ok. From then on, each High change that merges without his ok gets the record.

## Before you open the pull request

1. Run the checks AGENTS.md lists for what you touched, and paste their result lines into Testing.
2. Medium and High: run `/code-review high` in a fresh context against the pull request's diff. Fix or answer
   findings ranked 1 to 6; the rest are optional. Say what you did in the Review section.
3. At most two review rounds. The second reviews only what changed since the first. If it still finds an
   Important problem, stop and rethink the approach, and say so in the pull request.
4. One concern per pull request. A High one over 400 lines says in Risk: "Over 400 lines because …".

Don't run `/security-review` as a gate: its filter drops findings that matter here (see the security angle).

## The description

Five sections, each with something in it:

- `## Testing`: the commands run and their results.
- `## Not run`: what wasn't checked and why (no Docker here, no live Keycloak, not in a real browser).
- `## Risk`: the tier and why; which release path it takes (dev build, beta, a hotfix branch).
- `## How to undo`: revert, a setting, a later release; and whether data or a migration makes that harder.
- `## Review`: the `/code-review` run (effort, how many findings, what was fixed or answered and why).

Harry's three questions for his ok read straight off these: what isn't tested, how to undo it, and which release path.

## What failure looks like here

A review reports these first:

- **It breaks a server.** It won't start, upgrade or go back: ordering between services, a setting a server
  doesn't have yet, an image whose config changed, a migration the release before can't live with.
- **It hides.** Something unavailable disappears instead of saying why and who can change it.
- **It hard-codes.** A name, URL, limit or app id that should come from state, config or a manifest.
- **It reaches round.** An app or package past `@augur/*`, the gateway, the manifest or events; React or the kit bundled.
- **It breaks the promise.** The SDK, Quill or Common remove or rename something within a major.
- **It loses data or order.** An event skipped or out of order, an audit entry without its event, a backup
  pruned after a failed one, a retry that writes twice.

### The security angle

Use AUGUR's own threat model, not a generic one:

- Admins are not trusted with the server. An admin reaching what only the deployment admin may is a finding.
- Fail open is a bug: a check that believes a header, a missing setting or an outage.
- Defence in depth counts. A second layer missing is a finding even when the first holds today.
- A replay or bypass that needs an operational fault (a stale feed, a restart) is still a hole.

## How to report

- Open with the count: "3 findings, 1 to fix before merge", or plainly "Nothing needs fixing".
- Each finding names the file and line, what goes wrong and when.
- At most three nits. Style, naming and formatting are for lint, not review.
- Don't repeat a finding the author has answered.

## When something is found after the merge

The fix pull request names the pull request that introduced the defect (git blame, not the one that set it off),
and adds the check that would have caught it where it belongs: a test, a lint rule, a line here or in AGENTS.md.
A finding that keeps coming back becomes a rule (the pg Pool rule in `eslint.config.mjs` is one).
