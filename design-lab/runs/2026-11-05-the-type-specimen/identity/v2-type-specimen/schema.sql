-- Identity V2: the type specimen.
-- An entity hangs on one record (its specimen), set once. Names are rows with
-- dates, accepted or synonym. A merge sinks the junior's name into synonymy
-- under the senior entity; nothing moves. Portable to Postgres: TEXT times in ISO 8601.

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
  CHECK (synonym_of IS NULL OR status = 'synonym')
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
  recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  superseded_at TEXT,
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
