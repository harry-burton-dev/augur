---
"@apps/folio": minor
"@apps/folio-frontend": minor
---

Folio publishes documents. Whoever manages a document puts one version out to a team, a team and the teams below it, or the whole org; everyone it goes to can read that version (and only that one) from their own floor, finds it under "Published to you", and is told, with a Read button that opens it. Publishing again replaces what was out, and withdrawing takes it back, with a reason. Team leads publish to their team and below; the org, other teams and your own floor need the publisher role. Lists show and filter by draft, published and withdrawn. Folio now tells other apps what happened (`folio.document.*` events, from an outbox), and handles `document.open`.
