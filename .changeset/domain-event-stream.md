---
"@augur/events": minor
---

Domain events reach the browser: `GET /v1/domain-events/stream?topics=` streams each event on the person's floor and topics as it's published (events contract 1.8.0), so apps can refresh what they show without polling.
