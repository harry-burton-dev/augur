---
'@augur/permissions': minor
'@augur/service-kit': patch
---

The permissions service (ADR 0085), not yet run by deployments. It answers "may this subject do this to
that?" from the relationships OpenFGA holds, at `/access/v1/evaluation` and `/access/v1/evaluations` in the
shape of the AuthZEN Authorization API, for the gateway and AUGUR's own services only. Its model
(`model/core.fga`) covers the deployment, the org, floors, personas (ADR 0086) and roles made inside
AUGUR, and `model/questions.fga.yaml` holds the questions it must answer. A check it can't answer is
refused with the reason, never allowed. The service kit reserves `permissions` and `openfga` as app ids.
