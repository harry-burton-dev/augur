---
title: "Quickstart: build your first app"
description: Make an app from the template, run it in AUGUR's shell on your machine, and push it.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 3
---

By the end of this page you have an app of your own running in AUGUR's real shell on your machine, in its own
repository, ready to release. It takes about 15 minutes.

## Before you start

- Node 22 and pnpm 10.
- A GitHub token that can read GitHub Packages (a classic token with `read:packages`): AUGUR's packages are
  published there.
- A checkout of [AUGUR](https://github.com/harry-burton-dev/augur), with `pnpm install` run in it.

## 1. Make the repository

On GitHub, open [the app template](https://github.com/harry-burton-dev/augur-app-template), choose **Use this
template → Create a new repository**, and name it `augur-<id>`, such as `augur-expenses`. Clone it next to
your AUGUR checkout.

If your organisation's Backstage has **Create → New AUGUR app**, it does this step and the next for you.

## 2. Name it

The id is the app's address (`/expenses`) and its prefix behind the gateway (`/api/expenses`): 2 to 40
lowercase letters, digits and dashes.

```sh
cd augur-expenses
export NODE_AUTH_TOKEN=<your token>
pnpm make-app expenses --name "Expenses"
pnpm install && pnpm test
```

## 3. Run it in the shell

From your AUGUR checkout:

```sh
pnpm dev:app ../augur-expenses
```

Open <http://localhost:5173/expenses>. This is AUGUR's real shell and kit, with your frontend loaded from source
and your service running beside it. You're signed in as a stand-in person on your own floor. Edit either side
and it reloads.

## What you have

| Path | What it is |
| --- | --- |
| `manifest.json` | What the shell draws for your app, and what it asks permission for ([reference](../../reference/schemas/app-manifest/)) |
| `frontend/` | The screen, drawn with the app kit, which runs in the shell's sandbox |
| `service/` | Your app's API, on the service kit |
| `service/src/api-types.ts` | The wire types, written once and shared by the service and the frontend |
| `score/` | One Score file for each part: the service, and the job that migrates its database ([reference](../../reference/schemas/score-part/)) |
| `.github/workflows/` | CI on every pull request, and the workflows that build, sign and release the app |

## 4. Push it

Commit and push to `main`. Then, in the repository's settings on GitHub:

1. Add the secrets `PACKAGES_READ_TOKEN` (reads AUGUR's packages), `APP_RELEASES_TOKEN` (tells AUGUR's
   release feed about a new release) and `RELEASE_TOKEN` (a fine-grained token for this repository with
   Contents and Pull requests write).
2. Under **Actions → General → Workflow permissions**, choose **Read and write**.
3. Ask the admins of each deployment that should run your app to trust your repository as a publisher.

## What's next

- [Build an app](https://github.com/harry-burton-dev/augur/blob/main/docs/build-an-app.md) goes through the frontend, the service and the manifest in depth.
- [Ship an app](https://github.com/harry-burton-dev/augur/blob/main/docs/ship-an-app.md) takes it from here to a release that deployments install.
