# Albert API — Documentation pour OpenYourMath v2

Documentation condensée pour intégrer les services Albert (embeddings, reranker, LLM) dans le moteur de recherche d'exercices mathématiques.

## 1. Informations générales

**Fournisseur** : Etalab / DINUM (service de l'État français)
**Public cible** : Agents de la fonction publique d'État
**Documentation officielle** : <https://albert.sites.beta.gouv.fr>
**Référence API** : <https://albert.api.etalab.gouv.fr/reference>
**Code source** : <https://github.com/etalab-ia/OpenGateLLM>

**Base URL** : `https://albert.api.etalab.gouv.fr/v1`

**Compatibilité** : L'API est compatible avec le format OpenAI pour les endpoints `/v1/chat/completions`, `/v1/embeddings`, `/v1/audio/transcriptions`. L'endpoint `/v1/rerank` suit le format HuggingFace Text Embeddings Inference.

**Avantages clés** :
- Gratuit (dans les limites d'usage)
- Hébergement sur infrastructure française, conformité RGPD
- Modèles open-source (Apache 2.0, MIT), pas de lock-in
- Stack cohérente embedding + reranker de la même famille (BGE)

## 2. Authentification

Toutes les requêtes nécessitent une clé API générée sur le playground Albert.

```http
Authorization: Bearer VOTRE_CLE_API
```

**Obtention** : formulaire sur <https://albert.sites.beta.gouv.fr/access/>

**Configuration dans le projet** : stocker dans `.env`, ne jamais committer.

```bash
# .env
ALBERT_API_KEY=sk-...
ALBERT_BASE_URL=https://albert.api.etalab.gouv.fr/v1
```

## 3. Modèles pertinents pour OpenYourMath

| Alias interne | Modèle sous-jacent | Usage |
|---|---|---|
| `embeddings-small` | `BAAI/bge-m3` | Embeddings pour indexation et recherche vectorielle |
| `bge-reranker-v2-m3` | `BAAI/bge-reranker-v2-m3` | Reranking du top-N après retrieval |
| `openweight-large` | `openai/gpt-oss-120b` | Génération des résumés d'exercices (qualité max) |
| `openweight-medium` | `mistralai/Mistral-Small-3.2-24B` | Génération de résumés (bon compromis) |
| `openweight-small` | `mistralai/Ministral-3-8B` | Résumés rapides pour tests |

Les noms exacts à utiliser dans l'API peuvent varier — interroger `GET /v1/models` pour obtenir la liste précise.

## 4. Endpoint `/v1/embeddings`

### Requête

```http
POST https://albert.api.etalab.gouv.fr/v1/embeddings
Content-Type: application/json
Authorization: Bearer VOTRE_CLE_API

{
  "model": "embeddings-small",
  "input": "Texte à vectoriser"
}
```

### Paramètres

- `model` (string, requis) : identifiant du modèle d'embeddings
- `input` (string | string[], requis) : texte unique ou tableau de textes (batch)
- `encoding_format` (string, optionnel) : `"float"` (défaut) ou `"base64"`

### Réponse

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.0123, -0.0456, ...]
    }
  ],
  "model": "embeddings-small",
  "usage": {
    "prompt_tokens": 42,
    "total_tokens": 42
  }
}
```

### Notes importantes

- BGE-M3 produit des vecteurs de **1024 dimensions**
- Contexte max : **8192 tokens** — largement suffisant pour un résumé d'exercice
- BGE-M3 ne distingue pas query et document (contrairement à certains modèles comme E5 qui demandent des préfixes)
- Si le contexte est dépassé, l'API renvoie une erreur explicite

### Client JavaScript

```javascript
// src/lib/embeddings/albert.js
const ALBERT_BASE_URL = process.env.ALBERT_BASE_URL;
const ALBERT_API_KEY = process.env.ALBERT_API_KEY;

export async function embedText(text) {
  const response = await fetch(`${ALBERT_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ALBERT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'embeddings-small',
      input: text
    })
  });

  if (!response.ok) {
    throw new Error(`Albert embeddings error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return new Float32Array(data.data[0].embedding);
}

export async function embedBatch(texts) {
  const response = await fetch(`${ALBERT_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ALBERT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'embeddings-small',
      input: texts
    })
  });

  if (!response.ok) {
    throw new Error(`Albert embeddings error: ${response.status}`);
  }

  const data = await response.json();
  return data.data.map(item => new Float32Array(item.embedding));
}
```

## 5. Endpoint `/v1/rerank`

Le reranker prend une requête + un ensemble de documents et renvoie un score de pertinence pour chaque document. À utiliser après un retrieval initial (BM25 + vectoriel) pour affiner le top-N.

### Requête

```http
POST https://albert.api.etalab.gouv.fr/v1/rerank
Content-Type: application/json
Authorization: Bearer VOTRE_CLE_API

{
  "model": "bge-reranker-v2-m3",
  "query": "application du théorème central limite",
  "input": [
    "Exercice sur l'approximation d'une somme par une loi normale...",
    "Exercice d'intégration par parties avec fonction exponentielle...",
    "Application du TCL à un problème de poids cumulés..."
  ]
}
```

### Paramètres

- `model` (string, requis) : identifiant du reranker
- `query` (string, requis) : la requête utilisateur
- `input` (string[], requis) : liste des documents à classer

### Réponse

```json
{
  "object": "list",
  "data": [
    { "index": 2, "score": 0.9876 },
    { "index": 0, "score": 0.8234 },
    { "index": 1, "score": 0.0452 }
  ],
  "model": "bge-reranker-v2-m3"
}
```

Les résultats sont renvoyés **triés par score décroissant**. Le champ `index` correspond à la position dans le tableau `input` d'origine.

### Client JavaScript

```javascript
// src/lib/embeddings/albert.js (suite)

export async function rerank(query, documents) {
  const response = await fetch(`${ALBERT_BASE_URL}/rerank`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ALBERT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'bge-reranker-v2-m3',
      query: query,
      input: documents
    })
  });

  if (!response.ok) {
    throw new Error(`Albert rerank error: ${response.status}`);
  }

  const data = await response.json();
  // Retourne les index et scores triés par pertinence
  return data.data; // [{ index, score }, ...]
}
```

### Bonnes pratiques reranking

- Limiter à **50 documents max** par appel pour garder une latence acceptable (~500ms-1s)
- Passer des **résumés** plutôt que du LaTeX brut (plus pertinent pour le modèle)
- Le reranker voit query + document simultanément, donc il comprend mieux les relations contextuelles que le simple cosinus d'embeddings
- Gain typique : **+10-20 points de Recall@10** par rapport à du retrieval sans rerank

## 6. Endpoint `/v1/chat/completions`

Utilisé pour générer les résumés d'exercices à l'indexation. Format OpenAI standard.

### Requête

```http
POST https://albert.api.etalab.gouv.fr/v1/chat/completions
Content-Type: application/json
Authorization: Bearer VOTRE_CLE_API

{
  "model": "openweight-medium",
  "messages": [
    {
      "role": "user",
      "content": "Résume cet exercice mathématique..."
    }
  ],
  "temperature": 0,
  "max_tokens": 600
}
```

### Client JavaScript

```javascript
// src/lib/llm/summarize.js

export async function summarizeExercise(prompt) {
  const response = await fetch(`${ALBERT_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ALBERT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openweight-medium',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 600,
      response_format: { type: 'json_object' }
    })
  });

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}
```

## 7. Endpoint `/v1/models`

Liste les modèles actuellement disponibles. À interroger au démarrage pour vérifier la disponibilité et obtenir les identifiants exacts.

```javascript
export async function listModels() {
  const response = await fetch(`${ALBERT_BASE_URL}/models`, {
    headers: { 'Authorization': `Bearer ${ALBERT_API_KEY}` }
  });
  return (await response.json()).data;
}
```

## 8. Pipeline complet pour OpenYourMath

### Indexation d'un nouvel exercice

```
Exercice LaTeX
    ↓
Parser LaTeX (extraction \texte, \question, \reponse, métadonnées)
    ↓
Prompt de résumé
    ↓
[Albert /chat/completions avec openweight-medium]
    ↓
{ summary, concepts, methods, objects } en JSON
    ↓
Texte à embedder = summary + concepts + methods + objects
    ↓
[Albert /embeddings avec embeddings-small]
    ↓
Vecteur Float32Array[1024]
    ↓
INSERT INTO exercise_embeddings (uuid, embedding_summary, model_version)
UPDATE exercises SET summary, concepts, content_hash, indexed_at
INSERT INTO fts_exercises (summary, concepts)
```

### Recherche hybride avec rerank

```
Requête utilisateur "exercice sur le TCL niveau L2"
    ↓
Filtres SQL (niveau=L2)                  Filtres SQL appliqués
    ↓                                        ↓
[FTS5 BM25] → top 50 candidats    [Albert embed query] → cosinus → top 50
    ↓                                        ↓
Fusion RRF (Reciprocal Rank Fusion) → top 50 uniques
    ↓
[Albert /rerank sur les 50 résumés] → scores précis
    ↓
Top 20 final retourné à l'UI
```

## 9. Erreurs courantes et gestion

| Code | Signification | Action |
|------|---------------|--------|
| 401 | Clé API invalide ou expirée | Régénérer la clé sur le playground |
| 404 | Modèle introuvable | Interroger `/v1/models` pour voir les noms exacts |
| 413 | Contexte trop long | Tronquer l'input avant envoi |
| 429 | Rate limit atteint | Implémenter un backoff exponentiel |
| 500-503 | Service indisponible | Activer le fallback (Ollama local) |

### Wrapper avec retry et fallback

```javascript
// src/lib/embeddings/index.js
import { embedText as albertEmbed } from './albert.js';
import { embedText as localEmbed } from './ollama.js';

export async function embed(text, { retries = 3, useFallback = true } = {}) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await albertEmbed(text);
    } catch (err) {
      if (attempt === retries - 1) {
        if (useFallback) {
          console.warn('Albert indisponible, fallback Ollama local');
          return await localEmbed(text);
        }
        throw err;
      }
      // Backoff exponentiel : 1s, 2s, 4s
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
}
```

## 10. Rate limits et quotas

Les limites exactes dépendent du compte et de la politique Albert. À vérifier sur le playground (`Statistiques d'usage`). Principes généraux à anticiper :

- **Tokens par minute (TPM)** : à lisser avec du batching
- **Requêtes par minute (RPM)** : à lisser avec une queue
- **Tokens par jour (TPD)** : à suivre pour ne pas bloquer l'indexation

Pour l'indexation initiale d'un gros corpus (10 000+ exercices), lancer par lots de 100-500 exos avec pauses, plutôt qu'en une seule fois.

## 11. Schéma SQLite recommandé

```sql
-- Enrichissement de la table existante
ALTER TABLE exercises ADD COLUMN summary TEXT;
ALTER TABLE exercises ADD COLUMN concepts TEXT;      -- JSON array
ALTER TABLE exercises ADD COLUMN methods TEXT;       -- JSON array
ALTER TABLE exercises ADD COLUMN content_hash TEXT;  -- SHA-256 du LaTeX
ALTER TABLE exercises ADD COLUMN indexed_at DATETIME;

-- Table dédiée aux embeddings (séparée pour ne pas alourdir exercises)
CREATE TABLE IF NOT EXISTS exercise_embeddings (
  uuid TEXT PRIMARY KEY,
  embedding_summary BLOB NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'bge-m3',
  dimension INTEGER NOT NULL DEFAULT 1024,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uuid) REFERENCES exercises(uuid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_embeddings_model ON exercise_embeddings(model_version);

-- Enrichissement du FTS5 (à recréer avec les nouveaux champs)
DROP TABLE IF EXISTS fts_exercises;
CREATE VIRTUAL TABLE fts_exercises USING fts5(
  uuid UNINDEXED,
  title, chapter, subchapter, theme, module,
  summary,         -- nouveau : résumé LLM
  concepts,        -- nouveau : concepts extraits
  tokenize = 'unicode61 remove_diacritics 2'
);
```

## 12. Checklist avant mise en production

- [ ] Clé API Albert stockée dans `.env`, exclu de Git
- [ ] Champ `model_version` renseigné dans `exercise_embeddings`
- [ ] `content_hash` utilisé pour éviter les réindexations inutiles
- [ ] Fallback Ollama + BGE-M3 local disponible sur la machine
- [ ] Gestion des erreurs 429 avec backoff
- [ ] Benchmark de 20-30 requêtes annotées pour mesurer la qualité
- [ ] Logs des requêtes Albert pour suivre la consommation
- [ ] Cache en mémoire des embeddings (rechargé au démarrage du serveur)
- [ ] Monitoring des quotas (TPM, RPM, TPD)

## 13. Ressources

- Page modèles : <https://albert.sites.beta.gouv.fr/solutions/models/>
- Reference API : <https://albert.api.etalab.gouv.fr/reference>
- Formulaire d'accès : <https://albert.sites.beta.gouv.fr/access/>
- Statuts de l'API : <https://albert.sites.beta.gouv.fr/about/status/>
- Code source OpenGateLLM : <https://github.com/etalab-ia/OpenGateLLM>
- Contact : via le formulaire sur le site
