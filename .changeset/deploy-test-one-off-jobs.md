---
---

The deploy test learns which services run once and stop from the compose file (`restart: on-failure`) instead of naming them, so the knowledge graph's migration job no longer counts as a container that isn't running; a one-off job that exited with an error still does.
