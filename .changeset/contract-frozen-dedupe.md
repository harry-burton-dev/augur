---
"@augur/contract-tests": patch
---

The contract tests keep one frozen build for each set of SDK minors whose builds were byte-for-byte the same (`sdk-1.3` now stands for 1.3 to 1.8), and `freeze` keeps nothing when the new build matches the newest kept one. Folio's checks run against today's build only. The reference app now draws with React and Quill from the shell, and checks `previewOn` and a floor's `level`.
