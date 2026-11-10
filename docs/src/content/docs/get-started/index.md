---
title: What is AUGUR?
description: An app platform you run on your own servers, with one shell, one gateway and apps that plug into both.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 0
  label: Overview
---

AUGUR is an app platform that an organisation runs on its own servers. People open it in a browser, sign in
once, and work in apps that all look and behave the same way. Behind it, one gateway and a small set of
services handle who people are, what they may open, and how apps talk to each other.

AUGUR is in **beta**. It works and is used every day, and it may still change between releases. There is no
phone layout yet.

## What you get

- **One place to work.** The shell is the page people open. It draws every app's bar, places and side panel
  the same way, so a new app needs no training.
- **The organisation as it is.** Work happens on **floors**: your own, your team's, and the organisation's.
  What you see on a floor is what that floor holds, and admins choose which apps each floor can open.
- **Apps from anyone, safely.** Every app is built in its own repository, released and signed on its own, and
  installed from an app feed. Its code runs in a sandbox in the browser, and its service reaches AUGUR only
  through the gateway, with only the permissions it asked for and was granted.
- **Many deployments, one product.** The same release runs on a developer's workbench, a staging server and
  production. Names, addresses and limits come from each deployment's settings.
- **Upgrades that look after themselves.** The Deployment app takes a backup, upgrades every part, checks
  it came up, and goes back by itself if it didn't.

## How it fits together

```
browser ──▶ front door ─┬─ /         the shell, and each app's frontend
                        ├─ /api/  ──▶ gateway ──▶ AUGUR's services, and each app's service
                        └─ /sso/  ──▶ sign-in
```

Everything runs in Docker Compose on one server. The [concepts](concepts/) page explains each part.

## Where to go next

| You want to | Start with |
| --- | --- |
| Try AUGUR on a server of your own | [Quickstart: run AUGUR](quickstart-server/) |
| Make an app for it | [Quickstart: build your first app](quickstart-app/) |
| Understand the words | [Concepts](concepts/) and the [glossary](glossary/) |
