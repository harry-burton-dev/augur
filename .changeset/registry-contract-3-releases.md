---
"@augur/registry": minor
"@augur/admin": patch
---

The registry reads app contract 3 releases (`augur.app-release/v2`): it checks them against the contract's schemas and Score's, refuses what spec 9.2 lists with a plain reason each, warns about what 9.3 lists, and holds a later version that asks for anything new for an admin. A contract 2 file is refused, naming the contract. `GET /v1/contract` answers the majors served, and the app runner says the deployment's own networks with `PUT /v1/runner/networks`, which replace the fixed 172.16.0.0/12 rule for apps' addresses. Admin → Apps lists what a release asks for by part.

Not breaking for anyone: the job request and Admin → Apps' asks change shape, and their only callers (Admin and the app runner) ship in the same release; contract 2 releases are refused by design (ADR 0075 point 10, spec 11.6).
