---
'@augur/service-kit': patch
'@augur/updater': patch
---

The app runner keeps its record of previews through installs and undoes a failed switch fully. A tarball with a negative size is refused, ids that collide with platform secrets or jobs schemas are reserved, previews use their own jobs schema, and one refused outbox row no longer holds up the rest.
