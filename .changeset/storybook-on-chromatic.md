---
---

CI publishes the kits' Storybook to Chromatic (ADR 0016) only when a kit's code, tokens or stories change (on the pull request and on the push to main that brings it in), with TurboSnap, instead of building it in every run and keeping it as an artifact. Without the `CHROMATIC_PROJECT_TOKEN` secret the job says so and publishes nothing.
