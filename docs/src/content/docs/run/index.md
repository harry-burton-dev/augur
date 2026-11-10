---
title: Run AUGUR
description: Install, configure, back up, monitor and upgrade AUGUR on your own servers.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 0
  label: Overview
---

This section is for the people who run AUGUR's servers. A deployment is one Linux server running AUGUR's
containers with Docker Compose. [What runs on a server](whats-running/) says what each container does.

## Set up a server

- [Install AUGUR](install/): from an empty server to AUGUR running, backed up and reporting.
- [Settings and secrets](settings/): where each setting is kept, and the sign-in rules AUGUR applies.
- [Set up email](email/) and [sign in with Entra](entra/).
- [A staging server](staging/), with sample data.

## Keep it safe

- [Backups](backups/): nightly, tested every week, and copied off the server.
- [Restore to a point in time](restore-to-a-point-in-time/) and [restore a lost server](restore-a-lost-server/).

## Run it

- [Day to day](day-to-day/): starting, stopping, trying a build, and managing apps.
- [Limits and health](limits/) and [what browsers load](browsers/).
- [Open AUGUR to the internet for a while](open-to-the-internet/).
- [If something's wrong](troubleshooting/).
- [Wipe and refresh](wipe-and-refresh/) and [take a server out of service](retire/).

## Still in the repository's guides

These move into this section next:

- [Upgrading AUGUR](https://github.com/harry-burton-dev/augur/blob/main/docs/upgrade.md) and [When an upgrade goes back by itself](https://github.com/harry-burton-dev/augur/blob/main/docs/upgrade-went-back.md)
- [Mirroring AUGUR releases](https://github.com/harry-burton-dev/augur/blob/main/docs/mirror.md)
- [Observability](https://github.com/harry-burton-dev/augur/blob/main/docs/observability.md)
- [Sample data](https://github.com/harry-burton-dev/augur/blob/main/docs/seed.md)
