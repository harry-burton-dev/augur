---
"@augur/service-kit": minor
"@augur/gateway": minor
"@augur/registry": minor
---

Platform scopes (ADR 0083): AUGUR's own admin APIs get scopes of their own (`people:manage`, `apps:manage`, `org:manage`, `audit:read`, `deployment:upgrade`, `deployment:apps`, `deployment:health`, `deployment:settings`). The registry gives them only to AUGUR's own frontends (Admin holds who and what is allowed; the Upgrade Centre what runs and changing it), and the gateway lets a person's call made through one of those frontends reach the matching API with them. No app from a feed can ask for one. The service still checks the person's roles.
