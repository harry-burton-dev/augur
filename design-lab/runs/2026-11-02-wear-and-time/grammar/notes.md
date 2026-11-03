# Grammar: critique

Two sheets that sit above the surfaces. The mark names match the prompt's
list exactly (wear, seam, ring, stratum, unconformity, tide line, high-water
mark, now line, stale hatch, distance to travel), so other surfaces can use
them as they are.

## V1: Time language (`v1-time-language.html`)
*Idea.* The ten marks, each drawn on a small stage, with what it means, its
token recipe and what it must never mean. Above them sit five rules:
**time is matter, attention is light**; **one now**; **the past is
quieter**; **every mark answers** (what, since when, who, who can change
it); **one scale**.

*Sources.* Hill and Hollan (wear), kintsugi and conservators' "visible and
reversible" rule (seam), dendrochronology (ring), geology (stratum,
unconformity), tide tables and bridge flood marks (tide line, high-water
mark), Open MCT (now line, stale data), the cinematic light language
(stale hatch has to be told apart from *shadow*).

*What works.* Splitting matter from light lets history be everywhere
without breaking "dark when normal". A mark is ink, hairline or hatch. It
never glows, so it can't compete with a bloom or beacon. Every "never
means" line is there to stop a known misreading. A ring is not a progress
ring, a high-water mark is not a target, distance to travel is not a
progress bar, and a seam is not a warning.

*What fails or risks.* The seam gold is mixed from `--warning`, so at a
glance it sits near amber, the Team floor colour. It needs its own token and
a contrast check against `--floor-team-high`. Stale hatch (45°) and shadow
(135°) differ only by angle, which is weak, so stale always carries its age
in words. Ten marks is a lot; the reader prototypes show that five
(wear, seam, stale hatch, now line, distance) cover most of what a document needs.

*Needs (tokens).* `--mark-seam`, `--mark-wear`, `--mark-wear-read`,
`--mark-tide`, `--mark-now`, `--mark-stale-hatch` (all combinations of kit
tokens), `--time-past-dim` (.62). It relies on `--font-mono` (IBM Plex Mono,
still needs an ADR).

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 5

## V2: One scale, one now (`v2-one-scale.html`)
*Idea.* One document's whole life on a single axis. The record kept is
compressed by the square root of age, then the next six months run linear.
One now line crosses every lane: edits, repairs, reviews, readers, record.
Under it, a table gives each mark's data needs, what is probably recorded
today, the new event or field it needs, its cost on 5,000 documents, and
its privacy level.

*Sources.* Bret Victor (all times at once), tide almanacs (past and future
on one page), Tufte small multiples.

*What works.* It shows that the marks compose without clutter as long as
they share a scale. It is also the honest answer to the shortlist's
questions. Most marks are cheap: a date comparison, a histogram per
document, or CSS only. Two are not: read wear (privacy) and stratum (value
history, load it only when the object opens).

*What fails or risks.* The square-root scale is right for documents (most
change is recent) but would squash a five-year org history. The scale's
range should come from the object's own record, not from a constant. The
"recorded today" column is my assumption about the events service and is
marked "to check".

*Needs.* A kit `TimeScale` (one function, shared by every strip) and a
`NowLine`. New events: section anchor on updates, `update.kind =
correction` with a reason, `review.due` with `due.changed`,
`record.started {since, reason}`, and aggregated `section.read`.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4

## Ranked
1. V1 Time language: the vocabulary every surface uses.
2. V2 One scale: the shared axis and the data and cost table.
