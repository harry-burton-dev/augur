-- Merge and split V3: the register. Built on identity V2 (the type specimen).
-- Names, merges, splits and sortings are all entries in one register per entity.
-- What holds at any recorded time is the entries made by then and not yet closed.

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

-- The register of each entity (HM Land Registry's register of title): numbered entries in
-- order. An entry is never changed or removed; a later entry may close it.
CREATE TABLE register (
  entity TEXT NOT NULL REFERENCES entities(id),
  seq INTEGER NOT NULL,
  entered_at TEXT NOT NULL,
  entered_by TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('name', 'other name', 'placed under', 'released', 'fact sorted')),
  name TEXT,
  other TEXT REFERENCES entities(id),
  fact TEXT,
  closes INTEGER,
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (entity, seq),
  CHECK (closes IS NULL OR closes < seq)
);

-- What each entry cites.
CREATE TABLE entry_evidence (
  entity TEXT NOT NULL,
  seq INTEGER NOT NULL,
  record TEXT NOT NULL REFERENCES records(id),
  PRIMARY KEY (entity, seq, record),
  FOREIGN KEY (entity, seq) REFERENCES register(entity, seq)
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
