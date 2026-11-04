# Surface 2 · Home "what needs you" as a strip bay

**The moment:** it is Tuesday 3 Nov, 10:40. Amara Osei, a repairs coordinator on the Repairs North team, holds five things: an overdue intent, a disputed fact, an approval waiting for her initial, a share request, and a fact she has offered up to the data steward that hasn't been taken. Two more are on their way to her: Tom Reyes is offering her his gas certificates because he is off from tomorrow, and an asbestos register comes to her after Dev Kapoor. One failed sync, held by Mo Haddad, has been pointed out to her. Every variant shows the same eight things.

**Keys on every page:** R replays; each page lists its own keys at the top right. The moment plays about 1.2 s after load. Reduced motion swaps every movement for a quick crossfade.

**Files:** built from `../_src/home/v*.src.html` with the shared `data.js`, `lib.js` and `common.css`.

---

## V1: The strip bay
*Idea.* Home is a rack of strips in three bays: **you hold** (in time order), **coming to you** (not yours until you take it), and **pointed out to you** (someone else's). Pressing C cocks a strip: it steps out of line by one fixed distance and shows your note ("ring Helen before 14:00 about a new date"). The right pane is "the back of the strip": what it is, who holds it, its marks oldest first, and the three acts (open, cock, hand over). An act that isn't yours stays visible and says why.

*Sources.* Flight progress strips and strip bays; MacKay 1999 (cocking as a reminder).

*What works.* The three bays answer "what is mine?" before anything else, which most inboxes never do. Cocking is the best paper gesture in the run. It is a reminder that costs one key, needs no due date or priority, and shows by position alone. Nothing reorders while you work: new strips join the bottom bay until taken. "It isn't yours yet: read it back to take it" is the explain-never-hide line for a disabled Hand over.

*What fails or risks.* Strict time order puts an overdue intent first for days. That is honest, but it wears a groove; the cock helps. Some deployments will have 40 things in "you hold", and the bay then needs the overview rung (count by kind, then strips). A cock lasts until you uncock it, so stale cocks pile up; it may need a quiet "cocked 3 days ago".

*Principles.* Dark when normal: yes. Nothing moves at rest, and a cock is a still offset. Explain, never hide: strong. Focus stacking: not used; the back of the strip is a second pane, not a nearer plane. Letterbox: untouched (urgent items still take it).

*Needs.* `--x-proposed-cock`; `holder`, `offer`, `point_out` and private `cock` records (grammar V6).

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V2: Beside you
*Idea.* Your bay, and to its right the bays of the people you work with, just as sharp. A changeover lane between them shows a strip in transit: Tom offers his certificates, the strip leaves his bay dashed with "→ AO", crosses the lane and waits in yours. Grace's bay says she is off sick and holds a job due today.

*Sources.* MacKay 1999 (controllers read neighbours' strips out of the corner of an eye); Wears and Perry 2007 (status boards for coordination between groups).

*What works.* It is the direct case against blur (grammar V5). You see the handover coming before it arrives, and you see that Grace's leak trace is due today and has nobody. The neighbour bays are read-only and say so.

*What fails or risks.* Showing colleagues' work on Home crosses into *mine versus ours*: some deployments won't want everyone's load visible. It needs a rule (for example, your own team only) and a setting. At 1280 the neighbour column truncates. With eight people the column becomes a second board.

*Principles.* Argues against focal planes for shared work. Explain, never hide: strong. Calm: one movement per handover.

*Needs.* Presence (in, out, off) and team membership on Home; a privacy rule.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V3: On the clock
*Idea.* Position is time. Strips hang in fixed columns (past its time, today, tomorrow, this week, later) either side of a still now line. A cocked strip stands proud of its column. A footer counts held, offered, coming and pointed out.

*Sources.* Strip boards ordered by estimate; the wear-and-time run's one time scale and now line.

*What works.* "When is it due?" becomes a place, so the badge goes. The columns are fixed and only change when a day turns over, which keeps it calm. Ownership is carried by outline: solid is yours, dashed is offered, faint is someone else's.

*What fails or risks.* Five columns at 1280 give each strip about 220 px, so titles wrap to three lines. Holder is less legible than in V1 (initials only), and the three-bay split is lost. Columns by time duplicate the team board's levelling box (board V4).

*Principles.* Calm: yes. It agrees with *one now*.

*Needs.* Nothing beyond V1.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V4: Pigeonholes
*Idea.* A rack of holes, one per kind of thing by time. Empty holes are spare room. A meter shows "5 of 6": the limit is yours to set. Taking Tom's certificates drops a slip into its hole and fills the sixth slot. When full, offers still arrive and wait beside the rack, telling the giver you are full.

*Sources.* Post-room pigeonhole racks; T-card slots; WIP limits.

*What works.* Capacity you can see for one person: "you can take one more" is a fact, not a feeling. "Nothing is refused for you" is the right rule: a full rack informs the giver, it doesn't bounce the work.

*What fails or risks.* Most holes are empty most of the time, so the grid is mostly air. Kind by time duplicates V3 with worse density. A personal limit can turn into a target managers watch. The limit must stay the person's own, and never show on the team board unless the team sets one (board V1).

*Principles.* Explain, never hide: "full" is said, never enforced by hiding. Calm: yes.

*Needs.* A personal `slots` setting.

*Scores.* Clarity 3 · Distinctiveness 3 · Feasibility 4 · Fit 3

## V5: The desk top
*Idea.* Your own arrangement. You drag strips into piles you label ("Elm Court, this week", "to sign"). AUGUR never tidies; it only puts new arrivals in the in-tray. Holding L lays everything out in time order for a moment, without moving anything.

*Sources.* Sellen and Harper (layout as memory); Malone 1983 ("piles" versus "files").

*What works.* It is the most paper-like, and the in-tray rule (the system adds, never rearranges) is worth keeping on its own. L for a time-ordered view, while your arrangement survives, is a good pairing.

*What fails or risks.* This is skeuomorphism for its own sake. Free placement fails keyboard users (arrow keys move by small steps, which is slow), screen readers (spatial meaning has no reading order), and anyone with 30 items. It needs a stored layout per person. Malone found piles work for a while and then become a burden: the same will happen here.

*Principles.* Calm: yes. Explain, never hide: piles can bury things, which is the risk.

*Needs.* `desk_layout` storage.

*Scores.* Clarity 2 · Distinctiveness 4 · Feasibility 2 · Fit 2

## V6: The printed board
*Idea.* The expert layer. Strips print as fixed-width mono lines with marks in a fixed shorthand: ↳ cocked, →TR offered to, ⇠TR offered by, ◌DK after, ◉MH pointed out by, ✓DK initialled, +3D22H past its time. A command line takes "c 207", "h 207 tr", "i 118".

*Sources.* Strip printers and controllers' fixed shorthand; the cinematic run's "dense brief".

*What works.* It is the fastest for someone who works all day in it, and the shorthand is a closed list for every deployment. Each mark also stays a sentence on the strip's back.

*What fails or risks.* It relies on IBM Plex Mono (still needs an ADR). The shorthand has to be learned and fails a new starter. Uppercase titles are harder to read. It is an option, not a default.

*Principles.* Calm: yes. Explain, never hide: the key is always visible.

*Needs.* `--font-mono`; a command palette hook.

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 4 · Fit 3

---

## Ranked
1. **V1 The strip bay**: three bays, time order, cock, back of the strip.
2. **V2 Beside you**: for team-scoped Home, once the privacy rule is settled.
3. V3 On the clock.
4. V6 The printed board (expert option).
5. V4 Pigeonholes.
6. V5 The desk top (keep only "the system adds, never rearranges").

**What I'd build first.** V1 as Home's list, using the strip part from grammar V1: three bays, strict time order, C to cock with a private note, and the back of the strip as the side pane. From V5, keep the in-tray rule: AUGUR adds strips, it never rearranges them while you work. V2's neighbour bays wait for Harry's decision on showing colleagues' work.
