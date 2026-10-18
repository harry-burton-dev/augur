# Platform frontends

- `shell/`: the host. Wraps the UI kit's `ui-shell`, loads the manifest from the registry, mounts the current app into the Shell's stage and routes intents between apps. Next build step.
- `home/`: what needs you across every app, and the launcher.
- `admin/`: register apps, manage departments, audit trail.

Product apps keep their own frontends under `apps/<app>/frontend`. Each one default-exports a `MicroFrontend` from `@platform/mfe-sdk` and uses `@platform/ui-kit` for every visual.
