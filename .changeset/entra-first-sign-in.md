---
"@augur/identity": minor
"@augur/admin": minor
---

People can sign in with the organisation's Entra account. With `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID` and `ENTRA_CLIENT_SECRET` in `.env`, the realm job adds the organisation's single-tenant Entra as a sign-in, whose first sign-in links to the account with the same email, or makes one when nobody has it, with no password asked for. Taking the settings out turns it off and keeps the links. An account made this way is recorded as joined (`person.added` with `method: 'federated'`, so `platform.person.joined`), and a person shows `source: 'federated'` (contract 1.28.0, migration `lifecycle_004_federated`). Admin says how each person signs in.
