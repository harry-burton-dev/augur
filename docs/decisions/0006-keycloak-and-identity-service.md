# 0006. Keycloak signs people in; the identity service owns people, teams and floors

- **Status:** Accepted
- **Date:** 2026-10-18
- **Decided by:** Harry

## Context

AUGUR needs single sign-on that an organisation can connect to its own directory (Microsoft Entra in Harry's organisation) and also local accounts for demos and guests. Harry prefers established open-source tools over hand-rolled code.

## Options

1. **Hand-rolled auth.** Not acceptable for security.
2. **A hosted identity provider.** Doesn't run on an organisation's own servers.
3. **Keycloak.** Open source, runs in the stack, brokers Entra and local accounts.

## Decision

Keycloak runs in the stack and only signs people in (OIDC). It brokers the organisation's identity provider and local accounts. AUGUR's identity service is the source of truth for people, teams, floors and membership; Keycloak groups are not used for that.

## Consequences

- Keycloak's realm and client ids keep the old `platform` names on purpose, because renaming them would sign everyone out.
- The Keycloak master admin and `/sso/admin` exposure are open security items.

## Links

- Nested workspaces plan: https://claude.ai/artifact/9sTJ9XjyHX3EwCDfJiBfvp
- SaaS demo plan: https://claude.ai/artifact/WbJTkkLoZL5sirZiuWKUFp
