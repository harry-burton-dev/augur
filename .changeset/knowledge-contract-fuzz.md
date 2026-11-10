---
'@augur/knowledge': minor
'@augur/clients': minor
---

The knowledge graph's contract is now checked against the running service: Schemathesis sends it the requests the contract allows, on main, and CI stops a pull request that would break a contract's callers within a major (oasdiff). What the first run found is fixed: a clock with an offset wider than Postgres takes, or before year 1, no longer fails a read; a floor id or IRI as long as the contract allows no longer answers 414; a NUL character in a text answers 422, not 500; and errors are documented as `application/problem+json`, as they were always sent. A source text goes in a body to the new POST /floors/{floor}/known-entities, since a long one doesn't fit a URL; the GET stays, deprecated, until /v2.

Not breaking: knowledge.openapi.yaml no longer lists Turtle and TriG for the export's and the shapes' errors, which the service never sent: they were always `application/problem+json`.
