---
'@augur/service-kit': minor
'@augur/identity': patch
'@augur/gateway': minor
'@augur/admin': minor
---

AUGUR's own email sender (ADR 0065): `@augur/service-kit/mail` sends notice emails through the organisation's relay with Nodemailer, from React Email templates, and says why when it can't. The relay settings (`mailRelayFromEnv`) move into the service kit, shared with the realm job. The gateway's status now says whether email can be sent, and Admin → Status shows it with what to check.
