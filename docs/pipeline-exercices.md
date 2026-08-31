# Pipeline de construction de la base de données d'exercices

## Vue d'ensemble

Le pipeline transforme des fichiers LaTeX sources en une base de données SQLite enrichie sémantiquement, avec une indexation plein-texte et des embeddings vectoriels pour la recherche.

```
Sources LaTeX → Parsing → Cache → Compilation TikZ → Base SQLite → [Optionnel] Indexation sémantique
 (content/     (parse-   (cache/)  (build-tikz.js)   (build-db.js)   (Albert API)
 exercises/)   latex.js)
```

**Caractéristiques principales :**

- Construction incrémentale basée sur des hash SHA256 (ne retraite que les fichiers modifiés)
- Double pipeline : Pipeline A (traitement du contenu) et Pipeline B (indexation sémantique)
- Traçabilité du fichier primaire via `source_path`, conservée dans le cache, la base SQLite et les métadonnées sémantiques
- Indexation plein-texte FTS5 avec fallback sur table indexée classique
- Recherche sémantique via l'API Albert (gouvernement français)

---

## 1. Sources de données

### Exercices LaTeX

**Chemin :** [content/exercises/](content/exercises/)

Les sources éditoriales sont importées depuis exobase ; voir
[Synchroniser le contenu depuis exobase](sync-exobase.md) avant de modifier ou
de publier le corpus.

Chaque exercice est un fichier `.tex` organisé par dossier (ex. `amscc/`, `exo7/`). Structure d'un fichier `.tex` :

```latex
\uuid{YBwt}
\titre{Titre de l'exercice}
\chapitre{Analyse}
\sousChapitre{Suites}
\theme{suites numériques, convergence}
\niveau{L1}
\difficulte{2}
\module{M1}
\auteur{Prénom Nom}
\organisation{AMSCC}
\datecreate{2024-01-15}

\texte{
  Énoncé général de l'exercice avec du LaTeX : $f(x) = x^2$.
}
\question{
  Montrer que la suite $(u_n)$ converge.
}
\indication{
  Utiliser le théorème des suites monotones bornées.
}
\reponse{
  La suite converge vers $\ell = 1$.
}
```

Le chemin relatif au dossier `content/exercises/` est conservé comme identifiant de provenance `source_path`.
Exemples :

| Fichier primaire                       | `source_path`        |
| -------------------------------------- | -------------------- |
| `content/exercises/amscc/2F9q.tex`     | `amscc/2F9q.tex`     |
| `content/exercises/exo7/8-L3/0VzY.tex` | `exo7/8-L3/0VzY.tex` |

Ce chemin sert ensuite à rattacher le cache, les images et les métadonnées sémantiques au même fichier source.

### Métadonnées auteurs

**Fichier :** [content/authors.json](content/authors.json)

Contient pour chaque auteur : pseudo, prénom, nom, email, organisation, code licence et URL licence. Utilisé pour la résolution des noms lors de la construction de la base.

### Variables d'environnement

**Fichier :** `.env`

```env
# Ollama — LLM local (prioritaire pour chat et embedding)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=mistral-small3.2:24b
OLLAMA_EMBED_MODEL=bge-m3

# Albert — fallback si Ollama indisponible
ALBERT_API_KEY=sk-...
ALBERT_BASE_URL=https://albert.api.etalab.gouv.fr/v1
```

Ollama est interrogé en priorité au démarrage de `index-exercises.js`. Si le service répond et que les modèles sont installés, Albert n'est pas sollicité.

---

## 2. Étape 1 — Parsing LaTeX

**Script :** [scripts/parse-latex.js](scripts/parse-latex.js)

**Entrée :** Fichiers `.tex` dans [content/exercises/](content/exercises/)  
**Sortie :** Fichiers `.json` dans [cache/exercises/](cache/exercises/) + artefacts dans [static/artifacts/](static/artifacts/)

### Traitement

1. **Extraction des métadonnées** via les commandes LaTeX (`\uuid`, `\titre`, `\chapitre`, `\niveau`, `\difficulte`, etc.)

2. **Extraction des blocs de contenu** dans l'ordre d'apparition :

   | Commande LaTeX     | Type de bloc |
   | ------------------ | ------------ |
   | `\texte{...}`      | `text`       |
   | `\question{...}`   | `question`   |
   | `\indication{...}` | `indication` |
   | `\reponse{...}`    | `reponse`    |
   | `\code{...}`       | `code`       |

3. **Traitement des artefacts** :
   - **TikZ** : extraction des environnements `tikzpicture` → stockage en JSON, placeholder `<img>` pour compilation ultérieure
   - **Code** : extraction des blocs `SaveVerbatim` → conversion HTML avec coloration syntaxique
   - **Images** : résolution et copie des `\includegraphics{...}` vers [static/artifacts/images/](static/artifacts/images/)

   Les images sont recherchées dans `content/images/{source}/`, où `{source}` est le premier segment de `source_path`.
   Par exemple `exo7/8-L3/0VzY.tex` résout ses images dans `content/images/exo7/`.

4. **Conversion LaTeX → HTML** via Pandoc (utilitaire [scripts/utils/tex2html-utils.js](scripts/utils/tex2html-utils.js))

5. **Génération du preview** : troncature sécurisée à 150 caractères sans casser les balises HTML ni les délimiteurs mathématiques (`$...$`, `\[...\]`)

6. **Écriture de provenance** : le JSON de cache contient `source_path` et `source_hash`.

### Cache incrémental

Le gestionnaire de cache ([scripts/utils/cache-manager.js](scripts/utils/cache-manager.js)) maintient un fichier `.cache-meta.json` avec les hash SHA256 de chaque fichier `.tex`. Avec le flag `--incremental`, les fichiers inchangés sont ignorés.

```bash
pnpm build:cache          # Build incrémental (recommandé)
pnpm build:cache:full     # Rebuild complet
```

---

## 3. Étape 2 — Compilation TikZ

**Script :** [scripts/build-tikz.js](scripts/build-tikz.js)

**Entrée :** Fichiers JSON d'artefacts dans [static/artifacts/](static/artifacts/)  
**Sortie :** Fichiers SVG dans [static/artifacts/tikz/](static/artifacts/tikz/)

Pour chaque bloc TikZ référencé dans les artefacts, le script compile le code LaTeX en SVG via [scripts/utils/tikz2svg-utils.js](scripts/utils/tikz2svg-utils.js) et met à jour le JSON d'artefact avec le contenu SVG généré. Les erreurs de compilation sont capturées sans bloquer le pipeline.

---

## 4. Étape 3 — Construction de la base SQLite

**Script :** [scripts/build-db.js](scripts/build-db.js) (895 lignes)  
**Schéma :** [scripts/schema.sql](scripts/schema.sql)

**Entrée :** Fichiers JSON du cache  
**Sortie :** [data/exercises.sqlite](data/exercises.sqlite)

### Schéma de la base

#### Table `exercises`

| Colonne         | Type    | Description                                                 |
| --------------- | ------- | ----------------------------------------------------------- |
| `uuid`          | TEXT PK | Identifiant unique de l'exercice                            |
| `title`         | TEXT    | Titre                                                       |
| `chapter`       | TEXT    | Chapitre                                                    |
| `subchapter`    | TEXT    | Sous-chapitre                                               |
| `theme`         | TEXT    | Thèmes (séparés par virgule)                                |
| `level`         | TEXT    | Niveau (L1, L2, L3, ...)                                    |
| `difficulty`    | INTEGER | Difficulté (1–5)                                            |
| `module`        | TEXT    | Module                                                      |
| `content_json`  | TEXT    | Blocs de contenu sérialisés en JSON                         |
| `source_path`   | TEXT    | Chemin relatif du `.tex` source depuis `content/exercises/` |
| `source_hash`   | TEXT    | Hash SHA256 du fichier `.tex`                               |
| `content_hash`  | TEXT    | Hash SHA256 des blocs sémantiques (Pipeline A)              |
| `summary`       | TEXT    | Résumé généré par LLM (Pipeline B)                          |
| `concepts`      | TEXT    | Concepts théoriques en JSON (Pipeline B)                    |
| `methods`       | TEXT    | Méthodes de résolution en JSON (Pipeline B)                 |
| `objects`       | TEXT    | Objets mathématiques en JSON (Pipeline B)                   |
| `indexed_at`    | TEXT    | Timestamp de dernière indexation sémantique                 |
| `preview`       | TEXT    | Aperçu HTML du premier bloc                                 |
| `hasIndication` | INTEGER | Flag booléen                                                |
| `hasSolution`   | INTEGER | Flag booléen                                                |

#### Table `exercise_authors`

Relation N-N entre exercices et auteurs. Contient pseudo, nom affiché, code et URL de licence.

#### Table `exercise_embeddings`

Vecteurs d'embedding BAAI/bge-m3 (1024 dimensions, stockés en BLOB Float32Array). Cascade de suppression sur UUID.

#### Table `fts_exercises`

Table virtuelle FTS5 pour la recherche plein-texte. Champs indexés : `uuid`, `title`, `theme`, `chapter`, `module`, `level`. Tokenisation unicode61 avec suppression des diacritiques.

### Algorithme de build

1. Initialisation du schéma et migrations automatiques (ajout de colonnes manquantes)
2. Chargement des exercices depuis le cache JSON
   - Si un ancien cache ne contient pas `source_path`, il est reconstruit depuis son chemin sous `cache/exercises/`.
3. Résolution des auteurs contre [content/authors.json](content/authors.json) :
   - Tentative par pseudo exact
   - Conversion "Nom, Prénom" → "Nom Prénom"
   - Correspondance après normalisation (minuscules, sans diacritiques)
   - Inversion "Prénom Nom" → "Nom Prénom"
   - Fallback : utilisation du texte brut
4. Calcul du `content_hash` : SHA256 des blocs sémantiques (`texte`, `question`, `reponse`, `indication`, `hint`, `answer`, `solution`)
5. Extraction du texte pour FTS5 : nettoyage LaTeX, simplification des formules (`\frac{a}{b}` → "a sur b", `\sqrt{x}` → "racine de x")
6. Upsert dans la base (préserve les colonnes Pipeline B lors des mises à jour)
7. Nettoyage : suppression des exercices absents du cache
8. Statistiques : comptage par chapitre, module, niveau, difficulté

Les exercices dont le `content_hash` a changé ont leur `indexed_at` mis à NULL pour déclencher une réindexation sémantique.

Au démarrage, `build-db.js` charge aussi le **store Albert versionné** (`content/metadata/**/*.json`) et injecte ses données dans l'upsert si le `content_hash` correspond et si le `source_path` correspond quand il est présent. Cela permet de reconstruire une base fraîche après `pnpm clean` sans rappeler l'API.

---

## 5. Étape 4 — Indexation sémantique (Pipeline B)

**Script de production :** [scripts/index-exercises.js](scripts/index-exercises.js)  
**Librairie :** [src/lib/ia/summarize.js](src/lib/ia/summarize.js), [src/lib/ia/ollama.js](src/lib/ia/ollama.js), [src/lib/ia/albert.js](src/lib/ia/albert.js)  
**Store versionné :** [content/metadata/](content/metadata/) — un `.json` par exercice, rangé selon le même chemin relatif que le `.tex`, commité dans git

**Déclencheur :** Exercices avec `indexed_at IS NULL` (nouveaux ou contenu modifié)

### Versioning des métadonnées Albert

Les appels LLM sont coûteux. Les métadonnées générées (`summary`, `concepts`, `methods`, `objects`) sont persistées dans `content/metadata/` selon l'arborescence de `source_path` et commitées dans git. Elles survivent à `pnpm clean` et permettent de reconstruire la base sans rappeler l'API.

Le rangement suit maintenant l'arborescence du fichier primaire :

| `source_path`        | Métadonnée versionnée                  |
| -------------------- | -------------------------------------- |
| `amscc/2F9q.tex`     | `content/metadata/amscc/2F9q.json`     |
| `exo7/8-L3/0VzY.tex` | `content/metadata/exo7/8-L3/0VzY.json` |

Les anciens fichiers plats `content/metadata/{uuid}.json` restent lisibles par compatibilité, mais les nouvelles générations utilisent l'arborescence miroir.

Chaque fichier versionné contient :

```json
{
  "uuid": "YBwt",
  "source_path": "amscc/YBwt.tex",
  "summary": "L'exercice demande de...",
  "concepts": ["théorème central limite", "convergence en loi"],
  "methods": ["standardisation", "approximation gaussienne"],
  "objects": ["suite de variables iid", "proportion"],
  "content_hash": "a3f8c2...",
  "model": "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
  "indexed_at": "2025-04-25T10:30:00.000Z"
}
```

Le `content_hash` permet à `build-db.js` de détecter si le fichier versionné est encore valide (contenu source inchangé). `source_path` évite de réutiliser une métadonnée déplacée ou ambiguë sur un mauvais fichier primaire. Si le contenu a changé, les métadonnées versionnées sont ignorées et l'exercice est marqué pour réindexation.

Les embeddings sont stockés dans `cache/embeddings/{uuid}.json` (exclu de Git) et dans la table `exercise_embeddings` de la DB.
Voir [docs/embeddings-sync.md](docs/embeddings-sync.md) pour le workflow multi-machines.

### Fournisseurs LLM : Ollama (prioritaire) + Albert (fallback)

Au démarrage, `index-exercises.js` interroge Ollama via `checkOllamaAvailable()` :

| Condition                            | Chat (résumé)                    | Embedding                     |
| ------------------------------------ | -------------------------------- | ----------------------------- |
| Ollama disponible + modèle installé  | Ollama (`OLLAMA_CHAT_MODEL`)     | Ollama (`OLLAMA_EMBED_MODEL`) |
| Ollama indisponible ou modèle absent | Albert (`Mistral-Small-3.2-24B`) | Albert (`BAAI/bge-m3`)        |

Les modèles sont configurés dans `.env`. Les vecteurs produits par `bge-m3` via Ollama et via Albert sont identiques (même modèle).

**Modèles Albert de référence :**

| Usage         | Modèle                                          |
| ------------- | ----------------------------------------------- |
| Embedding     | `BAAI/bge-m3` (1024 dims)                       |
| Reranker      | `BAAI/bge-reranker-v2-m3`                       |
| Chat (résumé) | `mistralai/Mistral-Small-3.2-24B-Instruct-2506` |

### Processus de résumé

Pour chaque exercice à indexer :

1. **Construction du contexte LLM** avec budget prioritaire (8 000 caractères max) :
   - Ordre de remplissage : ÉNONCÉ → QUESTIONS → CORRIGÉS (tronqués à 3 000 chars chacun) → INDICATIONS
   - Les questions sont toujours incluses en entier ; les corrigés et indications sont écrêtés si le budget est épuisé

2. **Appel LLM** (température 0, max 800 tokens, mode JSON) :
   - Le prompt demande un JSON avec : `summary` (2-3 phrases), `concepts[]` (3-8 items), `methods[]` (2-5 items), `objects[]` (2-5 items)
   - Vocabulaire mathématique français exigé, pas d'abréviations ni de LaTeX dans les listes

3. **Parsing robuste du JSON** avec fallbacks (suppression de code fences Markdown, extraction entre accolades) et normalisation des champs (une string CSV est convertie en tableau)

4. **Retry** : 3 tentatives sur l'ensemble appel + parsing + validation — couvre les erreurs réseau, les 429/5xx et les réponses mal formées des modèles locaux

5. **Sauvegarde versionnée** dans `content/metadata/{source_path sans extension}.json`

6. **Mise à jour de la base** : `summary`, `concepts`, `methods`, `indexed_at`

7. **Génération de l'embedding** :
   - Texte concaténé : résumé + "Concepts: [...]" + "Méthodes: [...]" + "Objets: [...]"
   - Stocké en Float32Array dans `exercise_embeddings` + `cache/embeddings/{uuid}.json`

### Journal d'erreurs

Les erreurs non-quota sont persistées dans `cache/index-errors.json` après chaque échec (pas seulement en fin de run). Le fichier est également écrit si le processus est interrompu par `Ctrl+C`. Format :

```json
{
  "run_at": "2026-04-29T10:00:00.000Z",
  "total": 8580,
  "erreurs": [
    {
      "position": 148,
      "uuid": "C6J8",
      "title": "exo7 323",
      "message": "...",
      "at": "..."
    }
  ]
}
```

Les exercices en erreur gardent `indexed_at IS NULL` et sont automatiquement repris au prochain `pnpm index:exercises`.

**Scripts de test :** [scripts/ia/test-albert.js](scripts/ia/test-albert.js), [scripts/ia/test-summarize.js](scripts/ia/test-summarize.js) (utilise Ollama par défaut)

---

## 6. Runtime applicatif

**Dossier :** [src/lib/db/](src/lib/db/)

La base est ouverte en **lecture seule** au runtime (mode WAL + memory mapping).

| Fichier                                   | Rôle                                    |
| ----------------------------------------- | --------------------------------------- |
| [connection.js](src/lib/db/connection.js) | Singleton de connexion SQLite           |
| [queries.js](src/lib/db/queries.js)       | Recherche FTS5, filtres, pagination     |
| [stats.js](src/lib/db/stats.js)           | Statistiques par chapitre/module/niveau |

---

## 7. Commandes NPM

```bash
# Construction incrémentale (usage normal)
pnpm build:cache          # Parsing LaTeX → cache JSON
pnpm build:tikz           # Compilation TikZ → SVG (à lancer si les sources changées en contiennent)
pnpm build:db             # Cache → SQLite (charge aussi content/metadata/**/*.json)
pnpm build:content:incremental:with-tikz # Enchaîne les trois étapes ci-dessus

# Indexation sémantique Pipeline B
pnpm index:exercises                        # Exercices non indexés (indexed_at IS NULL)
pnpm index:exercises:force                  # Réindexe tout
node scripts/index-exercises.js --uuid UUID # Un seul exercice
node scripts/index-exercises.js --limit 50  # Limiter à 50 exercices
node scripts/index-exercises.js --dry-run   # Simuler sans écrire
# Après exécution : commiter les fichiers content/metadata/**/*.json
# En cas d'erreurs : consulter cache/index-errors.json

# Construction complète (premier run ou reset)
pnpm build:cache:full     # Parsing complet sans cache
pnpm build:content:full   # = build:cache:full + build:tikz + build:db

# Raccourcis
pnpm build:content        # alias compatible de build:content:incremental (sans TikZ)
pnpm build:content:incremental # = build:cache + build:db (sans TikZ)
pnpm build                # = build:content + build:app (Vite/SvelteKit)

# Développement
pnpm dev:full             # = build:content + pnpm dev

# Statistiques
pnpm build:stats          # Compte .tex, .json cache, exercices en DB

# Cache embeddings
pnpm cache:embeddings:restore   # Reconstruit cache/embeddings/ depuis la DB (utile sur nouvelle machine)
pnpm cache:embeddings:stats     # Statistiques du cache local
pnpm cache:embeddings:check     # Rapport détaillé avec incohérences cache ↔ DB

# Snapshot DB pour transfert entre machines (via GitHub Release + gh)
pnpm db:snapshot:pack           # Crée data/openyourmath-db-snapshot.tgz
pnpm db:snapshot:publish        # Publie l'archive sur le tag db-snapshot-dev
pnpm db:snapshot:download       # Télécharge l'archive depuis db-snapshot-dev
pnpm db:snapshot:restore        # Restaure data/exercises.sqlite puis cache/embeddings/

# Maintenance
pnpm authors:add-exo7-license   # Mise à jour licences auteurs
pnpm clean                      # Supprime cache, data, artifacts
pnpm reset                      # clean + build:content:full
```

---

## 8. Flux de données complet

```
/content/exercises/{source_path}
          │
          │ source_path conservé dans le cache et la DB
          ▼
  parse-latex.js ──── Pandoc (LaTeX → HTML)
          │           tikz2svg-utils.js (TikZ → SVG)
          │           cache-manager.js (hash incrémental)
          │
          ▼
/cache/exercises/{source_path sans extension}.json
/static/artifacts/{uuid}.json
/static/artifacts/tikz/{uuid}-{n}.svg
/static/artifacts/images/
          │
          ▼
    build-db.js ──── authors.json (résolution auteurs)
          │           schema.sql (init + migrations)
          │
          ▼
/data/exercises.sqlite
  ├─ exercises (métadonnées + contenu HTML)
  ├─ exercise_authors (auteurs résolus)
  ├─ fts_exercises (index FTS5)
  └─ exercise_embeddings (vecteurs Pipeline B)
          │
          ├──────────────────────────────────┐
          ▼                                  ▼
  Runtime SvelteKit                  Pipeline B
  src/lib/db/ (lecture seule)        scripts/index-exercises.js
  - Recherche FTS5                   - Résumé LLM (Albert Chat)
  - Filtres auteur/niveau            - Sauvegarde content/metadata/{source_path sans extension}.json ← git
  - Pagination                       - Embedding (BAAI/bge-m3) → exercise_embeddings

                                     content/metadata/{source_path sans extension}.json
                                     ↓ (chargé par build-db.js)
                                     Colonnes summary/concepts/methods/indexed_at
                                     restaurées sans rappeler l'API
```

---

## 9. Points d'attention et limites connues

### Robustesse

- **La compilation TikZ** échoue silencieusement : les erreurs sont capturées mais ne bloquent pas le pipeline. Un exercice avec un TikZ défectueux sera quand même inséré en base, mais sans visuel.
- **Le Pipeline B n'est pas déclenché automatiquement** : il faut appeler manuellement le script de résumé/embedding. Seul le flag `indexed_at IS NULL` signale les exercices à traiter.
- **Le parsing des auteurs** comporte plusieurs niveaux de fallback avec une logique d'inversion de nom ajoutée récemment, ce qui indique des cas limites non couverts par le format d'origine.

### Performance

- Le parsing LaTeX et la construction de la base sont **séquentiels** (pas de parallélisme entre exercices).
- Le cache incrémental ne détecte que les changements de fichiers `.tex` — une modification de `authors.json` ou de la configuration nécessite un rebuild complet.
- L'optimisation FTS5 (`optimize`) est effectuée en fin de build ; sur de grandes bases, un rebuild partiel laisse l'index non optimisé.

### Migration de schéma

- Les migrations de colonnes sont gérées manuellement dans `build-db.js` (fonction `runMigrations`). Il n'y a pas de framework de migration versionné — les évolutions de schéma doivent être ajoutées manuellement à cette fonction.
- La colonne `source_path` est ajoutée automatiquement aux bases existantes. Pour les caches anciens, `build-db.js` la reconstruit depuis le chemin du JSON sous `cache/exercises/`.

### Dépendances externes requises

- **Pandoc** : doit être installé sur le système pour la conversion LaTeX → HTML
- **LaTeX** (pdflatex/lualatex) : requis pour la compilation TikZ → SVG
- **SQLite avec FTS5** : le fallback sur table indexée classique est prévu mais la recherche plein-texte sera dégradée

---

## 10. Structure des fichiers clés

```
scripts/
├── parse-latex.js              # Étape 1 : parsing LaTeX → cache JSON
├── build-db.js                 # Étape 3 : cache → SQLite
├── build-tikz.js               # Étape 2 : TikZ → SVG
├── index-exercises.js          # Pipeline B : résumés LLM + embeddings
├── schema.sql                  # Schéma de la base de données
├── analyze_chapters.js         # Analyse de la structure des chapitres
├── update-authors-licenses.js  # Mise à jour des licences auteurs
├── ia/
│   ├── test-albert.js          # Tests de l'API Albert
│   ├── test-summarize.js       # Test de résumé sur UUIDs précis (Ollama par défaut)
│   ├── test-client.js          # Tests du client Albert
│   ├── cache-stats.js          # Statistiques du cache d'embeddings
│   └── restore-embedding-cache.js  # Reconstruit cache/embeddings/ depuis la DB
└── utils/
    ├── content-paths.js         # Racines et normalisation des chemins content/cache/metadata
    ├── cache-manager.js        # Gestion du cache incrémental
    ├── tex2html-utils.js       # Conversion LaTeX → HTML (Pandoc)
    ├── code2html-utils.js      # Blocs SaveVerbatim → HTML
    ├── image-artifacts.js      # Gestion des \includegraphics
    ├── tikz2svg-utils.js       # Compilation TikZ → SVG
    ├── previewUtils.js         # Génération de preview sécurisée
    ├── hash-utils.js           # Calcul de hash SHA256
    └── latex-only-text-extraction.js  # Extraction texte pour FTS5

src/lib/
├── ia/
│   ├── albert.js               # Client API Albert (chat, embedding, rerank)
│   ├── ollama.js               # Client Ollama local (interface compatible albert.js)
│   ├── summarize.js            # Résumé LLM + génération embedding (Ollama ou Albert)
│   └── embedding-cache.js      # Lecture/écriture du cache local cache/embeddings/
└── db/
    ├── connection.js           # Connexion SQLite singleton (lecture seule)
    ├── queries.js              # Requêtes FTS5, filtres, pagination
    └── stats.js                # Requêtes statistiques

content/
├── exercises/                  # Sources .tex organisés par dossier
├── images/                     # Images sources organisées par fournisseur/source
├── metadata/                   # Métadonnées Albert versionnées, miroir de exercises/
└── authors.json                # Référentiel des auteurs

cache/exercises/                # Cache JSON des exercices parsés
static/artifacts/               # Artefacts compilés (SVG, images, JSON)
data/exercises.sqlite           # Base finale (59 MB)
```
