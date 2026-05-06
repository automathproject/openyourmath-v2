# Synchronisation du cache d'embeddings entre machines

## Principe

Les embeddings vectoriels (BAAI/bge-m3, 1024 dims) sont stockés à deux endroits :

- **`data/exercises.sqlite`** (table `exercise_embeddings`) — source de vérité, baked dans l'image Docker
- **`cache/embeddings/{uuid}.json`** — cache local exclu de Git, utilisé par `index-exercises.js` pour éviter de rappeler l'API

```
cache/embeddings/
├── 4R9m.json    # { uuid, model, dimension, content_hash, embedding_base64, created_at }
├── YBwt.json
└── …
```

## Garde-fou : content_hash

Chaque fichier de cache contient le `content_hash` (SHA256 des blocs sémantiques
de l'exercice). Lors du chargement, ce hash est comparé à celui en base :

- **Correspondance** → embedding utilisé tel quel
- **Divergence** → cache ignoré, l'embedding sera recalculé au prochain `pnpm index:exercises`

Cela garantit qu'un exercice modifié ne réutilisera pas un embedding périmé.

## Workflow recommandé : nouvelle machine

La DB contient déjà tous les vecteurs. Le script `cache:embeddings:restore` les exporte
vers `cache/embeddings/` sans aucun appel API :

Prérequis :

- Node 22 actif (`source ~/.nvm/nvm.sh && nvm use`)
- dépendances installées (`pnpm install`)
- GitHub CLI installé et connecté (`gh auth login`)

```bash
# 1. Ancienne machine : créer et publier un snapshot GitHub Release
pnpm build:content
pnpm index:exercises
pnpm db:snapshot:pack
pnpm db:snapshot:publish

# 2. Nouvelle machine : télécharger la DB et restaurer le cache local
pnpm db:snapshot:download
pnpm db:snapshot:restore

# 3. Lancer l'indexation — les exercices déjà embeddés sont skippés
pnpm index:exercises
```

Par défaut, ces commandes utilisent le tag `db-snapshot-dev` et l'archive
`data/openyourmath-db-snapshot.tgz`. Le snapshot est une copie SQLite cohérente
produite avec `VACUUM INTO`, ce qui évite les problèmes liés aux fichiers WAL
(`data/exercises.sqlite-wal`, `data/exercises.sqlite-shm`).

Pour nommer un snapshot daté :

```bash
pnpm db:snapshot:pack data/openyourmath-db-20260506.tgz
pnpm db:snapshot:publish db-snapshot-20260506 data/openyourmath-db-20260506.tgz

pnpm db:snapshot:download db-snapshot-20260506 data/openyourmath-db-20260506.tgz
pnpm db:snapshot:restore data/openyourmath-db-20260506.tgz
```

## Alternative : rsync du cache

Si la DB n'est pas transférable (trop grosse, accès restreint) :

```bash
# Synchroniser uniquement les fichiers nouveaux ou modifiés
rsync -avz --progress --update \
  machine1:~/openyourmath-v2/cache/embeddings/ \
  cache/embeddings/
```

## Vérifier l'état du cache

```bash
pnpm cache:embeddings:stats           # résumé rapide
pnpm cache:embeddings:check           # rapport détaillé avec incohérences
```

Exemple de sortie :

```
📊 Cache d'embeddings — statistiques
   Répertoire : /home/user/openyourmath-v2/cache/embeddings

📁 8634 fichier(s) en cache
   ✅ Valides       : 8634
   💾 Taille totale : 68 Mo

📊 Comparaison cache ↔ base SQLite :
   En cache          : 8634
   En base (emb.)    : 8634
   ✅ Aucune incohérence détectée
```

## Ce qui est versionné vs ce qui ne l'est pas

| Artefact                       | Versionné Git | Cache local | Régénérable                                                      |
| ------------------------------ | ------------- | ----------- | ---------------------------------------------------------------- |
| `content/metadata/**/*.json`   | ✅ oui        | —           | Via LLM (Ollama ou Albert)                                       |
| `cache/embeddings/{uuid}.json` | ❌ non        | ✅ oui      | Via `pnpm cache:embeddings:restore` (depuis DB) ou Ollama/Albert |
| `data/exercises.sqlite`        | ❌ non        | —           | Via `pnpm build:db` + `pnpm index:exercises`                     |

## Régénération complète sans cache

Si le cache est absent ou corrompu, `pnpm index:exercises` recalcule les embeddings
via Ollama (si disponible) ou Albert. Le cache est reconstruit automatiquement à la volée.

```bash
pnpm index:exercises          # régénère seulement les exercices sans indexed_at
pnpm index:exercises:force    # force la régénération de tous les embeddings
```
