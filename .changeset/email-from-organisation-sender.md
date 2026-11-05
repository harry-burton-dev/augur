---
'@augur/service-kit': minor
'@augur/gateway': minor
'@augur/identity': minor
'@augur/admin': patch
---

Email comes from the organisation's sender (Admin → Organisation) instead of SMTP_FROM and the product's name. The service kit's `Mailer` takes a `sender` lookup (`organisationSender` reads identity's `GET /v1/organisation`), Admin → Status shows the name and address mail comes from, and the realm job gives Keycloak the same sender on every run.
