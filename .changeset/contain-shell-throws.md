---
"@augur/shell": minor
"@augur/home": minor
---

A throw in one of the shell's own parts (the Inbox, the Account area, urgent notices) or in Home now stops only that part: the rest of the screen keeps working, and the stopped part says it's a fault in AUGUR, that an admin can pass it on to whoever runs this AUGUR, and offers Try again. Anything else in the shell that throws while drawing shows the same, for the whole screen, with Reload, rather than a blank page. Both use the kit's `StateBoundary`.
