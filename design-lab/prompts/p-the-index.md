---
batch: 4
kind: steered
concepts: [the-workings-show, the-record-has-edges, plain-words-first, mine-versus-ours]
---

# Prompt P: The index. Finding anything across AUGUR.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-the-index/prompt.md`.

---

Batch 4 is about the platform underneath the screens: the services every
app relies on. These prompts are not about styling. Each asks how a
platform behaviour (who may do what, who is told, what is found, what an
agent may do, how settings and usage work) should behave, and how a person
sees and steers that behaviour. Prototypes may be behaviour models,
simulators and service blueprints as much as screens.

Each app keeps its own records: documents in Artifacts, intents in
Mandate, entities in Data Atlas, apps and people in Admin. A person
doesn't care which app holds a thing; they want to find it. This run asks
how **search across the platform** should behave: what is indexed, what a
result says about where it lives and whether you may open it, what search
could not look at, and how finding things and doing things (a command
palette) meet. Professional indexers and librarians have rules for this
that most search boxes ignore. Work in `design-lab/runs/<date>-the-index/`.

## Direction
- **One place to look, honest about its reach:** results say which
  apps and floors were searched, and which weren't, and why.
- **Results respect access without lying:** what you may not open is
  either left out (if you may not know it exists) or shown closed with
  who to ask (explain, never hide).
- **See also:** results lead to related things across apps (a document,
  the entity it is about, the intent it serves).
- **Find and do:** a result can be acted on in place.
- Many deployments; calm at rest (from the brief).

## References and what to take from each
- **Back-of-book indexing** (Society of Indexers; ISO 999): headings,
  subheadings, locators, "see" and "see also". Take: a curated layer over
  raw matches.
- **Concordances and thesauri** (preferred and non-preferred terms).
  Take: one term leading to the words people actually use.
- **Library union catalogues** (many libraries searched as one, holdings
  shown per library). Take: one search, many holders.
- **Command palettes and launchers** (Spotlight, Alfred, Raycast). Take:
  verbs and nouns in one box.
- **Information foraging theory** (Pirolli and Card): scent and patches.
  Take: results that show how close you are.

## Surfaces (6 variants each)
1. **Index sheet** (grammar): heading, locator, see, see also, holder,
   reach, closed result; plain words for each.
2. **One search across apps**: results grouped by holder, with reach
   shown.
3. **Closed results**: what may and may not appear when you lack access.
4. **See also**: a result opening onto its links across apps.
5. **Find and do**: the command palette as a verb-and-noun index.
6. **The curated index**: a floor's own index terms, kept by a keeper.

Round 2: combine into 3-4 screens. One must show the same query run by two
people on different floors, with different results, both honest.

## Questions the shortlist must answer
- What a platform search service would need from each app (a manifest
  contract? domain events?) and whether it needs an ADR.
- Which established open-source search engine fits (adding one needs an
  ADR), and how permissions are enforced at query time.
- How search agrees with the reference desk run (I).
