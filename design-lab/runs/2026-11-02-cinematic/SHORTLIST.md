Ranked by what I'd build first. Each step makes the ones after it cheaper. Round 2 screens are what each idea should look like when it ships; round 1 pages are where they came from.

| # | Build | Look at | Why it ranks here |
|---|---|---|---|
| 1 | **Light language + focus planes**: the kit signals (streak, bloom, shadow, beacon) and four named focal planes with their tokens | [Light language](grammar/v2-light-language.html), [Focal planes](focus/v1-focal-planes.html) | Every other idea uses them. It is small, needs no new colours, and makes "dark is calm" and "explain, never hide" visible everywhere. |
| 2 | **The right-click radial menu**: 8 verbs in fixed directions, an outer ring of targets, a preview of what changes, hold to confirm Delete, unavailable actions in place with "Ask &lt;owner&gt;" | [Artifacts in focus](combined/v2-artifacts-in-focus.html) (from radial V1, V5 and V6) | Harry asked for it to be right. Fixed directions build muscle memory, and the consequence preview is the strongest new idea of the night. |
| 3 | **The urgent path and Letterbox**: the ribbon phrase becomes the headline, the edge rules close into the 2.39 bars, four-part explanation, acknowledging is not resolving | [Urgent path](combined/v3-urgent-path.html) (from alerts V1, V5, V6, V2; telemetry V4, V5) | This is PDR-009 built properly. The bars carry information instead of being empty, and nothing is hidden. |
| 4 | **Lit path navigation**: open in place, a lit trail, path folders stick to the top as the breadcrumb | [Lit path](focus/v2-lit-path.html), inside Artifacts in focus | It is the cheapest focus idea, the most distinctive, and fits every app with a tree. |
| 5 | **Home, "what needs you"**: three depth planes, an "If you wait" line on each item, a briefing once per session | [Home](combined/v1-home-day.html) (from home V2, V5, V1) | It is the strongest screen, but it depends on data apps don't send yet (limits, consequences, ranking), so it comes after the parts. |
| 6 | **Floor control and travel**: tape mark with waiting counts, car-panel picker, ping travel, a title that sharpens on arrival | [Floor travel](combined/v4-floor-travel.html) (from floors V1, V2, V3, V5) | It is clearer than today's gauge. It needs waiting counts per floor, a new cross-floor query. |
| 7 | **Sparkline sentence ribbon**: one quiet line of words with tiny charts, still at rest | [Sparkline sentence](telemetry/v4-sparkline-sentence.html) | It is calm, cheap, and the best ambient telemetry. It is ready whenever events are. |
| 8 | **Shot list** as a page in docs/app-patterns.md | [Shot list](grammar/v1-shot-list.html) | It keeps motion honest: twelve named moves, and anything else is a cut. |

**Worth keeping as options:**
- [Closing aperture](alerts/v4-countdown.html): the letterbox narrows as a deadline nears. It extends PDR-009, so it needs a Proposed record first.
- [Dense brief](home/v4-dense-brief.html): a keyboard-first mode for power users.
- [Light and parallax](focus/v5-light-parallax.html): the low-power fallback for blur, about 35 to 40% cheaper.
- [Marking menu](radial/v2-marking.html): flick gestures as the expert layer of the radial menu.

**Not worth pursuing:**
- [Tick tape](telemetry/v1-tick-tape.html): it moves all the time, which breaks "dark when normal".
- [Patch bay](floors/v6-patch.html), [Console](home/v6-console.html) and [Rotary dial](radial/v3-rotary.html): memorable but slow, and they don't scale.

**Where these push back on Harry's principles:**
- Run the briefing once per session, not on every visit.
- An urgent letterbox shouldn't dismiss itself.
- Open the letterbox on arrival at a floor only when something urgent waits there.
- Let an item lift itself into focus only after a pause in typing, and only once per session.
- Blur costs grow with screen area, so blur one wrapper per plane, never each element.
- Light alone fails colour-blind users and bright rooms, so every glow carries words.
- Use Alt+PgUp/PgDn for floor travel, because PgUp/PgDn already scroll documents.

**Gaps every surface hit** (each a decision or a small PR):
- `--font-mono`: every page relies on IBM Plex Mono. It is a new font, so it needs an ADR.
- Focus-plane tokens: blur, saturation, dimming and scale for each plane, plus `--motion-rack` and `--motion-pull`. The full proposed set is in [the focus critique](focus/notes.html).
- A hatch pattern for stale, locked and unavailable states.
- A unitless letterbox ratio CSS can use, or a bar-height token.
- A separate token for "how long a card stays readable". Reduced motion currently cuts it to nothing along with the animation.

**Data the shell doesn't have yet:**
- for each item: level, limit time, "If you wait" consequence, acknowledged state;
- for each unavailable action: the reason and its owner;
- waiting counts for every floor;
- audience size for each floor;
- which documents and facts depend on which (for Delete's preview);
- a rule for ranking items across apps.
