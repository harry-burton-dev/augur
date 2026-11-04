---
"@augur/app-tools": minor
---

Every release image now carries a signed SBOM (SPDX, from Syft through BuildKit) and SLSA build provenance, attested with cosign by the same workflow that signs the image (PER-270). `augur-app bundle` does the same for an app's service image, and AUGUR's release does it for its own images and the shipped apps' images it re-signs. Check them with `cosign verify-attestation --type spdxjson` or `--type slsaprovenance` (docs/release-channels.md, Signatures).
