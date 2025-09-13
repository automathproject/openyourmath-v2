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
  level TEXT, -- MODIFIÉ : ancien difficulty devient level (TEXT)
  difficulty INTEGER, -- NOUVEAU : nouvelle difficulté numérique (1-5 ou NULL)
  module TEXT,
  author TEXT,
  organization TEXT,
  video_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  preview TEXT,
  hasIndication INTEGER NOT NULL DEFAULT 0, -- 0/1 booléen: au moins une indication
  hasSolution INTEGER NOT NULL DEFAULT 0,   -- 0/1 booléen: au moins une solution/réponse
  content_json TEXT NOT NULL,
  source_hash TEXT
);

-- Table virtuelle pour la recherche plein texte (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS fts_exercises USING fts5(
  uuid, -- Désormais indexé pour permettre la recherche par UUID
  title,
  theme,
  chapter,
  module,
  level, -- MODIFIÉ : level au lieu de difficulty
  difficulty UNINDEXED, -- NOUVEAU : difficulté numérique (pas indexée pour recherche texte)
  preview UNINDEXED, -- Ne participe plus au MATCH
  content_text,
  tokenize='unicode61 remove_diacritics 1'
);

-- Index pour accélérer les requêtes de navigation et de filtrage
CREATE INDEX IF NOT EXISTS idx_chapter ON exercises(chapter);
CREATE INDEX IF NOT EXISTS idx_level ON exercises(level); -- MODIFIÉ : index sur level
CREATE INDEX IF NOT EXISTS idx_difficulty ON exercises(difficulty); -- NOUVEAU : index sur difficulty numérique
CREATE INDEX IF NOT EXISTS idx_module ON exercises(module);
CREATE INDEX IF NOT EXISTS idx_author ON exercises(author);
