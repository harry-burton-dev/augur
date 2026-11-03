Ranked by what I'd build first. The headline: AUGUR should be **silent by default and answer rather than announce**. Of 76 events in a scripted working day, the combined language makes 33 sounds; a ding-per-event app makes 76. Listen to the day first, because it decides whether anything below is worth building.

| # | Build | Look at | Why it ranks here |
|---|---|---|---|
| 1 | **Listen to the day**: Harry plays the two-minute day with headphones, then on desk speakers, then in "open plan" mode | [A full day in two minutes](combined/v1-full-day-in-two-minutes.html) | Nobody has heard these yet. The page counts every sound against a budget and lists every event that stayed silent and why. |
| 2 | **The shell owns loudness**: apps raise a notice at a level; only the shell decides whether it sounds. Four levels, matching ADR 0044: L0 silent (info, history), L1 resolve, L2 arrival (failed has a falling contour), L3 urgent | [Sound language](grammar/v1-sound-language.html), [Test bench](grammar/v2-test-bench.html) | It keeps sound a rule, not a per-app feature. The register-led grammar ranks first: floor is pitch, family is contour and rhythm, level is note count. |
| 3 | **Sound settings**: off by default, one switch, per-category volume, reduced sound, feel profile, shared-screen mode, screen reader turn-taking | [Sound settings](combined/v4-sound-settings.html) | Sound can only ship with this, and it is the cheapest piece. |
| 4 | **Urgent heard**: everything stops, a beat of silence, then an unresolved chord. The lit lamp is the acknowledge button. Acknowledging silences it without answering, acting plays the next chord, and only resolving plays the answer | [Urgent path heard](combined/v2-urgent-path-heard.html), [Urgent V1](urgent/v1-caution-chime.html), [V6](urgent/v6-suspended-cadence.html) | It is the one moment where sound clearly earns its place, and it makes "acknowledge is not resolve" audible. |
| 5 | **Travel and reach**: browsing and travel are silent; arriving echoes only from floors where something waits; W says where you are; a Publish hold climbs from the target floor's pitch and thickens with audience size | [Travel and reach](combined/v3-travel-and-reach.html), [Floors V6](floors/v6-sonar-echo.html), [Pointer V4](pointer/v4-ladder.html) | You hear the reach before you let go, which helps prevent publishing to the wrong floor. |
| 6 | **Listen on demand**: press a key to hear a series, with limits as clicks and silence bracketed by start and end marks | [Telemetry V2](telemetry/v2-rumble-strip.html), [V5](telemetry/v5-turn-taking.html), [Ambient V6](ambient/v6-stethoscope.html) | It is real accessibility value with no annoyance, because it only plays when asked. |

**Worth keeping as options:**
- The [test bench](grammar/v2-test-bench.html) as a kit tool: it measures Brewster's checks live from the scheduled notes.
- [Spatial-led grammar](grammar/v4-spatial-led.html): sounds panned to where their sign is, with a mono test.
- [Chord stack](floors/v3-chord-stack.html): audience as the number of voices.
- [A week in two seconds](telemetry/v4-week-in-two-seconds.html), and the [scrubber with detents](telemetry/v6-scrub-detents.html).
- [Rotary detents](pointer/v1-detents.html) as an opt-in feel profile for people who want ticks.

**Not worth pursuing:**
- Any continuous bed or room tone ([Ambient V2](ambient/v2-held-chord.html), [Grammar V5](grammar/v5-room-led.html), [Urgent V2](urgent/v2-room-tone-drop.html)'s always-on tone). It breaks "dark when normal", and the [open-plan test](ambient/v5-open-plan.html) shows it fails on desk speakers: quiet enough for neighbours means you can't hear it either. Only the drop-out before urgent survives.
- Ticks on every radial direction by default: about 660 a day. Make them opt-in.
- [Compass scale](pointer/v2-compass.html), [Call and response](telemetry/v3-call-and-response.html), [Timbre families](floors/v2-timbre-families.html): clever but hard to learn.

**Where these push back on Harry's principles:**
- The cinematic run said urgent never loops. Sound needs a middle way: urgent asks three times 3 s apart, then each gap doubles (six asks in 48 s), then stops and the person on call is paged instead. It never gets louder or faster. **Needs your decision.**
- Most sounds a person hears come from their own actions (9 of 33 from the radial menu, 5 from floor echoes), not from alerts. So the Feel and Floors settings decide whether sound stays on, and they should start quiet.
- A daily budget (40 proposed) hides a busy morning. The day passes 40 by 11:20, so it needs a cap per hour too.
- Nothing may ever play on a shared screen. Shared-screen mode must be easy to reach and automatic when the screen is presented, if the browser can tell.

**Decisions for Harry** (none taken):
1. Should AUGUR have sound at all? If yes, an ADR for a shell sound layer (Web Audio, no files) and `--sound-*` tokens.
2. The urgent repeat schedule above.
3. Daily and hourly sound budgets.
4. Whether an org can set default sound settings, and who (Deployment Admin?).

**Gaps:**
- `--sound-*` tokens: base pitch per floor, envelope times, gain ceiling, limit pitch (G5, 784 Hz). Each surface's notes list its set. A token check is needed so no other sound lands on the limit pitch (the Department echo did).
- A reduced-sound preference, separate from reduced motion.
- A screen reader turn-taking rule: AUGUR's sounds never overlap speech.
- An "urgent" flag on notices (ADR 0044 has levels but no urgent).
- Knowing whether you are waiting on something, so the "who is waiting" rule can decide what sounds.

**Data AUGUR doesn't have yet:** per-person "waiting for" links (a watch or follow); audience size for each floor and share target; whether a screen is being presented.
