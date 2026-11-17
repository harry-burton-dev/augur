---
"@augur/gateway": patch
---

A part's onward call for a person is now refused when the person has left the floor the delegation names, or the app is no longer on for them there (turned off or blocked for them), as the person's own call already was. Before, the part could keep acting for them until its delegation ran out, up to `APP_DELEGATION_SECONDS`. The person's roles are still the ones the delegation was signed with. The gateway now remembers each catalogue by the caller's roles, departments and persona as well as the person and floor, so callers signed with different roles never share one. Fixes PER-521.
