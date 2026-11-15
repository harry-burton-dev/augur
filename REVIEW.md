# Reviewing a change to AUGUR

Read this before reviewing, and before opening a pull request. AGENTS.md has the rules for writing code; this
file has what a review looks for and what each pull request needs before it merges. The Review workflow checks
the parts a machine can (`scripts/review-tier.mjs`).

## Tiers

The paths a pull request changes set its tier (`.github/review-tiers.json`). Its tier is its highest path.

- **Low**: docs, tests, stories, changesets only. Merges on green CI.
- **Medium**: everything else. Needs the description's sections, a pre-merge review, and no more than 400
  changed lines (or a reason).
- **High**: the updater and anything on the release path, identity, permissions, the gateway, events, the
  registry, service-kit, migrations and stores, the SDK's public contract, app-tools, `infra/`, `release/` and
  `.github/`. Needs what Medium needs, and:
  - **the deploy test before the merge** where the change runs on a server (`deployTest`): CI's `deploy-test` job;
  - **a deep code review** on what can't be undone or gives more access (`harryOk` and `harryOkWhen`, named
    so from when they waited for Harry): a new or changed migration (its entry in the migrations lock) and the
    migration runner, backups and Postgres, Promote to stable and Halt, the updater's trusted signers, the Review
    check's own script, workflow and tiers, and a workflow or local action that gains privilege (adds
    `permissions:`, a `write` scope, `secrets`, `id-token`, a `pull_request_target`, `workflow_run` or
    `issue_comment` trigger, a `container:`, `services:` or `image:`, or a `docker://` step, or takes away a
    `permissions:` block or a `read` scope) or uses an action no workflow used before. The Review section names a
    `/code-review` run at `high`, `xhigh` or `max` effort, in a fresh context, with every finding ranked 1 to 6
    fixed or answered. The Review check lists these files under "Needs a deep review".

  Harry is not a gate on any pull request (PER-438, 15 Nov): every High pull request merges on green and goes in
  the auto-ok log (below), which tells him afterwards. Only he makes a release stable (Actions → Promote to
  stable); that stays his. The `harry-ok` label is no longer needed anywhere.

The Review check catches mistakes; it is not a wall against a hostile pull request, whose own workflows run with
the same token. The code review is the gate; the check makes sure one ran, deep enough for what changed.

A bot's pull request (Renovate) has no description to check: CI and the deploy test where it applies are its
gates, and the auto-ok log records it.

## The auto-ok log

Harry chose (PER-438) not to be asked: the code review is the gate, and the log tells him afterwards. Generated
files (`notCount`: the migrations lock, `release/kit.json`, the pnpm lockfile) don't set the tier, nor do files
only renamed (`ignoreRenames`), though a rename still counts for the deep review.

When a High pull request merges, the Review workflow's record job writes an **auto-ok record** on it (a comment
and the `auto-ok` label): what merged, the paths that set its tier, the files that needed a deep review, its
checks, and its Not run, How to undo, Risk and Review. That is the log he reads, and the control centre shows it
("Merged without you").

If Harry reads a record and would not have let it through, he adds the `harry-would-not` label. That is a miss:
the next pull request to this file or the tiers file tightens the rule, or the review, that let it through.

A tiers file may hold `next`, rules to try for a week first: the Review check reports what they make of each
pull request.

## Before you open the pull request

1. Run the checks AGENTS.md lists for what you touched, and paste their result lines into Testing.
2. Medium and High: run `/code-review high` in a fresh context against the pull request's diff. Fix or answer
   findings ranked 1 to 6; the rest are optional. Say what you did in the Review section.
3. At most two review rounds. The second reviews only what changed since the first. If it still finds an
   Important problem, stop and rethink the approach, and say so in the pull request.
4. One concern per pull request, no more than 400 changed lines. Tests, stories, fixtures and generated files
   don't count (`notSized` and `notCount` in the tiers file), except on the deep-review paths; the Review
   check says how many do.
5. A change that won't fit goes in as a series, in this order: the contract or schema, the service, the
   frontend, then whatever removes the old path. Open each against `main` once the one before has merged.
   Each leaves `main` working on its own, and says where it sits: "Part of PER-x, 2 of 4".
6. One still over 400 lines says in Risk: "Over 400 lines because …", and the reason says why it could not
   be split: recorded or generated content, a rename, a migration that must move with its store. "It is one
   feature" is not a reason.

Don't run `/security-review` as a gate: its filter drops findings that matter here (see the security angle).

## The description

Five sections, each with something in it:

- `## Testing`: the commands run and their results.
- `## Not run`: what wasn't checked and why (no Docker here, no live Keycloak, not in a real browser).
- `## Risk`: the tier and why; which release path it takes (dev build, beta, a hotfix branch).
- `## How to undo`: revert, a setting, a later release; and whether data or a migration makes that harder.
- `## Review`: the `/code-review` run (effort, how many findings, what was fixed or answered and why).

The three questions (what isn't tested, how to undo it, which release path) read straight off these, in the auto-ok record.

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
