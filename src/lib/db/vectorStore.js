// src/lib/db/vectorStore.js
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

export const EXPECTED_DIMENSION = 1024;

const __dirname = fileURLToPath(new URL('.', import.meta.url));
// src/lib/db/ → 3 niveaux → racine du projet
const DEFAULT_DB_PATH = path.resolve(__dirname, '../../../data/exercises.sqlite');

const state = {
  loaded: false,
  count: 0,
  dimension: 0,
  entries: [],      // [{uuid: string, vector: Float32Array}]
  byUuid: new Map() // Map<string, Float32Array>
};

function openDb() {
  const dbPath = process.env.DATABASE_PATH || DEFAULT_DB_PATH;
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

function deserializeBlob(buffer) {
  if (buffer.byteLength % 4 !== 0) return null;
  // Copie dans un Float32Array indépendant pour éviter les dépendances sur les buffers poolés
  const vec = new Float32Array(buffer.byteLength / 4);
  vec.set(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4));
  return vec;
}

function doLoad() {
  const t0 = Date.now();
  console.log('🔄 Chargement du vector store...');

  const db = openDb();
  let rows;
  try {
    rows = db.prepare('SELECT uuid, embedding_summary FROM exercise_embeddings').all();
  } finally {
    db.close();
  }

  state.entries = [];
  state.byUuid = new Map();
  let skipped = 0;

  for (const row of rows) {
    const vec = deserializeBlob(row.embedding_summary);
    if (!vec) {
      console.warn(`⚠️  Blob invalide pour ${row.uuid} (byteLength=${row.embedding_summary.byteLength}), ignoré`);
      skipped++;
      continue;
    }
    if (vec.length !== EXPECTED_DIMENSION) {
      console.warn(`⚠️  Dimension inattendue pour ${row.uuid}: ${vec.length} (attendu: ${EXPECTED_DIMENSION}), ignoré`);
      skipped++;
      continue;
    }
    state.entries.push({ uuid: row.uuid, vector: vec });
    state.byUuid.set(row.uuid, vec);
  }

  state.count = state.entries.length;
  state.dimension = state.count > 0 ? EXPECTED_DIMENSION : 0;
  state.loaded = true;

  const approxMB = (state.count * EXPECTED_DIMENSION * 4 / 1024 / 1024).toFixed(1);
  const elapsed = Date.now() - t0;
  const skippedMsg = skipped ? `, ${skipped} ignoré(s)` : '';
  console.log(`✅ ${state.count} embeddings chargés en ${elapsed}ms (dim=${EXPECTED_DIMENSION}, ~${approxMB} Mo)${skippedMsg}`);

  return { count: state.count, dimension: state.dimension };
}

/**
 * Charge le vector store en mémoire (idempotent).
 */
export function loadVectorStore() {
  if (state.loaded) return { count: state.count, dimension: state.dimension };
  return doLoad();
}

/**
 * Force le rechargement depuis la base (utile après une réindexation).
 */
export function reloadVectorStore() {
  state.loaded = false;
  return doLoad();
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Recherche les k plus proches voisins par similarité cosinus.
 * @param {Float32Array} queryVector
 * @param {number} k
 * @param {Set<string>} [allowedUuids] - si fourni, restreint la recherche à ces UUIDs
 * @returns {Array<{uuid: string, score: number}>}
 */
export function cosineTopK(queryVector, k, allowedUuids) {
  if (!state.loaded) loadVectorStore();

  const candidates = allowedUuids
    ? state.entries.filter(e => allowedUuids.has(e.uuid))
    : state.entries;

  const scored = new Array(candidates.length);
  for (let i = 0; i < candidates.length; i++) {
    scored[i] = { uuid: candidates[i].uuid, score: cosineSimilarity(queryVector, candidates[i].vector) };
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/**
 * @returns {{ count: number, dimension: number, approxMemoryMB: number, loaded: boolean }}
 */
export function getStoreStats() {
  return {
    count: state.count,
    dimension: state.dimension,
    approxMemoryMB: parseFloat((state.count * EXPECTED_DIMENSION * 4 / 1024 / 1024).toFixed(1)),
    loaded: state.loaded
  };
}
