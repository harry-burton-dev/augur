---
'@augur/models': minor
'@augur/service-kit': minor
---

The model gateway turns apps' texts into vectors (`POST /v1/embeddings`, contract 1.1), to match by meaning, when an embedding model is set up (`MODEL_EMBEDDING_NAME`; the stand-in always has one). Each request is one call, recorded as `model.embedded` without the texts. `embedTexts` in the service kit asks for them.
