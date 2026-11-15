---
"@augur/knowledge": patch
---

The knowledge graph refuses an app that reads or changes a floor with its own token and no person: it was treated as a person in the org, could read the org's floor, and could make itself the owner of someone's own floor before they first used it. An app acting for a person now reads only the floor it was opened on, not another floor named in the address.
