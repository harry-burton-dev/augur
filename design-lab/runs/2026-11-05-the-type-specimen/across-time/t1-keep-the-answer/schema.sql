-- Across time V1: keep the answer. Built on merge and split V2.
-- Facts are kept as they stand now: a correction edits or deletes the row, so facts have no
-- recorded time. To answer "what did it say then?", each run keeps the rows it returned.
-- Names and merges keep their dates (from the identity surface).

CREATE TABLE floors (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('you', 'team', 'department', 'org')),
  name TEXT NOT NULL,
  parent TEXT REFERENCES floors(id)
);

-- What a source said, as it arrived. Never changed; a wrong one is marked.
CREATE TABLE records (
  id TEXT PRIMARY KEY,
  says TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  floor TEXT NOT NULL REFERENCES floors(id),
  recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  discredited_at TEXT,
  discredited_why TEXT
);

-- One real thing. Its specimen is the record that made it, and never changes.
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  specimen TEXT NOT NULL UNIQUE REFERENCES records(id),
  floor TEXT NOT NULL REFERENCES floors(id),
  recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL
);

-- Every name an entity has been shown under or kept as, on recorded time.
-- synonym_of is set when the name lost to another entity's under a merge.
CREATE TABLE names (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL REFERENCES entities(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'synonym')),
  synonym_of TEXT REFERENCES entities(id),
  from_at TEXT NOT NULL,
  to_at TEXT,
  opened_by TEXT NOT NULL,
  closed_by TEXT,
  evidence TEXT REFERENCES records(id),
  merge TEXT,                 -- the merge that made this a synonym, if one did
  CHECK (synonym_of IS NULL OR status = 'synonym')
);

-- The merge as an act (botany: an author's opinion that two names are synonyms).
CREATE TABLE merges (
  id TEXT PRIMARY KEY,
  junior TEXT NOT NULL REFERENCES entities(id),
  senior TEXT NOT NULL REFERENCES entities(id),
  kind TEXT NOT NULL CHECK (kind IN ('found the same', 'became one')),
  valid_from TEXT,            -- only for 'became one': when it happened in the world
  name_rule TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  withdrawn_at TEXT,
  withdrawn_by TEXT,
  CHECK ((kind = 'became one') = (valid_from IS NOT NULL))
);

CREATE TABLE merge_evidence (
  merge TEXT NOT NULL REFERENCES merges(id),
  record TEXT NOT NULL REFERENCES records(id),
  PRIMARY KEY (merge, record)
);

-- A split withdraws one merge. It never deletes it.
CREATE TABLE splits (
  id TEXT PRIMARY KEY,
  merge TEXT NOT NULL UNIQUE REFERENCES merges(id),
  decided_by TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  why TEXT NOT NULL
);

CREATE TABLE split_evidence (
  split TEXT NOT NULL REFERENCES splits(id),
  record TEXT NOT NULL REFERENCES records(id),
  PRIMARY KEY (split, record)
);

-- Each fact said of the senior while merged, and where the split put it.
CREATE TABLE sortings (
  split TEXT NOT NULL REFERENCES splits(id),
  fact TEXT NOT NULL REFERENCES facts(id),
  kept_on TEXT NOT NULL REFERENCES entities(id),
  new_fact TEXT REFERENCES facts(id),
  sorted_by TEXT NOT NULL,
  why TEXT NOT NULL,
  PRIMARY KEY (split, fact)
);

-- What a floor accepts as so, on two clocks (as Data Atlas has today).
CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL REFERENCES entities(id),
  property TEXT NOT NULL,
  value TEXT,
  target TEXT REFERENCES entities(id),
  valid_from TEXT,
  floor TEXT NOT NULL REFERENCES floors(id),
  backed_by TEXT REFERENCES records(id),
  CHECK ((value IS NULL) <> (target IS NULL))
);

-- Pencil: what a producer proposed, until a person decides.
CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  producer_kind TEXT NOT NULL CHECK (producer_kind IN ('model', 'person', 'import')),
  producer TEXT NOT NULL,
  claim TEXT NOT NULL,
  mention TEXT,
  target TEXT REFERENCES entities(id),
  record TEXT REFERENCES records(id),
  floor TEXT NOT NULL REFERENCES floors(id),
  made_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'accepted', 'rejected')),
  decided_by TEXT,
  decided_at TEXT,
  became_fact TEXT REFERENCES facts(id)
);

-- The question is the record: words and choices, never rows.
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  words TEXT NOT NULL,
  kind TEXT NOT NULL,
  property TEXT NOT NULL,
  since TEXT NOT NULL,
  asked_by TEXT NOT NULL
);

-- Each time it was answered: when, as of what, by whom, and the count it gave.
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL REFERENCES questions(id),
  run_by TEXT NOT NULL,
  valid_at TEXT NOT NULL,
  known_at TEXT NOT NULL,
  answered INTEGER NOT NULL
);

-- Whose access each run used.
CREATE TABLE run_floors (
  run TEXT NOT NULL REFERENCES runs(id),
  floor TEXT NOT NULL REFERENCES floors(id),
  PRIMARY KEY (run, floor)
);

-- Copies know their source: where a run's answer was quoted.
CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  run TEXT NOT NULL REFERENCES runs(id),
  quoted_in TEXT NOT NULL,
  says TEXT NOT NULL,
  quoted_at TEXT NOT NULL
);

-- The rows each run returned, with the name they were shown under.
CREATE TABLE run_rows (
  run TEXT NOT NULL REFERENCES runs(id),
  entity TEXT NOT NULL REFERENCES entities(id),
  shown_as TEXT NOT NULL,
  PRIMARY KEY (run, entity)
);
