---
'@augur/gateway': minor
'@augur/service-kit': minor
---

The gateway reaches the permissions service at `/api/permissions`, and Status checks it. When the shell sends `X-Augur-Persona`, the gateway asks the permissions service whether that admin persona's session is live. Only then does the caller it signs carry `persona` beside the person (service-kit's `Caller.persona`, `x-user-persona`). A session that has ended, a call made for an app, and an unanswered check are each refused, saying why. Services don't act on the persona yet.
