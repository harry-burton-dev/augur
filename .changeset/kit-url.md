---
'@augur/shell': minor
---

The shell and every app load the UI kit (React, Common and Quill) from the kit bundle this release pins in release/kit.json, served at KIT_URL: by default /kit/ on the front door, or any host that mirrors it, such as a CDN (ADR 0048). Each kit file is held to its hash, Settings shows the kit and where it comes from, and the page says so, naming KIT_URL, if the kit can't be loaded.
