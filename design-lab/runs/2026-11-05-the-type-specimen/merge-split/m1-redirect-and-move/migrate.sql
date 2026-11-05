-- From identity V1 (today) to merge and split V1 (redirect and move).
-- Today keeps no merges: a "merge" was a retire plus an alias, and the alias was taken off
-- at the split. So nothing here can find the Harbourline merge again. Every entity gets a
-- first revision from its current label; retired entities are left retired, saying why not.

ALTER TABLE entities ADD COLUMN redirect_to TEXT REFERENCES entities(id);
CREATE TABLE revisions (entity TEXT NOT NULL REFERENCES entities(id), at TEXT NOT NULL, by TEXT NOT NULL, label TEXT,
  redirect_to TEXT REFERENCES entities(id), summary TEXT NOT NULL DEFAULT '', PRIMARY KEY (entity, at));
CREATE TABLE merges (id TEXT PRIMARY KEY, from_entity TEXT NOT NULL REFERENCES entities(id), into_entity TEXT NOT NULL REFERENCES entities(id),
  by TEXT NOT NULL, at TEXT NOT NULL, summary TEXT NOT NULL, undone_by TEXT, undone_at TEXT, undo_summary TEXT);
CREATE TABLE moved (merge TEXT NOT NULL REFERENCES merges(id), fact TEXT NOT NULL, from_entity TEXT NOT NULL REFERENCES entities(id), PRIMARY KEY (merge, fact));
CREATE TABLE questions (id TEXT PRIMARY KEY, words TEXT NOT NULL, kind TEXT NOT NULL, property TEXT NOT NULL, since TEXT NOT NULL, asked_by TEXT NOT NULL);
CREATE TABLE runs (id TEXT PRIMARY KEY, question TEXT NOT NULL REFERENCES questions(id), run_by TEXT NOT NULL, valid_at TEXT NOT NULL, known_at TEXT NOT NULL, answered INTEGER NOT NULL);
CREATE TABLE run_floors (run TEXT NOT NULL REFERENCES runs(id), floor TEXT NOT NULL, PRIMARY KEY (run, floor));

INSERT INTO revisions SELECT id, updated_at, updated_by, label, NULL,
  CASE state WHEN 'retired' THEN 'Retired before merges were kept; why is not known' ELSE 'Label at migration' END
FROM entities;
