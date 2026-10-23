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
  -- Empreinte du contenu dont le vecteur est issu : un vecteur est à jour si
  -- elle égale exercises.content_hash, indépendamment des métadonnées.
  content_hash TEXT,
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

-- Fiches d'exercices : listes thématiques éditorialisées, importées d'exobase
-- depuis content/fiches/<source>/. Une fiche ne porte aucun énoncé, seulement
-- un ordre et une structure sur des exercices existants.
CREATE TABLE IF NOT EXISTS fiches (
  uuid TEXT PRIMARY KEY,            -- identifiant éditorial, ex. f00012
  slug TEXT NOT NULL,               -- nom de fichier source, ex. fic00012
  title TEXT NOT NULL,
  author TEXT,
  organization TEXT NOT NULL,
  created_at TEXT,
  intro TEXT,                       -- texte libre d'introduction (optionnel)
  exercise_count INTEGER NOT NULL DEFAULT 0,  -- références résolues
  missing_count INTEGER NOT NULL DEFAULT 0,   -- références sans exercice au corpus
  max_depth INTEGER NOT NULL DEFAULT 0,       -- 0 = liste plate
  source_path TEXT,
  source_hash TEXT
);

-- Un enregistrement par référence d'exercice, dans l'ordre de la fiche.
-- section_path porte le chemin de titres au format JSON : [] pour une fiche
-- plate, ["Pratique"] pour un niveau, ["Géométrie","Coniques"] au-delà. Un
-- chemin plutôt qu'un arbre : un titre peut porter à la fois des exercices et
-- des sous-titres, ce qu'un modèle par feuilles ne représenterait pas.
CREATE TABLE IF NOT EXISTS fiche_items (
  fiche_uuid TEXT NOT NULL,
  position INTEGER NOT NULL,        -- ordre dans la fiche, à partir de 0
  section_path TEXT NOT NULL DEFAULT '[]',
  exercise_uuid TEXT,               -- NULL si la référence n'a pas d'exercice
  source_ref TEXT NOT NULL,         -- référence d'origine, ex. l'id exo7 « 671 »
  PRIMARY KEY (fiche_uuid, position)
);

CREATE INDEX IF NOT EXISTS idx_fiche_items_exercise ON fiche_items(exercise_uuid);
CREATE INDEX IF NOT EXISTS idx_fiches_organization ON fiches(organization);
CREATE INDEX IF NOT EXISTS idx_fiches_author ON fiches(author);

-- Référentiel CPGE : programmes officiels de mathématiques des classes
-- préparatoires, lus dans content/referentiels/cpge/programmes/*.md par
-- scripts/build-referentiel-cpge.js (voir docs/classification-cpge.md).
-- Un programme est un texte officiel ; plusieurs filières peuvent le partager
-- (MPSI et MP2I), une filière peut en avoir plusieurs (BCPST, un par année).
CREATE TABLE IF NOT EXISTS cpge_programmes (
  programme TEXT PRIMARY KEY,       -- ex. mpsi-mp2i, = nom du fichier
  titre TEXT NOT NULL,
  annee INTEGER NOT NULL,           -- 1 | 2
  bo TEXT,                          -- Bulletin officiel de publication
  nor TEXT,                         -- JSON : liste des NOR
  arrete TEXT,                      -- date ISO de l'arrêté
  rentree INTEGER,                  -- année de première application
  source_url TEXT,                  -- PDF officiel
  bo_url TEXT,
  pages TEXT,                       -- pages du PDF converties
  source_path TEXT,
  source_hash TEXT
);

CREATE TABLE IF NOT EXISTS cpge_filieres (
  filiere TEXT NOT NULL,            -- ex. MP2I
  programme TEXT NOT NULL,
  PRIMARY KEY (filiere, programme)
);

-- Nœuds rattachables : sections (###) et sous-sections lettrées (####) du
-- texte officiel. Une partie « A - » est une section dont parent_id désigne la
-- section générale ; une sous-section a pour parent sa section ou sa partie.
CREATE TABLE IF NOT EXISTS cpge_noeuds (
  id TEXT PRIMARY KEY,              -- ex. mpsi-mp2i.nombres-complexes.f
  programme TEXT NOT NULL,
  type TEXT NOT NULL,               -- section | sous-section
  parent_id TEXT,
  partie TEXT,                      -- grande partie : Premier semestre, Programme…
  semestre INTEGER,                 -- 1 | 2 en première année, sinon NULL
  lettre TEXT,                      -- a, b… pour une sous-section
  titre TEXT NOT NULL,              -- titre officiel, LaTeX compris
  texte TEXT,                       -- bandeau et notes, en Markdown
  contenus TEXT NOT NULL DEFAULT '[]', -- JSON : [{contenu, commentaire}]
  ordre INTEGER NOT NULL            -- ordre dans le texte officiel
);

CREATE INDEX IF NOT EXISTS idx_cpge_noeuds_programme ON cpge_noeuds(programme, ordre);
CREATE INDEX IF NOT EXISTS idx_cpge_noeuds_parent ON cpge_noeuds(parent_id);
CREATE INDEX IF NOT EXISTS idx_cpge_filieres_programme ON cpge_filieres(programme);

-- Rattachements des exercices aux nœuds. Les rattachements relus viennent de
-- la macro \cpge{} des sources (origine « source ») ; les propositions
-- automatiques, non relues, viendront des métadonnées. Filtrer une section
-- entière suit parent_id, pas le préfixe : l'identifiant d'une partie « A - »
-- ne prolonge pas celui de sa section générale.
--   WITH RECURSIVE sous(id) AS (SELECT :id UNION ALL
--     SELECT n.id FROM cpge_noeuds n JOIN sous ON n.parent_id = sous.id)
--   SELECT uuid FROM exercise_cpge WHERE noeud_id IN (SELECT id FROM sous)
CREATE TABLE IF NOT EXISTS exercise_cpge (
  uuid TEXT NOT NULL,
  noeud_id TEXT NOT NULL,
  origine TEXT NOT NULL,            -- source | llm | concordance | chapitre
  confiance REAL,                   -- 0..1, NULL pour un rattachement de \cpge{}
  PRIMARY KEY (uuid, noeud_id)
);

CREATE INDEX IF NOT EXISTS idx_exercise_cpge_noeud ON exercise_cpge(noeud_id);
