# Release channels: one branch, three rings

Work merges into `main`, the only long-lived branch. Each release is built and signed **once**, as a GitHub pre-release on the **beta** channel. Making it **stable** changes only its label: production servers then take that same release, so they run exactly what the preview server ran. There are no `preview` or `production` branches, and no promotion pull requests.

Which workflow does each step, when it runs and what it costs in CI minutes: [ci-cd.md](ci-cd.md).

A **unit** is what moves on its own: **AUGUR** (the platform, its services and the pillar apps, as one `augur@x.y.z` release) or one **app** the app runner installs (`app/<id>@x.y.z`, Mandate today).

| Step | What happens | Who |
| --- | --- | --- |
| Merge a pull request into `main` | CI runs; each changed unit gets a **dev build**, which only the workbench takes | anyone with a green pull request |
| Merge **Version packages** | cuts the versions, then builds, signs and releases each unit whose version moved, as a **beta** | the repository's owner |
| Run **Promote to stable** | marks a beta release stable, with `promotion.json` attached: nothing is rebuilt | the repository's owner only |

CI holds these rules on every pull request (`node scripts/promote.mjs check-pr`). Into `main` anything goes, with a changeset. Into a hotfix's `release/<unit>-<major>.<minor>` branch only a `hotfix/*` branch (or its Version packages pull request) goes, changing only that unit's files, and keeping to that line: a hotfix is a patch.

## Working on main

Open pull requests against `main`, with a changeset ([versioning.md](versioning.md#making-a-change)). Merging releases nothing on its own: the Release workflow keeps the **Version packages** pull request open while changesets wait. Merging that bumps each changed package, writes the changelogs and `release/augur-release.json`, and then, in the same run, builds, pushes and signs each unit whose version has no release yet, and makes its GitHub pre-release with its release file. The feed is published once at the end. Servers following beta (the preview ring) see it at their next check; production servers, which follow stable, don't.

The preview ring follows beta for AUGUR by itself while AUGUR is 0.x. A production server follows stable by itself once it has `SERVER_RING=production` (below). For an app, choose **New releases: Preview releases too** on the installed app in Admin → Apps, so its betas install there.

## Promote to stable

In GitHub, **Actions → Promote to stable → Run workflow**, with the unit (`augur`, or the id of an app released from this repository or from its own, below) and, if you like, the version (by default, that unit's newest beta). It attaches `promotion.json` (who made it stable, from which run, when), takes off the pre-release mark and, for AUGUR's newest stable, marks it the repository's latest release. Production servers see it at their next check. Only the repository's owner may run it: anyone else's run fails before it changes anything.

### Bake time

A release goes stable only once it has run on a preview deployment (`SERVER_RING=preview`) for 72 hours, with no deployment going back from it ([ADR 0018](decisions/0018-rollout-gates.md)). The workflow asks the portal, which works it out from the records deployments send ([ADR 0019](decisions/0019-deployment-reporting.md)). If it hasn't baked, the run fails and says how long it ran and where. Tick **Skip the bake time** to make it stable anyway: `promotion.json` records the override and why it was needed.

The portal is only on the tailnet, so the workflow joins it to ask ([ADR 0045](decisions/0045-promote-asks-portal-over-tailscale.md)). To set that up, once:

1. In Tailscale, add the tag `tag:ci` to the ACL's `tagOwners`, and let `tag:ci` reach the portal on port 443.
2. Make an OAuth client (Settings → OAuth clients) with the `auth_keys` write scope and the tag `tag:ci`.
3. In the repository, add the secrets `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_SECRET`, and the variable `PORTAL_URL` (the portal's address, such as `https://backstage.<your tailnet>.ts.net`).

Until then, a promotion goes ahead, and both the run and `promotion.json` say that bake time wasn't checked.

Units move independently: Mandate can become stable while AUGUR stays where it is, and the other way round.

### An app in its own repository

An app listed in `release/app-repos.json` ([ADR 0047](decisions/0047-app-repositories-in-augurs-feed.md)) is promoted from here too: give its id as the unit. The workflow marks its release stable in the app's own repository, with `promotion.json`, and the feed that follows lists it as stable. It does this with the `APP_PROMOTE_TOKEN` secret, which only this workflow reads: a fine-grained token with Contents read and write on the app repositories, nothing else, expiring after 90 days. Without it, promoting such an app fails and says so. The feed's `APP_RELEASES_TOKEN` stays read-only.

A pillar app (`release/shipped-apps.json`) isn't promoted on its own: it ships inside AUGUR's release ([ADR 0049](decisions/0049-pillar-apps-shipped-from-their-releases.md)), so it becomes stable when that AUGUR release does. Asking for one says so.

## Halting a release

When a release turns out to be bad after it's out, stop it reaching more servers: in GitHub, **Actions → Halt rollout → Run workflow**, with `halt`, the unit (`augur` or an app's id), the version and a reason people will read. It attaches `halted.json` (the reason, when, who) to the release and publishes the feed again at once ([ADR 0018](decisions/0018-rollout-gates.md)). Every server sees the mark at its next check: the release stays listed, marked halted with the reason, and is never offered, chosen as the next upgrade or installed. A server running it is told to move on, or to go back. Only the repository's owner may run it.

Run it again with `resume` to take the mark off once the release turns out fine. A fix is normally a new patch release instead, which servers move to as usual. Mirrors pass a halt on when the release is mirrored again ([mirror.md](mirror.md#halted-releases)).

## Hotfixes

For a fix that can't wait for what's on `main`: cut `release/<unit>-<major>.<minor>` from the release's tag (such as `git switch -c release/augur-0.14 augur@0.14.0`), branch `hotfix/<what>` from it, make the fix with a changeset and open a pull request into the release branch. Merging it opens a Version packages pull request on that branch; merging that releases the patch as a beta, and **Promote to stable** makes it stable. Then make the same fix on `main` (cherry-pick it, with its own changeset), so the next release has it too. Keep the release branch while that line is supported; delete it after.

## Signatures

Releases are signed by the Release workflow on the branch it ran on. The updater and the mirror take a signature from `release.yml` on `main` or a `release/<unit>-<major>.<minor>` branch (`releaseIdentity` in `platform/services/updater/src/signers.ts`), and still refuse any other branch or workflow. `preview` and `production` stay on the list for the releases made on them up to 0.13.0, which a deployment may roll back to.

Each image also carries two attestations, signed by the same workflow: an SBOM of what is inside it (SPDX, from Syft through BuildKit's `--sbom`) and SLSA build provenance (BuildKit's `--provenance`). An organisation's security review checks them with the image's own identity:

```sh
cosign verify-attestation --type spdxjson --certificate-identity-regexp '^https://github.com/harry-burton-dev/(augur|im-platform)/.github/workflows/' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com <image>@<digest> | jq -r .payload | base64 -d | jq .predicate
```

(`--type slsaprovenance1` for the provenance, which is SLSA v1; an app's release from its own repository names that repository instead.) The mirror's `cosign copy` carries them with the image, so an air-gapped deployment keeps them. A shipped app's image whose own build wrote none is released without them, with a warning in the release run.

Dev builds are signed by `augur-dev.yml` (AUGUR) or `app-dev.yml` (apps) on `main`, which the updater takes only for a dev build, and only on the workbench ([AUGUR dev builds](#augur-dev-builds)). `dev` stays on that list until `main` replaces it.

For AUGUR published from a fork, three settings in `.env` say whose signatures the updater takes instead, as certificate identity patterns: `IMAGE_SIGNER` for its images and the apps it installs (such as `^https://github\.com/acme/augur/\.github/workflows/release\.yml@refs/heads/main$`), `IMAGE_SIGNER_ISSUER` for who issues the certificates (GitHub Actions unless set), and `AUGUR_DEV_SIGNER` for its dev builds, which otherwise follows the repository `IMAGE_SIGNER` names. Leave all three unset to take the publisher's. The registry's `FEED_SIGNER` does the same for the release feed ([upgrade.md](upgrade.md#the-signed-feed)).

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

The **Upgrade Centre** (`/upgrades`) lists every upgrade asked for, newest first: from and to, who asked, how it ended (done, went back by itself, stopped partway), how long it took and the backup it took first. Above it, **What's new since** your version gathers every change between yours and the newest release, once each however many parts it moved, breaking changes first. Each release carries its changed parts' changelogs (`changelogs` in `augur-release.json`) for this; releases made before that link to their notes on GitHub instead.

**Admin → Apps**, on an installed app, shows what's new in the version waiting and the app's history: each install, update and removal, by whom or by itself.

## Going back

**Upgrade Centre → Go back** lists the five releases before yours on your channel. **Go back** runs the same steps as an upgrade, a backup first, then every part on the older release; parts the older release doesn't have are stopped. It's offered straight away only while no release between is breaking: within that, migrations only add, so the older release works on the tables the newer one left, and the data stays as it is. Across a breaking release, the list says which one and why, and going back is by hand, restoring the backup taken before upgrading to it ([upgrade.md](upgrade.md#going-back)). History records each going back, and Activity has `platform.go-back-requested` and `platform.went-back`.

For an app, **Admin → Apps → Go back** installs one of its three versions before (blue/green, as any install) and sets it to **Hold**, so Automatic doesn't take it straight up again.

## Dev builds

Every merge into `main` that changes a runner app (Mandate today) builds it at once, with no Version packages: **App dev builds** (`.github/workflows/app-dev.yml`) makes `app/<id>@<next patch>-dev.<run>` (such as `0.1.3-dev.212` after `0.1.2`), signed by that workflow on `refs/heads/main`, and keeps each app's three newest. A dev build sorts above the release it follows and below the next one.

Only a dev or preview server takes them. On the installed app in Admin → Apps, choose **New releases: Dev builds too**; with **Automatic**, each dev build installs at the server's next check (blue/green, as any install). Before each one, the updater takes a backup of the database, since a dev build runs on the server's real data; the install's first step names the file. On a production server the choice stays in the list, greyed, saying why; the registry refuses one, and the updater refuses to install a dev build unless `.env` says `SERVER_RING=dev` or `preview`.

Because a dev build has run its migrations on a real server, a migration is frozen once it's on `main`, not only once it's released: CI on a pull request into `main` fails if it changes or removes one that's already there (`MIGRATIONS_FROZEN_AT=origin/main pnpm check:migrations`). Add a new migration instead.

## AUGUR dev builds

AUGUR itself gets a dev build of every merge into `main` that changes the platform, the apps that ship with it (Folio, Explorer, Data Atlas) or how it's deployed: **AUGUR dev builds** (`.github/workflows/augur-dev.yml`) builds, pushes and signs every image as a release does and makes the pre-release `augur@<next patch>-dev.<run>` (such as `0.12.1-dev.48` after `0.12.0`). Its parts keep the last release's versions, since nothing is versioned until the Version packages PR; what it changes, what's breaking and its notes come from the changesets waiting (`node scripts/augur-release.mjs dev <run>`). AUGUR keeps its three newest dev builds, and the feed its two newest beside its releases.

Only the workbench takes them. With `SERVER_RING=dev`, the registry follows the dev channel by default (`RELEASE_CHANNEL=dev`), which holds dev builds and every release. When a dev build is next and nothing needs a person (no breaking change, and no new required setting the updater can't make up), the registry asks the updater for it by itself, and it runs as any upgrade: backup first, then roll forward, rolling back if it doesn't come up. The history says **By itself**. A dev build that didn't finish, or that an admin took back or went back from, is never asked for again by itself: it waits for an admin, as does a release. A dev build with something that needs you waits on Updates, saying what.

The updater checks a dev build's images against the AUGUR dev builds workflow on `refs/heads/main` (`AUGUR_DEV_SIGNER` in `.env` overrides it; [Signatures](#signatures)), not the Release workflow, and refuses one unless `.env` says `SERVER_RING=dev`. On a preview or production server `RELEASE_CHANNEL=dev` is ignored, and Updates says so.

## The pipeline feed

Beside the release feed, `ghcr.io/<repo>/feed:pipeline` says where everything is on its way from `main` to stable, for Backstage (every unit, every deployment) and each deployment's Upgrade Centre (this server's place on the line). The **Pipeline feed** workflow (`.github/workflows/pipeline.yml`, `scripts/pipeline.mjs`) writes it again after each Release run (every push to `main`) and after each workflow that makes or promotes releases (dev builds, Promote to stable). A pull request's preview, or a newly opened pull request, shows from the next of those runs; run the workflow by hand to refresh it sooner. It used to run on every pull request event too, about 300 runs a night for the same answer. It's read with the deployment's read key, as the release feed is. Its three stages are the rings: **dev** is `main`, **preview** is each unit's newest release (beta or stable), **production** its newest stable release. It holds:

- each unit (AUGUR, and each app the app runner installs) with its version at each stage, its newest dev build, and its pull requests' newest previews
- the changesets waiting on `main`, and which units each moves: what the next Version packages PR will release
- the pull requests merged since AUGUR's newest release, and between its newest release and its newest stable one, newest first
- the open Version packages pull request

It only describes the line. Nothing reads it to decide what to install: that stays the release feed's job.

Admin → **Upgrade Centre** (it replaced Updates) shows it as **The line**: each part at each stage, this server's version highlighted where it sits, what's waiting between the stages, and the open Version packages pull request, linked to GitHub. It shows and links only: merging and promoting stay in GitHub. With `PORTAL_URL` set to the company's Backstage, each part links to its system there. The registry reads the pipeline at most once a minute, from `feed:pipeline` beside the release feed (`PIPELINE_FEED_URL` says otherwise, `off` hides it); a server on a mirror has none, and the page says so.

## Feature previews

An app can ship a feature before it's everyone's, on any server, production included: it lists it in its manifest's `previews` (SDK 1.7), with an `id`, a `name`, a sentence of `detail` and, if you like, its last day, `until`. The app asks `ctx.previewOn('<id>')` and works as before when the answer is no; its service can ask the registry the same for a person (`GET /v1/apps/<id>/feature-previews/people/<person>`).

Who gets each is an admin's call, in **Admin → Apps** on the app, under **Feature previews**: **Off**, **For those who turn it on**, **On for everyone**, or **On for chosen floors**. Chosen floors try a feature on one team (or a few) first, without a release: it's on there and on every floor beneath them, personal floors included when the org is chosen, and off everywhere else. Nobody turns a floor preview on or off for themselves; the shell's **Previews** says it's on for some floors only. The app still just asks `ctx.previewOn('<id>')`: the shell's catalogue for the floor someone stands on already says. Its service passes the floor too (`?workspace=<floor>` on the call above); without it, floor previews count as off. Until an admin chooses, a preview server makes it opt-in and a production server keeps it off. People turn the opt-in ones on for themselves in the shell's **Previews** (in the band), which mounts the app again with it; while one is on, the app says **Preview on** above it, with the way back. After its `until` day a preview is off for everyone, and Admin says the app should drop it or make it everyone's. Each choice an admin makes is in Activity as `app.preview-set`.

AUGUR's own apps (Home, Admin, …) can offer feature previews too, in their entries in `platformApps` (`platform/services/registry/src/manifest.ts`). They aren't in the catalogue table, so an admin can't choose who gets them yet: each stays at the server's default (opt-in on a dev or preview server, off on a production one), and Admin says so if asked to change one. Home offers the design direction this way: `focal-planes` and `radial-menu` (PER-283), and the Upgrade Centre offers `urgent-letterbox`, which the shell reads to letterbox urgent news.

## The live dev loop

Vite and Storybook already change what you see as you save. `pnpm dev:app <id>` runs the real shell and kit with your app's frontend from source (hot reload) and its service beside it. Two switches make more of it live:

- `DEV_PREVIEWS=all` (or ids, comma separated) turns the app's feature previews on for the stand-in person.
- `DEV_HOST=0.0.0.0` opens the dev server to other machines on the tailnet (any `*.ts.net` name, plus `DEV_ALLOWED_HOSTS`), such as your phone.

The kits are in the `augur-kit` repository: work on a part there, in its Storybook.

### Live on the workbench

`pnpm dev:app <id> --live` puts your app's frontend, from source on your machine, into the workbench's real shell: real sign-in, floors, data and the installed service, for you alone.

1. Once, on your machine: `tailscale serve --bg 5173`, so the dev server answers on `https://<your machine>.<tailnet>.ts.net`.
2. Run `pnpm dev:app <id> --live`. It prints the address of the app's entry, such as `https://laptop.tail1234.ts.net/@fs/…/apps/<id>/frontend/src/entry.tsx`.
3. On the workbench, open the shell's **Previews**, find the app, paste it into **Live from my machine** and press **Load it**. Save a file and the page reloads. **Back to …** stops it.

Only the app's developers (Admin → Apps) can, only on the workbench, and only from a machine on the workbench's own tailnet: the registry refuses it unless `SERVER_RING=dev`, and only there does the front door's Content Security Policy let the shell load scripts from `https://*.<tailnet>.ts.net` (and its reload socket from `wss://*.<tailnet>.ts.net`), where `<tailnet>` comes from `PLATFORM_URL`. Never all of `*.ts.net`: every Tailscale user's machines are under it. A workbench whose `PLATFORM_URL` isn't `https://<machine>.<tailnet>.ts.net` loads from no machine. Anywhere else Previews still shows it, saying why. The address must be https on a name on that tailnet and end in `.js`, `.ts` or `.tsx`. It's kept in memory, so a registry restart puts you back on the app. The app's service is the installed one: to try service changes, open a pull request and use its preview. The kit and shared modules your entry imports come from your machine too, so a kit change shows as you make it.

For the kits on their own: the React kits' Storybook is in the `augur-kit` repository (`pnpm storybook` there), which publishes it to Chromatic (ADR 0016, ADR 0046) when a part, a token or a story changes.

## What's left to build

Signed promotion records, and clearing old dev builds' images from the registry. Feature previews move onto OpenFeature and flagd in the beta (ADR 0021, amended); apps' calls stay the same. Admin calls the channels **Preview** and **Production**; the release files and the registry's API still say beta and stable, and the pipeline feed still calls its stages branches, so servers on older releases keep reading the feeds.

## Once, in GitHub (the repository's owner)

1. Rulesets, if your plan enforces them on a private repository: `main` and `release/*` need a pull request and passing checks, and no force-pushes. On GitHub Free they aren't enforced, and the checks above still hold.
2. The workbench takes dev builds from `main` from 0.13.1 on, the first release made there. Until it runs 0.13.1, it refuses them at their signature check; upgrade it and they install by themselves again.
