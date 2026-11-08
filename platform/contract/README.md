# Contract tests

The shell's promise to apps, tested in a browser. A reference app on the app contract (`reference-app/`, contract 3) runs in the shell's worker, as every installed app does, and uses every part of the app context SDK 3 promises: the person, the floor and the path, feature previews (`previewOn`), `ctx.fetch`, `notify`, `raise`, `request` and answering one (`ctx.reply`), moving inside the app (`navigate`, `onNavigate`), a command in its pane's heading, and its Home card (`ctx.frame.card`). Its manifest declares what the shell draws before the app's code runs: places in the rail, a command, the intents it handles, an inbox kind, Find (`contributes.search`) and the card. Each check is a notice headed `check <name>`, and `tests/` opens it in the real shell, through the shell's dev-app mode (signed in as a stand-in person, nothing else of the platform needed), and reads them.

- `tests/contract.spec.ts`: the app context, the worker's sandbox (no network, no page, no token, its own script policy), the remote vocabulary, the headers on every call, the address, floors, failing, flooding, Home and Find.
- `tests/app-bar.spec.ts`: the app bar, its start menus and the rail with the app's places.
- `tests/inbox.spec.ts`: the Inbox, in the words of the app's inbox kinds.
- `tests/a11y.spec.ts`: axe on the desktop, a start menu, the app with its rail, and the stream.

```sh
pnpm build   # the shell's packages and Home
pnpm --filter @augur/contract-tests exec playwright install chromium   # once
pnpm --filter @augur/contract-tests test:contract
```

The manifest's feature preview `turned-on` is on for the stand-in person (`DEV_PREVIEWS`) and `left-off` off. `PLAYWRIGHT_CHROMIUM` uses a browser that is already installed, and `CONTRACT_PORT` moves the shell's dev server off 5180. Failures are kept in `test-results/`.

The reference app is built from source against today's SDK. A new part of the app context or the manifest gets a check in the reference app and a test in the same pull request that adds it.

## Waiting for states, not clocks

Each check waits for something on screen, never for an amount of time (PER-322). Before the first test, `warm.setup.ts` opens the reference app once, so the dev server has compiled everything before any test's clock starts. On CI a check waits up to 10 seconds for its state, because a busy runner can take longer than Playwright's default 5. A test about a time limit in the shell, such as Find's budget, makes the other side never answer, so only the shell's limit can end the wait.
