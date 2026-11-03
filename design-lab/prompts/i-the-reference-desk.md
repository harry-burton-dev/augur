---
batch: 3
kind: steered
concepts: [the-object-explains-itself, consequence-preview, the-workings-show, plain-words-first]
---

# Prompt I: The reference desk. Asking data a question.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-the-reference-desk/prompt.md`.

---

The operator from batch 3 (never written a query, doesn't want to) has a
question: "which suppliers have we not heard from since spring?", "what do
we know about this port, and how sure are we?". Today the choice is a
search box that matches words or a query builder that assumes you think
in tables. Reference librarians have answered vague questions from the
public for a century, and their method is a conversation: find out what
the person actually needs, then show where the answer came from. This run
asks what **interrogating data** looks like when it works like a good
reference desk, with or without a language model behind it. Work in
`design-lab/runs/<date>-the-reference-desk/`.

## Direction
- **The question comes first, in the person's words.** The interface
  helps sharpen it ("since spring: March, or your financial year?")
  rather than demanding a precise query up front.
- **Every answer shows its workings**: which records, which filters,
  what was left out and why, so the person can check it and change it.
- **"I don't know" is an answer.** When the data can't answer, say what's
  missing and who could add it, instead of returning nothing.
- **Same answer, every time:** a question can be saved, rerun and shared,
  and says when its answer last changed.
- Explain, never hide; many deployments; calm at rest (from the brief).

## References and what to take from each
- **The reference interview** (Brenda Dervin and Patricia Dewdney's
  neutral questioning, 1986). Take: questions that find the real need
  without leading.
- **Moshé Zloof's Query by Example** (IBM, 1975): fill in an example row
  and the system finds rows like it. Take: asking by showing.
- **Ben Shneiderman's dynamic queries** (HomeFinder, 1992) and the
  FilmFinder: sliders and checkboxes that update the answer instantly.
  Take: the answer moves while you shape the question.
- **Spreadsheet filters and pivot tables**: the most-used query tool in
  the world. Take: what operators already know how to do.
- **Twenty Questions and identification keys.** Take: narrowing by a few
  yes/no steps.
- **Research on natural-language interfaces to databases** and on showing
  generated queries back to users (for example "explain the SQL" studies).
  Take: when a model writes the query, the person sees it in plain words.

## Surfaces (6 variants each)
1. **Question sheet** (grammar): question, clarification, workings,
   answer, gap, saved question; how each is set and what each must
   never claim.
2. **The ask**: one box on the Data Atlas front page that turns a vague
   question into a sharp one through a short exchange.
3. **Ask by example**: point at a record ("more like this one") or fill
   in a sketch of the row you want.
4. **The answer with its workings**: the result, the plain-words query,
   what was excluded, how sure it is, and a way to change any step.
5. **When the data can't answer**: honest gaps, partial answers, and who
   to ask.
6. **Saved and shared questions**: a question as an object you keep,
   rerun, share to a floor, and watch for changes.

Round 2: combine into 3-4 screens. One must follow a single real-sounding
question from the first vague words to a shared answer a colleague reruns
a week later.

## Questions the shortlist must answer
- What does the model gateway do here, and what must work without it
  (Data Atlas already matches by keys, names and spelling without it)?
- How does a person tell a model's guess from a fact in the record?
- What a question needs to record to be rerun honestly (the data as it
  was, or as it is now?).

## Carry from earlier runs
Read `design-lab/concepts/README.md`, especially `the-object-explains-itself`,
`consequence-preview` and `time-as-address` (a question asked at a moment).
