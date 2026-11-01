# 0001. Record decisions as ADRs in the repository

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry

## Context

Until now AUGUR's decisions lived in chat threads, design artifacts and project memory. Each new piece of work had to be briefed by hand, and decisions were forgotten or quietly reversed. AUGUR is one codebase for many deployments, so drift costs every deployment.

## Options

1. **ADRs as Google Docs in Drive.** Easy for people to read, but kept apart from the code they govern, and not every session that changes the code can read Drive.
2. **ADRs in the repository, listed in a Drive register.** Reviewed in the same pull request as the change, readable by every session with the repo, and rendered by Backstage TechDocs.

## Decision

Technical decisions are written as ADRs in `docs/decisions/`, one file each, numbered in order, using [the template](template.md) (based on MADR). Product, naming and process decisions are written as PDRs in the AUGUR handbook on Google Drive. One Decision register in the handbook (`04 Decisions`) lists both.

A choice needs a record when it is hard to reverse (data model, storage, identity, a public contract such as the SDK, manifest, API or events), crosses packages or repositories, adds a dependency, tool, service or vendor, changes a name, a principle or how we work, or spends money. Anything else needs no record.

Statuses are Proposed, Accepted, Superseded and Deprecated. Only Harry accepts a record.

Records guide rather than bind, but changing course is never silent. Work that goes against an Accepted record comes with a new Proposed record that says what changes and why and links the one it replaces; Harry is told, and the deviating part does not merge until he accepts it. Then the old record says "Superseded by" and the register is updated.

## Consequences

- A pull request that changes a recorded decision carries the superseding ADR in the same diff.
- Decisions taken before this record existed were written down on 2026-11-01 with the date they were actually made (0002 onwards).
- Each app repository keeps its own `docs/decisions/` for decisions about that app only. Platform-wide decisions live here.
- Drift audits check the code against Accepted records.

## Links

- Proposal: https://claude.ai/artifact/MyFY8DhKZENj9cRpUgf64r
- Handbook: Google Drive folder "Augur"
