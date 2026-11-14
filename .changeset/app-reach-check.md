---
---

The deploy test checks, from inside an app's own container's network, that the app reaches the gateway and none of AUGUR's other containers, and that Postgres through the relay turns away every login AUGUR's own parts use.
