# Template: a release note that needs you

For anyone adding a note to "Release notes that need you" in
`docs/upgrade.md`, in the pull request that makes the change. Built from
`../next-note/v1-fill-in-template.md`, with the checks from
`../next-note/v4-checked-by-a-script.md` written as rules.

## When to write one
When an admin upgrading by hand must do something, check something, or
decide something because of your change. A new required setting, a
change to `compose.yml`, a one-way migration, a changed default, or a
changed role each needs one. If nobody has to act or know, don't add a
note: the changelog is enough.

## The block
Add it at the top of the section (newest first).

```markdown
### <What changes, as a sentence with a verb, in the admin's words>
**From** unreleased · **<verdict>** · **Way back** <the code step | a restore: what is lost | can't>

- **If** <the servers that must act>. Otherwise nothing to do.
- **Do:**
  1. <One action, with the setting or command in code. Before you upgrade, or after.>
  2. <...>
- **Check:** <the exact log line, exit code or page that shows it worked.>
- **Skip it and** <what breaks, in one sentence>.
- **Way back:** <the commands and what is lost, when it is more than the code step.>
- **For people:** <what changes for people who use AUGUR.>
- **Why:** <one or two sentences, and the record: ADR nnnn.>
```

## How to fill it

| Part | Rule |
|---|---|
| Heading | A sentence with a verb. When skipping it breaks something, say so in the heading: "Don't skip this release: …" |
| From | Write `unreleased`. The release replaces it with `augur@<version>`. [open: the release step doesn't exist yet] |
| Verdict | Exactly one of: **Do before** (add or place something before `pc up -d`), **By hand** (the release can't be left to the updater or an upgrade window), **Check** (only some servers act), **Nothing to do** |
| Way back | Always there. "the code step" when going back is `git checkout`, `PLATFORM_VERSION`, `pc up -d --remove-orphans` and nothing else |
| If | Only when some servers act and others don't. Name them. Never "most servers" |
| Do | One action per step, numbered, in order. Each setting in code, with required or optional, and `openssl rand -hex 32` for a secret. Say whether the Upgrade Centre's updater does it for you |
| Check | Something the admin can see. Leave it out only for **Nothing to do** |
| Skip it and | What breaks. "Nothing breaks: <what you miss>" is a fine answer |
| For people | Leave out when nothing changes for them |
| Why | Last. Never a step in it |
| Unknowns | `[open: <what isn't known>, <who can say>]`. Never a guess, never silence |

## Words
- "You" for the admin. Short sentences: under 25 words where you can, never over 30.
- AUGUR, Artifacts, Explorer in sentences. Code names only inside code:
  `FOLIO_*`, `auspex`, `ghcr.io/harry-burton-dev/im-platform`.
- No one server's names, paths or addresses as if they were everyone's.
  Use placeholders: `<tailnet>`, `<the release>`.
- "Before you upgrade", not "first". "By hand", not "not from the page".

## Before you open the pull request
1. Read the note as the admin upgrading from three releases back. Do you
   know from the first line whether to keep reading?
2. If your pull request adds a required setting to
   `infra/deploy/settings.schema.json`, the verdict isn't **Nothing to do**.
3. If the change migrates data one way, **Way back** says a restore and what is lost.
