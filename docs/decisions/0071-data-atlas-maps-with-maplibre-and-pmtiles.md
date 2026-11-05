# 0071. Data Atlas draws maps with MapLibre GL JS from the deployment's own PMTiles file

- **Status:** Proposed
- **Date:** 2026-11-05
- **Decided by:** Harry (overnight approval of the alpha's records, 5 Nov; the Data Atlas next-phases spec, N5, asks for "MapLibre GL JS with a PMTiles file served from the deployment's own storage, so it works without internet")

## Context

Data Atlas keeps places, and things that are at places, but it can only say where in words. People on an operations floor want to see where things are on a map, and later how they moved. An organisation's deployment may not call out to the internet, so a map that loads its tiles from a public tile server won't work there, and would tell that server what people are looking at. Today a place detail holds only words, so there's nothing to put on a map yet.

## Options

1. **No map.** Nothing to add. Places stay words.
2. **Leaflet with raster tiles from a public server.** Small and well known, but it needs the internet, and raster tiles for a whole region are large to host.
3. **MapLibre GL JS with vector tiles in one PMTiles file** (both BSD-3-Clause; MapLibre is the open fork of Mapbox GL JS, and PMTiles is Protomaps' single-file tile archive). The browser reads the tiles it needs from one file with HTTP range requests, so there's no tile server to run. A region's file is tens or hundreds of megabytes. MapLibre is large, about 800 KB minified.
4. **OpenLayers.** Capable and mature, but heavier to style, and it reads PMTiles only through a plugin.

## Decision

Data Atlas draws maps with **MapLibre GL JS** and reads its base map from **one PMTiles file that the deployment keeps**, through the `pmtiles` package. Both are used in its frontend only.

- **Loaded only when needed.** Both libraries are loaded with `import()` the first time a map opens, so floors that never open a map never download them.
- **Never the internet.** The base map is a vector PMTiles file that the deployment puts on the Atlas container, named by the deployment setting `ATLAS_MAP_TILES` (a path inside the container). Atlas serves that file through the gateway, with range requests, to people who can open Data Atlas. No map request leaves the deployment. A deployment makes its file once, for example by cutting its region out of a Protomaps OpenStreetMap build with the `pmtiles extract` command. `docs/atlas.md` says how.
- **The data's licence is shown.** OpenStreetMap data is under the ODbL, which requires attribution. The map shows `ATLAS_MAP_ATTRIBUTION`, which defaults to OpenStreetMap's credit.
- **Without a file, the map still works and says why.** Points are drawn on a plain background, with a note that the deployment has no base map and that an admin can add one (`ATLAS_MAP_TILES`, linked to the guide).
- **Colours from the tokens.** The base map's style is written in code from the design tokens, read from the page's CSS variables when the map opens, never as raw colours. The base map draws no text labels, because those would need a second file of glyphs. Names on the map are the kit's own markers for entities.
- **Where a point comes from.** A `place` detail's value may be a point, written as latitude and longitude in decimal degrees (WGS84), for example `57.70, 11.97`. Atlas checks that it's in range. Words are still allowed, but they don't go on the map. Because a detail known through facts has valid time, a sequence of positions is a movement. The starter ontology gives places a `location` detail.
- **Where maps show.** A map tab on a place shows its point and the things located at it. A map view in the explorer shows the entities in view that have a point, either their own or that of the place they're located at.

## Consequences

- Places and positions can be seen on a map, offline, with nothing new to run. A deployment without a base map file still gets points, and is told how to add a map.
- Two new dependencies in Data Atlas's frontend, kept current by Renovate. Their size is why they load only when a map opens.
- A deployment that wants a base map has to make and place a file, and keep it fresh if the map should change. Atlas doesn't fetch or update it.
- Points are stored as text in the existing fact values. That keeps the two clocks and floors as they are, but it means a query by area reads the values, so it's slow for large numbers of points. A spatial index (PostGIS) would need its own record.
- Labels on the base map, other projections and drawing areas are later work.
- The checks that hold the rule are Data Atlas's tests: a point out of range is refused, a place with a point shows it on the map, and a deployment without `ATLAS_MAP_TILES` shows the note.

## Links

- PER-240 (Data Atlas next phases, N5).
- The Data Atlas next-phases spec (project files, `specs/pillars/atlas-next.md`, N5).
- ADR 0015 (React, Quill, Tailwind and the token rule) and ADR 0070 (military symbols, the same lazy-load pattern).
