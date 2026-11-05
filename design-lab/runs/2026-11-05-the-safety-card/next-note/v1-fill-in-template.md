# V1: Fill-in template

Copy this into `docs/upgrade.md`, at the top of "Release notes that need
you", and fill every line. Delete a line only where the comment says you may.

```markdown
### <A sentence with a verb: what changes, in the admin's words>
**From** unreleased · **<Do before | By hand | Check | Nothing to do>** · **Way back** <the code step | a restore: what is lost | can't>

- **If** <the condition, when only some servers must act. Delete if every server must.>
- **Do:** <one numbered step per action, in order, with the exact setting or command in code. Say "before you upgrade", or "after".>
- **Check:** <the exact log line, exit code or page that shows it worked.>
- **Skip it and** <what breaks, in one sentence. If nothing breaks, say so.>
- **Way back:** <only when it is more than the code step: the commands, and what is lost.>
- **For people:** <what changes for people who use AUGUR. Delete if nothing.>
- **Why:** <one or two sentences, and the record (ADR nnnn).>
```

**Rules for the blanks**
- `From unreleased` stays as it is. The Version packages pull request
  replaces it with the release. [open: nothing does this yet; see the critique.]
- The verdict is one of the four words, exactly.
- If you don't know a blank, write `[open: <what isn't known>, <who can say>]`.
  Never leave it empty and never guess.
- Settings: name each one in code, say required or optional, and say how
  to make it (`openssl rand -hex 32`) when it is a secret.
- Names: Artifacts, Explorer, AUGUR in sentences. Code names only in code
  (`FOLIO_*`, `auspex`).
