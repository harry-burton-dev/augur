# Ship an app

From a new app to running on your servers, with no manual update at any step. Each step links to the page with the detail.

| Step | Where it runs | What you do |
| --- | --- | --- |
| [Build and test](#1-build-and-test-it) | Your machine | A repository from augur-app-template, `pnpm dev:app` |
| [Try it on a server](#2-try-it-on-a-real-server) | CI and your server | Open a pull request, switch to its preview |
| [Release it](#3-release-it) | CI | Merge, then merge Version packages |
| [Servers take it](#4-servers-take-it) | Each server | Nothing, unless it asks for something new |

This is for every app: the app runner installs them all, whether the app is in `apps/` or in its own repository ([below](#an-app-in-its-own-repository)). No app ships inside AUGUR's own releases (ADR 0075).

## Once per server (an admin)

1. Set up [the updater](upgrade.md#the-updater) and turn on [the app runner](upgrade.md#the-app-runner) with `APP_SECRETS_KEY` in `.env`.
2. In Admin → Apps, **Install** the app from the list of released apps. Each later version installs itself (step 4).
3. On the installed app, add its developers. Only they can switch to its previews.

A server that can't reach GitHub reads apps from a mirror instead ([mirror.md](mirror.md#mirror-apps)). It gets releases but not previews.

## 1. Build and test it

Make the app's repository from [augur-app-template](https://github.com/harry-burton-dev/augur-app-template) and follow its README, then, from an AUGUR checkout beside it:

```sh
pnpm dev:app ../augur-expenses   # the real shell and kit, your frontend and service from source
```

The shell stands in for the rest of the platform: sign-in, floors and Home. See [build-an-app.md](build-an-app.md) for the frontend, service and manifest, and for the checks to run before a pull request.

## 2. Try it on a real server

Push a branch and open a pull request. CI tests it as for any change, and **App previews** builds, signs and releases a preview of each app it changes, `<x.y.z>-pr.<number>.<run>`. Within 15 minutes (or straight away with **Check for releases** in Admin → Apps), each server with the app installed starts it beside the app, with scratch data of its own.

In the shell, **Previews** in the band lists your apps' previews. **Use it** switches you, and you alone, to the pull request's build: its frontend and its service, with the real sign-in, floors and other apps. **Back to <version>** returns you to the app. Each push replaces the preview, and closing the pull request takes it away with its data. See [app-previews.md](app-previews.md).

Pull requests from forks get no preview.

Once it's merged into `main`, **App dev builds** builds it again as a dev build, which a preview server set to **Dev builds too** installs for everyone on it, after a backup ([release-channels.md](release-channels.md#dev-builds)).

## 3. Release it

Add a changeset to the pull request (`pnpm changeset`) saying what changed in `@apps/expenses` and `@apps/expenses-frontend`, then merge it into `main`. Merging the next **Version packages** pull request moves the app's version and releases it as a beta; **Promote to stable** later makes that same release stable ([release-channels.md](release-channels.md)). To release it, the Release workflow builds and signs its service image and frontend, and makes the GitHub release `app/expenses@<version>` with its `app-release.json` ([versioning.md](versioning.md#app-releases)). A prerelease version, such as `1.3.0-beta.1`, goes out on the beta channel.

## 4. Servers take it

Each server reads the app releases every 15 minutes. What happens next is up to that server's choice for the app, in its settings in the Upgrade Centre:

- **Automatic** (the default) installs a patch or minor version straight away when it asks for nothing new: no new scope, resource, setting, place, command or About section, no raised limit, no more kinds of floor, no bigger uploads or canvas, and the same signer. The registry compares the two versions' `asks` and manifests; taking something away asks for nothing.
- Anything else (a major version, or a version that asks for more) waits under **Needs you**, with the reason, until an admin installs it.
- **Ask first** makes every version wait, and **Hold** stays where it is.

An install starts the new version beside the old, checks `/healthz`, then switches over. A version that fails its checks is removed, and the old one keeps running. Every step is in Activity ([upgrade.md](upgrade.md#the-app-runner)).

To go back, use **Go back** on the app's page in the Upgrade Centre, or hold the shell at an earlier manifest ([versioning.md](versioning.md#going-back-to-an-earlier-app-version)).

## An app in its own repository

Apps are moving out of this repository into their own (ADR 0012). Such an app releases from its own repository the same way, as `app/<id>@<version>` with its `app-release.json`, signed by that repository's own `release.yml` (and `app-dev.yml`, `app-preview.yml` for dev builds and previews).

An app on the app contract (contract 3, ADR 0075) also keeps `score/<part>.score.yaml` for each of its parts, and `augur-app validate` checks the manifest and those files against the contract's schemas, which `@augur/app-tools` ships (`manifest-3.schema.json`, `score-part-1.schema.json`, `app-release-2.schema.json`); its release file is `augur.app-release/v2`, which `@augur/app-tools/release2` writes with every part's image pinned by digest (`augur-app publish` writes it once the template moves to contract 3; today it writes v1).

A deployment installs only contract 3 releases. The registry checks a release against those schemas and Score's own, and answers with the first three problems and their paths; then it refuses, each with a plain reason: an id kept for AUGUR, a scope it doesn't offer, more than one part taking the gateway's calls or one that isn't a service, a secret output read in a variable instead of a file, a resource type it doesn't offer, a service part without a port, `api` without an inbound part or an inbound part without `api`, a radial action naming an unknown command, a place, command, About or setting id used twice, `bindings` without `links.entities`, and an app with neither frontend nor parts. It warns, and still installs, when a place or command repeats the app's own label or icon, a command shown for a selection is never named by a place or radial action, or a place the app fills has no frontend. A v1 file is refused as "on contract 2", and one listed in a feed is shown in Admin → Apps with that reason; `GET /api/registry/v1/contract` answers the majors this AUGUR serves.

When it installs one, the app runner treats the frontend bundle as it does each part's image: it checks the bundle's signature against the release's signer, pulls it from the registry by the digest the release names (`bundle.frontend`, over the registry's own API, with the deployment's read key where the artifact is private), checks the files are that digest, and gives them to the registry before registering the version. The registry keeps that build at `/apps/<id>/<version>/`, where the shell loads the app from; a build of the version that isn't the release's never takes that address. A deployment that doesn't keep frontends (no `FRONTENDS_BUCKET_SECRET`) can't install an app with a frontend: the install says so and goes back.

A deployment reads the feeds its `APP_FEEDS` lists (by default AUGUR's own). For an app none of them lists, an admin pastes the address of its `app-release.json` in Admin → Apps (`POST /api/registry/v1/app-runner/releases/read`): the registry reads it over https, at most 1 MB, never following a redirect and never from AUGUR itself, this machine or the deployment's own networks (checked on every address the name resolves to), checks it as above, and shows what it asks for before the admin installs it. Nothing is remembered of the address, so later versions of such an app are installed the same way, or from a feed once one lists it.

When it installs, the app runner registers the release's manifest as the app itself. The registry takes a contract 3 manifest only when it is the manifest of a release an admin had the runner install (under way, or installed before, for going back), and serves the shell that manifest as it is, with the upload limit in force, the previews on for the caller and `contract` (`GET /api/registry/v1/manifest`). An app on contract 3 lives at `/<id>` in the shell and `/api/<id>` at the gateway.

An app's address may be any host name or IP except loopback, link-local and the deployment's own networks, which the app runner tells the registry at start (until it has, Docker's default range 172.16.0.0/12 stands in). An IP literal is checked, written either way; a host name is not resolved first, so give one that points outside those networks.

The release steps come from `@augur/app-tools`, published beside the SDK. Its `augur-app` command runs in the app repository's root (`manifest.json`, `frontend/`, `service/` and a `Dockerfile` for the service) and does what `scripts/app-release.mjs` and `infra/release-app.sh` do here: `augur-app pending`, `dev <run>`, `preview <pr> <run>`, `bundle <channel>` (build, push and sign), `publish <bundle.json>`, `clean-devs` and `clean-previews <pr>`. The app template's workflows call it.

Servers still read one feed, AUGUR's (ADR 0047):

- `release/app-repos.json` names the repository each moved app is published from. The pull request that moves an app out adds its line.
- The Release feed workflow lists that repository's releases of that app, and only those signed there, beside AUGUR's own. It reads them with the `APP_RELEASES_TOKEN` secret, a fine-grained token that can read the app repositories' contents. The app's release workflow starts the Release feed workflow when it has released, with the same token, which can also run Actions in this repository.
- A server's app runner trusts only the repositories `APP_PUBLISHERS` in its `.env` lists, so each server lists the app's repository before installing it.
- The first release a server installs from the new repository takes over the data the old one left, so the updater takes a backup of the database first, and the install's first step names the file. Later releases from that repository install as usual. A version installed before this rule (its record names no repository) gets the same backup at its next update.

A platform or pillar app (ADR 0032) is listed here like any other: no app ships inside AUGUR's release (ADR 0075).
