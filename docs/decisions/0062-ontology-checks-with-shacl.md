# 0062. Data Atlas checks what it keeps against SHACL shapes, with rdf-validate-shacl

- **Status:** Proposed
- **Date:** 2026-11-05
- **Decided by:** Harry (overnight approval of the alpha's records, 5 Nov; the alpha spec's item 32 asks for "ontology checks by rdf-validate-shacl on n3")

## Context

Data Atlas checks each value as it's typed: a detail's kind, its pattern, a choice's values. These checks are in code and only see one value at a time. They can't say which entities on a floor no longer fit the ontology after it grows. Nothing outside Data Atlas can read them either. The OWL export says what the kinds and links are, but not what a valid entity looks like. SHACL (W3C, 2017) is the standard way to say that, and the ontology tools an org already uses read and write it.

Data Atlas already reads and writes RDF with N3.js (its packs and the OWL export).

## Options

1. **Keep checks in code only.** Nothing to add. There is no whole-floor check, and nothing other tools can read.
2. **SHACL shapes written with N3.js and checked with rdf-validate-shacl** (MIT, Zazuko, RDF/JS). Runs in the service, on N3's own store. It adds about 25 small packages, around 13 MB installed.
3. **A SHACL engine in another runtime** (pySHACL, Apache Jena) as a sidecar. More complete, but it means one more container and runtime for every deployment.
4. **JSON Schema with Ajv.** Already present through Fastify. Fine for one request body, but it doesn't speak RDF and other tools can't read it as an ontology constraint.

## Decision

Data Atlas writes SHACL shapes from its ontology with N3.js and checks entities against them with **rdf-validate-shacl**, in its own service.

- **Shapes.** Each kind is a node shape. Each detail is a property shape: its datatype, pattern, choice values (`sh:in`) and at most one value. Each kind of link is a property shape naming the kinds it may point to. The shapes export beside the OWL at `GET /v1/ontology/shacl`.
- **Checks.** Checks run when someone asks for them, never on every write. That covers one entity, and everything on a floor that the caller sees. Each finding says, in words a person can act on, which entity, which detail and why.
- **Code checks stay.** The checks in code still guard input, because they answer fast and in plain words. SHACL is the shared rule, and the whole-floor check.

## Consequences

- Admins can see which entities no longer fit after the ontology changes, and other tools can read the shapes.
- One new dependency tree in Data Atlas's service. Renovate keeps it current. It must stay in the service, never in the frontend bundle.
- A whole-floor check reads every entity it covers, so it pages and has a limit. It isn't run on a timer.
- Checking packs an org loads against shapes they bring with them comes later, if an org asks for it.
- The check that holds the rule is Data Atlas's tests: shapes from the starter ontology accept the seeded entities, and reject a broken one with the reason in words.

## Links

- PER-328 (Data Atlas N3), part of PER-240.
- The Data Atlas next-phases spec (project files, `specs/pillars/atlas-next.md`, N3).
