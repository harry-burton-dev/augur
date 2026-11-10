---
'@augur/knowledge': patch
---

Compose leaves the knowledge service unconnected to the models service in this phase of design (`MODELS_URL` empty), so it reads no raw text and writes no summaries. The code for both stays, marked in `src/index.ts`.
