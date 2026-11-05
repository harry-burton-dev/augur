---
batch: 7
kind: steered
track: writing
concepts: [plain-words-first, said-in-a-sentence, the-readers-minute, context-names-its-reader]
---

# Prompt WR1: The safety card. Release notes a tired admin can act on.

Read `design-lab/tracks/writing/brief.md` first; it holds the rules, the
check and the critique format. When you start, move this file to
`design-lab/runs/<date>-the-safety-card/prompt.md`.

---

`docs/upgrade.md` in `augur` holds "Release notes that need you": about
thirty notes, newest first, each written when its change merged. An
admin upgrading from an old version has to read all of them to find the
four that apply to their server, and the steps are buried in paragraphs.
Airline safety cards are read by people who don't want to read them, in
a hurry, in any language, and they are tested on readers, not reviewed
by writers. Plain-language law and the GOV.UK style guide do the same
for government text. This run asks what AUGUR's **upgrade notes** look
like if they are written to be acted on and tested on readers. Work in
`design-lab/runs/<date>-the-safety-card/`.

## The source text
`docs/upgrade.md`, the section "Release notes that need you" and its
notes, as they stand on `main` when the run starts. Copy it into the run
as `source.md` (it is the baseline for the reader test).

## The reader (every check uses this person)
An admin on a single-server deployment, upgrading from AUGUR 0.9 to the
current release after two months away. They have the server open and
twenty minutes. They need to know which notes apply to them, what to do
in what order, and what will break if they skip a step.

## References and what to take from each
- **Airline passenger safety cards** and the research on them (for
  example Corbett, McLean and Cosper's FAA studies of card
  comprehension). Take: pictures and order over prose; tested on readers.
- **The GOV.UK style guide and content design** (Sarah Richards,
  *Content Design*, 2017). Take: start with the user's need; front-load.
- **The US Plain Writing Act (2010) and the Federal Plain Language
  Guidelines**. Take: "you", active voice, short sections, tables for
  conditions.
- **Darwin Information Typing Architecture (DITA)**: task, concept and
  reference topics. Take: a step is a different kind of text from an
  explanation, and mixing them is why notes are slow to use.
- **Keep a Changelog** and **Ubuntu's release notes "upgrade" section**.
  Take: what software already does, and where it stops short.
- **Newspaper subediting: the inverted pyramid**. Take: the whole story
  in the first sentence.

## Surfaces (4 variants each)
1. **Grammar** (`grammar.md`): action, condition, consequence, version
   range, why, and what each must never claim.
2. **One note**: rewrite the single hardest note (pick the one with the
   most steps; say which) in four forms.
3. **The whole set**: the full section restructured four ways for the
   reader upgrading across many versions.
4. **Writing the next note**: a template or rule a coding agent follows
   when it adds a note in a pull request, tested by having the reader
   test run on a note written from it.

Round 2: combine into one rewritten section plus the template, and run
the reader test on it against the original.

## Questions the shortlist must answer
- What did the reader get wrong on the original, and does the rewrite fix
  it without losing a fact?
- Should notes be filtered by "from version" (a product ask for the
  Upgrade Centre), and what would that need?
- What rule goes into `AGENTS.md` so the next thirty notes are written
  this way?
