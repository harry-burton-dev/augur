---
---

Deploy files: log rotation on every container, memory limits on Keycloak, the rendition worker and the observability stack, and healthchecks for Keycloak and Garage that the front door, identity, the realm job and the storage job wait for. Local compose binds Postgres, Garage and Keycloak to 127.0.0.1.
