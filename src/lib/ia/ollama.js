// src/lib/ia/ollama.js
// Client Ollama local — interface compatible avec albert.js.
// Utilisé en priorité sur Albert quand Ollama est disponible et que les
// modèles requis sont installés.
//
// Configuration (.env) :
//   OLLAMA_BASE_URL      (défaut : http://localhost:11434)
//   OLLAMA_CHAT_MODEL    (défaut : mistral)
//   OLLAMA_EMBED_MODEL   (défaut : bge-m3)  ← même modèle que Albert, vecteurs compatibles

import { EMBEDDING_DIMENSION } from './albert.js';

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');

export const OLLAMA_MODELS = {
  get chat()      { return process.env.OLLAMA_CHAT_MODEL  || 'mistral'; },
  get embedding() { return process.env.OLLAMA_EMBED_MODEL || 'bge-m3'; }
};

/**
 * Vérifie si Ollama tourne et si les modèles requis sont installés.
 * Timeout court (2 s) pour ne pas bloquer le démarrage.
 *
 * @returns {Promise<{available: boolean, models?: string[], hasChat: boolean, hasEmbed: boolean}>}
 */
export async function checkOllamaAvailable() {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000)
    });
    if (!res.ok) return { available: false, hasChat: false, hasEmbed: false };

    const data = await res.json();
    const installed = (data.models ?? []).map(m => m.name.split(':')[0].toLowerCase());
    const chatBase  = OLLAMA_MODELS.chat.split(':')[0].toLowerCase();
    const embedBase = OLLAMA_MODELS.embedding.split(':')[0].toLowerCase();

    return {
      available: true,
      models:    installed,
      hasChat:   installed.includes(chatBase),
      hasEmbed:  installed.includes(embedBase)
    };
  } catch {
    return { available: false, hasChat: false, hasEmbed: false };
  }
}

/**
 * Génère une complétion via l'API OpenAI-compatible d'Ollama.
 * Interface identique à albert.chat().
 *
 * @param {string} prompt
 * @param {{ model?: string, temperature?: number, maxTokens?: number, jsonMode?: boolean }} options
 * @returns {Promise<string>}
 */
export async function ollamaChat(prompt, {
  model       = OLLAMA_MODELS.chat,
  temperature = 0,
  maxTokens   = 800,
  jsonMode    = false
} = {}) {
  const body = {
    model,
    messages:   [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ollama' },
    body:    JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama chat → ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

/**
 * Génère un embedding via l'API OpenAI-compatible d'Ollama.
 * Interface identique à albert.embed().
 * Le modèle par défaut (bge-m3) produit des vecteurs 1024-dim identiques à Albert.
 *
 * @param {string} text
 * @param {string} [model]
 * @returns {Promise<Float32Array>}
 */
export async function ollamaEmbed(text, model = OLLAMA_MODELS.embedding) {
  const res = await fetch(`${OLLAMA_BASE_URL}/v1/embeddings`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ollama' },
    body:    JSON.stringify({ model, input: text })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama embed → ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const vec  = new Float32Array(data.data[0].embedding);

  if (vec.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Ollama embed : dimension inattendue ${vec.length} (attendu ${EMBEDDING_DIMENSION}). ` +
      `Vérifiez que OLLAMA_EMBED_MODEL=${model} est bien bge-m3.`
    );
  }

  return vec;
}
