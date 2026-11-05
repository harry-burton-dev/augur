# Reader test for the sample note (surface 4)

Text under test: `../combined/sample-note.md`, a note written from
`../combined/template.md`. Baseline: the same note as it stands in the
source, the first bullet of the section (`../source.md` line 3).

The reader is the same admin as in `questions.md`. The tester gets
`sample-note-questions-only.md` and one of the two texts.

| # | Question | Answer | Source |
|---|---|---|---|
| S1 | Which settings must you add to `.env`, and which must you remove, before you upgrade? | Add `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET`, `EVENTS_CLIENT_SECRET` (`openssl rand -hex 32` each); remove `SERVICE_TOKEN` | line 3 |
| S2 | You run an app with its own service. What must you do for it? | In Admin, Apps, **Issue a new sign-in**, and use it as the app's `SERVICE_CLIENT_SECRET` | line 3 |
| S3 | Do you need to make anything in Keycloak? | No. Identity makes the matching Keycloak clients when it starts | line 3 |
| S4 | What happens if you upgrade without adding the three secrets? (the text can't answer this) | The text doesn't say | none |

**Note on the "why" line.** A first draft said `SERVICE_TOKEN` "was one
token every service shared". That reads more into "the shared token" (line
3) than the source holds, so it was cut back to the source's words.
