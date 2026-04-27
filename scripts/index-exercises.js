#!/usr/bin/env node
// scripts/index-exercises.js
// Pipeline B : indexation sémantique des exercices via Albert.
// Génère summary/concepts/methods/objects via LLM, puis l'embedding vectoriel.
// Les métadonnées LLM sont versionnées dans content/metadata/{uuid}.json.
// Les embeddings sont mis en cache dans cache/embeddings/{uuid}.json pour éviter
// de rappeler l'API Albert si le contenu n'a pas changé (content_hash).
//
// Usage :
//   node scripts/index-exercises.js              # exercices non indexés (indexed_at IS NULL)
//   node scripts/index-exercises.js --force      # réindexe tout
//   node scripts/index-exercises.js --uuid UUID  # un seul exercice
//   node scripts/index-exercises.js --dry-run    # affiche sans écrire
//   node scripts/index-exercises.js --limit N    # limite le nombre d'exercices traités

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { config as dotenvConfig } from 'dotenv';
import { summarizeExercise, buildEmbeddingText } from '../src/lib/ia/summarize.js';
import { embed, MODELS, withRetry, isQuotaExceeded } from '../src/lib/ia/albert.js';
import { checkOllamaAvailable, ollamaChat, ollamaEmbed, OLLAMA_MODELS } from '../src/lib/ia/ollama.js';
import { getEmbeddingFromCache, saveEmbeddingCache } from '../src/lib/ia/embedding-cache.js';
import { saveAlbertMetadata } from './utils/albert-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

dotenvConfig({ path: path.resolve(__dirname, '../.env') });

const DB_PATH        = path.resolve(__dirname, '../data/exercises.sqlite');
const ERRORS_LOG_PATH = path.resolve(__dirname, '../cache/index-errors.json');

// --- CLI args ---
const args = process.argv.slice(2);
const FORCE    = args.includes('--force');
const DRY_RUN  = args.includes('--dry-run');
const uuidArg  = args.find((_, i) => args[i - 1] === '--uuid');
const limitArg = args.find((_, i) => args[i - 1] === '--limit');
const LIMIT    = limitArg ? parseInt(limitArg, 10) : Infinity;

function openDb() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Base de données absente : ${DB_PATH}\nLancez d'abord pnpm build:db`);
  }
  try {
    const mod = require('better-sqlite3');
    const Database = mod.default || mod;
    const probe = new Database(':memory:');
    probe.close();
    return new Database(DB_PATH);
  } catch (err) {
    if (
      err.message?.includes('NODE_MODULE_VERSION') ||
      err.message?.includes('different Node.js version')
    ) {
      throw new Error(
        `better-sqlite3 doit être recompilé pour cette version de Node.\n` +
        `Lancez : pnpm build:db  (il recompile automatiquement)\n` +
        `Ou : cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && npm run build-release`
      );
    }
    throw err;
  }
}

function loadExercisesToIndex(db) {
  if (uuidArg) {
    const row = db.prepare('SELECT * FROM exercises WHERE uuid = ?').get(uuidArg);
    if (!row) throw new Error(`Exercice introuvable : ${uuidArg}`);
    const hasEmb = !!db.prepare('SELECT 1 FROM exercise_embeddings WHERE uuid = ?').get(uuidArg);
    return [{ ...row, _needsSummary: FORCE || !row.indexed_at, _needsEmbedding: FORCE || !hasEmb }];
  }
  if (FORCE) {
    return db.prepare('SELECT * FROM exercises ORDER BY chapter, uuid').all()
      .map(row => ({ ...row, _needsSummary: true, _needsEmbedding: true }));
  }

  // Exercices sans résumé → réindexation complète (Albert Chat + Albert Embedding)
  const sansSummary = db.prepare(
    'SELECT * FROM exercises WHERE indexed_at IS NULL ORDER BY chapter, uuid'
  ).all().map(row => ({ ...row, _needsSummary: true, _needsEmbedding: true }));

  // Exercices avec résumé mais sans embedding → Albert Embedding seul
  const sansEmbedding = db.prepare(`
    SELECT e.* FROM exercises e
    LEFT JOIN exercise_embeddings ee ON e.uuid = ee.uuid
    WHERE e.indexed_at IS NOT NULL AND ee.uuid IS NULL
    ORDER BY e.chapter, e.uuid
  `).all().map(row => ({ ...row, _needsSummary: false, _needsEmbedding: true }));

  return [...sansSummary, ...sansEmbedding];
}

const SEMANTIC_TYPES = new Set(['enonce', 'question', 'reponse', 'indication', 'hint', 'answer', 'solution', 'texte', 'text']);

function computeContentHash(contentArray) {
  if (!Array.isArray(contentArray)) return null;
  const blocks = contentArray.filter(b => SEMANTIC_TYPES.has((b?.type || '').toLowerCase()));
  return crypto.createHash('sha256').update(JSON.stringify(blocks)).digest('hex');
}

async function indexOne(db, row, stmts, providers) {
  const content = JSON.parse(row.content_json);
  const contentHash = computeContentHash(content);
  let summaryObj;

  if (row._needsSummary) {
    // 1a. Résumé via LLM — Ollama en priorité, Albert en fallback
    const summaryModel = providers.chatModel;
    const chatFn       = providers.chat;   // null → summarizeExercise utilisera albert.chat
    summaryObj = await withRetry(
      () => summarizeExercise({ ...row, content }, { model: summaryModel, chatFn }),
      { maxAttempts: 3, delayMs: 2000 }
    );
    const indexedAt = new Date().toISOString();

    // 2. Versionner dans content/metadata/{uuid}.json
    saveAlbertMetadata(row.uuid, {
      uuid:         row.uuid,
      source_path:  row.source_path || null,
      summary:      summaryObj.summary,
      concepts:     summaryObj.concepts,
      methods:      summaryObj.methods,
      objects:      summaryObj.objects,
      content_hash: contentHash,
      model:        summaryModel,
      indexed_at:   indexedAt
    }, { sourcePath: row.source_path });

    // 3. Mettre à jour la base
    stmts.updateSummary.run(
      summaryObj.summary,
      JSON.stringify(summaryObj.concepts),
      JSON.stringify(summaryObj.methods),
      JSON.stringify(summaryObj.objects),
      indexedAt,
      row.uuid
    );
  } else {
    // 1b. Résumé déjà versionné — reconstituer depuis la base, aucun appel API
    if (!row.summary) {
      throw new Error(`Résumé absent en base pour ${row.uuid} malgré indexed_at renseigné`);
    }
    summaryObj = {
      summary:  row.summary,
      concepts: JSON.parse(row.concepts || '[]'),
      methods:  JSON.parse(row.methods  || '[]'),
      objects:  JSON.parse(row.objects  || '[]')
    };
  }

  // 4. Embedding — Ollama en priorité, Albert en fallback, cache local en premier
  const embeddingText = buildEmbeddingText(summaryObj);
  let vector;
  const cached = getEmbeddingFromCache(row.uuid, contentHash);
  if (cached) {
    process.stdout.write('(cache) ');
    vector = cached.vector;
  } else {
    vector = await withRetry(
      () => providers.embed(embeddingText),
      { maxAttempts: 3, delayMs: 1000 }
    );
    saveEmbeddingCache(row.uuid, vector, contentHash);
  }
  const blob = Buffer.from(vector.buffer);
  stmts.upsertEmbedding.run(row.uuid, blob, MODELS.embedding, vector.length);

  return summaryObj;
}

async function main() {
  console.log('🧠 Pipeline B — Indexation sémantique');

  // Détection Ollama (prioritaire) avec fallback Albert
  const ollama = await checkOllamaAvailable();

  const providers = {
    chatModel: ollama.hasChat  ? OLLAMA_MODELS.chat      : MODELS.chat,
    chat:      ollama.hasChat  ? ollamaChat               : null,
    embed:     ollama.hasEmbed ? ollamaEmbed              : embed,
    embedLabel: ollama.hasEmbed
      ? `Ollama/${OLLAMA_MODELS.embedding}`
      : `Albert/${MODELS.embedding}`
  };

  if (ollama.available) {
    console.log('🦙 Ollama disponible');
    const chatSrc  = ollama.hasChat  ? `✅ ${OLLAMA_MODELS.chat}`      : `❌ ${OLLAMA_MODELS.chat} absent → Albert (${MODELS.chat})`;
    const embedSrc = ollama.hasEmbed ? `✅ ${OLLAMA_MODELS.embedding}` : `❌ ${OLLAMA_MODELS.embedding} absent → Albert (${MODELS.embedding})`;
    console.log(`   Résumé    : ${chatSrc}`);
    console.log(`   Embedding : ${embedSrc}`);
  } else {
    console.log(`⚡ Ollama non disponible → Albert API`);
    console.log(`   Résumé    : ${MODELS.chat}`);
    console.log(`   Embedding : ${MODELS.embedding}`);
  }

  if (DRY_RUN) console.log('   (mode dry-run : aucune écriture)');
  if (FORCE)   console.log('   (mode force : réindexation complète)');
  if (uuidArg) console.log(`   (exercice unique : ${uuidArg})`);
  console.log();

  const db = openDb();
  db.pragma('journal_mode = WAL');

  const exercises = loadExercisesToIndex(db);
  const toProcess = exercises.slice(0, LIMIT);

  if (toProcess.length === 0) {
    console.log('✅ Aucun exercice à indexer.');
    db.close();
    return;
  }

  const nComplet    = toProcess.filter(r => r._needsSummary).length;
  const nEmbedSeul  = toProcess.filter(r => !r._needsSummary).length;
  console.log(`📋 ${toProcess.length} exercice(s) à traiter`);
  if (nComplet   > 0) console.log(`   - ${nComplet}  réindexation complète  (${MODELS.chat} + ${MODELS.embedding})`);
  if (nEmbedSeul > 0) console.log(`   - ${nEmbedSeul}  embedding seul         (${MODELS.embedding})`);
  console.log();

  if (DRY_RUN) {
    for (const row of toProcess) {
      const mode = row._needsSummary ? 'résumé+emb' : 'emb seul  ';
      const etat = row.indexed_at ? `indexé le ${row.indexed_at.slice(0, 10)}` : 'non indexé';
      console.log(`  [${mode}]  ${row.uuid}  ${row.title?.slice(0, 55) ?? ''}  (${etat})`);
    }
    console.log();
    console.log('ℹ️  Mode dry-run : aucun appel API, aucune écriture.');
    db.close();
    return;
  }

  const stmts = {
    updateSummary: db.prepare(`
      UPDATE exercises
      SET summary = ?, concepts = ?, methods = ?, objects = ?, indexed_at = ?
      WHERE uuid = ?
    `),
    upsertEmbedding: db.prepare(`
      INSERT INTO exercise_embeddings (uuid, embedding_summary, model_version, dimension)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(uuid) DO UPDATE SET
        embedding_summary = excluded.embedding_summary,
        model_version     = excluded.model_version,
        dimension         = excluded.dimension,
        created_at        = CURRENT_TIMESTAMP
    `)
  };

  let okResume = 0, okEmbedSeul = 0, errors = 0, quotaAtteint = false;
  const journalErreurs = [];
  const startTime = Date.now();
  const runAt = new Date().toISOString();

  for (let i = 0; i < toProcess.length; i++) {
    const row = toProcess[i];
    const num  = `[${i + 1}/${toProcess.length}]`;
    const mode = row._needsSummary ? '' : '[emb] ';
    process.stdout.write(`${num} ${mode}${row.uuid} — ${row.title?.slice(0, 50) ?? ''}… `);

    try {
      await indexOne(db, row, stmts, providers);
      console.log('✅');
      if (row._needsSummary) okResume++; else okEmbedSeul++;
    } catch (err) {
      if (isQuotaExceeded(err)) {
        console.log('⏸️ ');
        quotaAtteint = true;
        break;
      }
      console.log(`❌ ${err.message}`);
      journalErreurs.push({
        position: i + 1,
        total:    toProcess.length,
        uuid:     row.uuid,
        title:    row.title ?? null,
        message:  err.message,
        at:       new Date().toISOString()
      });
      errors++;
    }
  }

  // Persister le journal d'erreurs
  if (journalErreurs.length > 0) {
    try {
      fs.mkdirSync(path.dirname(ERRORS_LOG_PATH), { recursive: true });
      fs.writeFileSync(
        ERRORS_LOG_PATH,
        JSON.stringify({ run_at: runAt, total: toProcess.length, erreurs: journalErreurs }, null, 2),
        'utf-8'
      );
    } catch (writeErr) {
      console.warn(`⚠️  Impossible d'écrire le journal d'erreurs : ${writeErr.message}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log();

  const ok = okResume + okEmbedSeul;
  if (quotaAtteint) {
    const traites = ok + errors;
    const restants = toProcess.length - traites;
    console.log(`⏸️  Quota API journalier atteint après ${traites} exercice(s) (${elapsed}s)`);
    if (okResume    > 0) console.log(`   ✅ ${okResume} résumés générés    (${providers.chatModel})`);
    if (okEmbedSeul > 0) console.log(`   ✅ ${okEmbedSeul} embeddings seuls    (${providers.embedLabel})`);
    if (errors      > 0) console.log(`   ❌ ${errors} erreurs  →  ${ERRORS_LOG_PATH}`);
    console.log(`   ⏳ ${restants} exercice(s) restants — relancez demain :`);
    console.log('   pnpm index:exercises');
  } else {
    console.log(`🏁 Terminé en ${elapsed}s`);
    if (okResume    > 0) console.log(`   ✅ ${okResume} résumés générés    (${providers.chatModel})`);
    if (okEmbedSeul > 0) console.log(`   ✅ ${okEmbedSeul} embeddings seuls    (${providers.embedLabel})`);
    if (errors      > 0) console.log(`   ❌ ${errors} erreurs  →  ${ERRORS_LOG_PATH}`);
    if (okResume > 0) {
      console.log(`   📁 Métadonnées versionnées dans content/metadata/`);
      console.log(`   → Pensez à commiter les fichiers content/metadata/*.json`);
    }
  }

  db.close();
}

main().catch(err => {
  console.error('Erreur fatale:', err.message);
  process.exit(1);
});
