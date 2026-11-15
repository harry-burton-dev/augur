---
"@augur/mfe-sdk": patch
---

A bus handler that throws no longer stops the handlers after it: each one runs, and the throw is reported as an uncaught error is. As with the DOM's events, a handler added during an emit waits for the next one, and one removed before its turn isn't called.
