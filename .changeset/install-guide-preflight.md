---
---

The install guide (docs/deploy.md) is one procedure from an empty server to a running, backed-up deployment that reports to Backstage, with sections for a staging server, wiping and refreshing one, and taking one out of service, and a glossary. Its settings list is made from the settings schema and held to it by `pnpm check:settings`. The preflight has an install mode: `node scripts/preflight.mjs --install` checks the `.env` against the schema (each value's pattern, length and choices, no two secrets the same, the address matching the machine's tailnet name, the read key, the host's memory and disk), and `--fill-secrets` fills in every blank secret nobody needs to type.
