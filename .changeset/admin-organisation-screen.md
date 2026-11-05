---
'@augur/admin': minor
'@augur/registry': patch
---

Admin → Organisation shows the organisation's name, time zone and email sender, and lets an admin change them in one form that sends only what changed (ADR 0042). It says plainly that AUGUR's email doesn't use the organisation's sender yet: mail still goes from the relay's address (`SMTP_FROM`) under the product's name. Activity writes `organisation.changed` as a sentence, and Admin's menu gains a Settings group in the Organisation area.
