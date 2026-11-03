# Surface 6 · From finding to action

**The moment:** Sam Okafor, depot coordinator on the North depot crew (Team floor), has a finding: *7 of 18 North depot vans are overdue for inspection, up from 2 in August.* Sam can publish it as a briefing in Artifacts, feed an intent in Mandate, or watch it for change. Before Sam picks, every variant shows the reach: who will see it, on which floors, and what they can and can't open behind it.

**Shared data, one object (`DATA`) per page:** a regional services organisation with three floors (Org 1,180 people, Fleet and Facilities Department 34, North depot crew Team 9). Behind the finding sit 68 records in six groups (18 vans, 46 inspection records, the depot log, Kestrel's October report, the servicing contract, and a restricted incident report), kept on different floors. That makes the reach uneven: Team readers can open 67 of 68, Department readers 29, Org readers 1. Every count on every page is computed from the `kept` map and the floor rule from docs/atlas.md ("a floor shows what's kept on it and on the floors above"), so nothing is typed in by hand.

**Keys on every page:** R replays, T shows the admin words (two registers), G turns the model gateway off, A accepts the model's bottom line. With G, the bottom line falls back to its template and **no number changes** (pencil and ink). A shows the pencil-to-ink change. The six ways to be empty carry over from the catalogue run: not yours to see uses the 135° hatch and a lock and names whom to ask; not known yet uses corner ticks; sources disagree uses the warning edge.

**Files:** `v1-section.html` … `v6-radial.html` are built by `_src/build.py` from `_src/common.css`, `_src/data.js`, `_src/lib.js` and `_src/v*.src.html`. The built pages link the kit as the brief says.

---

## V1: The section
*Idea.* An architectural section through the building. The briefing is placed on one floor, and its light falls through the floors under it, because a floor reads what is kept on it and above it. Each slab shows how many people on that floor can read it (Isotype figures, counted, never scaled) and a strip of the 68 records: ink cells they can open, hatched cells they can't. The same drawing shows Feed (only the intent's floor lights, owner plus followers) and Watch (only you).

*Sources.* Architectural section drawings (the cut floor plate, a light well); Neurath's Isotype (repeated figures, with a part figure cut rather than shrunk); light language "streak and bloom" from the cinematic run.

*What works.* It is the only variant where the rule "readers see their floor and above" becomes something you can see: moving a briefing up a floor lights more slabs, and their strips get more hatched. The warning "your sentences carry numbers from records most of them can't open" appears by itself when most of the strip is hatched. It answers *who* and *what they can open* in a single picture.

*What fails or risks.* The Org slab at one figure per person would be 1,146 figures, so the page switches to one figure per 20 people above 60. That breaks Isotype's one-scale-per-chart rule (the key says so, but only in a corner). 68 cells per slab is fine; a finding over 5,000 records needs the cells grouped (one cell per 10, or the overview rung). The slab order is the org chart, not the reading order, so an operator has to read from the bottom up.

*New employee test.* Partly. A manager reads "34 people can read it" in seconds, but not the cell strips: they need the legend.

*Model vs template.* The model may draft only the bottom line, shown in pencil. Slab text, counts, "kept here / reads it from", the verdict sentence and the warning are all templates.

*Principles.* Explain, never hide: strong (every hatched cell is a record that exists and is locked, never left out). Calm: the light falls once per choice and nothing moves at rest. Focus stacking: the lit slabs are the near plane. No letterbox.

*Needs.* `--x-proposed-reach-wash`; a reach query that returns people per floor and records each floor can open (see the end of these notes).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V2: Distribution list
*Idea.* The finding as a staff paper with a distribution block, in the order staff practice already uses: **For action** (an intent in Mandate and its owner), **For information** (a library in Artifacts), **Bring forward** (the registry's bring-forward (BF) diary: the paper comes back to you on a date or when something changes, i.e. a watch). The paper carries a marking banner at its head and foot that says its reach in plain words ("Readable by 34 people · up to the Department floor"). Each paragraph has portion marks: one letter per floor on the list, solid if that floor's readers can check the claim, outlined if partly, hatched if not.

*Sources.* Military staff papers and BLUF (distribution: action and information addressees); UK Government Security Classifications (banner marking at head and foot, portion marking per paragraph, here used for reach, not secrecy); civil service registry practice (bring-forward diary); office routing slips.

*What works.* The three verbs become one form, so doing all three at once is natural. The portion marks are the best per-claim reach signal in the set: the lead can see that paragraph 3 is fully checkable at Department and paragraph 5 nowhere. Managers already know the form.

*What fails or risks.* Banner markings look like security classification, and some readers will take "Readable by 34 people" as a classification level. The marks need a colour other than the protective-marking colours. "Bring forward" is an old registry phrase, so the label also says "watch for change". Floor initials (T, D, O) are fine for three floors but not for deployments with more.

*New employee test.* Yes. This is the one a manager reads correctly fastest, because it looks like the paper they already get.

*Model vs template.* The model may draft the bottom line (pencil) and nothing else. Paragraph text comes from claim templates. The banner, portion marks and slip lines are computed.

*Principles.* Explain, never hide: strong (hatched portion marks; "their copy says whom to ask"). Calm: the slip fills one line at a time once, and nothing moves at rest. No letterbox.

*Needs.* A portion-mark kit part; Artifacts would need to keep the per-paragraph basis so the marks still work after publishing.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 3

## V3: Proofs
*Idea.* Before it goes, pull a proof for each reader, side by side: the same briefing as North depot notes (Team), Fleet briefings (Department) and Board papers (Org) readers will see it. In each proof, a link they can open is ink; a group they can partly open says "some more locked, ask Jo Barnes"; a group they can't open becomes a locked hatch chip with whom to ask. Claims that rest on locked records get an edge mark. You pick the proof you mean to publish. Feed shows each intent owner's view (with the actions only *they* can take, greyed). Watch shows an example notice for each kind of watch.

*Sources.* Printer's proofs and the press check; "View as" in social network privacy settings; pencil and ink from the reference desk run.

*What works.* It is the most literal answer to "what can they open behind it", because you see the locked chips where the reader will. It brought out three rules the other variants missed: (1) **a pencil bottom line can't go out**: the proof shows a corner-ticked gap "won't go out until Sam accepts it"; (2) readers are told "some" are locked, not how many, while the publisher sees exact counts; (3) feeding the Org intent "Renew the Kestrel servicing contract" puts the finding in front of an owner who can open 1 of 68 records, which is a reason to feed the Department intent instead.

*What fails or risks.* Three columns of near-identical text is heavy: the eye has to find the differences, and the edge mark is the only help. It needs a "render as floor" view on the server (the reach per reader floor computed honestly, not faked on the client). With more than three targets it needs paging.

*New employee test.* Yes for the reach ("the Org can open 1 of 68" is obvious). It takes a manager about a minute to see that the three proofs say the same thing.

*Model vs template.* Bottom line only, and it shows in no proof until accepted. Link labels, "ask …", meters and the go-bar sentence are templates. The example notices in Watch are templates filled from the triggers.

*Principles.* Explain, never hide: the strongest of the six. Focus stacking: the picked proof is lit and the others stay sharp, which is right because you compare them. Calm: yes.

*Needs.* A server "proof as floor X" endpoint; an "evidence" view in Mandate.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 3 · Fit 4

## V4: The order in a sentence
*Idea.* The action is a paragraph you write by choosing. "Publish it as a briefing in ⟨Fleet briefings⟩. 34 people on the Department floor and under it can read it. Some can open only 29 of 68 records behind it, and their copy says to ask Jo Barnes or the Health and safety desk for the rest. Tell ⟨nobody⟩." Only the underlined words are choices. Everything else is a computed consequence in ink. Opening a choice lists each option with its reach and a small meter of what readers can open. **Moving through the list rewrites the sentence in place**, so you read the consequence before you pick. Add "Feed an intent" or "Watch it" as further numbered sentences, then press Do it once. The paragraph stays with the finding as the record of what was done.

*Sources.* BLUF and the five-paragraph order (one sentence per action, in order); said in a sentence and the catalogue's facet sentence (counts before you choose); Bret Victor's reactive documents.

*What works.* It reads aloud. It is the cheapest to build in Quill (text, a listbox, one reach query). It joins three actions without a form. The approval for Board papers becomes a plain sentence: "It waits for Priya Nair's approval."

*What fails or risks.* Long sentences: the Org case runs to four lines at 1280. The popup can cover the next sentence (it is placed under the sentence it changes, so the one you are reading stays visible). The words must be translated per deployment as whole sentence templates, not word by word.

*New employee test.* Yes. The kept paragraph is something a manager can read later and understand without having seen the screen.

*Model vs template.* All of it is templates. The model must not write the action sentence, because it is a commitment. It may only draft the briefing's bottom line, which shows in pencil on the left.

*Principles.* Explain, never hide: strong (the approval and locked records are stated in the sentence). Calm: yes. Consequence preview: the best in the set.

*Needs.* Sentence templates per action (Common), and the same reach query as V1.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V5: Flood marks
*Idea.* Watch for change as a gauge staff. One row per van (18), with overdue rows inked. Past months are cut into the wall as flood marks at the level they reached ("Jul · Aug 2", "Oct 5"), "Now 7" is a heavier line, and the December forecast is a dotted pencil mark. You paint your own marks across the staff ("Tell me above 8"), and can add a higher mark that tells your lead, which shows her floor and what she can open. A column says plainly **what makes the count move**, and which of those AUGUR can notice today. The ones it can't are drawn as unavailable, with what they need.

*Sources.* Tide gauge staffs; flood marks cut into bridges and walls; the Environment Agency's three flood warning levels (several thresholds that tell different people); Isotype counting.

*What works.* It answers the prompt's third question on screen. A due date passing overnight creates **no event**, so the watch says "it passes 8 that night, but AUGUR can't notice a date passing yet: you'd hear when the next inspection is recorded." That one sentence is the case for a clock in the events service. The example notices give one reason each ("a date passed, noticed late"; "still 7, but on a different basis: a source was withdrawn"). That is the five-reasons idea, telling a real change from a change in the evidence.

*What fails or risks.* It only covers watching. It needs V4 or V2 for the other two verbs. The staff works for a count up to about 40; past that it needs the overview rung or a scale. Marks below the current level ("tell me when back to 0") need a different control.

*New employee test.* Yes for "who will be told and when". A manager may take the flood marks for targets at first glance, but the labels fix that.

*Model vs template.* All templates. The forecast mark is the only judgement and is drawn in pencil with "likely". The "why it moved" reasons are a fixed list of five.

*Principles.* Explain, never hide: strongest on system gaps (the missing triggers are visible and say what they need). Time is matter: past levels are cut in ink and never glow; only your marks carry light. Calm: still at rest.

*Needs.* See "What watch for change needs" below; `--x-proposed-*` floor colours for marks are existing floor tokens.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V6: The radial on a finding
*Idea.* The cinematic run's right-click radial, applied to a finding. It keeps the direction contract: Publish stays at slot 2 (east), Feed takes Move's slot 3 ("put it somewhere"), and Watch takes Pin's slot 7. The new verbs have dashed rings until they are learnt. The outer ring fans out the targets (libraries, intents, kinds of watch). The hub says the reach (1,180 · Org · Department · Team). A consequence card beside it gives the floor bars (people, plus a bar of what each floor can open) and, for Board papers, explains the lock: "You can't publish here yourself… choosing it sends Priya Nair a request with this preview."

*Sources.* Cinematic radial (combined V2) and its consequence preview; marking menus (Kurtenbach and Buxton); the far focal plane (blur and desaturate, no black scrim).

*What works.* No new place to learn. The reach is in the hub, where the eye already is. A locked target stays on the ring with its lock, so explain-never-hide holds. It is the fastest for people who use AUGUR every day.

*What fails or risks.* Opening the radial over the finding blurs the finding, so the card repeats the headline. The radial is a power tool and the operator in this brief isn't a power user. The reach shown is a single number plus bars: no per-claim reach and no proofs. Its geometry needs four proposed tokens.

*New employee test.* No. A manager watching won't know what the hub number means without the card.

*Model vs template.* Templates only. The radial never shows model text.

*Principles.* Focus stacking: yes. Explain, never hide: yes (lock in place, reason in the card). Calm: yes. It conflicts with nothing in the cinematic shortlist and extends its slot contract.

*Needs.* `--x-proposed-radial-r`, `-outer`, `-hub`, `--x-proposed-plane-far-blur`, `-sat`; finding as a kind in the radial's action table.

*Scores.* Clarity 3 · Distinctiveness 3 · Feasibility 4 · Fit 5

---

## Scores

| Variant | Clarity | Distinct. | Feasibility | Fit | Total |
|---|---|---|---|---|---|
| V4 Order in a sentence | 4 | 4 | 4 | 4 | 16 |
| V5 Flood marks | 4 | 5 | 3 | 4 | 16 |
| V3 Proofs | 5 | 3 | 3 | 4 | 15 |
| V2 Distribution list | 4 | 4 | 4 | 3 | 15 |
| V1 The section | 4 | 4 | 3 | 4 | 15 |
| V6 Radial on a finding | 3 | 3 | 4 | 5 | 15 |

## Ranked
1. **V4 Order in a sentence**: the default way to act. Every choice previews its reach, and the paragraph becomes the record of what was done.
2. **V3 Proofs**: the "look as them" step one key away from V4 (a "See their copy" link per sentence). It is the clearest answer to "what can they open".
3. **V5 Flood marks**: the watch editor. It owns the honest list of what AUGUR can and can't notice.
4. **V2 Distribution list**: borrow the portion marks (per-claim reach) and the marking banner, which goes into the published briefing's header.
5. **V1 The section**: a good teaching picture for floors, and a candidate for the Org-scale overview, but too heavy for every action.
6. **V6 Radial**: keep it as the expert entry point (slots 2, 3 and 7), but it opens V4 with the target already filled, not its own card.

## What I'd build first
**The reach query first, then V4 on top of it.** Every variant needed the same three numbers per target: people who can read it on each floor, records behind it that each reader floor can open, and whom to ask for the rest. Build that once, in the gateway or Data Atlas, honouring the floor rule and restricted records. Then V4's sentence is cheap: templates over that query, a listbox, and the kept paragraph. Ship it with two rules from this run. First, **a pencil bottom line can't be published or sent**; it must be accepted first. Second, **readers are told "some" are locked, never how many**, while the publisher sees exact counts. Then add V3's proof as "See their copy" and V2's portion marks inside the published briefing. Leave V5 until the events service has a clock, and until then let the watch say plainly that it can't notice dates passing.

---

## What "watch for change" needs from Data Atlas and the events service

| # | Need | From | Why (seen in) |
|---|---|---|---|
| 1 | **The recipe is saved, not the number**: a watch stores the finding's query ("vans at the North depot whose next inspection is past its date") and re-runs it | Data Atlas | Counts must be recomputed, never cached text (V5, V4) |
| 2 | **Change events with kind, detail and floor**: `observation.recorded`, `entity.changed`, filtered by kind (InspectionEvent) and detail | Data Atlas → events | Without them a watch would have to poll |
| 3 | **A clock**: scheduled re-runs (nightly) and "date reached" triggers, because a due date passing creates no data event | events service | The biggest gap: overdue happens by time passing (V5) |
| 4 | **Silence detection**: "nothing new for 21 days" as an event, drawn as *no record* | events service | A watch that never fires might be broken (V5) |
| 5 | **Evidence events**: source withdrawn in Artifacts, disagreement settled in Triage, a guess accepted | Artifacts, Data Atlas Triage | The count can stay the same while its basis changes (V5's second notice) |
| 6 | **Evaluation under the watcher's own access**, re-checked on every run; a notice says "what you can see changed" when access moves | gateway/identity + Data Atlas | A watch must never leak what its owner can't open (V1, V3, V5) |
| 7 | **The reason with every notice**, one of five: something happened · a date passed · a source changed · a disagreement was settled · what you can see changed | events payload | Readers can tell a real change from a change in the evidence |
| 8 | **Durable subscriptions with a cursor** ("from where it left off", as Data Atlas already follows Mandate), an owner, an expiry, and the watch as a visible object others can be told about ("it's Sam's watch") | events service | A lead told by someone else's watch must know whose it is (V5) |
| 9 | **Thresholds and several marks** per watch, each with its own recipient on its own floor | events service or a small watch store | The flood-warning levels pattern (V5) |

Today Data Atlas follows bindings and withdrawals through events, so items 2 and 5 are partly there. Items 3, 4, 6 and 9 don't exist yet.

## Which text a model may write, across the surface
- **May draft, in pencil:** the briefing's bottom line, and only from the finding's claims. Every number in it must match a claim (checked by template, as the `T` line says). It can't be published, sent or attached to an intent until a person accepts it. With G (gateway off) it falls back to a template sentence, and no number on the page changes.
- **Never:** reach sentences, counts, "whom to ask", approval lines, action sentences (V4), notices and their reasons (V5), banner and portion marks (V2). These are commitments or facts, so they are ink and come from templates.

## Where this pushes back
- **Publishing a count is a disclosure.** The headline "7 of 18 vans are overdue" carries a number derived from records most Org readers can't open. AUGUR can't stop that and shouldn't, but it should say so before you publish (V1's warning). **Needs Harry's decision:** warn only, or ask for confirmation when most of the records behind a claim are closed to most readers.
- **"Some" for readers, exact for the publisher** (from the catalogue's hidden-count rule). The publisher sees exact counts because they can open the records.
- **Feeding an intent above your floor** lets an owner see evidence they can't check (Dana Whitlock opens 1 of 68). Suggest the nearest intent the owner *can* check first, and show the other with its reach.
- **Watches are private, but a mark that tells someone else is not.** A watch that tells your lead must say whose it is, and she must be able to stop being told.
- **Approval to publish on the Org floor** is shown as a policy ("set by your admin") with the approver named. That needs a library setting in Artifacts that doesn't exist yet.

## Needs token
Carried from the catalogue run: `--x-proposed-gap-ink`, `--x-proposed-hatch`, `--x-proposed-stale`, `--x-proposed-unseen`, `--x-proposed-disagree`, `--x-proposed-disagree-wash`, `--x-proposed-quiet`, `--x-proposed-type-micro`, `--x-proposed-lit`, `--x-proposed-lit-wash`.
New here: `--x-proposed-pencil` and `--x-proposed-pencil-wash` (pencil edge and wash for model text), `--x-proposed-reach-wash` (how strongly a lit floor is tinted), `--x-proposed-radial-r`, `--x-proposed-radial-outer`, `--x-proposed-radial-hub`, `--x-proposed-plane-far-blur`, `--x-proposed-plane-far-sat` (V6).
Every variant relies on `--font-mono` (IBM Plex Mono), which still needs an ADR.
