# Pipeline de recherche hybride

## Schéma

```
requête utilisateur
       │
       ├─── embed(query) ──────────────────► Albert API (BAAI/bge-m3, 1024d)
       │         ↑ lancé en premier (async)      │
       │                                         ▼
       └─── BM25 / FTS5 ──────────────────► top-50 UUIDs + rank
             (better-sqlite3, synchrone)          │
                      │                           │
                      └──────── RRF merge ◄───────┘
                                    │
                          1/(60+rank_BM25) + 1/(60+rank_vec)
                                    │
                                 top-50
                                    │
                          ┌─────────┴──────────┐
                     rerank=false          rerank=true
                          │                    │
                       top-N              Albert API
                          │         (BAAI/bge-reranker-v2-m3)
                          │                    │
                          │            re-tri des 50
                          │                    │
                          │          seuil relatif : score >= top * 0.05
                          │          (élimine les hors-sujet)
                          │                    │
                          │               top-N restants
                          │                    │
                          └─────────┬──────────┘
                                    │
                                hydrate()
                         (SELECT * FROM exercises
                          WHERE uuid IN (…))
                                    │
                               résultats
```

## Fichiers

| Fichier | Rôle |
|---------|------|
| `vectorStore.js` | Charge les 8 633 embeddings en mémoire au démarrage (lazy, singleton). Expose `cosineTopK(vec, k, allowedUuids?)`. |
| `hybridSearch.js` | Orchestre le pipeline complet. `runBM25` est synchrone, `embed()` est lancé en parallèle pour qu'ils se chevauchent. |
| `../ia/albert.js` | Client Albert API : `embed()`, `rerank()`, `embedBatch()`, `withRetry()`. Lit `process.env.ALBERT_API_KEY` (ponté depuis `.env` via `hooks.server.js`). |
| `../ia/rerank.js` | Wrapper rerank avec timeout 2 s et fallback ordre RRF si Albert ne répond pas. |

## Points clés

- **Parallélisme** : `embed()` démarre avant `runBM25()` (synchrone). Le coût total est `max(BM25, embed)` et non `BM25 + embed`.
- **Pool intermédiaire** : BM25 et vecteur récupèrent chacun top-50, RRF en fusionne ≤ 100, rerank en re-trie 50, hydrate en retourne N.
- **Dégradation gracieuse** : si l'embed échoue (timeout, quota), la recherche continue sur BM25 seul. Si le rerank échoue, l'ordre RRF est conservé.
- **Seuil dynamique rerank** : après le tri du cross-encoder, seuls les résultats avec `rerankScore >= topScore * 0.05` sont conservés. Cela élimine les résultats hors-sujet sans fixer de seuil absolu (le seuil s'adapte au score du meilleur résultat).
- **Filtrages** : les filtres SQL s'appliquent côté BM25 (clause `WHERE`) et côté vectoriel (filtre `allowedUuids` en mémoire avant `cosineTopK`).
- **Document rerank** : `"${title}\n${summary}"` — ~80 tokens, dans la fenêtre 512 du cross-encoder.
