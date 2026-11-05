---
"@augur/service-kit": minor
---

The service kit's public surface is now an API report, checked in CI. `MailTransport` is the kit's own interface rather than Nodemailer's type, `startAppService` resolves to a plain `FastifyInstance`, and telemetry takes any string record as its settings.

Not breaking: Nodemailer's transport still fits `MailTransport`, and `process.env` still fits the telemetry settings.
