-- Configuration pour de meilleures performances
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- Table principale pour les exercicaes
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
  license_code TEXT,
  license_url TEXT,
  video_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  preview TEXT,
  hasIndication INTEGER NOT NULL DEFAULT 0, -- 0/1 booléen: au moins une indication
  hasSolution INTEGER NOT NULL DEFAULT 0,   -- 0/1 booléen: au moins une solution/réponse
  content_json TEXT NOT NULL,
  source_path TEXT,
  source_hash TEXT,
  content_hash TEXT,   -- hash du contenu sémantique (énoncés, questions, réponses, indications) — géré par Pipeline A
  summary TEXT,        -- résumé généré par LLM (Pipeline B uniquement)
  concepts TEXT,       -- JSON: liste de concepts (Pipeline B uniquement)
  methods TEXT,        -- JSON: liste de méthodes (Pipeline B uniquement)
  objects TEXT,        -- JSON: liste d'objets mathématiques (Pipeline B uniquement)
  indexed_at TEXT      -- horodatage de la dernière indexation sémantique (Pipeline B uniquement)
);

-- Table d'association exercice ↔ auteurs (un enregistrement par auteur)
CREATE TABLE IF NOT EXISTS exercise_authors (
  uuid TEXT NOT NULL,
  author_display TEXT NOT NULL,
  author_pseudo TEXT,
  PRIMARY KEY (uuid, author_display)
);
CREATE INDEX IF NOT EXISTS idx_ex_auth_display ON exercise_authors(author_display);
CREATE INDEX IF NOT EXISTS idx_ex_auth_uuid ON exercise_authors(uuid);

-- Table des embeddings sémantiques (Pipeline B uniquement)
CREATE TABLE IF NOT EXISTS exercise_embeddings (
  uuid TEXT PRIMARY KEY,
  embedding_summary BLOB NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'BAAI/bge-m3',
  dimension INTEGER NOT NULL DEFAULT 1024,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uuid) REFERENCES exercises(uuid) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_embeddings_model ON exercise_embeddings(model_version);

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
CREATE INDEX IF NOT EXISTS idx_license_code ON exercises(license_code);
CREATE INDEX IF NOT EXISTS idx_source_path ON exercises(source_path);
CREATE INDEX IF NOT EXISTS idx_content_hash ON exercises(content_hash);
CREATE INDEX IF NOT EXISTS idx_indexed_at ON exercises(indexed_at);
