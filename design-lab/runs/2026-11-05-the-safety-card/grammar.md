# Grammar: the parts of an upgrade note

Every note in "Release notes that need you" is built from the same few
parts. The source mixes them in paragraphs. This sheet names each part,
says what it is for, how it is written, and what it must never claim.
Every variant in this run is built from these parts, in different orders.

Sources behind it: DITA's task, concept and reference topics (a step is a
different kind of text from an explanation); the FAA card studies (one
action per panel, in order, tested on readers); GOV.UK content design
(start with the reader's need, front-load); the Federal Plain Language
Guidelines ("you", active voice, tables for conditions); the inverted
pyramid (the whole story in the first sentence).

## The parts

| Part | What it answers | Written as | Must never claim |
|---|---|---|---|
| **Headline** | What changes, in the reader's terms | A sentence with a verb: "Mandate now ships with AUGUR". Not a noun phrase ("The read key") | That nothing is needed, if any condition below needs something |
| **Version range** | Does this note apply to me? | `From augur@0.17.0`. A range when it applies only between two releases | A version the source doesn't hold. Where it is missing: `[open: release]` |
| **Verdict** | Must I act? | One of four: **Do this before**, **Do this by hand** (the release can't be left to the updater or a window), **Check one thing**, **Nothing to do** | "Nothing to do" while a condition (memory, a changed password, an old token) still needs action |
| **Condition** | Is it me? | "If your server has less than 8 GB of memory". One per line; a table when there are two or more | A condition that is really a default ("on most servers") without saying what the rest must do |
| **Action** | What do I do? | One imperative per step, numbered, in order, with the exact command or setting in code. Says when: before `pc up -d`, after, or once | Two actions in one step; an action hidden in "why" text |
| **Check** | Did it work? | The exact thing you see: a log line, an exit code, a page | "It should work". A check that needs a tool the step didn't name |
| **Consequence** | What breaks if I skip it? | "Skip it and the server refuses every later release." Plain, specific, one sentence | A consequence the source doesn't state. Where it is missing: `[open: what happens if skipped]` |
| **Way back** | Can I undo it, and what do I lose? | One of three: **goes back with the code step**, **goes back only with a restore** (and what is lost), **can't go back** | "Going back works" when data has migrated |
| **Why** | Why did it change? | Last, short, for the curious. Links to the record | Any step. A step written here is a step nobody does |
| **For people** | What changes for the people who use it? | A short list, after the steps | That people must do something now, unless the source says so |
| **Identifiers** | Names to type | Code only: `FOLIO_CLIENT_SECRET`, `auspex`, `ghcr.io/.../im-platform` | Code names as names of apps. In prose it is Artifacts, Explorer, AUGUR |

## Four verdicts, four kinds of note
Reading the 37 notes in the source, each one is mainly one kind:

| Verdict | Count in source | Example |
|---|---|---|
| Do this before (a setting to add, a file to place) | 9 | Mandate ships with AUGUR; Server rings; App storage |
| Do this by hand (a one-way or hand-only release) | 4 | Keycloak 26.8; Apps' frontends by version; Artifacts ships; Images from releases |
| Check one thing (only if a condition holds) | 8 | Log limits (memory under 8 GB); the repository's new name (don't skip it); A call that names no floor |
| Nothing to do (for your information, or optional set-up) | 16 | Explorer's name; Sample data; Reporting; The watch |

The count is a judgement and is listed per note in `whole-set/v2-by-what-you-do.md`.

## Rules the parts imply
1. **The verdict comes first, before the why.** A reader who stops after
   one line knows whether to keep reading.
2. **Steps and explanations never share a paragraph.** (DITA.) The
   source's Keycloak note has four steps, then "what changes for people",
   then the way back, then commands. Each is its own block.
3. **Every note has a version range.** In the source, 3 of 37 do (0.16.x,
   0.17.0 and 0.18.0, all inside two notes). This is the one gap a
   rewrite can't close: it needs a fact from the changelogs.
4. **Conditions are tested, not assumed.** "Nothing to do on most servers"
   becomes "If your server has less than 8 GB of memory, do X. Otherwise
   nothing."
5. **Settings are listed where they are added, and again in one list.**
   An admin crossing many releases adds every setting at once; the
   per-note list is for the reader of one release.
6. **The way back is named on every note, even when it's "the code step".**
   Silence reads as "safe".
7. **Identifiers are code; names are prose.** `FOLIO_*` keys and the
   `auspex` container are typed as they are. The app is Artifacts or
   Explorer in every sentence.

## Words to use and avoid

| Use | Avoid | Why |
|---|---|---|
| before you upgrade | first | "first" is ambiguous across several notes |
| by hand | from the page, not from the Updates page | the Updates page is gone; say what to do |
| add to `.env` | set, put, give | one verb for one act |
| the code step, a restore | going back (alone) | they are different acts with different losses |
| you, your server | a server, the deployment | the reader is one admin on one server |
| [open: ...] | (silence) | explain, never hide |
