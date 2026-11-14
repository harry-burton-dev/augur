---
---

The deploy test's Starter job signs in to GitHub Packages before building, so pushing Starter's images is no longer refused and the app runner's part of the test runs again. The script's state dump no longer complains when the test fails before compose is set up.
