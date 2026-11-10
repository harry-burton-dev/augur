---
'@augur/permissions': minor
---

Roles made in AUGUR, and the grants that give them (ADR 0085, spec section 5).

- Whoever manages a floor, or an org admin acting as one, can make a role for it.
- They can put people, positions' holders or a floor's members in a role, and a person or a position can be given it until a time.
- They can give a role's holders lead, member, settler or raiser on a floor they manage, or publisher or audit reader on the org.
- Every grant is kept in a ledger with who gave it, why and until when. Whoever gave it, or anyone who could give it now, can take it back.
- When a giver loses the right to give, what they gave is taken back. That is checked after each copy from identity.
- Everything is recorded in the audit log.
- Admin's screens for this come next.
