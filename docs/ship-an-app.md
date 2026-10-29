# Ship an app

From a new app to running on your servers, with no manual update at any step. Each step links to the page with the detail.

| Step | Where it runs | What you do |
| --- | --- | --- |
| [Build and test](#1-build-and-test-it) | Your machine | `pnpm create-app`, `pnpm dev:app` |
| [Try it on a server](#2-try-it-on-a-real-server) | CI and your server | Open a pull request, switch to its preview |
| [Release it](#3-release-it) | CI | Merge, then merge Version packages |
| [Servers take it](#4-servers-take-it) | Each server | Nothing, unless it asks for something new |

This is for apps the app runner installs: every app in `apps/` but those that ship with AUGUR (Folio, for now), which come with AUGUR's own releases ([upgrade.md](upgrade.md)).

## Once per server (an admin)

1. Set up [the updater](upgrade.md#the-updater) and turn on [the app runner](upgrade.md#the-app-runner) with `APP_SECRETS_KEY` in `.env`.
2. In Admin → Apps, **Install** the app from the list of released apps. Each later version installs itself (step 4).
3. On the installed app, add its developers. Only they can switch to its previews.

A server that can't reach GitHub reads apps from a mirror instead ([mirror.md](mirror.md#mirror-apps)). It gets releases but not previews.

## 1. Build and test it

```sh
pnpm create-app expenses --name "Expenses"
pnpm dev:app expenses        # the real shell and kit, your frontend and service from source
pnpm --filter "@apps/expenses*" test
```

The shell stands in for the rest of the platform: sign-in, floors and Home. See [build-an-app.md](build-an-app.md) for the frontend, service and manifest, and for the checks to run before a pull request.

## 2. Try it on a real server

Push a branch and open a pull request. CI tests it as for any change, and **App previews** builds, signs and releases a preview of each app it changes, `<x.y.z>-pr.<number>.<run>`. Within 15 minutes (or straight away with **Check for releases** in Admin → Apps), each server with the app installed starts it beside the app, with scratch data of its own.

In the shell, **Previews** in the band lists your apps' previews. **Use it** switches you, and you alone, to the pull request's build: its frontend and its service, with the real sign-in, floors and other apps. **Back to <version>** returns you to the app. Each push replaces the preview, and closing the pull request takes it away with its data. See [app-previews.md](app-previews.md).

Pull requests from forks get no preview.

## 3. Release it

Add a changeset to the pull request (`pnpm changeset`) saying what changed in `@apps/expenses` and `@apps/expenses-frontend`, then merge it into `dev`. The next **Version packages** pull request on `dev` moves the app's version, and **Promote to preview** takes it to `preview`, which releases it as a pre-release; the Promote workflow later takes it to production ([release-channels.md](release-channels.md)). Releasing it on preview: the Release workflow builds and signs its service image and frontend, and makes the GitHub release `app/expenses@<version>` with its `app-release.json` ([versioning.md](versioning.md#app-releases)). A prerelease version, such as `1.3.0-beta.1`, goes out on the beta channel.

## 4. Servers take it

Each server reads the app releases every 15 minutes. What happens next is up to that server's choice for the app, under Admin → Apps:

- **Automatic** (the default) installs a patch or minor version straight away when it asks for nothing new: no new scopes, storage, kinds of floor or bigger uploads, an SDK range the server's AUGUR opens, and the same signer.
- Anything else (a major version, or a version that asks for more) waits under **Needs you**, with the reason, until an admin installs it.
- **Ask first** makes every version wait, and **Hold** stays where it is.

An install starts the new version beside the old, checks `/healthz`, then switches over. A version that fails its checks is removed, and the old one keeps running. Every step is in Activity ([upgrade.md](upgrade.md#the-app-runner)).

To go back, install an older version from Admin → Apps, or hold the shell at an earlier manifest ([versioning.md](versioning.md#going-back-to-an-earlier-app-version)).
