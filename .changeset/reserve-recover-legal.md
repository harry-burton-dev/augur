---
"@augur/service-kit": patch
---

An app can no longer take the id `recover` or `legal`: the front door serves the way back at /recover/ and AUGUR's licence and notices at /legal/ itself. A test now reads infra/deploy/nginx.conf and fails when a path it serves isn't kept from apps.
