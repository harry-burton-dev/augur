---
"@augur/shell": minor
"@augur/home": minor
---

A throw in one of the shell's own parts (the Inbox, the Account area, urgent notices) or in Home now stops only that part: the rest of the screen keeps working, and the stopped part says it isn't the person's fault, that an admin can pass it on to whoever runs the deployment, and offers Try again (Close for the Account area). It starts again by itself when what it shows changes. Anything else in the shell that throws while drawing shows the same for the whole screen, with Reload, rather than a blank page. Each is reported as an uncaught error is, so browser telemetry still hears of it. Both use the kit's `StateBoundary`.
