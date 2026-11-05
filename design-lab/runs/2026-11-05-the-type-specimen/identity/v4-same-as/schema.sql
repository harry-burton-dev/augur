-- Identity V4: same as.
-- Every record that names a thing becomes its own entity and is never merged.
-- Sameness is a link (owl:sameAs, as Wikidata and linked data use it). The thing a person
-- sees is a cluster: the entities joined by links that stand. Its name is the label of
-- its oldest member (Wikidata keeps the older item). Labels have a history, like an
-- item's revisions. A model's "same as" is a link in state 'proposed'.

CREATE TABLE floors (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('you', 'team', 'department', 'org')),
  name TEXT NOT NULL,
  parent TEXT REFERENCES floors(id)
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

CREATE TABLE same_as (
  id TEXT PRIMARY KEY,
  a TEXT NOT NULL REFERENCES entities(id),
  b TEXT NOT NULL REFERENCES entities(id),
  state TEXT NOT NULL CHECK (state IN ('proposed', 'asserted', 'withdrawn', 'rejected')),
  made_by TEXT NOT NULL,
  made_by_kind TEXT NOT NULL CHECK (made_by_kind IN ('person', 'model')),
  made_at TEXT NOT NULL,
  asserted_at TEXT,
  closed_by TEXT,
  closed_at TEXT,
  summary TEXT NOT NULL DEFAULT '',        -- an edit summary, as on a wiki
  closed_summary TEXT
);

CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL REFERENCES entities(id),
  property TEXT NOT NULL,
  value TEXT,
  target TEXT REFERENCES entities(id),
  valid_from TEXT,
  floor TEXT NOT NULL REFERENCES floors(id),
  recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  superseded_at TEXT,
  from_model INTEGER NOT NULL DEFAULT 0,
  CHECK ((value IS NULL) <> (target IS NULL))
);

CREATE TABLE questions (id TEXT PRIMARY KEY, words TEXT NOT NULL, kind TEXT NOT NULL, property TEXT NOT NULL, since TEXT NOT NULL, asked_by TEXT NOT NULL);
CREATE TABLE runs (id TEXT PRIMARY KEY, question TEXT NOT NULL REFERENCES questions(id), run_by TEXT NOT NULL, valid_at TEXT NOT NULL, known_at TEXT NOT NULL, answered INTEGER NOT NULL);
CREATE TABLE run_floors (run TEXT NOT NULL REFERENCES runs(id), floor TEXT NOT NULL REFERENCES floors(id), PRIMARY KEY (run, floor));
