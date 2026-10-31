---
"@augur/ui-kit": patch
---

The reader loads markdown-it the first time it shows a document, not with the kit: every page downloads about 48 KB (gzipped) less before the shell starts. `await reader.updateComplete` still finds the document shown.
