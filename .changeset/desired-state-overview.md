---
"@augur/registry": minor
---

Each unit (AUGUR and every installed app) has a desired state: policy, how far Automatic goes, a semver pin and weekly upgrade windows in the deployment's time zone (ADR 0020). AUGUR on production installs patch releases by itself in Sunday's 02:00 window unless an admin changes that; apps keep their channel and policy. New `GET /platform/overview` lists every unit with its record, what Automatic does next and what needs an admin; failed and went-back results stay in Needs you until an admin marks them looked at, for every admin. DEPLOYMENT_TIME_ZONE sets the time zone.
