# 0029. The SDK reserves a working context and a protective marking now

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry

## Context

Two things would break the SDK if they were added after apps depend on it.

- **Working context.** Tools such as a briefing creator need a second scope beside the floor, for example "working under Operation Alpha, phase 2".
- **Protective markings.** Whether the organisation marks its information is still open (PER-149). If it does, every `Ref`, artifact version, intent and entity fact needs a marking, and adding that after a pilot means re-marking all existing data.

## Options

1. **Reserve both now, empty:** an optional `focus` manifest field and `ctx.focus` that stays empty until the shell fills it; an optional `marking` on `Ref` that nothing enforces yet.
2. **Wait,** and take an SDK 2.0 if either is needed.

## Decision

Option 1. Both are optional and additive. Nothing reads `marking` until PER-149 settles the scheme, and the shell doesn't fill `ctx.focus` until working context is built.

## Consequences

- No breaking SDK change later for either.
- A reserved field can mislead people. The SDK docs say it's empty and why.

## Links

- Foundation gap analysis, 27 October 2026: gaps G6 and G13, decisions D1 and D6.
- PER-144, PER-149.
