---
"@augur/gateway": minor
---

A call the host makes for an app (`x-augur-app`) must name the floor the person stands on; one that names none gets 400 instead of being checked on the organisation's. The host always names it. A part's onward call for a person (`x-augur-delegation`) is now checked on the floor that person stood on, which the delegation carries, rather than on the organisation's when the part names none; a part that names a different floor gets 400. Part of PER-463.
