-- Configuration pour de meilleures performances
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- Table principale pour les exercices
CREATE TABLE IF NOT EXISTS exercises (
  uuid TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  chapter TEXT NOT NULL,
  subchapter TEXT,
  theme TEXT,
  difficulty INTEGER,
  author TEXT,
  organization TEXT,
  video_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  content_json TEXT NOT NULL,
  source_hash TEXT
);

-- Table virtuelle pour la recherche plein texte (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS fts_exercises USING fts5(
  uuid UNINDEXED,
  title,
  theme,
  chapter,
  content_text,
  tokenize='unicode61 remove_diacritics 1'
);

-- Index pour accélérer les requêtes de navigation et de filtrage
CREATE INDEX IF NOT EXISTS idx_chapter ON exercises(chapter);
CREATE INDEX IF NOT EXISTS idx_difficulty ON exercises(difficulty);
CREATE INDEX IF NOT EXISTS idx_author ON exercises(author);