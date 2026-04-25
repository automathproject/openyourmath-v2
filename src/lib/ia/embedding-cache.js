// src/lib/ia/embedding-cache.js
// Cache local des embeddings dans cache/embeddings/{uuid}.json
// Exclu de Git, synchronisable manuellement via rsync.
// Le content_hash garantit la cohérence : si le contenu change, le cache est ignoré.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MODELS, EMBEDDING_DIMENSION } from './albert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const EMBEDDINGS_CACHE_ROOT = path.resolve(__dirname, '../../../cache/embeddings');

/**
 * Chemin absolu vers le fichier cache d'un exercice.
 * @param {string} uuid
 * @returns {string}
 */
export function getCacheFilePath(uuid) {
  return path.join(EMBEDDINGS_CACHE_ROOT, `${uuid}.json`);
}

/**
 * Lit le fichier cache brut pour un uuid.
 * @param {string} uuid
 * @returns {object|null}
 */
export function loadEmbeddingCache(uuid) {
  const filePath = getCacheFilePath(uuid);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Écrit l'embedding dans le cache local.
 * @param {string} uuid
 * @param {Float32Array} vector
 * @param {string} contentHash  SHA256 des blocs sémantiques
 */
export function saveEmbeddingCache(uuid, vector, contentHash) {
  fs.mkdirSync(EMBEDDINGS_CACHE_ROOT, { recursive: true });

  const buf = Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
  const data = {
    uuid,
    model:            MODELS.embedding,
    dimension:        vector.length,
    content_hash:     contentHash,
    embedding_base64: buf.toString('base64'),
    created_at:       new Date().toISOString()
  };

  fs.writeFileSync(getCacheFilePath(uuid), JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Récupère un embedding depuis le cache si le content_hash correspond.
 * Retourne null en cas de cache miss, hash invalide, ou modèle périmé.
 *
 * @param {string} uuid
 * @param {string} contentHash
 * @returns {{ vector: Float32Array, model: string, dimension: number }|null}
 */
export function getEmbeddingFromCache(uuid, contentHash) {
  if (!contentHash) return null;

  const cached = loadEmbeddingCache(uuid);
  if (!cached) return null;
  if (cached.content_hash !== contentHash) return null;
  if (cached.model !== MODELS.embedding) return null;

  try {
    const buf = Buffer.from(cached.embedding_base64, 'base64');
    const vector = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);

    if (vector.length !== EMBEDDING_DIMENSION) return null;

    return {
      vector,
      model:     cached.model,
      dimension: cached.dimension ?? vector.length
    };
  } catch {
    return null;
  }
}
