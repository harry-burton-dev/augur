# Contract tests

The shell's promise to apps, tested in a browser. A reference app (`reference-app/`) uses every part of the mount context the SDK promises: the person, the path, a token, `notify`, `raise`, `request` (answered and declined), the event bus, and being unmounted. `tests/contract.spec.ts` opens it in the real shell, through the shell's dev-app mode (signed in as a stand-in person, nothing else of the platform needed), and checks each one.

It runs against every build of the reference app:

- **source**: built with today's SDK.
- **`frozen/sdk-<major>.<minor>/entry.js`**: the reference app as it was built against each earlier SDK minor. These are never rebuilt or replaced, so they stand for apps that were released and not touched since. A shell change that breaks any of them breaks real apps, and fails CI.

```sh
pnpm build
pnpm --filter @augur/contract-tests exec playwright install chromium   # once
pnpm --filter @augur/contract-tests test:contract
```

When a release bumps the SDK's minor (1.1, 1.2…), keep that release's build: `pnpm build && pnpm --filter @augur/contract-tests freeze`, and commit the new `frozen/` folder. A new part of the mount context gets a check in the reference app and the spec in the same pull request that adds it; the frozen builds don't use it, which is the point.
