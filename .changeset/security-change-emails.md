---
'@augur/identity': minor
'@augur/shell': minor
---

People are emailed when their password, code app or passkeys change. With a relay, the realm job turns on Keycloak's email listener, and AUGUR's Keycloak image leaves failed sign-ins out. Identity's `GET /v1/me/security` says whether those emails are on and where they go (contract 1.25.0), and Account → Sign-in and security says so. Until people choose a time zone of their own, times follow the organisation's time zone from Admin → Organisation, and then the browser's. Account → Language and region says which one they follow.
