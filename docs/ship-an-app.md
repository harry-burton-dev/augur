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

- **Automatic** (the default) installs a patch or minor version straight away when it asks for nothing new: no new scopes, storage, kinds of floor or bigger uploads, an SDK range the server's AUGUR opens, and the same signer.
- Anything else (a major version, or a version that asks for more) waits under **Needs you**, with the reason, until an admin installs it.
- **Ask first** makes every version wait, and **Hold** stays where it is.

An install starts the new version beside the old, checks `/healthz`, then switches over. A version that fails its checks is removed, and the old one keeps running. Every step is in Activity ([upgrade.md](upgrade.md#the-app-runner)).

To go back, use **Go back** on the app's page in the Upgrade Centre, or hold the shell at an earlier manifest ([versioning.md](versioning.md#going-back-to-an-earlier-app-version)).

## An app in its own repository

Apps are moving out of this repository into their own (ADR 0012). Such an app releases from its own repository the same way, as `app/<id>@<version>` with its `app-release.json`, signed by that repository's own `release.yml` (and `app-dev.yml`, `app-preview.yml` for dev builds and previews).

The release steps come from `@augur/app-tools`, published beside the SDK. Its `augur-app` command runs in the app repository's root (`manifest.json`, `frontend/`, `service/` and a `Dockerfile` for the service) and does what `scripts/app-release.mjs` and `infra/release-app.sh` do here: `augur-app pending`, `dev <run>`, `preview <pr> <run>`, `bundle <channel>` (build, push and sign), `publish <bundle.json>`, `clean-devs` and `clean-previews <pr>`. The app template's workflows call it.

Servers still read one feed, AUGUR's (ADR 0047):

- `release/app-repos.json` names the repository each moved app is published from. The pull request that moves an app out adds its line.
- The Release feed workflow lists that repository's releases of that app, and only those signed there, beside AUGUR's own. It reads them with the `APP_RELEASES_TOKEN` secret, a fine-grained token that can read the app repositories' contents. The app's release workflow starts the Release feed workflow when it has released, with the same token, which can also run Actions in this repository.
- The updater trusts that repository to sign that app, and only that app, so a server needs no `APP_PUBLISHERS` line for it. Releases of the app signed anywhere else, this repository included, are refused from then on.
- The first release a server installs from the new repository takes over the data the old one left, so the updater takes a backup of the database first, and the install's first step names the file. Later releases from that repository install as usual. A version installed before this rule (its record names no repository) gets the same backup at its next update.

A platform or pillar app (ADR 0032) is listed here like any other: no app ships inside AUGUR's release (ADR 0075).
