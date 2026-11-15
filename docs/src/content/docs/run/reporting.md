---
title: Report to Backstage
description: Let a deployment tell your organisation's Backstage what it runs, signed, or export the record by hand on a server with no way out.
status: beta
checkedAgainst: 0.26.0
sidebar:
  order: 24
---

A deployment can tell your organisation's Backstage what it runs. Nothing is sent until you set it up; until
then Deployment's Reporting section, under **Worth knowing**, says it isn't set up and what to set.

## Set it up

1. Add the deployment to Backstage's catalog of deployments, if it isn't there, and note its `metadata.name`.
   The portal's README ("Deployments") says where that file is; the portal's GitHub token must be able to read it.
2. In `.env`, set `DEPLOYMENT_ID` to that name and `PORTAL_URL` to Backstage's address. Then
   `docker compose up -d registry`.
3. In Deployment's Reporting section, select the **Public key** field to copy it, and paste it into the annotation
   `augur.dev/report-key` on that entry. Let Backstage read its catalogue again.

Backstage refuses a record from a deployment it doesn't list, or one not signed with the key it lists.

## What is sent, and when

The registry makes the deployment's own signing key the first time it's needed and keeps it in the database,
so a server restored from a backup reports as the same deployment. It sends a signed record two minutes after it
starts (so after each upgrade), whenever a version, an upgrade's result or something that needs you changes,
and once a day.

The record holds the deployment's name and ring, the version of AUGUR and of each app, what's available, each
unit's policy and pin, health, the last results and the feed's state. It holds no names or ids of people.

## A server with no way out

Set `DEPLOYMENT_ID` and leave `PORTAL_URL` unset: nothing is sent. An admin uses **Export the record** in
Deployment's Reporting section and carries the file to the deployment's card in Backstage.

`DEPLOYMENT_REPORTING=off` turns both sending and exporting off.
