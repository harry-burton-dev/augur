# Contract tests

The shell's promise to apps, tested in a browser. A reference app (`reference-app/`) uses every part of the mount context the SDK promises: the person, the path, a token, `notify`, `raise`, `request` (answered and declined), the event bus, the floor and its level, feature previews (`previewOn`), and being unmounted. It draws with React and Quill (`@augur/app-kit`), which the shell serves, as apps do from SDK 1.10. `tests/contract.spec.ts` opens it in the real shell, through the shell's dev-app mode (signed in as a stand-in person, nothing else of the platform needed), and checks each one.

It runs against every build of the reference app:

- **source**: built with today's SDK.
- **`frozen/sdk-<major>.<minor>/entry.js`**: the reference app as it was built against an earlier SDK minor. These are never rebuilt or replaced, so they stand for apps that were released and not touched since. A shell change that breaks any of them breaks real apps, and fails CI. A folder also stands for every later minor whose build was byte-for-byte the same, so it is named for the oldest of them.

```sh
pnpm build   # Folio's frontend and service too
pnpm --filter @augur/contract-tests exec playwright install chromium   # once
pnpm --filter @augur/contract-tests test:contract
```

Folio ships with AUGUR but an admin can turn it off, and either way the shell, Home, Find and other apps must keep working. So today's build runs twice, once with Folio in the catalogue beside it (its built frontend, and its service keeping everything in memory, through the dev-app mode's `DEV_ALSO`) and once without, and each frozen build runs beside Folio, as released apps now do. `tests/pillar.spec.ts` checks what changes: Folio's Home card, `document.open` and `document.pick` answered by Folio, and with it off, Home without its card and those intents saying no app handles them. Those check the shell and Folio rather than what an app was built with, so they run against today's build only; the frozen builds run `tests/contract.spec.ts`.

Today's build runs with the manifest's feature preview `turned-on` on for the stand-in person (`DEV_PREVIEWS`) and `left-off` off.

It runs every build side by side, each against its own copy of the shell on its own port (5180, 5181…), and prints each build's results once that build is done. Failures for a build are kept in `test-results/<build>/`.

On an ordinary pull request CI runs today's build and only the oldest and newest frozen builds (`CONTRACT_FROZEN=edges`); the Version packages pull request runs every one ([docs/ci-cd.md](../../docs/ci-cd.md)).

When a release bumps the SDK's minor, keep that release's build: `pnpm build && pnpm --filter @augur/contract-tests freeze`, and commit the new `frozen/` folder. When the build is byte-for-byte the newest kept one, `freeze` says so and keeps nothing: that folder already stands for it. A new part of the mount context gets a check in the reference app and the spec in the same pull request that adds it, with `since('<minor>')` so builds from before it skip it; the frozen builds don't use it, which is the point.

SDK 2.0 is a major: the shell stops serving Lit and the Lit kit. Every 1.x frozen build was the Lit reference app, so at the cut the `sdk-1.*` folders retired from `frozen/` and after the 2.0 release `frozen/sdk-2.0` was kept and the reference manifest's range narrowed to `^2.0.0`. A 1.x app that never imported Lit still runs on a 2.0 shell once its range also accepts 2, as the pillar apps' do (`^1.4.0 || ^2.0.0`); the contract tests no longer stand for those builds, which retire when the pillar apps are rebuilt on 2.x. From then on each 2.x minor is frozen as above.

## Waiting for states, not clocks

Each check waits for something on screen, never for an amount of time (PER-322). Before the first test, `warm.setup.ts` opens the reference app once, so the dev server has compiled everything before any test's clock starts. On CI a check waits up to 10 seconds for its state, because a busy runner can take longer than Playwright's default 5. A test about a time limit in the shell, such as Find's budget, makes the other side never answer, so only the shell's limit can end the wait.
