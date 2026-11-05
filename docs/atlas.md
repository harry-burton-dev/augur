# Data Atlas

Data Atlas holds the things the organisation keeps track of (ships, ports, organisations, people, places, events), what is known about each, and how they connect. Artifacts holds what was published, Mandate holds what people mean to do, and Data Atlas holds what those are about. It ships with AUGUR, like Artifacts (a pillar app), at `/atlas`.

Data Atlas lives in its own repository, [augur-atlas](https://github.com/harry-burton-dev/augur-atlas), whose README is the app's own guide, with its API. Every AUGUR release ships the release of it that `release/shipped-apps.json` pins (ADR 0049).

## What people see

- **Entities**, one per real thing, kept on the floor they were made on. A floor shows what's kept on it and on the floors above, never below, and anything out of reach says where it's kept and who to ask.
- **What's known**: details, each backed by observations from a source (a document in Artifacts, a person), with what disagrees shown side by side. When a source is withdrawn or deleted in Artifacts, what was read from it stays, marked, and stops counting as evidence.
- **Used by**: the intents in Mandate bound to an entity, and the documents what's known came from.
- **Triage**: what sources propose (new entities, links, details) waits here, and nothing skips it.
- **The ontology**: the kinds of thing, their details and kinds of link, starting from a profile of the Common Core Ontologies. Admins change it in the studio, adopt terms from packs, load their own pack from OWL, and decide the words sources asked for. It exports as OWL.

## In a deployment

- A container, `atlas`, on port 8086, reached through the gateway at `/api/atlas`, and its frontend inside `web`.
- Its graph lives in Postgres, in its own `atlas` schema, under its own login (`app_atlas`). The storage container makes the login, the schema and the `pg_trgm` and `pgvector` extensions it uses for matching by spelling and by meaning. It makes a bucket too, as it does for every app, though Data Atlas keeps nothing there.
- Settings in `.env`: `ATLAS_CLIENT_SECRET` (its sign-in), `ATLAS_DATABASE_PASSWORD` and `ATLAS_BUCKET_SECRET`. An upgrade from the Upgrade Centre makes them up; by hand, `openssl rand -hex 32` makes each.
- It puts itself in Admin, Apps on its first start. Admins turn it off org-wide or floor by floor; it can't be removed.
- Matching by meaning in Triage uses the model gateway when it's on. Without it, Triage matches by keys, names and spelling, and says so.
- It follows Mandate's bindings and Artifacts' withdrawals through events, from where it left off. Mandate is optional: without it, "Used by" lists only documents.

## Maps

Data Atlas puts places, and what's at them, on a map (ADR 0071). A place's Location written as a point, latitude then longitude, such as `57.70, 11.97`, puts it on the map. An entity page shows **Where it is**, and the explorer offers **Show on a map**.

The base map comes from your server, never the internet. Without one, points go on a plain background, and the map says an admin can add one. To add one:

1. Make a PMTiles file of your region from a Protomaps OpenStreetMap build, with the `pmtiles` command line tool (github.com/protomaps/go-pmtiles): `pmtiles extract <build>.pmtiles region.pmtiles --bbox=<west>,<south>,<east>,<north>`. Do it on a machine that can reach the build, then copy the file over. A country is typically tens to a few hundred megabytes.
2. Put it in `maps/` beside the compose file on the server.
3. In `.env`, set `ATLAS_MAP_TILES=/maps/region.pmtiles`. If your data isn't OpenStreetMap's, set `ATLAS_MAP_ATTRIBUTION` to its credit.
4. `pc up -d atlas`.

Data Atlas serves the file through the gateway to people who can open it, a part at a time. To change the map, replace the file and restart `atlas`.
