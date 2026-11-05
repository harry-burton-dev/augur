# V4: Checked by a script

The rule is whatever CI can check. A proposal, not built: a check over
`docs/upgrade.md`, beside `pnpm check:reasons` and `pnpm check:settings`.
It would fail a pull request when a note in "Release notes that need you":

| # | Fails when | Why it can be checked |
|---|---|---|
| 1 | the line after a `###` heading doesn't start with `**From** ` | fixed text |
| 2 | `From` is neither `unreleased` nor a version like `augur@0.18.0` | a pattern |
| 3 | the verdict isn't one of **Do before**, **By hand**, **Check**, **Nothing to do** | a closed list |
| 4 | the verdict is **Nothing to do** but the note names a setting the pull request adds to `infra/deploy/settings.schema.json` as required | the schema already lists settings (`pnpm check:settings`) |
| 5 | a setting named in the note isn't in `settings.schema.json` | the same list |
| 6 | the verdict is **Do before** or **By hand** and there is no numbered step | structure |
| 7 | there is no **Way back** | fixed text |
| 8 | a sentence outside code is over 30 words | count |
| 9 | prose (not code) uses a code name or old name from AGENTS.md's list (`Folio`, `Auspex`, `IM platform`) | AUGUR's naming rules |
| 10 | the note has an empty `[open: ]` | a pattern |

And one check on release: the Version packages pull request replaces each
`From unreleased` with the version it releases. [open: who builds this;
it touches the release workflow (docs/versioning.md).]

What a script can't check: whether the verdict is right, whether the "if"
is the real condition, whether the consequence is true. A reader test
checks those, once per template change, not once per note.
