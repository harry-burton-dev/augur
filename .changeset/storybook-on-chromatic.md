---
---

CI publishes the kits' Storybook to Chromatic (ADR 0016) from main and from pull requests that touch a kit, with TurboSnap, instead of building it in every run and keeping it as an artifact. Without the `CHROMATIC_PROJECT_TOKEN` secret the job says so and publishes nothing.
