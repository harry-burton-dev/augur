-- Merge and split V4: evidence and conclusion. Built on identity V4 (same as).
-- The Genealogical Proof Standard's split: records say, conclusions believe, and every
-- conclusion cites the records it rests on, for or against. A merge is a 'same'
-- conclusion; a split is a 'distinct' conclusion that withdraws it; sorting a fact said
-- while merged is an 'about' conclusion. A record found wrong is marked, never removed.
-- A model's guess is a hypothesis, kept apart; it is not an entity and joins nothing.

CREATE TABLE floors (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('you', 'team', 'department', 'org')),
  name TEXT NOT NULL,
  parent TEXT REFERENCES floors(id)
);

CREATE TABLE records (
  id TEXT PRIMARY KEY,
  says TEXT NOT NULL,
  floor TEXT NOT NULL REFERENCES floors(id),
  recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  discredited_at TEXT,
  discredited_why TEXT
);

CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  floor TEXT NOT NULL REFERENCES floors(id),
  recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL
);

CREATE TABLE labels (
  entity TEXT NOT NULL REFERENCES entities(id),
  label TEXT NOT NULL,
  from_at TEXT NOT NULL,
  to_at TEXT,
  by TEXT NOT NULL,
  PRIMARY KEY (entity, from_at)
);

CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL REFERENCES entities(id),   -- the entity it was said of when typed
  property TEXT NOT NULL,
  value TEXT,
  target TEXT REFERENCES entities(id),
  valid_from TEXT,
  floor TEXT NOT NULL REFERENCES floors(id),
  recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  superseded_at TEXT,
  CHECK ((value IS NULL) <> (target IS NULL))
);

-- We believe. Never edited; withdrawn by a later conclusion.
CREATE TABLE conclusions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('same', 'distinct', 'about')),
  a TEXT NOT NULL REFERENCES entities(id),
  b TEXT REFERENCES entities(id),
  fact TEXT REFERENCES facts(id),
  stated_by TEXT NOT NULL,
  stated_at TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  withdraws TEXT REFERENCES conclusions(id),
  CHECK ((kind = 'about') = (fact IS NOT NULL))
);

CREATE TABLE cites (
  conclusion TEXT NOT NULL REFERENCES conclusions(id),
  record TEXT NOT NULL REFERENCES records(id),
  bearing TEXT NOT NULL CHECK (bearing IN ('supports', 'contradicts')),
  PRIMARY KEY (conclusion, record)
);

-- Pencil: a producer's guess. Never counted; becomes a conclusion only when a person states one.
CREATE TABLE hypotheses (
  id TEXT PRIMARY KEY,
  producer_kind TEXT NOT NULL CHECK (producer_kind IN ('model', 'person', 'import')),
  producer TEXT NOT NULL,
  claim TEXT NOT NULL,
  mention TEXT,
  about TEXT REFERENCES entities(id),
  record TEXT REFERENCES records(id),
  made_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'accepted', 'rejected')),
  decided_by TEXT,
  decided_at TEXT,
  became TEXT
);

CREATE TABLE questions (id TEXT PRIMARY KEY, words TEXT NOT NULL, kind TEXT NOT NULL, property TEXT NOT NULL, since TEXT NOT NULL, asked_by TEXT NOT NULL);
CREATE TABLE runs (id TEXT PRIMARY KEY, question TEXT NOT NULL REFERENCES questions(id), run_by TEXT NOT NULL, valid_at TEXT NOT NULL, known_at TEXT NOT NULL, answered INTEGER NOT NULL);
CREATE TABLE run_floors (run TEXT NOT NULL REFERENCES runs(id), floor TEXT NOT NULL REFERENCES floors(id), PRIMARY KEY (run, floor));
