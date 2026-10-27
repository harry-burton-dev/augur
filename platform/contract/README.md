# Contract tests

The shell's promise to apps, tested in a browser. A reference app (`reference-app/`) uses every part of the mount context the SDK promises: the person, the path, a token, `notify`, `raise`, `request` (answered and declined), the event bus, and being unmounted. `tests/contract.spec.ts` opens it in the real shell, through the shell's dev-app mode (signed in as a stand-in person, nothing else of the platform needed), and checks each one.

It runs against every build of the reference app:

- **source**: built with today's SDK. There is no `sdk-1.2`: the reference app built against SDK 1.2 was byte-for-byte the build in `sdk-1.1`.
- **`frozen/sdk-<major>.<minor>/entry.js`**: the reference app as it was built against each earlier SDK minor. These are never rebuilt or replaced, so they stand for apps that were released and not touched since. A shell change that breaks any of them breaks real apps, and fails CI.

```sh
pnpm build   # Folio's frontend and service too
pnpm --filter @augur/contract-tests exec playwright install chromium   # once
pnpm --filter @augur/contract-tests test:contract
```

Folio ships with AUGUR but an admin can turn it off, and either way the shell, Home, Find and other apps must keep working. So today's build runs twice, once with Folio in the catalogue beside it (its built frontend, and its service keeping everything in memory, through the dev-app mode's `DEV_ALSO`) and once without, and each frozen build runs beside Folio, as released apps now do. `tests/pillar.spec.ts` checks what changes: Folio's Home card, `document.open` and `document.pick` answered by Folio, and with it off, Home without its card and those intents saying no app handles them.

It runs every build side by side, each against its own copy of the shell on its own port (5180, 5181…), and prints each build's results once that build is done. Failures for a build are kept in `test-results/<build>/`.

When a release bumps the SDK's minor (1.1, 1.2…), keep that release's build: `pnpm build && pnpm --filter @augur/contract-tests freeze`, and commit the new `frozen/` folder. A new part of the mount context gets a check in the reference app and the spec in the same pull request that adds it; the frozen builds don't use it, which is the point.
