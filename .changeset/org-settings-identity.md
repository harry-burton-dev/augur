---
"@augur/identity": minor
"@augur/sign-in-theme": patch
"@augur/admin": minor
---

Admin → Organisation's settings grow (ADR 0042): the organisation's logo (a PNG, served to sign-in pages without a sign-in), a sign-in notice shown as Keycloak's Terms and Conditions step with "ask everyone again", the languages offered and the default, and, for a deployment admin who just entered their password, two steps for everyone and how long leavers and Activity are kept. AUGUR's own services read the retention at `GET /v1/organisation/policy`. The realm job applies the notice, languages, two steps for everyone and the organisation's name to Keycloak; the sign-in pages show the name and logo kept in Admin.

Admin → Organisation shows and changes them: a Logo section (drop a PNG), Sign-in notice, Languages, and Security and retention, which says who can change it and asks for the password again when it's needed. Activity says what changed in words.
