# Release channels: dev, preview, production

Work merges into `dev`. `dev` is promoted to `preview`, which runs on the preview server. `preview` is promoted to `production`, one unit at a time, for every other deployment. A release is built and signed once, on `preview`; production takes that same release, so a production server runs exactly what preview ran.

A **unit** is what moves on its own: **AUGUR** (the platform, its services and the pillar apps, as one `augur@x.y.z` release) or one **app** the app runner installs (`app/<id>@x.y.z`, Mandate today). The plan this follows: [release channels spec](https://claude.ai/artifact/DPaF1kkMzfAvPghpTYgLDJ).

| Branch | What goes into it | What a merge does |
| --- | --- | --- |
| `dev` (the default branch) | every pull request | keeps the **Version packages** pull request; once that's merged, opens or refreshes **Promote to preview** |
| `preview` | `dev` (through Promote to preview), a back-merge from `production`, or a `hotfix/*` branch | builds, signs and releases each unit whose version has no release yet, as a GitHub **pre-release** |
| `production` | a `promote/*` branch (from the Promote workflow) or a `hotfix/*` branch, merged by the repository's owner | marks the promoted release as on production: no image is rebuilt. Only a hotfix's new version is built here |

CI holds these rules on every pull request (`node scripts/promote.mjs check-pr`): a pull request into `preview` or `production` from anywhere else fails, as does one that carries changesets no Version packages run has spent, or a promotion that changes another unit's files.

## Working on dev

Open pull requests against `dev`, with a changeset as before ([versioning.md](versioning.md#making-a-change)). Merging into `dev` releases nothing. The Release workflow on `dev` keeps the Version packages pull request open, which cuts the versions: merging it bumps each changed package, writes the changelogs and `release/augur-release.json`, exactly as it did on `main`.

## Promote to preview

Once Version packages is merged and nothing is waiting, the Release workflow opens **Promote to preview**, a pull request from `dev` into `preview`. It lists each unit whose version is different from preview's, from and to. While new changesets wait on `dev`, its CI fails and says to merge Version packages first, so only versioned code reaches preview.

Merging it runs the Release workflow on `preview`: each new version is built, pushed and signed, then released as a GitHub pre-release with its release file, and the feed is published. Servers following beta (the preview server) see it at their next check. Production servers, which follow stable, don't.

The preview server follows beta for AUGUR by itself while AUGUR is 0.x. A production server follows stable by itself once it has `SERVER_RING=production` (below). For an app, choose **New releases: betas too** on the installed app in Admin → Apps, so preview releases of it install there.

## Promote to production

In GitHub, **Actions → Promote → Run workflow**, with the unit (`augur`, or an app's id such as `mandate`) and, if you like, the version (by default, the one preview has). It opens **Promote <name> <version> to production**: a branch from `production` with only that unit's files from `preview`, and `pnpm-lock.yaml` made again for production's packages. CI on it checks the unit against production: an app's SDK range against production's AUGUR, the contract tests and the migrations lock.

Merge it yourself. The Release workflow on `production` then finds the release preview made, attaches `promotion.json` (who merged which pull request, from which commit) and takes off its pre-release mark, so it is on the stable channel and production servers see it at their next check. It refuses when the pull request wasn't merged by the repository's owner.

Units move independently: Mandate can go to production while AUGUR stays where it is, and the other way round.

## Hotfixes

For a fix production can't wait for: branch `hotfix/<what>` from `production`, make the fix with a changeset, run `pnpm version-packages` on the branch and commit (so it carries a new version and no waiting changesets), and open a pull request into `production`. Merging it builds and releases the new version on production, the one time production builds. The Release workflow then opens back-merge pull requests from `production` into `preview` and `dev`, so the fix isn't lost at the next promotion.

## Signatures

Releases are signed by the Release workflow on the branch it ran on. The updater and the mirror take a signature from `release.yml` on `main`, `preview` or `production` (`releaseIdentity` in `platform/services/updater/src/signers.ts`), and still refuse any other branch or workflow. `main` stays on the list for releases made before it was renamed.

## Server rings

Each server says what kind it is with `SERVER_RING` in `.env`. It is set there and not in Admin, so no admin session can change it.

| | `preview` (the preview server) | `production` (every other deployment, and the default) |
| --- | --- | --- |
| AUGUR follows | preview releases (beta) by default; `RELEASE_CHANNEL=stable` for production ones only | production releases (stable) only; `RELEASE_CHANNEL=beta` is ignored, and Updates says so |
| An app follows | production releases, or preview releases too (Admin → Apps, **New releases**) | production releases only; **Preview releases too** stays in the list, greyed, saying why |
| Pull requests' builds | run for an app's developers | don't run, unless `ALLOW_PR_PREVIEWS=on` |

It is a required setting from the release that brings it: **Upgrade to …** asks for it, and the preflight stops a by-hand upgrade until it's set. Set `SERVER_RING=preview` on the preview server, and `production` everywhere else.

## What's left to build

Dev builds of every merge to `dev` and signed promotion records come next; then the Updates page's history, changelogs and Go back, feature previews, and the live dev loop. Admin calls the channels **Preview** and **Production**; the release files and the registry's API still say beta and stable, so servers on older releases keep reading the feed.

## Once, in GitHub (the repository's owner)

1. Rename `main` to `production` (Settings → General → Default branch, or Branches → rename). Open pull requests and links follow it.
2. Create `preview` and `dev` from `production`, and make `dev` the default branch.
3. Rulesets, if your plan enforces them on a private repository: `production` and `preview` need a pull request and passing checks, and no force-pushes; `dev` needs passing checks. On GitHub Free they aren't enforced, and the checks above still hold.
4. `RELEASE_TOKEN` needs nothing new: it opens the promotion pull requests so CI runs on them.
