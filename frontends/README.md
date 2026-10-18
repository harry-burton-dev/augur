# Frontends

Built in this order (see the build order in the root README):

- `shell/`: hosts the design system's Shell, loads the manifest from the registry and mounts the active micro frontend into the Shell's stage. Build step 2.
- `mfe-home/`: launcher listing the apps the user can open. Step 6.
- `mfe-library/`: document libraries, editor and reader view. Step 6.
- `mfe-admin/`: register apps, manage departments, audit trail. Step 7.

Each micro frontend default-exports a `MicroFrontend` from `@im/mfe-sdk` and uses `@im/ui-kit` for every visual.
