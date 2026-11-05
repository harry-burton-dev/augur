# V2: Seven rules

No template. Seven rules a writer keeps in mind, short enough for `AGENTS.md`.

1. **Lead with the verdict.** The first line after the heading says one of:
   do this before you upgrade, take this release by hand, check this if,
   or nothing to do.
2. **Say which release.** Write `From unreleased`; the release fills it in.
3. **One step, one action.** Number the steps. Put each setting or command
   in code. Say "before you upgrade" or "after".
4. **Say what breaks if it's skipped,** and how to go back, even when going
   back is just the code step.
5. **Keep why for last,** in one or two sentences. Never put a step in it.
6. **Write "if" with its "then".** "Nothing to do on most servers" is not
   allowed: name the servers that must act, and what they do.
7. **Mark what you don't know** as `[open: ...]`. Don't guess.
