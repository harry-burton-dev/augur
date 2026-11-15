---
'@augur/service-kit': minor
'@augur/registry': minor
'@augur/app-tools': minor
'@augur/shell': minor
'@augur/contract-tests': patch
---

An app's frontend holds only the file types it needs (the service kit's new `FRONTEND_TYPES`: scripts, styles, JSON, source maps, images, fonts, WebAssembly), never a page or an SVG, which opened at its `/apps/` address would run as the shell's origin (PER-453). `packFrontend` and `unpackFrontend` refuse any other file, saying which and why, so `augur-app bundle` stops before it pushes anything and the registry refuses the bundle; the registry never writes one to the frontends bucket. The front door answers 404 for any other file under `/apps/`, and sends `X-Content-Type-Options: nosniff` and a report-only Content-Security-Policy (`sandbox; default-src 'none'; frame-ancestors 'none'`) with everything under `/apps/`, `/assets/` and `/shared/` (`infra/deploy/not-a-page.conf`). The contract tests run the reference app with that policy enforced.
