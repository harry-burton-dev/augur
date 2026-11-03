# Surface 2: Artifacts library and collection

The question for this surface: can a shelf of documents show age, use and staleness at a glance, using the objects already on screen and no extra column? All six pages share one sample collection of 14 documents (Security & Risk, "Access and identity") and one set of time helpers. Every name, date and count comes from the `DATA` object at the top of each page, and V4 also generates a 5,000-document department from a seed. Every mark answers "why are you like this, and since when?" in place: point at it, or focus a row and press `?`. The demo plays about 1.2 s after load, and `R` replays it.

The marks use the grammar sheet's names: **wear**, **seam**, **ring**, **stratum**, **unconformity**, **tide line**, **high-water mark**, **now line**, **stale hatch**, **distance to travel**. "Needs you" never gets a new signal. It keeps the cinematic warning outline and a beacon that sweeps once.

---

## V1: Patina shelf (`v1-patina-shelf.html`)
*Idea.* The existing list row ages in place, using three marks on things that are already there. Patina: the title's tone moves from light to muted as time since the last change grows, on a log scale. Wear: the row's leading edge looks polished in proportion to readers last month, like a worn step. Stale hatch: the row is hatched, and its meta slot says "Stale 3 months · Tom Reyes". A correction shows as a short stitched seam after the title. The demo starts with every row the same tone and lets the patina settle in over `--motion-calm`. Then one row is edited and briefly takes the now colour, and the why card opens on a stale row.

*Sources.* Hill and Hollan's read wear (the margin as a record), patina, and Open MCT's stale-data marking.

*What works.* It reads in passing and costs nothing to learn: old things are quieter, and handled things look handled. It drops into today's list row with three numbers per document. The why card ("Stale · Last change · Who · Still read", then Review now (locked, with the reason) and Ask Tom Reyes) carries explain-never-hide into time. Of the six, it is the calmest over a full working day.

*What fails or risks.* Patina and the lit path's dimming both reduce brightness, so a dimmed old row on a dimmed branch becomes too faint. Patina has to stay a colour shift (toward `--ink-muted`) and never use opacity once the lit path ships. The first draft drew the seam as a line through the title, and people read that as "deleted". It now sits beside the title as a stitched mark, but it needs words on hover to mean anything. A log age scale makes 2 days and 3 weeks look alike. An age-tone legend is required, because tone on its own is not enough for colour-blind users or bright rooms.

*Principles.* Calm: yes, nothing moves at rest. Explain, never hide: yes. Focus stacking: it conflicts with the lit-path dimming (see above). Letterbox: not used.

*Needs.* Tokens `--wear-min`, `--wear-max`, `--past-dim`, `--hatch-ink`, `--hatch-gap`, `--seam`. Data per document: last change, readers last month, review date and reviewer, and correction versions. Shell: a `Why` popover kit part (Quill).

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 5

## V2: Tree rings (`v2-tree-rings.html`)
*Idea.* The file icon becomes a cross-section, with one ring per year of the document's life. Ring width is how much changed that year, and a thin ring means a quiet year, not a problem. Dots on each ring mark versions at their day-of-year angle. A correction is a bright seam crack running out to the bark, and a rollback is a fire-scar wedge. Missing rings (dashed) are an unconformity: the years before an import with no history. The bark's brightness is read wear. A dotted arc outside the bark is the distance to the next review, one turn per year, with a green tick at now. The demo grows each glyph from the pith outward. Then the why card opens on 2024 for Encryption key management: "5 Aug Lena Park, 7 Aug Rollback".

*Sources.* Dendrochronology (ring width, fire scars, missing rings), kintsugi, and Tufte's word-size graphics.

*What works.* Age (ring count), rhythm (ring width) and damage (scars) all show in a 100 px glyph, and the glyph can be read close up, one ring per year. It is the most distinctive mark here, and the "1 + 1 = 3" shape works: a young document with one fat ring looks young.

*What fails or risks.* People have to learn to read it. At first sight the glyphs look like clocks or targets. At 100 px, one wide year swamps the rest, and the dots are tiny. A glyph has about 20 to 60 SVG nodes, which is fine in a virtualised grid but too heavy for 5,000 drawn at once. Stale shows only as the card's hatch, because the rings themselves cannot say "stale".

*Principles.* Calm: yes. Explain, never hide: yes; missing rings are drawn, not left blank. Focus stacking: neutral. Letterbox: not used.

*Needs.* Tokens `--ring-size` and `--travel`. Data: versions with word counts, version `kind` (correction or rollback), and import gaps. Kit: a `RingGlyph` component (canvas when there are more than about 200).

*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V3: Sediment (`v3-sediment.html`)
*Idea.* The collection becomes a cross-section in which height is time. Documents rest as grains in the stratum of their last change: last 7 days, 30 days, 1 to 3 months, and so on down to "older than 3 years". The strata get darker with depth, and their order is fixed, so position alone answers "how old". A grain's polish is read wear. The now line is the ground surface. Above it, the next 90 days hang as stems whose length is the distance to travel ("Review in 2 weeks · Vulnerability disclosure statement"). An empty stratum still shows, labelled "nothing changed". The library's own gap, when it was read-only during the move, is a hatched unconformity band with dates and the reason. The demo drops the grains into place. Then Encryption key management is edited: it rises to the top stratum and leaves a dashed ghost, "rested here until today".

*Sources.* Geological strata and unconformities, Open MCT's now line, and tide tables (known future events printed with the past).

*What works.* It is the clearest picture of "one direction, one now": the past is below, the future above. It replaces a sort control instead of adding a column. The ghost that a moved document leaves behind is a good way to show "what changed" without a log. It is cheap, since it is grouping plus CSS.

*What fails or risks.* Within a stratum, order is by date only, so finding a document by name means using search. With 5,000 documents the top strata are fine, but "1 to 2 years" could hold 1,200 grains, so it needs a cap ("and 1,140 more") or a step to V4. The sky band costs height on 1280×800. A green now line clashes with the You floor colour and the lit-path trail, so it needs its own token.

*Principles.* Calm: yes. Explain, never hide: strong, with empty strata and the unconformity both drawn. Focus stacking: the sky could sit on the near plane. Letterbox: not used.

*Needs.* Tokens `--now-line`, `--stratum-min`, `--travel`. Data: last change, review and archive dates, and the library's record gaps (a migration or read-only period as an event). Kit: a `Strata` layout in Quill.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 4

## V4: Whole shelf (`v4-whole-shelf.html`)
*Idea.* This variant climbs the ladder of abstraction. Rung 1 draws every document in the department as one 6 px cell on one canvas: 5,000 cells on five shelves (one per library), each shelf running from newest change to oldest. Brightness is readers last month, a diagonal is stale, warning-coloured cells need you, and dotted cells have no record. Dragging across a shelf (or pressing `1` to `5`) opens rung 2, where the same documents appear as patina rows. The demo fills the shelves in age order and then steps down into Policies.

*Sources.* Bret Victor's "Up and Down the Ladder of Abstraction", History Flow (a whole history read as one picture), and Tufte's small multiples.

*What works.* It is the honest answer to "5,000 documents". One canvas pass (5,000 `fillRect` calls) takes well under a frame, and the data is about 4 numbers per document. Shapes show at once: the stale tail at the old end of every shelf, which shelf is heavily read, and the unrecorded run in Audit evidence. It is the only variant that gives an Admin-level overview.

*What fails or risks.* A single cell cannot be read by name. Hover shows a tip, but there is no keyboard way into a single cell yet; a roving focus is needed. Canvas text and colours have to be read from tokens at draw time (done here) and redrawn on theme change. The "needs you" cells are the one place where several warnings show at once (10 in 5,000). That is acceptable only because each one is a cell, not a beacon.

*Principles.* Calm: yes, it is static after the fill. Explain, never hide: the tip and rung 2 explain, and the cells themselves do not. Focus stacking: the rungs fit near and far planes well. Letterbox: not used.

*Needs.* Tokens `--shelf-cell`, `--shelf-gap`. Data: one aggregate endpoint per scope (id, last change, readers last month, stale days, needs-you), paged by shelf. Kit: a canvas `Overview` with an accessible table fallback.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V5: Now-line almanac (`v5-now-line.html`)
*Idea.* Every row becomes a strip of time, and one now line runs down the whole shelf at about 70% of the width. Left of it is the past on a compressed scale out to 4 years: edit ticks along the top edge (height is the size of the change), seams for corrections, and read wear as a low tide along the bottom edge with a high-water mark at the peak month. A missed review is a tide line, and from there to now the row is hatched, so **how stale it is equals how long the hatch is**. Right of the now line, the known future is a dotted distance to travel ending in a diamond. The default sort is next due first, so stale items come first. The demo draws the now line down the shelf, and the hatches and travel lines appear with it.

*Sources.* Tide tables and almanacs, the Open MCT now line, and Hill and Hollan.

*What works.* It is the only variant where staleness has a length instead of a label, and where past and future sit on one scale (the prompt's high-water mark and deadline on the same bridge). Scanning down the now line answers both "what is falling due" and "what is already late". The row text stays readable because the marks sit under a scrim on the title side.

*What fails or risks.* It is the busiest page. Every row carries a small chart, which tires the eye over a day unless the marks stay very faint. The axis scale (sqrt, out to 4 years) has to be learned, and "1y" sits nearer the middle than people expect. Each row needs 12 monthly read counts. At 5,000 documents it needs virtualisation, at about 15 to 30 SVG nodes per row. It is best as a view people choose ("Due") rather than the default.

*Principles.* Calm: borderline; it is still at rest but dense. Explain, never hide: strong. Focus stacking: neutral. Letterbox: not used.

*Needs.* Tokens `--now-line`, `--tide-line`, `--travel`, `--now-at`. Data: monthly readers per document (read events), review dates, version sizes and kinds, and import gaps.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V6: Handled sheets (`v6-handled-sheets.html`)
*Idea.* Each document is a sheet with physical traces, and the traces belong to two different owners. **Your fold** is a dog-ear on documents whose current version you have read; it is private and exact. **Everyone's thumb** is a soft polish on the turning corner, from readers last month; it is aggregate and has a threshold. Foxing specks grow with years untouched. A correction is a mended seam across the sheet, and stale is a hatch and a tag. The demo is "you come back": everything changed since your last visit (19 Oct) unfolds and leaves a crease, and new documents say "new".

*Sources.* Dog-ears and foxing, conservators' visible repair, and Hill and Hollan.

*What works.* The split between personal and collective wear is the idea worth keeping. It turns a privacy rule (your reads are yours, everyone else's are counts) into visible grammar. The unfolding demo is a calm, in-place version of "what changed while you were away".

*What fails or risks.* It is skeuomorphic. Paper sheets go against AUGUR's glass and water language, and the first draft's foxing read as dirt or errors. The thumbnails are big, so only about 12 fit on a screen. The faux text means nothing; real first-page thumbnails would cost a render service. The folds are close to invisible on dark slate without the legend.

*Principles.* Calm: yes. Explain, never hide: yes. Focus stacking: neutral. Letterbox: not used.

*Needs.* Token `--fold-size`. Data: the last version each user read, kept per user (personal and not shared), plus the time of their last visit per collection.

*Score.* Clarity 3 · Distinctiveness 3 · Feasibility 4 · Fit 2

---

## Cost on a 5,000-document library
| Mark | Render cost | Data cost | Verdict |
|---|---|---|---|
| Patina tone, wear edge, stale hatch (V1) | 2 CSS custom properties and 1 class per row; virtualised, so about 20 rows are in the DOM | 3 numbers per document, computed by the server | **Cheap; use everywhere** |
| Strata grouping (V3) | Grouping and CSS; cap each stratum | Last change only | Cheap |
| Whole-shelf cells (V4) | 1 canvas, 5,000 rects, under 5 ms | About 4 numbers × 5,000, about 80 KB | Cheap; the overview |
| Seam glyph | 1 element | Version `kind` | Cheap |
| Almanac strip (V5) | 15 to 30 SVG nodes per row, virtualised | 12 monthly counts and versions per document | Medium; a view people choose |
| Ring glyph (V2) | 20 to 60 SVG nodes per tile; canvas when there are more than about 200 | All versions with sizes | Medium to high |
| Sheets with foxing (V6) | About 40 or more nodes per sheet | Per-user read version | Medium; only "your fold" is worth it |

## What AUGUR records today and what each mark needs
- **From version events the events service probably keeps already** (created, updated, published): patina, strata, rings, edit ticks, "changed since". I have not checked this against the events schema.
- **New fields:** version `kind` (correction or rollback) for seams and scars; `review.next` and `review.by` on documents or collections for stale and distance to travel; `archive` or retention dates for the future band; a record-gap event (import without history, read-only period) for unconformities.
- **New events, with privacy implications (flag for Harry):** `document.read`, aggregated per document per month as distinct readers, for wear and the high-water mark. Also a per-user "last version read" and "last visit", which only that user ever sees, for your fold and "since you were here".

## Privacy question for Harry (proposal, not a decision)
Should read wear be **counts only, per month, never names**, withheld when fewer than *k* people read it (the pages use `privacy.minReaders: 5`), with *k* perhaps rising with the floor's audience size? Your own reads would be shown only to you (V6's fold). Names would appear only when the reader has consented, for example a "mark as reviewed" sign-off. Even with this rule, a monthly count of fewer than 5 in a 42-person department can point to a person if it is combined with timing, so the rule may also need to keep counts monthly rather than daily.

## Where this conflicts with the cinematic direction
- Patina and the lit path both dim. Patina must stay a hue shift, never opacity.
- The now line in `--green` collides with the You floor colour and the trail. It needs its own `--now-line` token.
- The `Why` card is a new overlay alongside the radial menu's consequence preview. They should be one component family: "what would happen" and "why it is like this".

## Needs token (all at the top of `<style>` as `--x-*`)
`--wear-min`, `--wear-max`, `--past-dim`, `--hatch-ink`, `--hatch-gap` (the cinematic hatch gap is still open), `--seam`, `--now-line`, `--tide-line`, `--travel`, `--ring-size`, `--stratum-min`, `--shelf-cell`, `--shelf-gap`, `--now-at`, `--fold-size`. Every page also relies on `--font-mono` (IBM Plex Mono), which still needs an ADR.

## Ranked
1. **V1 Patina shelf**: the default row treatment, cheap and calm.
2. **V5 Now-line almanac**: the best way to show staleness and the future; ship it as the "Due" view.
3. **V3 Sediment**: a "Layers" view and the clearest picture of one-direction time.
4. **V4 Whole shelf**: the overview at department and Admin scale, and the answer to 5,000.
5. **V2 Tree rings**: beautiful, but people have to learn to read it; keep it for a document's About panel, not the shelf.
6. **V6 Handled sheets**: drop the paper. Keep "your fold versus everyone's thumb" as a rule.

## What I'd build first
Build V1's three marks as props on the Quill list row (`age`, `wear`, `stale: {days, by}`), plus one shared `Why` popover that every mark feeds with four lines: what, since when, why, and who can change it, with unavailable actions shown in place and the reason. The server computes the three numbers per document, so the client stays cheap at 5,000. Then add V5's stale-since hatch and distance to travel as a "Due" view on the same rows, and V4's canvas overview once a scope holds more than about 500 documents. I went beyond the ask in one place. The split between personal fold and collective wear (V6) should become the privacy rule for all read wear, so I have put it to Harry as a question rather than leaving it buried in a prototype.
