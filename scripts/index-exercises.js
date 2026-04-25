#!/usr/bin/env node
// scripts/index-exercises.js
// Pipeline B : indexation sémantique des exercices via Albert.
// Génère summary/concepts/methods/objects via LLM, puis l'embedding vectoriel.
// Les métadonnées LLM sont versionnées dans content/metadata/{uuid}.json.
// Les embeddings sont stockés uniquement en base (régénérables depuis le texte).
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
import { embed, MODELS, withRetry } from '../src/lib/ia/albert.js';
import { saveAlbertMetadata } from './utils/albert-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

dotenvConfig({ path: path.resolve(__dirname, '../.env') });

const DB_PATH = path.resolve(__dirname, '../data/exercises.sqlite');

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
    return [row];
  }
  if (FORCE) {
    return db.prepare('SELECT * FROM exercises ORDER BY chapter, uuid').all();
  }
  return db.prepare('SELECT * FROM exercises WHERE indexed_at IS NULL ORDER BY chapter, uuid').all();
}

const SEMANTIC_TYPES = new Set(['enonce', 'question', 'reponse', 'indication', 'hint', 'answer', 'solution', 'texte', 'text']);

function computeContentHash(contentArray) {
  if (!Array.isArray(contentArray)) return null;
  const blocks = contentArray.filter(b => SEMANTIC_TYPES.has((b?.type || '').toLowerCase()));
  return crypto.createHash('sha256').update(JSON.stringify(blocks)).digest('hex');
}

async function indexOne(db, row, stmts) {
  const content = JSON.parse(row.content_json);
  const contentHash = computeContentHash(content);

  // 1. Résumé LLM
  const summaryModel = MODELS.chat;
  const summaryObj = await withRetry(
    () => summarizeExercise({ ...row, content }, { model: summaryModel }),
    { maxAttempts: 3, delayMs: 2000 }
  );

  const indexedAt = new Date().toISOString();

  if (!DRY_RUN) {
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

    // 4. Embedding
    const embeddingText = buildEmbeddingText(summaryObj);
    const vector = await withRetry(
      () => embed(embeddingText),
      { maxAttempts: 3, delayMs: 1000 }
    );
    const blob = Buffer.from(vector.buffer);
    stmts.upsertEmbedding.run(row.uuid, blob, MODELS.embedding, vector.length);
  }

  return summaryObj;
}

async function main() {
  console.log('🧠 Pipeline B — Indexation sémantique via Albert');
  console.log(`   Modèle résumé  : ${MODELS.chat}`);
  console.log(`   Modèle embedding : ${MODELS.embedding}`);
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

  console.log(`📋 ${toProcess.length} exercice(s) à traiter`);
  console.log();

  if (DRY_RUN) {
    for (const row of toProcess) {
      const indexed = row.indexed_at ? `indexé le ${row.indexed_at.slice(0, 10)}` : 'non indexé';
      console.log(`  ${row.uuid}  ${row.title?.slice(0, 60) ?? ''}  (${indexed})`);
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

  let ok = 0, errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < toProcess.length; i++) {
    const row = toProcess[i];
    const num = `[${i + 1}/${toProcess.length}]`;
    process.stdout.write(`${num} ${row.uuid} — ${row.title?.slice(0, 50) ?? ''}… `);

    try {
      await indexOne(db, row, stmts);
      console.log('✅');
      ok++;
    } catch (err) {
      console.log(`❌ ${err.message}`);
      errors++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log();
  console.log(`🏁 Terminé en ${elapsed}s`);
  console.log(`   ✅ ${ok} indexés   ❌ ${errors} erreurs`);
  if (!DRY_RUN && ok > 0) {
    console.log(`   📁 Métadonnées versionnées dans content/metadata/`);
    console.log(`   → Pensez à commiter les fichiers content/metadata/*.json`);
  }

  db.close();
}

main().catch(err => {
  console.error('Erreur fatale:', err.message);
  process.exit(1);
});
