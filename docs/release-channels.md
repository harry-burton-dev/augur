# Release channels: dev, preview, production

Work merges into `dev`. `dev` is promoted to `preview`, which runs on the preview server. `preview` is promoted to `production`, one unit at a time, for every other deployment. A release is built and signed once, on `preview`; production takes that same release, so a production server runs exactly what preview ran.

A **unit** is what moves on its own: **AUGUR** (the platform, its services and the pillar apps, as one `augur@x.y.z` release) or one **app** the app runner installs (`app/<id>@x.y.z`, Mandate today). The plan this follows: [release channels spec](https://claude.ai/artifact/DPaF1kkMzfAvPghpTYgLDJ).

| Branch | What goes into it | What a merge does |
| --- | --- | --- |
| `dev` (the default branch) | every pull request | keeps the **Version packages** pull request; once that's merged, opens or refreshes **Promote to preview** |
| `preview` | `dev` (through Promote to preview), a back-merge from `production`, or a `hotfix/*` branch | builds, signs and releases each unit whose version has no release yet, as a GitHub **pre-release** |
| `production` | a `promote/*` branch (from the Promote workflow) or a `hotfix/*` branch, merged by the repository's owner | marks the promoted release as on production: no image is rebuilt. Only a hotfix's new version is built here |

Versions are only cut on `dev`. If `preview` or `production` ever holds changesets that were never versioned, the Release workflow there releases nothing and says why in its summary, instead of opening a Version packages pull request into that branch.

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

AUGUR's dev builds are signed by `augur-dev.yml` on `dev`, which the updater takes only for a dev build, and only on the workbench ([AUGUR dev builds](#augur-dev-builds)).

## Server rings

Each server says what kind it is with `SERVER_RING` in `.env`. It is set there and not in Admin, so no admin session can change it.

| | `dev` (the workbench) | `preview` (a staging server) | `production` (every other deployment, and the default) |
| --- | --- | --- | --- |
| AUGUR follows | AUGUR's own dev builds, taken by itself, and every release (`RELEASE_CHANNEL=dev`, the default; see [AUGUR dev builds](#augur-dev-builds)) | preview releases (beta) by default; `RELEASE_CHANNEL=stable` for production ones only | production releases (stable) only; `RELEASE_CHANNEL=beta` is ignored, and Updates says so |
| An app follows | production releases, preview releases too, or dev builds too (Admin → Apps, **New releases**) | the same | production releases only; **Preview releases too** and **Dev builds too** stay in the list, greyed, saying why |
| Pull requests' builds | run for an app's developers | the same | don't run, unless `ALLOW_PR_PREVIEWS=on` |
| Feature previews nobody chose for | opt-in | opt-in | off |

It is a required setting from the release that brings it: **Upgrade to …** asks for it, and the preflight stops a by-hand upgrade until it's set. Set `SERVER_RING=dev` on the workbench (the server you build on), `preview` on a staging server if you keep one, and `production` everywhere else, the demonstration deployment included. A preview server does everything the workbench does except run AUGUR's own dev builds.

## History and changelogs

**Admin → Upgrade Centre** lists every upgrade asked for, newest first: from and to, who asked, how it ended (done, went back by itself, stopped partway), how long it took and the backup it took first. Above it, **What's new since** your version gathers every change between yours and the newest release, once each however many parts it moved, breaking changes first. Each release carries its changed parts' changelogs (`changelogs` in `augur-release.json`) for this; releases made before that link to their notes on GitHub instead.

**Admin → Apps**, on an installed app, shows what's new in the version waiting and the app's history: each install, update and removal, by whom or by itself.

## Going back

**Admin → Upgrade Centre → Go back** lists the five releases before yours on your channel. **Go back** runs the same steps as an upgrade, a backup first, then every part on the older release; parts the older release doesn't have are stopped. It's offered straight away only while no release between is breaking: within that, migrations only add, so the older release works on the tables the newer one left, and the data stays as it is. Across a breaking release, the list says which one and why, and going back is by hand, restoring the backup taken before upgrading to it ([upgrade.md](upgrade.md#going-back)). History records each going back, and Activity has `platform.go-back-requested` and `platform.went-back`.

For an app, **Admin → Apps → Go back** installs one of its three versions before (blue/green, as any install) and sets it to **Hold**, so Automatic doesn't take it straight up again.

## Dev builds

Every merge into `dev` that changes a runner app (Mandate today) builds it at once, with no Version packages: **App dev builds** (`.github/workflows/app-dev.yml`) makes `app/<id>@<next patch>-dev.<run>` (such as `0.1.3-dev.212` after `0.1.2`), signed by that workflow on `refs/heads/dev`, and keeps each app's three newest. A dev build sorts above the release it follows and below the next one.

Only a dev or preview server takes them. On the installed app in Admin → Apps, choose **New releases: Dev builds too**; with **Automatic**, each dev build installs at the server's next check (blue/green, as any install). Before each one, the updater takes a backup of the database, since a dev build runs on the server's real data; the install's first step names the file. On a production server the choice stays in the list, greyed, saying why; the registry refuses one, and the updater refuses to install a dev build unless `.env` says `SERVER_RING=dev` or `preview`.

Because a dev build has run its migrations on the preview server, a migration is frozen once it's on `dev`, not only once it's released: CI on a pull request into `dev` fails if it changes or removes one that's already there (`MIGRATIONS_FROZEN_AT=origin/dev pnpm check:migrations`). Add a new migration instead.

## AUGUR dev builds

AUGUR itself gets a dev build of every merge into `dev` that changes the platform, the apps that ship with it (Folio, Auspex, Data Atlas) or how it's deployed: **AUGUR dev builds** (`.github/workflows/augur-dev.yml`) builds, pushes and signs every image as a release does and makes the pre-release `augur@<next patch>-dev.<run>` (such as `0.12.1-dev.48` after `0.12.0`). Its parts keep the last release's versions, since nothing is versioned until the Version packages PR; what it changes, what's breaking and its notes come from the changesets waiting (`node scripts/augur-release.mjs dev <run>`). AUGUR keeps its three newest dev builds, and the feed its two newest beside its releases.

Only the workbench takes them. With `SERVER_RING=dev`, the registry follows the dev channel by default (`RELEASE_CHANNEL=dev`), which holds dev builds and every release. When a dev build is next and nothing needs a person (no breaking change, and no new required setting the updater can't make up), the registry asks the updater for it by itself, and it runs as any upgrade: backup first, then roll forward, rolling back if it doesn't come up. The history says **By itself**. A dev build that didn't finish, or that an admin took back or went back from, is never asked for again by itself: it waits for an admin, as does a release. A dev build with something that needs you waits on Updates, saying what.

The updater checks a dev build's images against the AUGUR dev builds workflow on `refs/heads/dev` (`AUGUR_DEV_SIGNER` in the updater overrides it), not the Release workflow, and refuses one unless `.env` says `SERVER_RING=dev`. On a preview or production server `RELEASE_CHANNEL=dev` is ignored, and Updates says so.

## The pipeline feed

Beside the release feed, `ghcr.io/<repo>/feed:pipeline` says where everything is between the branches, for Backstage (every unit, every deployment) and each deployment's Upgrade Centre (this server's place on the line). The **Pipeline feed** workflow (`.github/workflows/pipeline.yml`, `scripts/pipeline.mjs`) writes it again on every push to `dev`, `preview` or `production`, when a pull request into one opens or closes, and after each workflow that makes or removes releases. It's read with the deployment's read key, as the release feed is. It holds:

- each unit (AUGUR, and each app the app runner installs) with its version on each branch, its newest dev build, and its pull requests' newest previews
- the changesets waiting on `dev`, and which units each moves: what the next Version packages PR will release
- the pull requests merged into `dev` that `preview` hasn't got, and into `preview` that `production` hasn't, newest first
- the open Version packages, Promote to preview and Promote to production pull requests

It only describes the line. Nothing reads it to decide what to install: that stays the release feed's job.

Admin → **Upgrade Centre** (it replaced Updates) shows it as **The line**: each part on each branch, this server's version highlighted where it sits, what's waiting between the branches, and the open Version packages and Promote pull requests, each linked to GitHub. It shows and links only: merging and promoting stay in GitHub. With `PORTAL_URL` set to the company's Backstage, each part links to its system there. The registry reads the pipeline at most once a minute, from `feed:pipeline` beside the release feed (`PIPELINE_FEED_URL` says otherwise, `off` hides it); a server on a mirror has none, and the page says so.

## Feature previews

An app can ship a feature before it's everyone's, on any server, production included: it lists it in its manifest's `previews` (SDK 1.7), with an `id`, a `name`, a sentence of `detail` and, if you like, its last day, `until`. The app asks `ctx.previewOn('<id>')` and works as before when the answer is no; its service can ask the registry the same for a person (`GET /v1/apps/<id>/feature-previews/people/<person>`).

Who gets each is an admin's call, in **Admin → Apps** on the app, under **Feature previews**: **Off**, **For those who turn it on**, or **On for everyone**. Until an admin chooses, a preview server makes it opt-in and a production server keeps it off. People turn the opt-in ones on for themselves in the shell's **Previews** (in the band), which mounts the app again with it; while one is on, the app says **Preview on** above it, with the way back. After its `until` day a preview is off for everyone, and Admin says the app should drop it or make it everyone's. Each choice an admin makes is in Activity as `app.preview-set`.

## The live dev loop

Vite and Storybook already change what you see as you save. `pnpm dev:app <id>` runs the real shell and kit with your app's frontend from source (hot reload) and its service beside it. Three switches make more of it live:

- `--kit` also rebuilds the UI kit, its tokens (`tokens/tokens.json`) and the shared modules the shell serves as you change them, and reloads the page, so a change to a kit part shows in your app in a few seconds.
- `DEV_PREVIEWS=all` (or ids, comma separated) turns the app's feature previews on for the stand-in person.
- `DEV_HOST=0.0.0.0` opens the dev server to other machines on the tailnet (any `*.ts.net` name, plus `DEV_ALLOWED_HOSTS`), such as your phone.

### Live on the workbench

`pnpm dev:app <id> --live` puts your app's frontend, from source on your machine, into the workbench's real shell: real sign-in, floors, data and the installed service, for you alone.

1. Once, on your machine: `tailscale serve --bg 5173`, so the dev server answers on `https://<your machine>.<tailnet>.ts.net`.
2. Run `pnpm dev:app <id> --live`. It prints the address of the app's entry, such as `https://laptop.tail1234.ts.net/@fs/…/apps/<id>/frontend/src/entry.ts`.
3. On the workbench, open the shell's **Previews**, find the app, paste it into **Live from my machine** and press **Load it**. Save a file and the page reloads. **Back to …** stops it.

Only the app's developers (Admin → Apps) can, and only on the workbench: the registry refuses it unless `SERVER_RING=dev`, and only there does the front door's Content Security Policy let the shell load scripts from `https://*.ts.net` (and its reload socket from `wss://*.ts.net`). Anywhere else Previews still shows it, saying why. The address must be https on a `*.ts.net` name and end in `.js` or `.ts`. It's kept in memory, so a registry restart puts you back on the app. The app's service is the installed one: to try service changes, open a pull request and use its preview. The kit and shared modules your entry imports come from your machine too, so a kit change shows as you make it.

For the kit on its own, `pnpm --filter @augur/ui-kit storybook`. Every pull request's CI run keeps its Storybook for 14 days: download **storybook** from the run's artifacts, unzip it and serve the folder (`npx serve`).

## What's left to build

Signed promotion records, clearing old dev builds' images from the registry, and giving a feature preview to chosen teams. Admin calls the channels **Preview** and **Production**; the release files and the registry's API still say beta and stable, so servers on older releases keep reading the feed.

## Once, in GitHub (the repository's owner)

1. Rename `main` to `production` (Settings → General → Default branch, or Branches → rename). Open pull requests and links follow it.
2. Create `preview` and `dev` from `production`, and make `dev` the default branch.
3. Rulesets, if your plan enforces them on a private repository: `production` and `preview` need a pull request and passing checks, and no force-pushes; `dev` needs passing checks. On GitHub Free they aren't enforced, and the checks above still hold.
4. `RELEASE_TOKEN` needs nothing new: it opens the promotion pull requests so CI runs on them.
