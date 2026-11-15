---
"@augur/mfe-sdk": minor
---

A bus handler that throws, or whose promise rejects, no longer stops the handlers after it: each one runs, then `createEventBus`'s new `onError` option hears of it with the type (by default it's reported as an uncaught error is). The shell logs it with the topic. `fakeContext`'s bus throws it from `emit`, so a failing check in a handler still fails an app's test. As with the DOM's events, a handler added during an emit waits for the next one, and one removed before its turn isn't called.

Not breaking: `createEventBus` gains an optional argument, and `EventBus` is unchanged.
