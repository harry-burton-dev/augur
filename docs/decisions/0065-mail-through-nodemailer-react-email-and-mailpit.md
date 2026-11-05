# 0065. AUGUR's own email is sent by Nodemailer from React Email templates, and Mailpit catches it in dev

- **Status:** Accepted
- **Date:** 2026-11-05
- **Decided by:** Harry (overnight approval of the alpha's records, 5 Nov)
- **Replaces:** none

## Context

ADR 0035 sends email through the organisation's own SMTP relay. Two kinds of email go there. Keycloak sends its own (address checks, forgotten passwords, invites), from its email theme (ADR 0041), once the realm job points it at the relay. AUGUR's services will send the rest: notification emails and digests from the events service, and person-lifecycle email. Those need one way to send and one way to write a template, and the local stack needs a place for mail to land that is never a real inbox.

## Options

1. **Nodemailer to the relay, templates in React Email, Mailpit in dev.** Nodemailer is the standard Node SMTP client, with no service of its own. React Email writes templates as React components with the same tokens as the kits, and renders them to HTML and plain text. Mailpit is a single small container that takes SMTP and shows what arrived.
2. **Each service talks SMTP itself, with string templates.** No dependency, but every service handles TLS, retries and escaping on its own, and templates drift from the product's look.
3. **A mail vendor's SDK.** Ruled out by ADR 0035: deployments may be air-gapped.

## Decision

Option 1. Every email AUGUR's own services send goes through one sender in the service kit (`mail.ts`), which uses Nodemailer with the relay settings (`SMTP_*`, the same ones the realm job gives Keycloak) and renders React Email templates kept in the service kit. Mail on the local stack goes to Mailpit, never out. Keycloak keeps sending its own email from its theme.

## Consequences

- New dependencies when the sender lands: `nodemailer` and React Email's render (templates are plain elements, so its component package isn't needed), in the service kit only. Mailpit (`axllent/mailpit`) runs only in `infra/docker-compose.yml`, never on a server.
- One set of relay settings, described once in the settings schema, serves Keycloak and AUGUR's services.
- Without a relay, the sender says so instead of failing, and screens that would email fall back (ADR 0035).
- The first step (PER-189) gives Keycloak the relay and adds Mailpit; the service-kit sender follows in its own pull request.

## Links

- ADR 0035 (the organisation's relay), ADR 0041 (the sign-in and email theme), ADR 0042 (organisation settings, including the sender)
- Linear PER-189 (W2.1)
