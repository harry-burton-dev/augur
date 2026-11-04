# Design lab

Exploratory design research for AUGUR: prompts, the runs they produced, and
the concepts that steer what we explore next. Nothing here ships. Ideas move
into the product through the usual path: a Proposed record or an entry in
`docs/app-patterns.md`, then a kit change in its own PR.

```
design-lab/
  brief.md        rules every run follows (read first)
  keywords.md     keyword bank: fields, search terms and seed sources for new prompts
  _kit/           tokens.css (from the repo tokens), Lucide icons, screenshot and gallery scripts
  concepts/       high-level concepts found by runs; README.md is the index
  prompts/        the ready queue: prompts waiting to be run
  runs/<date>-<slug>/
    prompt.md     the prompt as it was run (moved here from prompts/)
    concepts.md   the new concepts this run found
    SHORTLIST.md  ranked build order, gaps, push-backs
    index.html    gallery; one folder per surface with prototypes and notes.md
```

## The loop
1. **Pick** a prompt from `prompts/`. Steered prompts first, unless Harry
   asks for the wildcard.
2. **Archive it on use:** `git mv prompts/<file>.md runs/<date>-<slug>/prompt.md`
   in the run's first commit, so every prompt sits next to its output.
3. **Run it** following `brief.md`: grammar sheet, six variants per surface,
   critiques, gallery, a combining round, `SHORTLIST.md`.
4. **Harvest concepts:** write `runs/<run>/concepts.md` with the new
   high-level concepts the research turned up (ideas bigger than one
   prototype, that could steer a whole future run). Add or update one file
   per concept in `concepts/` and its row in `concepts/README.md`.
5. **Refill the queue:** keep at least four prompts in `prompts/`. When it
   drops below four, write the next **batch**: three or more steered prompts,
   each naming the concepts it pushes, plus **one wildcard** (see below).
   Number batches in each prompt's front matter. Find fields and search
   terms in `keywords.md`, mark the rows you use, and add new rows the
   research turns up.
6. **Report**: one summary to Harry with the gallery, the shortlist and the
   new concepts.

## Prompt front matter
```yaml
---
batch: 1
kind: steered        # or wildcard
concepts: [history-as-material, honest-blank]
---
```

## Wildcards
Every batch carries one wildcard so the lab doesn't only dig where it has
already dug. A wildcard must come from a field no earlier prompt has drawn
on, may ignore or deliberately argue against an existing concept, and is
still grounded in a real practice with real references. If a wildcard run
turns up a strong concept, the next batch steers on it like any other.

## Runs so far
| Run | Prompt | Result |
|---|---|---|
| [2026-11-02 cinematic](runs/2026-11-02-cinematic/) | cinematic and instrument-panel UI | 42 prototypes; shortlist led by the light language, focal planes, radial menu, urgent path |
| [2026-11-02 wear and time](runs/2026-11-02-wear-and-time/) | history as a material | 42 prototypes; shortlist led by one time scale and now line, visible repairs (seams), "why, and since when?" in place, back after two weeks |
| [2026-11-03 room tone](runs/2026-11-03-room-tone/) | sound as a calm second channel | 39 prototypes; silent by default, answer rather than announce: 33 sounds in a 76-event day, urgent as an open question, hear the reach before you publish |
| [2026-11-03 the catalogue](runs/2026-11-03-the-catalogue/) | data structure people can read | 40 prototypes; six ways to be empty, statements for one record, a sentence of facets over a table of one kind |
| [2026-11-03 the reference desk](runs/2026-11-03-the-reference-desk/) | asking data a question | 40 prototypes; pencil and ink (a model never enters a count), draft first and ask only what changes, the answer has a base |
| [2026-11-03 the briefing](runs/2026-11-03-the-briefing/) | from data to a decision | 40 prototypes; same digits at every height, confidence worked out by rule, question not chart |
| [2026-11-03 the apprentice](runs/2026-11-03-the-apprentice/) | agents that work alongside people | 40 prototypes; works under someone, standby and go (silence is not a go), trust changes the sample not the signature, mistakes have siblings |
| [2026-11-03 the switchboard](runs/2026-11-03-the-switchboard/) | who is told, how, and when | 40 prototypes; the route is a trace, four classes with news waiting for an edition, taken not seen, returned to sender |
| [2026-11-03 the minute](runs/2026-11-03-the-minute/) | decisions and actions as outputs | 40 prototypes; words fixed with status beside them, actions as open questions, agreed in the room, revisit lines, the wake |
| [2026-11-03 the label](runs/2026-11-03-the-label/) | governance you can see on the data | 40 prototypes; a label on every value worded by policy, the strictest part wins and says why, said another way, four kinds of no, enforce what you can see |
| [2026-11-03 paper and the desk](runs/2026-11-03-paper-and-the-desk/) | wildcard: work you can pick up and hand over | 40 prototypes; someone holds it, the readback moves it, say what you sign for, shared work stays sharp (argues against blur on others' work) |
| [2026-11-03 mise en place](runs/2026-11-03-mise-en-place/) | turning raw data into something usable | 40 prototypes; raw and kept, stop don't guess, the pass balances against the file's own total, rehearsed to the pass |
| [2026-11-03 the situation](runs/2026-11-03-the-situation/) | from data to information to context | 40 prototypes; the working set of links with rung, lift, reason, reader and holds-while; stale when a condition breaks; the set is the handover |
| [2026-11-03 the analyst's bench](runs/2026-11-03-the-analysts-bench/) | thinking tools for people who aren't analysts | 40 prototypes; one technique at a time by rule, hedged below the bar, judged by what doesn't fit, the model widens never narrows, keep the score |
| [2026-11-03 the annotated game](runs/2026-11-03-the-annotated-game/) | wildcard: judgement marked by people, after the fact | 40 prototypes; people mark moves and records mark positions, judged as it stood, own moves first, record the way back now, the opening book |
