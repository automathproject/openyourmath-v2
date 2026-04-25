# Synchronisation du cache d'embeddings entre machines

## Principe

Les embeddings vectoriels (BAAI/bge-m3, 1024 dims) sont stockés dans
`cache/embeddings/{uuid}.json` — exclus de Git mais synchronisables manuellement
via `rsync`. Comme ils sont déterministes, il suffit de les transférer une fois
pour qu'une nouvelle machine évite de régénérer 8 000+ appels API.

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
- **Divergence** → cache ignoré, l'API Albert sera rappelée au prochain `pnpm index:exercises`

Cela garantit qu'un exercice modifié ne réutilisera pas un embedding périmé.

## Workflow : première installation / nouveau clone

```bash
# Sur la machine source (celle qui a déjà les embeddings) :
rsync -avz --progress \
  cache/embeddings/ \
  user@machine-cible:~/openyourmath-v2/cache/embeddings/

# Sur la machine cible, reconstruire la base (les embeddings seront restaurés) :
pnpm build:db
```

`pnpm build:db` appelle automatiquement `restoreEmbeddingsFromCache()` qui repeupled
la table `exercise_embeddings` depuis le cache local.

## Workflow : mise à jour incrémentale

```bash
# Synchroniser uniquement les fichiers nouveaux ou modifiés
rsync -avz --progress --update \
  cache/embeddings/ \
  user@machine-cible:~/openyourmath-v2/cache/embeddings/
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
   💾 Taille totale : 134.2 Mo

📊 Comparaison cache ↔ base SQLite :
   En cache          : 8634
   En base (emb.)    : 8634
   ✅ Aucune incohérence détectée
```

## Ce qui est versionné vs ce qui ne l'est pas

| Artefact | Versionné Git | Cache local | Régénérable |
|---|---|---|---|
| `content/metadata/{uuid}.json` | ✅ oui | — | Via Albert Chat (LLM) |
| `cache/embeddings/{uuid}.json` | ❌ non | ✅ oui | Via Albert Embedding |
| `data/exercises.sqlite` | ❌ non | — | Via `pnpm build:db` |

## Régénération complète sans cache

Si le cache est absent ou corrompu, `pnpm index:exercises` rappelle l'API Albert
pour chaque exercice indexé. Le cache est reconstruit automatiquement à la volée.

```bash
pnpm index:exercises          # régénère seulement les exercices sans indexed_at
pnpm index:exercises:force    # force la régénération de tous les embeddings
```
