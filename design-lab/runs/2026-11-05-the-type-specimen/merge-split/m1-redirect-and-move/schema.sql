-- Merge and split V1: redirect and move. Built on identity V1 (today's shape).
-- Wikidata's way: merging moves the junior's statements onto the senior and leaves the
-- junior as a redirect. Undoing the merge clears the redirect and moves the logged
-- statements back. Each entity has a revision history, as a wiki page does.
-- Anything said of the merged entity in between must be sorted by editing it.

CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  floor TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'retired')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  redirect_to TEXT REFERENCES entities(id)
);

-- Page history: every change of label or redirect, with an edit summary.
CREATE TABLE revisions (
  entity TEXT NOT NULL REFERENCES entities(id),
  at TEXT NOT NULL,
  by TEXT NOT NULL,
  label TEXT,
  redirect_to TEXT REFERENCES entities(id),
  summary TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (entity, at)
);

CREATE TABLE merges (
  id TEXT PRIMARY KEY,
  from_entity TEXT NOT NULL REFERENCES entities(id),
  into_entity TEXT NOT NULL REFERENCES entities(id),
  by TEXT NOT NULL,
  at TEXT NOT NULL,
  summary TEXT NOT NULL,
  undone_by TEXT,
  undone_at TEXT,
  undo_summary TEXT
);

-- Which statements a merge moved, so the undo can move them back.
CREATE TABLE moved (
  merge TEXT NOT NULL REFERENCES merges(id),
  fact TEXT NOT NULL,
  from_entity TEXT NOT NULL REFERENCES entities(id),
  PRIMARY KEY (merge, fact)
);

-- Today: aliases text[] on the entity. No dates, no who, no why.
CREATE TABLE entity_aliases (
  entity TEXT NOT NULL REFERENCES entities(id),
  alias TEXT NOT NULL,
  PRIMARY KEY (entity, alias)
);

-- One row per identity key, so no two entities share one.
CREATE TABLE entity_keys (
  entity TEXT NOT NULL REFERENCES entities(id),
  type TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (entity, key),
  UNIQUE (type, key, value)
);

-- What people saw or read, as they said it. Only ever added.
CREATE TABLE observations (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL REFERENCES entities(id),
  property TEXT NOT NULL,
  value TEXT,
  floor TEXT NOT NULL,
  source TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retracted_at TEXT,
  retracted_why TEXT
);

-- What a floor accepts as so, on two clocks.
CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL REFERENCES entities(id),
  property TEXT NOT NULL,
  value TEXT,
  target TEXT REFERENCES entities(id),
  valid_from TEXT,
  valid_to TEXT,
  floor TEXT NOT NULL,
  backed_by TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  superseded_at TEXT,
  superseded_by TEXT,
  CHECK ((value IS NULL) <> (target IS NULL))
);

CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  floor TEXT NOT NULL,
  source TEXT NOT NULL,
  producer TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'finished', 'withdrawn')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE proposal_items (
  proposal TEXT NOT NULL REFERENCES proposals(id),
  key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('mention', 'observation', 'term')),
  body TEXT NOT NULL,
  matches TEXT NOT NULL DEFAULT '[]',
  decision TEXT,
  decided_by TEXT,
  decided_at TEXT,
  PRIMARY KEY (proposal, key)
);

CREATE TABLE questions (id TEXT PRIMARY KEY, words TEXT NOT NULL, kind TEXT NOT NULL, property TEXT NOT NULL, since TEXT NOT NULL, asked_by TEXT NOT NULL);
CREATE TABLE runs (id TEXT PRIMARY KEY, question TEXT NOT NULL REFERENCES questions(id), run_by TEXT NOT NULL, valid_at TEXT NOT NULL, known_at TEXT NOT NULL, answered INTEGER NOT NULL);
CREATE TABLE run_floors (run TEXT NOT NULL REFERENCES runs(id), floor TEXT NOT NULL, PRIMARY KEY (run, floor));
