# 0019. Deployments report what they run, as a signed heartbeat or an exported file

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry

## Context

Backstage shows what each ring takes, not what each deployment actually runs. Bake time, the fleet view and DORA figures all need the real versions and upgrade results. Some organisation deployments will be air-gapped and can't call out.

## Options

1. **Deployments push a signed heartbeat to Backstage. Air-gapped ones export the same record as a file that an admin carries across.**
2. **Backstage polls each deployment.** Needs inbound access and a token on every server.
3. **A full OpAMP (OpenTelemetry agent management) server.** A standard, but more than this needs today.

## Decision

Option 1. The registry sends the record after every upgrade and once a day. It holds the deployment's id, ring, AUGUR and app versions, pins and policies, health, the last upgrades' results and the feed's state, and no personal data. The message follows OpAMP's status shapes (agent description, health, package statuses), so a standard server could take over later. Each record is signed with a key the deployment holds, and Backstage keeps the public key per deployment in `org/deployments.yaml`. Reporting can be turned off in `.env`, and the Upgrade Centre says when it is off.

## Consequences

- Backstage gains an endpoint, and an import for files, which must refuse unknown or unsigned records.
- DORA figures (deploy frequency, lead time, change failure rate, time to restore) can be worked out in Backstage from these reports plus GitHub.

## Links

- Linear PER-177
