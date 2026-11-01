# 0028. Discussion starts inside Intent behind a ref-keyed API

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry

## Context

Back-briefs on an intent, questions on an artifact and notes on an entity fact are all threads attached to an object. Only Intent needs them first.

## Options

1. **A platform discussion service now.**
2. **Start inside Intent,** with an API keyed by `Ref` (ADR 0025), and lift it into the platform when a second app needs comments.

## Decision

Option 2. The API takes a `Ref`, never an Intent-only id, so moving it later doesn't change callers.

## Consequences

- No new service before there's a second user of it.
- Mentions feed the Inbox (ADR 0026) and audit.

## Links

- Foundation gap analysis, 27 October 2026: gap G11, decision D5.
- PER-144.
