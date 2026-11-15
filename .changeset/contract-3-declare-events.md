---
'@augur/service-kit': minor
'@augur/events': minor
'@augur/registry': minor
---

Warn an app on contract 3 that doesn't declare the domain events it reads or publishes: the registry says each app's contract, the service kit's `registryDeclaredEvents` passes it on, and the events service answers each publish and read with a `warning`. The next release refuses such an app.
