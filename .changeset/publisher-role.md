---
"@augur/identity": minor
"@augur/service-kit": minor
---

A publisher role, for people who may publish beyond their own team (to the whole org, or any team). Identity adds it to the sign-in service when it starts, so existing servers get it too. Identity says who an audience reaches (`GET /v1/members?principals=`, `people:read`), which the service kit's `identityAudience` calls, and the directory's teams carry their `path` of team ids.
