// src/lib/db/hybridSearch.js
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import { embed } from '../ia/albert.js';
import { cosineTopK, loadVectorStore } from './vectorStore.js';
import { rerankDocuments } from '../ia/rerank.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_DB_PATH = path.resolve(__dirname, '../../../data/exercises.sqlite');
const K_RRF = 60;

function openDb() {
  const dbPath = process.env.DATABASE_PATH || DEFAULT_DB_PATH;
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

// Dupliqué depuis queries.js où elle n'est pas exportée
function prepareSearchQuery(query) {
  if (!query || query.trim() === '') return null;
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(t => t.replace(/["']/g, ''))
    .map(t => t.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(Boolean);
  const longTokens = tokens.filter(t => t.length >= 3);
  if (longTokens.length === 0) return null;
  return longTokens.map(t => `${t}*`).join(' ');
}

function escapeLike(v) {
  return v.replace(/[%_\\]/g, ch => `\\${ch}`);
}

function buildFilterConditions(filters) {
  const conditions = [];
  const params = [];
  const f = filters || {};

  if (f.level) {
    conditions.push('UPPER(e.level) = UPPER(?)');
    params.push(f.level);
  }
  if (f.module) {
    conditions.push('UPPER(e.module) = UPPER(?)');
    params.push(f.module);
  }
  if (f.chapter) {
    conditions.push('UPPER(e.chapter) = UPPER(?)');
    params.push(f.chapter);
  }
  if (f.subchapter) {
    conditions.push('UPPER(e.subchapter) = UPPER(?)');
    params.push(f.subchapter);
  }
  if (f.theme) {
    conditions.push("e.theme LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(f.theme)}%`);
  }
  if (f.difficulty !== undefined && f.difficulty !== null && f.difficulty !== '') {
    if (f.difficulty === 'null') {
      conditions.push('e.difficulty IS NULL');
    } else {
      const d = parseInt(f.difficulty, 10);
      if (!isNaN(d)) {
        conditions.push('e.difficulty = ?');
        params.push(d);
      }
    }
  }

  return { conditions, params };
}

// Retourne un Set<uuid> des exercices passant les filtres, ou null si aucun filtre.
function buildAllowedUuids(db, filters) {
  const { conditions, params } = buildFilterConditions(filters);
  if (conditions.length === 0) return null;
  const rows = db.prepare(
    `SELECT e.uuid FROM exercises e WHERE ${conditions.join(' AND ')}`
  ).all(...params);
  return new Set(rows.map(r => r.uuid));
}

// Recherche FTS5 avec filtres inline — retourne [{uuid, rank}] triés par pertinence BM25.
function runBM25(db, ftsQuery, filters, k) {
  if (!ftsQuery) return [];
  const { conditions, params } = buildFilterConditions(filters);
  const filterClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT fts.uuid, bm25(fts_exercises) AS rank
    FROM fts_exercises fts
    JOIN exercises e ON e.uuid = fts.uuid
    WHERE fts_exercises MATCH ?
      ${filterClause}
    ORDER BY rank
    LIMIT ?
  `).all(ftsQuery, ...params, k);
  return rows;
}

function rrfMerge(bm25Results, vectorResults, limit) {
  const scores = new Map();

  bm25Results.forEach(({ uuid }, i) => {
    const s = scores.get(uuid) ?? { rrfScore: 0, rankBM25: null, scoreVector: null };
    s.rrfScore += 1 / (K_RRF + i + 1);
    s.rankBM25 = i + 1;
    scores.set(uuid, s);
  });

  vectorResults.forEach(({ uuid, score }, i) => {
    const s = scores.get(uuid) ?? { rrfScore: 0, rankBM25: null, scoreVector: null };
    s.rrfScore += 1 / (K_RRF + i + 1);
    s.scoreVector = score;
    scores.set(uuid, s);
  });

  return Array.from(scores.entries())
    .map(([uuid, s]) => ({ uuid, ...s }))
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit);
}

function hydrate(db, merged) {
  if (merged.length === 0) return [];
  const uuids = merged.map(r => r.uuid);
  const placeholders = uuids.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT uuid, title, level, module, chapter, subchapter, theme, difficulty,
           preview, summary, author, organization, license_code, license_url,
           video_id, created_at, updated_at, hasIndication, hasSolution
    FROM exercises WHERE uuid IN (${placeholders})
  `).all(...uuids);
  const byUuid = new Map(rows.map(r => [r.uuid, r]));
  return merged.map(({ uuid, rrfScore, rankBM25, scoreVector, rerankScore }) => {
    const row = byUuid.get(uuid);
    return {
      uuid,
      title:        row?.title        ?? '',
      level:        row?.level        ?? null,
      module:       row?.module       ?? null,
      chapter:      row?.chapter      ?? null,
      subchapter:   row?.subchapter   ?? null,
      theme:        row?.theme        ?? null,
      difficulty:   row?.difficulty   ?? null,
      preview:      row?.preview      ?? null,
      summary:      row?.summary      ?? null,
      author:       row?.author       ?? null,
      organization: row?.organization ?? null,
      license_code: row?.license_code ?? null,
      license_url:  row?.license_url  ?? null,
      video_id:     row?.video_id     ?? null,
      created_at:   row?.created_at   ?? null,
      updated_at:   row?.updated_at   ?? null,
      hasIndication: row?.hasIndication ?? 0,
      hasSolution:   row?.hasSolution   ?? 0,
      // scores intermédiaires — toujours présents, l'endpoint décide quoi exposer
      score:        rrfScore,
      scoreBM25:    rankBM25,
      scoreVector,
      rerankScore:  rerankScore ?? null
    };
  });
}

// Lecture légère title+summary pour les candidats du rerank (évite d'hydrater les colonnes inutiles).
function lightFetch(db, uuids) {
  if (uuids.length === 0) return new Map();
  const placeholders = uuids.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT uuid, title, summary FROM exercises WHERE uuid IN (${placeholders})`
  ).all(...uuids);
  return new Map(rows.map(r => [r.uuid, r]));
}

function fetchByFiltersOnly(db, filters, limit) {
  const { conditions, params } = buildFilterConditions(filters);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT uuid, title, level, module, chapter, subchapter, theme, difficulty, preview, summary
    FROM exercises e ${where}
    ORDER BY e.updated_at DESC
    LIMIT ?
  `).all(...params, limit);
  return rows.map(row => ({ ...row, score: 0, scoreBM25: null, scoreVector: null }));
}

/**
 * Recherche hybride FTS5 + vectorielle avec fusion RRF.
 *
 * @param {{ query?: string, filters?: object, limit?: number, retrievalK?: number }} options
 * @returns {Promise<Array>}
 */
/**
 * Recherche hybride FTS5 + vectorielle avec fusion RRF, et rerank optionnel.
 *
 * @param {{
 *   query?: string,
 *   filters?: object,
 *   limit?: number,
 *   retrievalK?: number,
 *   rerank?: boolean,
 *   rerankCandidates?: number,
 *   _timing?: object  // optionnel : objet à peupler avec les temps par étape (pour le debug)
 * }} options
 * @returns {Promise<Array>}
 */
export async function hybridSearch({
  query = '',
  filters = {},
  limit = 20,
  retrievalK = 50,
  rerank = false,
  rerankCandidates = 50,
  _timing = null
} = {}) {
  const db = openDb();
  try {
    loadVectorStore(); // idempotent

    const trimmedQuery = (query || '').trim();
    const ftsQuery = prepareSearchQuery(trimmedQuery);

    // Query vide ou trop courte → résultats par filtres SQL uniquement
    if (!ftsQuery) {
      const t0 = Date.now();
      const results = fetchByFiltersOnly(db, filters, limit);
      if (_timing) _timing.hydrateMs = Date.now() - t0;
      return results;
    }

    // Filtrage SQL → Set d'UUIDs autorisés pour la recherche vectorielle
    const allowedUuids = buildAllowedUuids(db, filters);
    if (allowedUuids !== null && allowedUuids.size === 0) {
      return [];
    }

    // Phase 2a + 2b en parallèle :
    // embed() lance une requête HTTP (async), BM25 s'exécute en synchrone pendant que
    // la requête est en vol — total ≈ max(BM25, embed) plutôt que BM25 + embed.
    const embedStart = Date.now();
    const embedPromise = embed(trimmedQuery).catch(err => {
      console.warn('⚠️ Embed Albert échoué, continuation sans vectoriel:', err.message);
      return null;
    });

    const bm25Start = Date.now();
    const bm25Results = runBM25(db, ftsQuery, filters, retrievalK);
    if (_timing) _timing.bm25Ms = Date.now() - bm25Start;

    const queryVector = await embedPromise;
    if (_timing) _timing.embedMs = Date.now() - embedStart;

    const vectorResults = queryVector
      ? cosineTopK(queryVector, retrievalK, allowedUuids)
      : [];

    if (bm25Results.length === 0 && vectorResults.length === 0) {
      return [];
    }

    // Taille du pool intermédiaire : rerankCandidates si rerank activé, sinon limit.
    const poolSize = rerank ? rerankCandidates : limit;
    const merged = rrfMerge(bm25Results, vectorResults, poolSize);
    if (_timing) _timing.candidatesAfterRRF = merged.length;

    if (!rerank) {
      const t0 = Date.now();
      const results = hydrate(db, merged);
      if (_timing) _timing.hydrateMs = Date.now() - t0;
      return results;
    }

    // Rerank : lecture légère title+summary pour les candidats uniquement,
    // puis hydratation complète seulement pour les finalTopK retenus.
    const lightMap = lightFetch(db, merged.map(r => r.uuid));
    const candidates = merged.map(r => ({
      ...r,
      title:   lightMap.get(r.uuid)?.title   ?? '',
      summary: lightMap.get(r.uuid)?.summary ?? ''
    }));

    const rerankStart = Date.now();
    const reranked = await rerankDocuments(trimmedQuery, candidates);
    if (_timing) _timing.rerankMs = Date.now() - rerankStart;

    const t0 = Date.now();
    const results = hydrate(db, reranked.slice(0, limit));
    if (_timing) _timing.hydrateMs = Date.now() - t0;
    return results;
  } finally {
    db.close();
  }
}
