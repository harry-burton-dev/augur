# Previews of pull requests

A pull request that changes an app gets a preview: its build runs on your server beside the app everyone uses, and the app's developers can switch to it for themselves to try it with the real platform (sign-in, floors, other apps) before it merges. Nobody else sees it, and it never touches the app's data.

Previews are for apps the [app runner](upgrade.md#the-app-runner) installed. Apps that ship with AUGUR (Folio, for now) have none.

## How a preview gets to your server

1. **The pull request is built.** `.github/workflows/app-preview.yml` runs on every push to a pull request that changes `apps/<id>/`. For each app it changes, it gives the build the version `<x.y.z>-pr.<number>.<run>` (`node scripts/app-release.mjs preview`), builds and signs it as the Release workflow does (`infra/release-app.sh … preview`), and makes the pre-release `app/<id>@<that version>` with its `app-release.json`, naming the pull request. The pull request's older previews are deleted, so there's one per app. A pull request from a fork gets none: it has no token to push or sign with.
2. **The registry finds it.** On its next read of the app feed (every 15 minutes, or **Check for releases** in Admin → Apps), the registry sees the pull request's newest build. If the app is installed and has at least one developer, it asks the runner to start it. Each app runs at most 3 previews, each build is tried once, and a build only runs when it's from the same repository as the installed app.
3. **The runner starts it** beside the app, as `app-<id>-pr<number>` in the `augur-apps` project: its signature must be the preview workflow's, made for that very pull request (`…/app-preview.yml@refs/pull/<number>/merge`), and the repository's releases must be trusted. It signs in as the app, with the app's scopes, but gets scratch storage of its own (`<id>-pr<number>`: its own database login, schema and bucket) and `APP_PREVIEW=pr-<number>` in its settings, so the service kit marks its notifications ("Preview #12: …") and audit entries as from the preview. It must answer `/healthz` on its version within 3 minutes. It's never registered, so the catalogue and everyone else carry on with the installed version.

A new push replaces the preview in place, keeping its scratch data. A preview is taken away, with its scratch data, when its pull request closes (its builds leave the feed), a week after its last build, or when the app is removed from the server.

## Trying one (developers)

An admin makes you one of an app's developers in Admin → Apps, on the installed app. Then **Previews** appears in the shell's band: it lists each of your apps with its running previews (the pull request, its title and link, its version and when it ends). **Use it** switches you to that preview; **Back to <version>** switches you back. While you're on one, the shell says so at the bottom of the screen, with the way back.

While you've chosen a preview, the shell is given its manifest (so it loads that build's frontend, kept by version), and the gateway sends your calls to the app to the preview's service. The gateway reads where to send them every 30 seconds, so give it a moment after switching. Everyone else, and you on other apps, are unaffected.

The same through the registry: `GET /api/registry/v1/previews` lists them, and `PUT /api/registry/v1/previews/<app>` with `{"pr": 12}` (or `{"pr": null}`) switches.

## Turning previews off

Previews only run for apps with developers: take everyone off an app's developers and none start for it. Running ones go a week after their last build, or remove one at once by closing its pull request.

## What they cost

Each preview is one more container on the server, and its images stay in GitHub Packages after the pull request closes; delete old `-pr.` versions there from time to time.
