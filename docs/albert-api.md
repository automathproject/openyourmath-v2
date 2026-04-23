# Albert API — Documentation pour OpenYourMath v2

Documentation condensée pour intégrer les services Albert (embeddings, reranker, LLM) dans le moteur de recherche d'exercices mathématiques.

**Version 2** — corrigée après validation des endpoints sur l'API de production (avril 2026).

## 1. Informations générales

**Fournisseur** : Etalab / DINUM (service de l'État français)
**Public cible** : Agents de la fonction publique d'État
**Documentation officielle** : <https://albert.sites.beta.gouv.fr>
**Référence API** : <https://albert.api.etalab.gouv.fr/reference>
**Code source** : <https://github.com/etalab-ia/OpenGateLLM>

**Base URL** : `https://albert.api.etalab.gouv.fr/v1`

**Compatibilité** : L'API est largement compatible OpenAI pour `/v1/chat/completions`, `/v1/embeddings`, `/v1/audio/transcriptions`. L'endpoint `/v1/rerank` utilise le format Cohere/Jina (champ `documents`, réponse dans `results` avec `relevance_score`).

**Avantages clés** :
- Gratuit (dans les limites d'usage)
- Hébergement sur infrastructure française, conformité RGPD
- Modèles open-source (Apache 2.0, MIT), pas de lock-in possible
- Stack cohérente embedding + reranker de la même famille (BGE)
- Reporting transparent : consommation en tokens, coût, empreinte carbone

## 2. Authentification

Toutes les requêtes nécessitent une clé API générée sur le playground Albert.

```http
Authorization: Bearer VOTRE_CLE_API
```

**Obtention** : formulaire sur <https://albert.sites.beta.gouv.fr/access/>

**Configuration dans le projet** : stocker dans `.env`, ne jamais committer. Vérifier que `.env` est dans `.gitignore` (`git check-ignore -v .env` doit renvoyer une ligne).

```bash
# .env
ALBERT_API_KEY=sk-votre-cle-ici
ALBERT_BASE_URL=https://albert.api.etalab.gouv.fr/v1
```

Créer également un `.env.example` versionné pour documenter les variables :

```bash
# .env.example (celui-ci est commité)
ALBERT_API_KEY=your_albert_api_key_here
ALBERT_BASE_URL=https://albert.api.etalab.gouv.fr/v1
```

## 3. Modèles disponibles (avril 2026)

Liste obtenue via `GET /v1/models` :

| Identifiant API | Type | Usage recommandé |
|---|---|---|
| `BAAI/bge-m3` | text-embeddings-inference | Embeddings — 1024 dimensions |
| `BAAI/bge-reranker-v2-m3` | text-classification | Reranker pour retrieval |
| `openai/gpt-oss-120b` | text-generation | LLM — qualité max (résumés précis) |
| `mistralai/Mistral-Small-3.2-24B-Instruct-2506` | image-text-to-text | LLM — équilibré (défaut recommandé) |
| `mistralai/Ministral-3-8B-Instruct-2512` | image-text-to-text | LLM — rapide (tests, tâches simples) |
| `Qwen/Qwen3-Coder-30B-A3B-Instruct` | text-generation | LLM — spécialisé code |
| `openai/whisper-large-v3` | automatic-speech-recognition | Transcription audio (non utilisé ici) |

⚠️ Utiliser les **identifiants complets** (`BAAI/bge-m3`, pas `bge-m3` ni `embeddings-small`). Les alias mentionnés sur le site marketing ne sont pas acceptés par l'API.

## 4. Endpoint `/v1/embeddings`

### Requête

```http
POST https://albert.api.etalab.gouv.fr/v1/embeddings
Content-Type: application/json
Authorization: Bearer VOTRE_CLE_API

{
  "model": "BAAI/bge-m3",
  "input": "Texte à vectoriser"
}
```

### Paramètres

- `model` (string, requis) : identifiant complet du modèle
- `input` (string | string[], requis) : texte unique ou tableau de textes (batching)

### Réponse

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.0016, 0.0364, -0.0505, ...]
    }
  ],
  "model": "BAAI/bge-m3",
  "usage": {
    "prompt_tokens": 50,
    "total_tokens": 50
  }
}
```

### Caractéristiques BGE-M3

- **Dimension** : 1024
- **Contexte max** : 8192 tokens (largement suffisant pour un résumé d'exercice)
- **Pas de distinction query/document** (contrairement à E5 ou Qwen3-Embedding qui demandent des préfixes)
- **Stocker en Float32Array** : 4 octets × 1024 = 4 Ko par vecteur

### Batching

Pour l'indexation en masse, envoyer plusieurs textes dans un seul appel réduit drastiquement la latence réseau. Limiter à ~50-100 textes par batch pour éviter les dépassements de contexte.

## 5. Endpoint `/v1/rerank`

### Requête

```http
POST https://albert.api.etalab.gouv.fr/v1/rerank
Content-Type: application/json
Authorization: Bearer VOTRE_CLE_API

{
  "model": "BAAI/bge-reranker-v2-m3",
  "query": "application du théorème central limite",
  "documents": [
    "Exercice d'approximation d'une somme par la loi normale...",
    "Exercice d'intégration par parties...",
    "Application du TCL à un problème de poids cumulés..."
  ]
}
```

### Paramètres

- `model` (string, requis) : identifiant du reranker
- `query` (string, requis) : la requête utilisateur
- `documents` (string[], requis) : ⚠️ **bien `documents`, pas `input`**

### Réponse

```json
{
  "object": "list",
  "id": "request-xxx",
  "results": [
    { "relevance_score": 0.9876, "index": 2 },
    { "relevance_score": 0.0123, "index": 0 },
    { "relevance_score": 0.0007, "index": 1 }
  ],
  "model": "BAAI/bge-reranker-v2-m3",
  "usage": {
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0,
    "cost": 0,
    "carbon": { "kWh": { "min": 0, "max": 0 } }
  }
}
```

Points importants :
- Les résultats sont **dans `results`**, pas `data`
- Clé du score : **`relevance_score`**, pas `score`
- Résultats **triés par pertinence décroissante** par l'API
- `index` correspond à la position dans le tableau `documents` envoyé
- Les **scores ne sont pas calibrés** — seul l'ordre compte (un 0.0097 peut être excellent si les autres sont à 0.0007)
- `usage.prompt_tokens = 0` : le rerank semble ne pas consommer de quota tokens

### Bonnes pratiques reranking

- Limiter à **50 documents max** par appel pour garder une latence acceptable
- Passer des **résumés** plutôt que du LaTeX brut (plus pertinent pour le modèle)
- Gain typique : **+10-20 points de Recall@10** par rapport à du retrieval sans rerank

## 6. Endpoint `/v1/chat/completions`

Format OpenAI standard. Utilisé pour la génération de résumés d'exercices.

### Requête

```http
POST https://albert.api.etalab.gouv.fr/v1/chat/completions
Content-Type: application/json
Authorization: Bearer VOTRE_CLE_API

{
  "model": "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
  "messages": [
    { "role": "user", "content": "Résume cet exercice..." }
  ],
  "temperature": 0,
  "max_tokens": 600
}
```

### Mode JSON

Pour forcer une réponse JSON parseable (utile pour les résumés structurés) :

```json
{
  "response_format": { "type": "json_object" }
}
```

À combiner avec un prompt qui demande explicitement du JSON.

## 7. Endpoint `/v1/models`

À appeler une fois au démarrage pour valider l'authentification et la disponibilité des modèles.

```javascript
const response = await fetch(`${ALBERT_BASE_URL}/models`, {
  headers: { 'Authorization': `Bearer ${ALBERT_API_KEY}` }
});
const models = (await response.json()).data;
```

## 8. Client unifié

Un seul fichier client peut servir à la fois dans l'application SvelteKit et dans les scripts Node standalone, en s'appuyant sur `process.env`. SvelteKit expose les variables d'env dans `process.env` côté serveur, et `dotenv` les charge pour Node pur.

### Fichier `src/lib/ia/albert.js`

```javascript
// Fonctionne dans SvelteKit (serveur) ET dans les scripts Node
const ALBERT_BASE_URL = process.env.ALBERT_BASE_URL || 'https://albert.api.etalab.gouv.fr/v1';
const ALBERT_API_KEY = process.env.ALBERT_API_KEY;

export const MODELS = {
  embedding: 'BAAI/bge-m3',
  reranker: 'BAAI/bge-reranker-v2-m3',
  chat: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506',
  chatLarge: 'openai/gpt-oss-120b',
  chatSmall: 'mistralai/Ministral-3-8B-Instruct-2512'
};

export const EMBEDDING_DIMENSION = 1024;

async function albertFetch(endpoint, body) {
  if (!ALBERT_API_KEY) {
    throw new Error('ALBERT_API_KEY manquante dans les variables d\'environnement');
  }

  const response = await fetch(`${ALBERT_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ALBERT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Albert ${endpoint} → ${response.status}: ${text}`);
  }

  return response.json();
}

/** Embedding d'un texte unique. Retourne Float32Array de dimension 1024. */
export async function embed(text) {
  const data = await albertFetch('/embeddings', {
    model: MODELS.embedding,
    input: text
  });
  return new Float32Array(data.data[0].embedding);
}

/** Embeddings en batch. Plus efficace pour l'indexation. */
export async function embedBatch(texts) {
  if (texts.length === 0) return [];
  const data = await albertFetch('/embeddings', {
    model: MODELS.embedding,
    input: texts
  });
  return data.data.map(item => new Float32Array(item.embedding));
}

/** Reclasse des documents par pertinence. Retourne [{index, score}, ...] trié décroissant. */
export async function rerank(query, documents) {
  if (documents.length === 0) return [];
  const data = await albertFetch('/rerank', {
    model: MODELS.reranker,
    query,
    documents
  });
  return data.results.map(r => ({
    index: r.index,
    score: r.relevance_score
  }));
}

/** Appel LLM pour génération de texte. */
export async function chat(prompt, {
  model = MODELS.chat,
  temperature = 0,
  maxTokens = 600,
  jsonMode = false
} = {}) {
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const data = await albertFetch('/chat/completions', body);
  return data.choices[0].message.content;
}
```

### Utilisation dans SvelteKit

```javascript
// src/routes/api/search/+server.js
import { embed, rerank } from '$lib/ia/albert.js';

export async function POST({ request }) {
  const { query } = await request.json();
  const vec = await embed(query);
  // ...
}
```

Les variables d'env sont chargées automatiquement par SvelteKit au démarrage, `process.env.ALBERT_API_KEY` est directement accessible côté serveur.

### Utilisation dans un script Node standalone

```javascript
// scripts/ia/indexer.js
import 'dotenv/config'; // ← charge .env dans process.env
import { embed, rerank, chat } from '../../src/lib/ia/albert.js';

const vec = await embed('Texte à vectoriser');
console.log(vec.length); // 1024
```

La seule ligne différente est l'import de `dotenv/config` en tête de script. Installation : `npm install --save-dev dotenv`.

### Pourquoi ça fonctionne dans les deux contextes

- **Côté SvelteKit** : le serveur Node qui exécute SvelteKit met les variables de `.env` dans `process.env` automatiquement (via Vite)
- **Côté script standalone** : `import 'dotenv/config'` charge explicitement `.env` dans `process.env`

Dans les deux cas, le client Albert lit `process.env.ALBERT_API_KEY` et n'a pas besoin de savoir dans quel contexte il tourne.

## 9. Pipeline complet pour OpenYourMath

### Indexation d'un nouvel exercice

```
Exercice LaTeX
    ↓
Parser LaTeX (extraction \texte, \question, \reponse, métadonnées)
    ↓
chat() avec prompt de résumé structuré
    ↓
{ summary, concepts, methods, objects } en JSON
    ↓
Texte à embedder = summary + "\nConcepts: " + concepts.join(", ") + ...
    ↓
embed() → Float32Array[1024]
    ↓
SQLite :
  INSERT INTO exercise_embeddings (uuid, embedding_summary, model_version)
  UPDATE exercises SET summary, concepts, content_hash, indexed_at
  INSERT INTO fts_exercises (summary, concepts)
```

### Recherche hybride avec rerank

```
Requête "exercice sur le TCL niveau L2"
    ↓
Filtres SQL (niveau=L2)
    ↓
[FTS5 BM25] → top 50        [embed(query) + cosinus] → top 50
    ↓                              ↓
Fusion RRF (Reciprocal Rank Fusion) → top 50 uniques
    ↓
rerank(query, résumés_du_top_50) → scores précis
    ↓
Top 20 retourné à l'UI
```

## 10. Gestion des erreurs

| Code | Signification | Action |
|------|---------------|--------|
| 401 | Clé API invalide/expirée | Régénérer sur le playground |
| 404 | Modèle introuvable | Vérifier l'identifiant via `/v1/models` |
| 413 | Contexte trop long | Tronquer l'input |
| 422 | Paramètre manquant ou invalide | Vérifier le format (ex: `documents` vs `input` en rerank) |
| 429 | Rate limit atteint | Backoff exponentiel |
| 500-503 | Service indisponible | Fallback (Ollama local avec BGE-M3) |

### Wrapper avec retry

```javascript
export async function embedWithRetry(text, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await embed(text);
    } catch (err) {
      if (attempt === retries - 1) throw err;
      if (err.message.includes('429') || err.message.includes('503')) {
        const delay = 1000 * Math.pow(2, attempt);
        console.warn(`Retry dans ${delay}ms (${err.message})`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err; // 401, 404 : inutile de retry
      }
    }
  }
}
```

## 11. Rate limits et quotas

Les limites exactes dépendent du compte et de la politique Albert, visibles sur le playground (`Statistiques d'usage`). À anticiper :

- **TPM** (tokens par minute) : lisser avec du batching
- **RPM** (requêtes par minute) : lisser avec une queue
- **TPD** (tokens par jour) : suivre pour ne pas bloquer l'indexation

Pour l'indexation initiale d'un gros corpus, lancer par lots de 100-500 exercices avec pauses, plutôt qu'en une fois.

## 12. Schéma SQLite recommandé

```sql
-- Enrichissement de la table existante
ALTER TABLE exercises ADD COLUMN summary TEXT;
ALTER TABLE exercises ADD COLUMN concepts TEXT;      -- JSON array
ALTER TABLE exercises ADD COLUMN methods TEXT;       -- JSON array
ALTER TABLE exercises ADD COLUMN content_hash TEXT;  -- SHA-256 du LaTeX brut
ALTER TABLE exercises ADD COLUMN indexed_at DATETIME;

-- Table dédiée aux embeddings
CREATE TABLE IF NOT EXISTS exercise_embeddings (
  uuid TEXT PRIMARY KEY,
  embedding_summary BLOB NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'BAAI/bge-m3',
  dimension INTEGER NOT NULL DEFAULT 1024,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uuid) REFERENCES exercises(uuid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_embeddings_model ON exercise_embeddings(model_version);

-- Enrichissement du FTS5 (recréer avec les nouveaux champs)
DROP TABLE IF EXISTS fts_exercises;
CREATE VIRTUAL TABLE fts_exercises USING fts5(
  uuid UNINDEXED,
  title, chapter, subchapter, theme, module,
  summary, concepts,
  tokenize = 'unicode61 remove_diacritics 2'
);
```

## 13. Checklist avant mise en production

- [ ] Clé API Albert stockée dans `.env`, `.env` ignoré par Git
- [ ] `.env.example` commité pour documenter les variables
- [ ] `dotenv` installé en dev dependency
- [ ] Client `src/lib/ia/albert.js` créé
- [ ] Import `dotenv/config` en tête de chaque script Node standalone
- [ ] Champ `model_version` renseigné dans `exercise_embeddings`
- [ ] `content_hash` utilisé pour éviter les réindexations inutiles
- [ ] Fallback Ollama + BGE-M3 local prévu en cas d'indisponibilité Albert
- [ ] Gestion des erreurs 429/503 avec backoff
- [ ] Benchmark de 20-30 requêtes annotées pour mesurer la qualité
- [ ] Cache en mémoire des embeddings au démarrage du serveur
- [ ] Monitoring des quotas via le playground

## 14. Ressources

- Page modèles : <https://albert.sites.beta.gouv.fr/solutions/models/>
- Reference API : <https://albert.api.etalab.gouv.fr/reference>
- Formulaire d'accès : <https://albert.sites.beta.gouv.fr/access/>
- Statuts API : <https://albert.sites.beta.gouv.fr/about/status/>
- Code source OpenGateLLM : <https://github.com/etalab-ia/OpenGateLLM>