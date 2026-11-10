# Knowledge that stays the worker's: a hybrid knowledge engineering architecture, built as AUGUR

White paper plan (structure, section summaries and golden thread; not the full prose). 10 Nov 2026. Read from augur main at ee77d16, augur-mandate main at c0dd1b5, the Decision register as checked 10 Nov 06:49Z, the Knowledge Map (claude.ai artifact KJD59DD1kedQAzrNAU3DAH, live table), the CommonKADS audit (Drive 1eZUZ1P1hxbosZpF8319jDs_pXzdzCmYieBvotJMSTqQ), D1 methods (1oqIrlhvLSTd2eeD0Pm7nVepcQ0LrqU4U5fvCGZrlEEE) and F1 synthetic fieldwork (1qFxTwmxfw8YAk_UkZOIaYMK17cJ4dIRLfH6iLYmWkBY).

## One screen

**What the paper is for.** To let the sponsor and architects in the author's organisation decide whether to adopt AUGUR as the place their knowledge work happens. It argues one thing and shows the build.

**The sponsor's decision, framed in the paper's opening box.**

| Option | What it means | What it costs | When it's right |
| --- | --- | --- | --- |
| A. Adopt for a bounded phase (recommended) | Run AUGUR on one deployment for one team's weekly planning task: synthetic first, then a real pilot once the tests in section 8 pass | One server, one admin's time, a model provider account (sizing to be measured, section 9) | The tests in section 8 pass on synthetic work |
| B. Wait | Watch until the reasoning layers (methods) and permissions are running | Nothing now; knowledge stays where it is | Section 8 tests fail or are unclear |
| C. Don't adopt | Keep current tools | Nothing now; the formalise-first problems stay | The organisation won't let AI write even claims |

**Reader.** Primary: a sponsor (non-technical, owns the decision) and the organisation's architects (will judge whether it is sound and operable). Secondary: a knowledge engineering reader who will test whether the theory is honest.

**The one claim.** Classic knowledge engineering had the right model of knowledge work and failed at the points where people had to formalise what they knew in advance. AI can now do that formalising, but only safely if the worker's own record stays primary, AI output stays a claim until people on the right floor hold it, tasks carry intent rather than a fixed method, and the domain records itself as events. AUGUR is a working build of that architecture: most of its context and domain layers exist in code, its reasoning layers are designed, and its META layer is the open frontier.

**Plain words the paper uses (glossary, page 2 of the paper).** Record numbers (ADR, PDR) and map codes (P1, K6) stay out of the body text and appear only in the appendices.

| Term | Plain meaning |
| --- | --- |
| Floor | A group that decides together what it holds true: you alone (your personal floor), a team, or the whole organisation. A trust boundary, not a folder. |
| Steward (the code calls it a settler) | A person on a floor whose job includes deciding which claims the floor holds. One per team floor is enough to start; any member with the right position can be one. |
| Source | The worker's own words (a report, a note, a conversation). Referenced, never copied or rewritten. |
| Observation | One claim the AI extracted from a source, with the exact quote it came from. It can't be edited. |
| Faithful check | A person who didn't write the source confirms the quote really says what the observation claims. It proves the words exist, not that the reading of them is right. |
| Belief | What a floor has decided to hold, resting on one or more observations. |
| Retain, raise, reflect | Retain: extract observations from a source. Raise: propose a belief to a floor. Reflect: compare beliefs and show disagreements. |
| 'Asked' fallback, candidates | When the AI can't fit a claim to the floor's vocabulary, it keeps it as an open question ('asked') or proposes a new term (a candidate) for a steward to accept. |
| Modality, two clocks | Modality: whether a claim is a fact, a plan, a wish or a doubt. Two clocks: when something was true in the world, and when the system learnt it. |
| Domain event, outbox | A short notice that something changed ("plan 12 was approved"), carrying ids, not content. The outbox writes it in the same step as the change, so none is lost. |
| Intent | How a task is given: purpose, end state, constraints, restraints and freedoms, not a script. |
| Method | A reusable way of doing a task that an AI or a person follows, with named roles. Designed, not built. |

**Decisions box for the author (reversible, recommended option first).**

| No. | Decision | Recommended | Other options |
| --- | --- | --- | --- |
| W1 | Primary reader | Sponsor and architects in your organisation | KE academics (a paper), the public (a manifesto) |
| W2 | Length of the finished paper | 12 to 16 pages plus appendices | 6 pages (brief), 30+ (report) |
| W3 | How much theory | One section on classic KE, one on CommonKADS, cited, no worksheets | Full CommonKADS walk-through |
| W4 | How limits are shown | Their own section, before the C4, using the map's empty and partial nodes | Footnotes |
| W5 | Name of the approach | "Hybrid knowledge engineering" (the author's words) | "AI-filled CommonKADS", a new coined name |
| W6 | Use "steward" in the paper for the code's "settler" | Steward | Keep "settler" and define it |
| W7 | Add a one-page "What works today" before section 1 | Yes (all three cold readers asked for it) | Fold it into section 10 |

## The golden thread (Minto: situation, complication, question, answer)

- **Situation.** Organisations run on knowledge that lives in people and in what they write. CommonKADS (Schreiber et al., 2000) gave the clearest model of that work: who does it (organisation, agent), what it is (task), and how it is reasoned (domain, inference and task knowledge).
- **Complication.** In practice, knowledge engineering stalled wherever people had to formalise first. Experts couldn't say what they knew; schemas forced their knowledge into boxes and replaced their own record; methods designed in advance broke on real work; rule bases became unmaintainable; knowledge bases held one timeless truth; and nobody saw the work as it was actually done. AI removes the cost of formalising, but adds a new failure: confident output nobody can trace.
- **Question.** Can an organisation keep CommonKADS's discipline (knowledge you can inspect, reasoning you can explain) while letting AI do the formalising, without losing the worker's record or the floor's authority over what is true?
- **Answer.** Yes, on four principles and one added layer. The principles: the worker's record stays primary and extraction is derived (P1); a task carries intent, not a designed method (P2); the domain is event driven (P3, PDR-025); and AI writes observations while people on a floor hold beliefs (P4, PDR-022). The added layer is META: the system watches the work as done and proposes changes to its own methods and terms. AUGUR builds this, and its C4 shows where each part runs.

Every section below moves this thread one step. If a section can be cut without breaking the thread, it is cut.

## Sections

Each section has: what it holds, its Toulmin card (claim, grounds, warrant, rebuttal), and its evidence. Target lengths assume W2.

### 0. What works today (1 page, before section 1)

**Holds.** In plain words, what a team could use on a deployment now, and what it can't yet. Can: sign in; floors for people, teams and the organisation; keep a source and have the AI extract observations with their quotes; check them as faithful and hold them as beliefs; see the floor's belief now and its history on request; export to standard formats (PROV-O); install apps from a feed; nightly backups off the server; upgrades from the Deployment app. Can't yet: methods (repeatable AI ways of working); the permissions service in running deployments; mining the work as done (META); a phone layout. All testing so far is synthetic: simulated planners and reports, no real participants, by the author's choice.

- Claim: the knowledge loop (source, observation, check, belief) is usable today; reasoning and META are not.
- Grounds: Knowledge Map statuses; knowledge service PRs merged on main; Compose at ee77d16.
- Rebuttal: "usable" is shown on synthetic work only.

### 1. Where knowledge engineering stalled (situation and complication, 1.5 pages)

**Holds.** A short history told as six failures, each one a place where people had to formalise before the system could help. It ends on what AI changes.

- Claim: the failures were not in the model of knowledge work but in the cost and damage of formalising it up front.
- Grounds: the knowledge acquisition bottleneck (Feigenbaum 1977); MYCIN never used clinically and XCON's rule base growing past ten thousand rules (McDermott 1982; Soloway et al. 1987); Cyc's decades of hand encoding; tacit knowledge (Polanyi 1966; Nonaka and Takeuchi 1995); plans as resources for situated action (Suchman 1987); work-as-imagined versus work-as-done (Hollnagel 2014).
- Warrant: if each failure sits at a formalise-first step, removing that step's cost removes the failure's main cause.
- Rebuttal: some failures were organisational (sponsorship, cost), not technical. The paper says so and does not claim AI fixes those.
- Evidence: the Knowledge Map's "where it struggled before" column, one row per failure.

### 2. What CommonKADS still gets right (0.75 page)

**Holds.** The three levels (context, concept, artefact), the knowledge model's three layers, the task template library, and transfer functions. Why the layers are still the best test of "can I explain this agent?".

- Claim: the layered model is worth keeping even when AI does the work.
- Grounds: Schreiber et al. 2000; Allen et al., "Knowledge Engineering Using Large Language Models", TGDK 1(1), 2023, arguing LLMs make the line between knowledge and reasoning more important to draw on purpose.
- Warrant: an organisation must be able to inspect what is known and how a decision was reached; the layers name exactly those.
- Rebuttal: the worksheets are 1990s consultancy paperwork. Keep the layers and templates, drop the paperwork (audit decision C1).
- Evidence: CommonKADS audit, sections 1 and 5.

### 3. What AI changes, and what it must not (1 page)

**Holds.** The turn of the argument. AI can read a worker's report, a conversation or a trace and formalise it; it can stand in for a designed method by working with the person. But its output is plausible, not reliable. So the architecture must bound AI by provenance (every claim points to its source words) and by authority (people decide what is held).

- Claim: AI fills the formalise-first gaps only when it writes claims, not truth.
- Grounds: H1 and H2 on the Knowledge Map; the knowledge service keeps the quote and its character span on every observation and never edits one (001-store.ts:133-134, 219).
- Warrant: a claim with its source and a human decision can be trusted to the degree its floor trusts its people.
- Rebuttal: provenance can be faked by a model that quotes the wrong span. The faithful check by a non-author (001-store.ts:158) is the guard, and it costs attention. And a faithful quote proves the words exist, not that the AI read them correctly: the paper keeps "faithful to the source" and "a correct interpretation" apart, and only the floor's hold decides the second.
- Evidence: Knowledge Map H1, H2; PDR-022. Section 8 adds the measures for both: reviewer load and check efficacy.

### 4. Four principles (1 page)

**Holds.** The principles in the author's own words, each with the failure it answers and the record that fixes it.

| Principle | Answers | Record |
| --- | --- | --- |
| P1 Knowledge is taken from the work, not forced into a form | Schema-first capture | ADR 0079; "a real ontology graph extracted from the work" (the author, 8 Nov) |
| P2 A task is an intent, not a designed method | Methods designed in advance | Mandate intent (purpose, end state, constraints, restraints, freedoms); Mandate ADR 0001 |
| P3 The domain is event driven | No view of the work as done | PDR-025 (Accepted 10 Nov) |
| P4 Trust by floor: AI writes observations, people hold beliefs | One timeless truth; untraceable AI output | PDR-022, amended by PDR-027 |

Plus the two platform principles that shape every decision after: one codebase, many deployments; explain, never hide (AUGUR principles 1 and 2).

- Claim: these four are enough to make the AI fill safe.
- Grounds: each closes one or more of section 1's failures (the map links them).
- Warrant: a principle that is a record is enforced at review; one that is only prose is not.
- Rebuttal: P2 has no repeatability until methods exist (section 6, D1).

### 5. The hybrid architecture (2 pages, the conceptual core)

**Holds.** The Knowledge Map as the paper's main figure: the CommonKADS models in their levels, with a First principles band above and the META layer on top. For each layer, one line on the classic failure, the AI fill and the guard. Then the four seams where AI meets the record:

1. Extraction: retain writes observations from a source, quote attached.
2. Verification: a non-author checks it is faithful; a settler holds it on the floor.
3. Method runs: each step's output lands as observations; departures are recorded with a reason (D1).
4. Events: every meaningful change is a domain event, written with the change (outbox).

- Claim: the architecture keeps CommonKADS's layers and swaps every formalise-first step for an AI step guarded by provenance and authority.
- Grounds: map statuses: 19 built, 1 designed, 15 partial, 10 empty of 45 nodes (Principles 3, META 5, Organisation 7, Task 4, Agent 4, Knowledge domain 7, inference 3, task 3, Communication 4, Design 5).
- Warrant: the seams are the only places AI writes, so they are the only places that need guarding.
- Rebuttal: the inference and task layers are designed, not built. Say it here and again in section 9.
- Also says what the graph is: a property graph in Postgres (one schema per service, "Postgres for now" in its record), exported as RDF and PROV-O, so no graph database is needed to start.
- Evidence: Knowledge Map; CommonKADS audit matrix (34 elements: 17 have, 9 partial, 8 missing).

### 6. The decisions that make it real (3 pages)

**Holds.** The things the author has been trying to name, each explained by the concern that forced it, as a concern, decision and view table (ISO/IEC/IEEE 42010 style; full table in Appendix B). Each gets a paragraph in the paper:

- Floors as trust boundaries, not folders (ADR 0007, PDR-022).
- Observations and beliefs, two clocks, modality, disputes (ADR 0079, 0091).
- Extraction from reports, with candidates for new terms (ADR 0079, 0080; candidates table).
- What people see: the floor's belief now, history on request (PDR-026).
- Intent passed down floors as mission command (Mandate, Mandate ADR 0001).
- Methods as resources, not scripts (D1, PDR-027); hand-offs that know what they rest on (ADR 0090).
- Positions, not people, hold permissions (ADR 0085, 0089).
- The Palantir mirror: Ontology (knowledge service), Actions (the action catalogue), Logic (methods, still to build).
- Apps as ordinary services behind one gateway, sandboxed in the shell; the platform never waits on an app (ADR 0073, 0075, 0076).
- Event driven by outbox, ids not content (PDR-025, docs/domain-events.md).

- Claim: each decision answers a named concern of the knowledge architecture, not a preference.
- Grounds: the Decision register, Accepted records only.
- Warrant: a decision with its concern can be re-made when the concern changes; one without it can't.
- Rebuttal: some decisions predate the knowledge framing (Compose, Keycloak). They appear only in section 10, as platform choices.
- Freedoms can be abused: an AI agent given an intent could take a freedom the giver didn't mean. Answer: an agent acts only through the action catalogue, with its position's permissions, and every step it takes is an observation a person can see; restraints are checked before an action runs. The agent runtime itself is still Proposed, so this is designed, not shown.

### 7. The META layer: the system watches its own work (1.5 pages)

**Holds.** The layer CommonKADS never had. What it observes (the event stream and the content events point to), what it extracts (cases, drift, repeating methods, missing terms), and where its output goes (observations on the floor, method candidates for a steward). Grounded in double-loop learning (Argyris and Schön 1978), process mining and object-centric logs (van der Aalst; OCEL 2.0), and work-as-done (Hollnagel).

Worked example, synthetic: in the simulated week-45 fleet plan (F1), the senior planner confirms twice where the procedure says once, and the cover planner copies last week's figure because the rule behind it isn't written. Both are exactly what M2 (drift) and K6 (rule types) should surface.

- Claim: an event-driven domain plus recorded method departures gives META its raw material without anyone writing a log.
- Grounds: domain events and audit exist (events/src/store.ts); departures are designed as step records (D1 section 8).
- Warrant: what is recorded can be mined; what is mined can be proposed back as a change a person decides.
- Rebuttal: much knowledge work emits no event (a conversation, reasoning in a head). H3 tests this. Watching work can feel like surveillance: per floor, visible, never used to rate people.

### 8. Evidence and how it could be wrong (1 page)

**Holds.** The three hypotheses with their falsifiers, all tested on synthetic fieldwork only (the author's rule, 10 Nov), and the walk-through of one intent (the fleet weekly plan) down the floors: 7 of 10 steps fit, 3 have no home.

- Claim: the architecture makes falsifiable predictions and names the tests.
- Grounds, with the thresholds that count as failure:
  - H1 fails if, shown their own report beside its extraction, planners mark more than one observation in five unfaithful, or the 'asked' fallback carries more than a third of observations.
  - H2 fails if planners using an AI for the same weekly task can't say afterwards how they reached the plan, or plan quality (rating, on-time rate) gets worse or swings more than with their old way.
  - H3 fails if more than a third of the steps planners describe aloud leave no domain event.
- Added measures (from the cold read): reviewer load (minutes of faithful checking per source, and the share a steward holds without changes); check efficacy (seed known-unfaithful observations and count how many reviewers catch); and two baselines on the same synthetic reports: a plain model extraction with no guard, and manual elicitation by a simulated knowledge engineer.
- Warrant: a claim with a falsifier is a claim; one without is a slogan.
- Rebuttal: synthetic ground truth comes from the same generator as the reports, so the tests show fidelity and coverage, not whether real tacit knowledge survives. Said plainly, with the reason: the author's rule is synthetic fieldwork only for now, so a real pilot is the next gate (option A).

### 9. Limits (1 page)

**Holds.** Every empty and partial node, grouped by what it blocks. Empty: process breakdown (O4), feasibility (O7), knowledge items (T4), competence (A3), drift (M2), method mining (M3), knowledge roles (I2), task methods (X1), template library (X3), design traced to knowledge (D4). Partial includes rule types (K6), inferences as data (I1), control structure (X2), explainability of reasoning (D5), and P3 itself. Plus platform facts: the agent runtime part of ADR 0014 is still Proposed; the permissions service (ADR 0085) is built but not yet run by deployments.

- Claim: the limits are where the next work goes, not where the argument fails.
- Grounds: map statuses; D1's recommended shape for X1 and I2.
- Rebuttal: a sceptical reader may say the core of CommonKADS (inference and task) is exactly what is missing. Answer, stated as the author's judgement and not as evidence: the domain and context layers are the expensive part to get right, and they are built; the reasoning layers have a designed shape that writes into them.

**Operability and security (half a page, for the architects).** What exists: the model API key lives only in the models service; the gateway refuses outside calls to platform services; floors are fenced in the knowledge store so one floor's graph can't be read from another; nightly backups and a WAL archive copied off the server, with restore steps; telemetry and alerts. What doesn't yet: a written threat model (including prompt injection through sources, where a report contains text that tries to steer the extractor; the faithful check and observations-only writes limit the damage but don't prevent it); high availability (one server, Compose); sizing figures; a Kubernetes and VMware path (planned after Compose); the permissions service running in deployments.

### 10. AUGUR as built: the C4 (2 pages, the finale)

**Holds.** Levels 1 to 3, regenerated from the code (Appendix C), each container labelled with the layer of the map it serves. Ends with one sentence that closes the thread: the architecture in section 5 runs today as these containers.

## Appendix A. Claims ledger

| No. | Claim | Evidence | Status |
| --- | --- | --- | --- |
| C1 | Each observation keeps its source quote and span, and can't be edited | knowledge/src/migrations/001-store.ts:133-134, 219 | Evidenced (code) |
| C2 | A non-author checks an extraction is faithful before a settler holds it | 001-store.ts:158, 445, 458-463 | Evidenced (code) |
| C3 | Extraction can only use declared classes and predicates; the 'asked' fallback and candidates soften this | 001-store.ts:80, 137, 353 | Evidenced (code) |
| C4 | A Mandate intent carries purpose, end state, constraints, restraints and freedoms | augur-mandate service/src/api-types.ts:23 | Evidenced (code) |
| C5 | Key tasks are things, not strings | Mandate ADR 0001 (Accepted 10 Nov) | Evidenced (record; code not checked) |
| C6 | Services publish domain events through an outbox in the same transaction; events carry ids, not content | docs/domain-events.md; knowledge kg.emit (001-store.ts:310); Mandate outbox (service/src/index.ts:47) | Evidenced (code) |
| C7 | The domain is event driven | PDR-025 | Evidenced as a principle; partial in practice (H3) |
| C8 | Personal floor is memory; shared floors take what is published | PDR-022, PDR-027 | Evidenced (record) |
| C9 | Positions hold permissions, not people | ADR 0089; PR #544 | Evidenced (record); permissions service not yet in Compose |
| C10 | Methods are resources; departures are recorded | D1 section 8 | Designed, not built |
| C11 | A belief records what it rests on and when it stops standing | ADR 0091 | Evidenced (record; code not checked) |
| C12 | Apps reach AUGUR only through the gateway; the gateway refuses calls to platform services from outside | gateway/src/app.ts:68, 321, 595 | Evidenced (code) |
| C13 | Apps run in their own Compose project, one Score workload per part, blue/green | updater/src/runner.ts header | Evidenced (code) |
| C14 | Methods with typed roles that write evidence-backed observations were not found at Palantir, Camunda, Celonis, Glean or Microsoft | D1 section 2, read 10 Nov | Evidenced (dated vendor docs); re-check quarterly |
| C15 | AUGUR mirrors Palantir's Ontology, Actions, Logic split | Architecture MASTER "The shape"; ADR 0079 | Evidenced (record) |
| C16 | Map counts: 19 built, 1 designed, 15 partial, 10 empty of 45 | Knowledge Map live table, 10 Nov | Evidenced (data) |
| C17 | Classic KE failures (Feigenbaum, MYCIN, XCON, Cyc, Polanyi, Nonaka, Suchman, Hollnagel, Argyris) | Primary sources named | Needs page references: not resolved in this pass |
| C18 | LLMs make KE's layering more relevant | Allen et al., TGDK 1(1), 2023, doi:10.4230/TGDK.1.1.3 | Cited by the audit; not re-read in this pass |
| C19 | Synthetic week-45: double confirm; copied figure | F1 doc section 10 | Evidenced (synthetic only) |
| C20 | The agent runtime is still Proposed | Register, ADR 0014 | Evidenced (record) |

Rows with no evidence: 0. Rows whose evidence is not yet resolved to a page or re-read: 2 (C17, C18).

## Appendix B. Concerns, decisions and views (42010 style)

| Concern (who has it) | Decision | Record | View that answers it |
| --- | --- | --- | --- |
| Will my words be kept as I wrote them? (worker) | Sources referenced, observations immutable, quote kept | ADR 0079 | Knowledge map K3; C4 L3 knowledge service |
| Who decides what is true here? (floor, sponsor) | Trust by floor; AI writes observations | PDR-022, PDR-027 | Map K7, O2 |
| What do I see by default? (planner) | Belief now; history on request | PDR-026 | Map K4 |
| Can the system grow its vocabulary without an engineer? (steward) | Candidates and the 'asked' fallback | ADR 0079, 0080 | Map K5, M4 |
| How is a task given without scripting it? (manager) | Intent with freedoms and constraints | Mandate ADR 0001 | Map T1, C4 |
| How is AI reasoning made inspectable? (architect, auditor) | Methods as resources with typed roles; step records | D1 (designed); PDR-027 | Map X1, I2 |
| How does work pass between people and agents? (planner) | Hand-offs that know what they rest on | ADR 0090 | Map C1, I3 |
| Why does this belief stand, and when does it stop? (anyone) | Rests-on recorded; stop-standing events | ADR 0091 | Map D5 |
| Who may do what when people change jobs? (admin) | Positions hold permissions; OpenFGA | ADR 0085, 0089 | Map O3; C4 L2 (not yet deployed) |
| How do we see the work as done? (steward, sponsor) | Event-driven domain, outbox | PDR-025 | Map P3, M1; C4 L2 events |
| Can an app break the platform? (architect) | Platform never waits on an app; sandboxed UI | ADR 0073, 0076 | C4 L2 app runner |
| Can we run it in our own estate, many times? (ops) | Compose; one codebase, many deployments | ADR 0010; principle 1 | C4 L1, L2 |
| How do apps reach the knowledge? (app builder) | Only through objects and actions on the gateway | ADR 0079, 0081 | C4 L3 gateway |

## Appendix C. The C4, regenerated from the code (augur main ee77d16)

**Level 1, context.** People in the organisation (on their floors), admins and deployment admins reach AUGUR in a browser by whatever route the deployment chooses (ADR 0010 amended). AUGUR depends on: a model provider (behind the models service only), GitHub (release feed and images), and the organisation's SMTP relay (ADR 0035). Apps arrive from the app feed (ADR 0075).

**Level 2, containers (Compose project "platform").**

| Container | Does | Map layer |
| --- | --- | --- |
| web (nginx) | Serves the shell and kit; sends /api/ to the gateway, /sso/ to Keycloak | Communication (present) |
| gateway | The one door: verifies sign-in, adds the floor, routes /api/<name>, signs the caller, refuses outside calls to platform services | Communication (exchange spec) |
| keycloak, keycloak-config | Sign-in; realm applied as code by identity's job | Agent (human agents) |
| identity | People, teams, floors, positions, organisation settings | Organisation (structure) |
| registry | App catalogue, releases, grants, upstreams for the gateway | Design |
| events | Domain events (outbox delivery), notifications, Inbox, audit | Communication (transactions); META (work log) |
| models | Model gateway; the only holder of the model API key | Agent (system agents) |
| knowledge, knowledge-migrate | Floors' graphs: sources, observations, beliefs, candidates, actions, export | Knowledge (domain, inference) |
| storage | One-shot setup of buckets and logins | Platform |
| postgres (pgvector) | One database, a schema per service | Platform |
| garage | S3 object storage | Platform |
| backup, backup-tools | Nightly backup, WAL archive, restic copy off the server | Platform |
| updater, docker-proxy (profile updater) | Upgrades; the app runner, which writes the "augur-apps" Compose project | Design |
| otel-lgtm | Telemetry and alerting | Platform |
| tailscale | Only on deployments reached over a tailnet (the author's workbench) | Platform |

Apps: each installed app runs in the separate "augur-apps" project, one container per Score part, blue/green, with nothing it didn't ask for (runner.ts). The gateway reaches an app as /api/<app id>.

**Level 3.** Three views: the gateway's request path (auth, floor, route, signed caller); the knowledge service (retain, faithful check, hold, raise, reflect, export, emit); the app runner (Score workload to Compose service, blue/green, previews).

**Diff against the current diagrams.**

Against the Architecture MASTER (last checked 8 Nov):
- In code, not in the MASTER: knowledge and knowledge-migrate; keycloak-config; otel-lgtm; backup-tools.
- In the MASTER, no longer in Compose: Artifacts (folio), Data Atlas (atlas), Explorer (auspex), Mandate in augur-apps, folio-worker. Postgres schemas folio, atlas, mandate are listed; kg is not.
- Status out of date: ADR 0075, 0076 and the 0010 amendment are shown as Proposed; all are Accepted.
- Decided, not yet in Compose: the permissions service (ADR 0085).

Against the generated C4 (project files architecture/gen.py, 29 Oct): it still draws the Lit UI kit (now React, ADR 0015), the bundled apps and folio-worker with Docling, and has no knowledge service. It needs regenerating.

## Appendix D. Synthetic cold read

Three AI reader personas (a sponsor, an organisation architect, a knowledge engineering academic) read only the first version of this plan and answered ten fixed questions: the decision; the one claim; two failures; who holds knowledge; observation versus belief; why intent not method; what META watches; how much is built; where it runs; what would prove it wrong. Then: where did you lose trust, and what would you need before deciding.

**What they got right (all three).** The decision, the one claim, the map counts (19 built, 1 designed, 15 partial, 10 empty of 45) and the names of the three falsifiers.

**Where they went wrong or got stuck, and what changed.**

| Problem | Readers | Change made |
| --- | --- | --- |
| House words undefined (floor, settler, retain, raise, reflect, outbox, 'asked', modality, two clocks) and record and map codes in the text | All three | Glossary; codes only in appendices; "steward" for settler (W6) |
| Reads as an internal memo ("Decisions for Harry"); the sponsor isn't given options or costs | Sponsor, architect | Decision box with options A, B, C; author's decisions box |
| Who a steward is and how many a floor needs | Sponsor, academic | Defined in the glossary |
| Thresholds for failure not stated | All three | Section 8 states them |
| What kind of graph it is | Architect, academic | Section 5: Postgres property graph with RDF and PROV-O export |
| A faithful quote proves the words exist, not the reading | Academic | Section 3 keeps the two apart |
| No measure of reviewer load or check efficacy; no baseline | Academic | Section 8 adds both measures and two baselines |
| "The expensive layers are built" argued without evidence | Academic | Section 9 marks it as the author's judgement |
| No threat model, HA, backup, sizing or estate fit | Architect | Operability and security in section 9 |
| AI agents could exploit freedoms | Architect | Section 6 rebuttal |
| What works today, cost to run, first 90 days, real pilot evidence | Sponsor | Section 0; option A; synthetic-only stated as a deliberate constraint |

**Still open after the changes.** Sizing and running cost can't be stated until a deployment is measured. The first-90-days view depends on option A being chosen. No real-pilot evidence exists, by design.
