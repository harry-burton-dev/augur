---
title: Concepts
description: Deployments, the shell, floors, the gateway, apps and events, and how they fit together.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 1
---

AUGUR has a handful of ideas that everything else builds on. Read this page once and the rest of the
documentation will make sense.

## Deployments

A **deployment** is one install of AUGUR: one server running AUGUR's containers with Docker Compose, with its
own people, data and settings. An organisation usually has several, such as a staging server that takes each
release first and a production server where people work.

Each deployment says what kind of server it is (its **ring**: `dev`, `preview` or `production`) and which
releases it's offered (its **channel**: dev, beta or stable). A release is built and signed once; making it
stable changes only its label, so production runs exactly what staging ran.

## The shell

The **shell** is the web page people open. It signs them in, shows the apps they can open, and draws each
app's frame: the app bar along the top, the rail of the app's places down one side, and the About panel on
the other. It draws all of that from the app's manifest before any of the app's own code runs, so every app
starts the same way and looks the same.

An app's own screen runs in a sandbox inside the shell, with no network and no sign-in token of its own. It
asks the shell for what it needs, and the shell asks the gateway.

## Floors

A **floor** is a level of the organisation: your **own** floor, a **team**'s floor, or the **organisation**'s.
Teams nest, so a department sits on the organisation's floor and its teams sit on the department's.

Everything happens on a floor. When you open an app, you open it on the floor you're standing on, and it shows
what that floor holds: your own notes on your floor, your team's on the team's. The address says where you are
(`/@me/notes` is your own floor, `/@org/notes` the organisation's).

Floors also carry rules. Admins choose which apps each floor can open: a floor follows the floor above it
until an admin gives it a rule of its own, and an app blocked on a floor is blocked on every floor beneath it. Anything that isn't available stays visible and says why,
and who can change it.

## The gateway

Every call to AUGUR goes through the **gateway**, at `/api`. It checks who is calling and on which floor,
refuses a floor the person isn't on, and passes the call to the right service. An app's own service sits behind
it too, at `/api/<app id>`, so an app's frontend and anyone else reach it the same way.

Behind the gateway sit AUGUR's own services:

| Service | What it does |
| --- | --- |
| Identity | People, teams and floors, roles, and signing in (with Keycloak) |
| Registry | The apps a deployment has, their releases, and the catalogue the shell shows |
| Events | Domain events, notifications and the Inbox |
| Storage | Each app's own database schema and file bucket |
| Models | AI models, for any service that asks, through one gateway |
| Knowledge | The entities each floor knows about and what is known of them (being built) |
| Updater | Upgrades AUGUR and installs apps from their releases (optional) |

## Apps

No app ships inside AUGUR. Every app, even Home and Admin, is installed from an **app feed** and reaches AUGUR
only through the gateway, its manifest and events. There are two kinds:

- **Platform apps** help people use and manage AUGUR. Home, Admin and Deployment (where admins upgrade
  AUGUR) come with every deployment.
- **Pillar apps** are the foundation of what the organisation produces with it.

An app is made of:

- a **manifest** (`manifest.json`) that says what the shell draws for it, what it asks permission for, and
  what settings it has;
- a **frontend** the shell runs in its sandbox;
- one or more **parts**, each a container described by a [Score](https://score.dev) file, such as the service
  that answers its API and a job that migrates its database.

Each app lives in its own repository, made from the app template, and is released and signed there. A
deployment's admins choose which publishers they trust.

## Events

When something happens that others may care about, the service where it happened publishes a **domain event**
on a **topic**, such as `platform.person.joined`. Other services follow the topics they need, and the shell
passes events on the floor you're on to the apps you have open, so screens update as things change.

**Notifications** tell a person something, and the **Inbox** holds work that waits on someone.

## Releases

AUGUR and each app are released separately. An app says which major of the **app contract** it speaks, and a
deployment installs only releases on a contract it serves. Within a major, AUGUR's packages add and never
remove, so an app built against an earlier release keeps working.
