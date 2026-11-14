---
title: Where releases come from
description: How a deployment finds AUGUR's and apps' releases, the read key it needs while they're private, and how it trusts them.
status: beta
checkedAgainst: 0.26.0
sidebar:
  order: 22
---

A deployment finds new releases of AUGUR and of apps in a **release feed** that AUGUR's Feed workflow keeps beside
its images, `ghcr.io/harry-burton-dev/im-platform/feed`. The registry reads it (Deployment, **Check for updates**) and the
updater pulls what it names. A server that can't reach GitHub reads a mirror in your own registry instead
([Mirroring releases](https://github.com/harry-burton-dev/augur/blob/main/docs/mirror.md)).

## The release feed

- `RELEASE_FEED_URL` points the registry at another feed, such as a mirror's, or `off` to check nothing.
- Which releases a server is offered follows its ring, `SERVER_RING`: the workbench takes dev builds, a preview
  server beta releases, and a production server stable ones. `RELEASE_CHANNEL` can choose another, within what
  the ring allows: a production server only ever follows stable releases, and only the workbench takes dev
  builds. Deployment says when it ignored `RELEASE_CHANNEL`, and why.

## The read key

While AUGUR's packages are private, a deployment needs one **read key**: a GitHub token that can read the
packages and nothing else. With it, the registry checks the feed and the updater pulls images. Give each
deployment its own key, so you can take one away without touching the others. Keys belong to a GitHub account, so
use one that can do nothing but read: a separate account for deployments, made with its own email address.

Once, in GitHub:

1. Sign up for the deployments' account and turn on two-factor authentication for it.
2. As the owner of AUGUR's packages, give that account **Read** on each one: open **Packages** on your profile,
   then for each package (the feed, each service, the updater and each app) choose **Package settings → Manage
   access → Invite** and add the account with the **Read** role. A package made later, such as a new app's,
   needs the same once, after its first release.

   Don't add the account to the repository itself: on a repository owned by a personal account, every
   collaborator can push. If the repository moves to an organisation, the **Read** role on the repository covers
   every package that inherits its access.

For each deployment:

1. Signed in as the deployments' account, make a
   [classic token](https://github.com/settings/tokens/new?scopes=read:packages) named after the deployment, with
   only **read:packages** and an expiry you'll put in your calendar.
2. On the server:
   ```sh
   mkdir -p infra/deploy/secrets
   printf '%s' '<the token>' > infra/deploy/secrets/github-read-key
   sudo chown 1000 infra/deploy/secrets/github-read-key && chmod 600 infra/deploy/secrets/github-read-key
   echo '<the token>' | docker login ghcr.io -u <the account> --password-stdin
   ```
   and in `.env`, `GITHUB_READ_USER=<the account>`. `docker login` is for pulling by hand (`pc pull`); the
   updater signs itself in with the same key.
3. Run `pc up -d registry updater`, then **Check for updates** in Deployment. It lists releases, or says the key was
   refused and why.

To take a deployment's access away, delete its token in the account's **Settings → Developer settings → Personal
access tokens**; the others carry on. When a token is near its expiry, make a new one and repeat step 2. A
deployment that pulls from a mirror has no use for a read key.

## The signed feed

The registry checks the feed before it believes it. The Feed workflow signs it with cosign, keyless, as the
Release workflow signs images, and gives it an expiry two weeks out; it runs again every Monday, so a feed that
stops being renewed runs out. The registry turns down a feed that isn't signed by AUGUR's Feed workflow, whose
signature doesn't verify, or that has expired. It keeps running what it runs, and Deployment says why.

- **A mirror** is shown as your organisation's own feed, not as signed by the publisher, and doesn't expire. Each
  image is still checked.
- `FEED_SIGNER` in `.env` overrides which workflow may sign the feed, as a regular expression. Leave it unset
  unless you publish AUGUR from a fork.
- Checking works offline when `infra/deploy/releases/trusted_root.json` is there.

A release its publisher **halted** is still listed in Deployment, marked halted with the reason, but is never
offered, chosen as the next upgrade or installed. A server running one is told so first, and where to go: a newer
release that isn't halted, or back to the one before.
