# Combined V4: Sound settings (`v4-sound-settings.html`)

Sources: `_src1/` (engine.js shared with V1, v4.data.js, v4.js, v4.html).

## V4: Account › Sound

*Idea.* The Sound section of the shell's Account area. It is the one place
where a person decides what AUGUR may say out loud. It opens with **one switch,
Off** (the org default), and "Click to enable sound". Below that are six kinds
of sound (Urgent, Needs you, Done, Floors, Touch, Data). Each row has its own
volume, an **Audition** button (keys 1 to 6), a score of exactly what it
plays, its visible sign, and a line on when it fires. Then come Reduced sound,
**Feel** (None / Quiet hand / Detents, with sounds per day), **Where you are**
(Desk / Open plan / Shared screen, Shift M), **Show captions on screen**, and
**Screen reader** (Sound, then words / Words only / My screen reader plays
charts), with lanes that show AUGUR stepping aside. A right rail holds "Hear
it" (caption strip and score of the last audition), the org's defaults beside
yours, who can change them, and yesterday's numbers, which link to V1.

*What it combines.* Grammar V1's six families and floor register (the scores
are the same `seq()` output V1 plays). Ambient V4: Done only for your own work
within 15 minutes, needs-you held while you type. Ambient V5: the three rooms
and their rules. Pointer V6: Quiet hand as the default Feel, the Delete edge
"learnt, silent now" with "Hear it again", Detents at about 660 a day. Pointer
V3: feel as a setting. Floors V6: echoes from other floors as a sub-switch,
default off, with the reason. Telemetry V5: the turn-taking choices and their
honest limits. Telemetry V2: the Data row's house note, drawn red on its score.

*Explain, never hide, control by control.*
- Every control has an org tag: "Northwind default", or in blue "changed from
  Northwind's Desk". The rail table shows the org value beside yours.
- **One lock, shown properly.** Urgent volume can't go below 50% while sound is
  on. The row says why (Northwind security), who set it (Ana Ruiz), who can
  change it and where (Ana Ruiz or Tomas Berg, Admin › Sound), and what you
  can still do (turn all sound off; the Letterbox always shows). The slider
  stops at 50% without hiding it.
- A row that is silent in use stays visible and is dimmed, with the reason
  inline ("silent in use · Reduced sound is on"). It can still be auditioned,
  and the audition says "you won't hear this in use".
- In Shared screen, Audition buttons stay visible but disabled, with the
  reason: "an audition would reach the meeting. Captions only". Captions are
  forced on and the switch says why.
- Things AUGUR can't know are said plainly: where you are, whether you are
  sharing, whether a screen reader is speaking. All three are settings, not
  detection.
- Mute is separate from Off: it silences everything at once for a call and
  keeps the settings.

*What works.* Turning sound on is a decision you can make after hearing it:
auditions play once on click, even while sound is off (the click is the
gesture). The scores make the language visible. Pitch rising towards Org and
the red house note can be read without sound. The page names the whole
vocabulary in six rows, which is the strongest test that the language is small
enough. "About 30 a day" against "about 660 a day" settles the ticks question
for most people without an argument. The defaults table gives the admin model
(org default → personal override → lock with a named reason) a shape for
Admin › Sound to mirror.

*What fails or risks.*
- It is a long page: six rows and four option groups. The volume sliders may
  be unneeded detail. Most people want Off / On / Reduced, and per-category
  volume could go behind "More".
- Volume per category invites people to turn Urgent down, hence the lock, and
  a lock on a personal setting is a policy decision (ADR, PDR).
- "Where you are" relies on people remembering to switch. Shift M helps, but
  someone will forget before a demo. A meeting-aware default would need
  calendar data the shell doesn't have.
- At 1280 the rail table wraps tightly. The score column drops below 1400 px,
  which hides the visual twin there.

*Principles.* Explain, never hide: strongest of the run. Calm: nothing plays
or moves without a click. The page's only automatic motion is the 1.2 s
highlight of the Needs you row. Letterbox: referenced (Urgent's sign), not
shown. Focus stacking: not used.

*Needs.* The same `--sound-*` tokens as V1 (see notes-v1.md), and `--sound-lock-urgent-min`
as an org setting rather than a token. *Data the shell lacks:* per-person
sound settings in identity, org defaults and locks with who set them and why,
learnt state per sound, yesterday's sound count (from the events service), a
radiogroup and switch component in the kit (Aerie), and an Admin › Sound page.

*After lunch.* Not applicable as a page. The settings it makes, Quiet hand,
Desk, echoes off, give the V1 day: on.

*Screen reader clash.* Low. The page does what it describes. Each audition's
words reach the live region after the sound plus `--sound-turn-gap`. The
option cards are real radiogroups with arrow keys. Audition buttons name their
key.

*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 5
