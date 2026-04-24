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

async function albertFetch(endpoint, body, method = 'POST') {
  if (!ALBERT_API_KEY) throw new Error('ALBERT_API_KEY manquante');

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${ALBERT_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  if (body !== undefined) options.body = JSON.stringify(body);

  const response = await fetch(`${ALBERT_BASE_URL}${endpoint}`, options);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Albert ${endpoint} → ${response.status}: ${text}`);
  }

  return response.json();
}

export async function listModels() {
  const data = await albertFetch('/models', undefined, 'GET');
  return data.data;
}

/**
 * Vérifie que tous les modèles utilisés par le projet sont disponibles.
 * Utile au démarrage d'un script d'indexation pour fail fast.
 * @returns {Promise<{ok: boolean, missing: string[]}>}
 */
export async function checkModels() {
  const available = new Set((await listModels()).map(m => m.id));
  const missing = Object.values(MODELS).filter(id => !available.has(id));
  return { ok: missing.length === 0, missing };
}

/**
 * @param {string} text
 * @returns {Promise<Float32Array>}
 */
export async function embed(text) {
  const data = await albertFetch('/embeddings', { model: MODELS.embedding, input: text });
  const vec = new Float32Array(data.data[0].embedding);
  if (vec.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Dimension inattendue : ${vec.length} (attendu: ${EMBEDDING_DIMENSION})`);
  }
  return vec;
}

/**
 * @param {string[]} texts
 * @returns {Promise<Float32Array[]>}
 */
export async function embedBatch(texts) {
  const data = await albertFetch('/embeddings', { model: MODELS.embedding, input: texts });
  return data.data.map(item => {
    const vec = new Float32Array(item.embedding);
    if (vec.length !== EMBEDDING_DIMENSION) {
      throw new Error(`Dimension inattendue : ${vec.length} (attendu: ${EMBEDDING_DIMENSION})`);
    }
    return vec;
  });
}

/**
 * @param {string} query
 * @param {string[]} documents
 * @returns {Promise<Array<{index: number, score: number}>>}
 */
export async function rerank(query, documents) {
  if (documents.length === 0) return [];
  const data = await albertFetch('/rerank', { model: MODELS.reranker, query, documents });
  return data.results.map(r => ({ index: r.index, score: r.relevance_score }));
}

/**
 * @param {string} prompt
 * @param {object} options
 * @returns {Promise<string>}
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
  if (jsonMode) body.response_format = { type: 'json_object' };
  const data = await albertFetch('/chat/completions', body);
  return data.choices[0].message.content;
}

/**
 * Retries fn up to maxAttempts times on transient errors (429, 5xx).
 * @param {() => Promise<T>} fn
 * @param {{ maxAttempts?: number, delayMs?: number }} options
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { maxAttempts = 3, delayMs = 1000 } = {}) {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isTransient = /429|50[0-9]/.test(err.message);
      if (!isTransient || i === maxAttempts - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}
