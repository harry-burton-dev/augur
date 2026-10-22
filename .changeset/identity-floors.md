---
"@platform/identity": minor
---

Identity keeps the floors people stand on: one org, teams that nest up to five deep, and everyone's own floor, in its own tables (`identity.workspaces`, `identity.workspace_members`, on Postgres `ltree`). `GET /v1/me/workspaces` answers the caller's floors with each one's path from the org, their role and whether they're on it directly or through a team below; their own floor is made the first time they ask. Admin's departments are now these teams: the first start copies Keycloak's groups and their members in once, and from then on the Departments screen and each person's departments change identity's tables, not Keycloak. `ORG_NAME` names the org's floor (default "Organisation").
