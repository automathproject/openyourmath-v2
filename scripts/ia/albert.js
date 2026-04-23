// src/lib/ia/albert.js
import { env } from '$env/dynamic/private';

const ALBERT_BASE_URL = env.ALBERT_BASE_URL || 'https://albert.api.etalab.gouv.fr/v1';
const ALBERT_API_KEY = env.ALBERT_API_KEY;

// Modèles utilisés — centralisés ici pour changer facilement
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
    throw new Error('ALBERT_API_KEY manquante');
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

/**
 * Génère un embedding pour un texte unique.
 * @param {string} text
 * @returns {Promise<Float32Array>} vecteur de dimension 1024
 */
export async function embed(text) {
  const data = await albertFetch('/embeddings', {
    model: MODELS.embedding,
    input: text
  });
  return new Float32Array(data.data[0].embedding);
}

/**
 * Génère des embeddings en batch (plus efficace pour l'indexation).
 * @param {string[]} texts
 * @returns {Promise<Float32Array[]>}
 */
export async function embedBatch(texts) {
  const data = await albertFetch('/embeddings', {
    model: MODELS.embedding,
    input: texts
  });
  return data.data.map(item => new Float32Array(item.embedding));
}

/**
 * Reclasse une liste de documents par pertinence à une requête.
 * @param {string} query
 * @param {string[]} documents
 * @returns {Promise<Array<{index: number, score: number}>>} trié par pertinence décroissante
 */
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

/**
 * Appel LLM pour génération de texte (résumés, classifications...).
 * @param {string} prompt
 * @param {object} options
 * @returns {Promise<string>} texte généré
 */
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
  
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }
  
  const data = await albertFetch('/chat/completions', body);
  return data.choices[0].message.content;
}