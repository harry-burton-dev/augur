# Grammar: critique

Two sheets that sit above the surfaces. They don't design a screen; they name
the moves and signals every screen draws from, so the surfaces stop
inventing their own.

## V1: Shot list
*Idea.* Twelve camera moves (establishing shot, rack focus, focus pull,
letterbox, match cut, dolly, iris, insert, dark cockpit, following shot, slow
push, cut on action), each with what it means in film, the one AUGUR moment
that earns it, and the tokens it runs on. Everything not on the list is a
plain cut.

*Sources.* Make It So (tropes that work), Walter Murch's "the cut should
serve emotion, story, rhythm, eye-trace", Territory Studio, avionics dark
cockpit, the shell's existing `liftGhost()` match cut.

*What works.* It turns Harry's principles from adjectives into a finite
vocabulary that can live in `docs/app-patterns.md` and in the kit as named
transitions (`rack()`, `pull()`, `letterbox()`, `dolly()`), so apps can't
improvise new motion. Most moves already have tokens; only the far-plane
values are new.

*What fails or risks.* Twelve is too many to ship at once; slow push and
iris are the most likely to feel gimmicky. Slow push (screen leaning in over
minutes) could be unsettling and needs a user test before anything else.

*Principles.* Letterbox (shot 4) and focus stacking (2, 3, 10) get a
precise place; explain-never-hide is carried by the insert shot and dark
cockpit's "nothing needs you" state.

*Needs.* Proposed tokens `focus-far-blur` (6px), `focus-far-saturate`
(.35), `focus-far-scale` (.995), `focus-far-opacity` (.55). A kit module of
named transitions.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 5

## V2: Light language
*Idea.* Harry's mockup counts with anamorphic light streaks. This makes light
the *only* signalling system: streak (count), bloom (needs you), flicker
(changed), ember (going stale), beacon (urgent, leads to the letterbox),
shadow (unavailable, with the reason), horizon (floor colour), leak
(something off-screen), glint (focus), dim (done), dark (all clear). No
badges, no red dots.

*Sources.* Harry's design mockup, Territory Studio's single alert
colour, avionics "dark cockpit", Tufte's data-ink (light is spent only on
meaning).

*What works.* It is distinctive and fits the water: the shell is already
made of light on slate. It gives every app one way to say "look here", and
"dark is calm" makes the all-clear state a feature. Shadow makes Explain,
never hide visual.

*What fails or risks.* Light alone fails colour-blind users and bright
rooms, so every signal has to carry words (rule 4 on the sheet). Bloom and
beacon loops must stop under reduced motion (they do here) and must be
capped (three blooms, one beacon). Streak length stops being readable past
about 9; above that it needs a scale break.

*Principles.* Directly serves focus pulling (bloom = pulled focus), and
the beacon is the hand-off into PDR-009's letterbox.

*Needs.* No new colours. A `Signal` part in Common with `kind` = streak,
bloom, flicker, ember, beacon, shadow; the cap rules enforced by the shell
(one beacon platform-wide).

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 5

## Ranked
1. V2 Light language: the most reusable idea of the night; it unifies what
   every other surface is doing.
2. V1 Shot list: the doc that keeps motion honest.

**What I'd build first:** write both into `docs/app-patterns.md` as two
short tables, then build `Signal` (streak, bloom, shadow first) and the four
focus-far tokens, because every other exploration depends on them.
