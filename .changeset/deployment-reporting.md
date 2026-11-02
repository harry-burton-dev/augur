---
'@augur/registry': minor
---

The registry reports what the deployment runs to the company's Backstage, signed with the deployment's own key, after each change and once a day, or exports it as a file for an air-gapped server (ADR 0019). Set DEPLOYMENT_ID (and PORTAL_URL) in .env to turn it on; DEPLOYMENT_REPORTING=off turns it off.
