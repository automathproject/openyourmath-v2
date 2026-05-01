// src/lib/ia/rerank.js
import { rerank as albertRerank, withRetry } from './albert.js';

const DEFAULT_TIMEOUT_MS = 2000;

/**
 * Reclasse des candidats par cross-encoder Albert (bge-reranker-v2-m3).
 * Le texte envoyé au reranker est "title\nsummary" pour chaque candidat.
 * Fallback sur l'ordre RRF d'entrée en cas d'erreur ou timeout.
 *
 * @param {string} query
 * @param {Array<{uuid: string, title: string, summary: string|null, [key: string]: any}>} candidates
 * @param {{ timeoutMs?: number }} options
 * @returns {Promise<Array<{rerankScore: number|null, [key: string]: any}>>}
 */
export async function rerankDocuments(query, candidates, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (candidates.length === 0) return [];

  const texts = candidates.map(c => `${c.title}\n${c.summary ?? ''}`);

  let rankResults;
  try {
    const rankPromise = withRetry(() => albertRerank(query, texts));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timeout après ${timeoutMs}ms`)), timeoutMs)
    );
    rankResults = await Promise.race([rankPromise, timeoutPromise]);
  } catch (err) {
    console.warn(`⚠️ Rerank Albert échoué (${err.message}), fallback ordre RRF`);
    return candidates.map(c => ({ ...c, rerankScore: null }));
  }

  // rankResults: [{index, score}] déjà triés par score décroissant par Albert.
  // On reconstruit les objets candidats dans cet ordre.
  // Sort stable : à score égal, l'ordre RRF d'origine est préservé comme tie-breaker.
  return rankResults
    .map(({ index, score }) => ({ ...candidates[index], rerankScore: score }))
    .sort((a, b) => b.rerankScore - a.rerankScore);
}
