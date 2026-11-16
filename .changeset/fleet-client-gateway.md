---
'@augur/gateway': minor
'@augur/service-kit': minor
---

The gateway lets the fleet's machine client (platform-fleet, ADR 0100) through to the registry's routes that read and change what the server runs, as the caller client:platform-fleet, and nowhere else. The registry still refuses its changes until it holds them to the server's ring.
