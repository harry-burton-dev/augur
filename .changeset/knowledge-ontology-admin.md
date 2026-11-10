---
'@augur/knowledge': minor
---

An ontology admin (one of AUGUR's admins) adopts a term extraction asked for, as a class or predicate of its own or as another name for one the ontology has, and dismisses one it won't take, saying why: the `adopt` and `dismiss` actions. A claim that falls to `kg:note` asking for an adopted term is kept under it from then on; what was kept before stays as it was. The first adopt pass ships with it: status, reason, defect, expected impact, availability, risk and description, with the names the corpus asked for them by. On draft 4's corpus the share of claims that fall to `kg:note` goes from 32.7% to 23.5%. `GET /v1/ontology/owl` serves the ontology as OWL in Turtle, and a new term sends `platform.knowledge.ontology.changed`. Migrations 010 and 011.
