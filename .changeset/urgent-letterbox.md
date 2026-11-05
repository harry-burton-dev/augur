---
'@augur/events': minor
'@augur/service-kit': minor
'@augur/registry': minor
'@augur/shell': minor
---

Urgent news (ADR 0044 D3, PER-283). A notification can be `urgent`, from AUGUR's own services only (an app's is refused, 403). The Upgrade Centre marks a halted release and a go-back that didn't finish urgent, and offers a feature preview, `urgent-letterbox`: with it on, the shell opens urgent news in a see-through letterbox over the work, one at a time with the rest in its queue, and steps it back to the edge rule until someone opens it. Events contract 1.12.0.
