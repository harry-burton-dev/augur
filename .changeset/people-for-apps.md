---
"@augur/service-kit": minor
"@augur/identity": minor
"@augur/registry": patch
"@augur/admin": patch
---

Apps can look people up for sharing, with the new `people:read` scope. Identity says who a person stands for (`GET /v1/people/:id/principals`: `person:`, `team:` and `tree:` principals and `org`) and finds people and teams by name or names them by id (`GET /v1/directory`). The service kit's `identityPrincipals` (kept 30 seconds) and `identityDirectory` call them. Admin shows the scope as "Look up people and teams".
