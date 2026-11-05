---
'@augur/identity': minor
---

The realm job points Keycloak at the organisation's SMTP relay (`SMTP_*` in `.env`, ADR 0035) and, with one, turns on Forgot password and address checks; without one it leaves a relay set in the console and offers those only if there is one. The local stack catches all mail in Mailpit (ADR 0065).
