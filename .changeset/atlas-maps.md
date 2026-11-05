---
---

ADR 0071 (Proposed): Data Atlas draws maps with MapLibre GL JS from a PMTiles file the deployment keeps. Deployments can set `ATLAS_MAP_TILES` and `ATLAS_MAP_ATTRIBUTION`, with the file in `maps/` beside the compose file, mounted read-only into `atlas`.
