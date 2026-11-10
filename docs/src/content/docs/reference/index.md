---
title: Reference
description: "AUGUR's APIs, schemas and settings, generated from the code."
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 0
  label: Overview
---

Every page in this section is generated from the file the code itself uses, each time the site is built,
so it can't drift from what AUGUR does. Pages marked **Generated** in the sidebar are written by no one.

| Reference | What it covers | Generated from |
| --- | --- | --- |
| [App manifest](schemas/app-manifest/) | An app's `manifest.json` | `platform/packages/app-tools/manifest-3.schema.json` |
| [Score part](schemas/score-part/) | AUGUR's rules for an app's Score files | `platform/packages/app-tools/score-part-1.schema.json` |
| [App release file](schemas/app-release/) | What an app release carries | `platform/packages/app-tools/app-release-2.schema.json` |
| [Deployment settings](schemas/settings/) | Every setting in a deployment's `.env` | `infra/deploy/settings.schema.json` |
| The APIs, one section each | Every operation the gateway serves, with its parameters, bodies and answers | the OpenAPI files in `contracts/` |

Still to come: the event topics AUGUR publishes, and the browser SDK and service kit. Until then they are
in the guides on [domain events](https://github.com/harry-burton-dev/augur/blob/main/docs/domain-events.md#the-platforms-topics)
and [building an app](https://github.com/harry-burton-dev/augur/blob/main/docs/build-an-app.md).
