# Concepts found by this run

Reader tests are in `checks/results.md`. Every tested text, the source
included, was answered fully right, so the evidence is speed and the
doubts readers raised. Each is filed in `design-lab/concepts/` with
`track: writing`. Concepts are shared: each could steer a UI or ops run too.

## Verdict first (`verdict-first`)
Every piece of text that may ask something of its reader opens with one
of a small, closed set of verdicts (for upgrade notes: do before, by hand,
check if, nothing to do) and what undoing it costs, before any why. A
reader who stops after one line still does the right thing, and 37 notes
can be scanned by their first lines.

Evidence: one-note V1 and V2, whole-set V1 and V4, the template, grammar.
**The test didn't support it for the reader:** the card per note, built
on it, was no faster than the source (890 words per answer against 896).
It stays as the shape that gives a generated sheet its data.
Sources: the inverted pyramid, GOV.UK front-loading, the safety card's
fixed panels. Could steer: Home "what needs you", the Upgrade Centre's
Needs you list, notifications, ops runbooks.

## Every note knows its release (`the-note-knows-its-release`)
A note written before its release exists says so (`From unreleased`),
and the release fills the number in. Without it the reader's first
question, "does this apply to me?", can't be answered by any text or
filter. In the source, 34 of 37 notes have no release, because the
writer couldn't know it.

Evidence: all four whole-set variants had to mark it `[open]`;
next-note V4 and the critique found the cause. Every reader, on every
text, said they couldn't tell which notes apply to their server. Could steer: the Upgrade
Centre's filter by version, app changelogs, Mandate intents that name the
release they wait for.

## One sheet for the jump (`one-sheet-for-the-jump`)
A reader crossing many changes at once needs their actions merged by when
they act (one table of settings, one list of releases not to skip, one
table of what going back costs), not one note after another. The sheet is
generated from the notes for the range being crossed, never written by
hand.

Evidence: whole-set V3 and combined Part A: the only tested texts faster
than the source (678 words per answer against 896; Q8 at word 102
against all 6,670), with the fewest doubts. The combined reader found
every answer in Part A and none in the cards below it. Sources: the safety card's order, run sheets. Could steer: the
Upgrade Centre's plan for an upgrade, onboarding after time away, the
"back after two weeks" idea from wear and time.

## Every if has a then (`every-if-has-a-then`)
No condition without its action: "nothing to do on most servers" names
the servers that must act and what they do. Writing the text as an
if-then table is also the fastest way to find what the source never
says, which then becomes `[open]`.

Evidence: one-note V4 (two missing "thens"), next-note V3, Q5. Not
tested on its own; every reader found the 8 GB condition in every text. Sources:
the Federal Plain Language Guidelines' tables for conditions, decision
tables. Could steer: settings help, error messages, policy text in the label run's style.

## A contradiction is open (`a-contradiction-is-open`)
A rewrite that keeps every fact keeps every contradiction. Where the
source disagrees with itself (apps take "only 0.x patches" on one line and
"patch and minor releases" on another; "by hand" meaning two things), the
rewrite marks it `[open: ...]` and names who can settle it, instead of
carrying both sides.

Evidence: found by the readers, not the author: the source's reader
raised both, and the card-per-note and combined texts carried them on.
Could steer: any run that rewrites or merges existing text, Data Atlas's
disputed facts, Mandate intents that conflict.

Also used: plain words first (names in prose, identifiers in code), said
in a sentence (headings as sentences with verbs), the reader's minute
(words to the answer as the measure), context names its reader (one admin
on one server, said up front), and the honest blank (`[open: ...]`, and a list of what the text can't
tell you at the top, phrased as the reader's own questions).
