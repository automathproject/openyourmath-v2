#!/usr/bin/env node
// scripts/ia/cache-stats.js
// Visualise l'état du cache d'embeddings local et détecte les incohérences.
//
// Usage :
//   node scripts/ia/cache-stats.js
//   node scripts/ia/cache-stats.js --verbose   # détails sur les entrées invalides

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import {
  EMBEDDINGS_CACHE_ROOT,
  loadEmbeddingCache,
} from '../../src/lib/ia/embedding-cache.js';
import { MODELS } from '../../src/lib/ia/albert.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const DB_PATH = path.resolve(__dirname, '../../data/exercises.sqlite');
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');

function openDb() {
  if (!fs.existsSync(DB_PATH)) return null;
  try {
    const mod = require('better-sqlite3');
    const Database = mod.default || mod;
    return new Database(DB_PATH, { readonly: true });
  } catch {
    return null;
  }
}

async function main() {
  console.log('📊 Cache d\'embeddings — statistiques');
  console.log(`   Répertoire : ${EMBEDDINGS_CACHE_ROOT}`);
  console.log();

  if (!fs.existsSync(EMBEDDINGS_CACHE_ROOT)) {
    console.log('ℹ️  Le répertoire cache/embeddings/ n\'existe pas encore.');
    console.log('   Lancez pnpm index:exercises pour générer les embeddings.');
    return;
  }

  const files = fs.readdirSync(EMBEDDINGS_CACHE_ROOT).filter(f => f.endsWith('.json'));
  console.log(`📁 ${files.length} fichier(s) en cache`);

  if (files.length === 0) {
    console.log('   (cache vide)');
    return;
  }

  let validCount = 0;
  let invalidJson = 0;
  const wrongModel = [];
  let totalSize = 0;

  for (const file of files) {
    const uuid = path.basename(file, '.json');
    const filePath = path.join(EMBEDDINGS_CACHE_ROOT, file);
    totalSize += fs.statSync(filePath).size;

    const cached = loadEmbeddingCache(uuid);
    if (!cached) {
      invalidJson++;
      if (VERBOSE) console.warn(`   ⚠️  JSON invalide : ${file}`);
      continue;
    }
    if (cached.model !== MODELS.embedding) {
      wrongModel.push({ uuid, model: cached.model });
      continue;
    }
    validCount++;
  }

  console.log(`   ✅ Valides       : ${validCount}`);
  if (invalidJson > 0)      console.log(`   ❌ JSON invalide : ${invalidJson}`);
  if (wrongModel.length > 0) {
    console.log(`   🔄 Modèle périmé : ${wrongModel.length}  (modèle actuel : ${MODELS.embedding})`);
    if (VERBOSE) wrongModel.forEach(e => console.log(`      ${e.uuid} → ${e.model}`));
  }
  console.log(`   💾 Taille totale : ${(totalSize / 1024 / 1024).toFixed(1)} Mo`);

  // Comparaison avec la base SQLite
  const db = openDb();
  if (!db) {
    console.log('\nℹ️  Base de données absente — comparaison cache ↔ base ignorée.');
    return;
  }

  try {
    const dbRows = db.prepare(`
      SELECT e.uuid, e.content_hash, ee.uuid AS has_embedding
      FROM exercises e
      LEFT JOIN exercise_embeddings ee ON e.uuid = ee.uuid
    `).all();

    const cacheSet = new Set(files.map(f => path.basename(f, '.json')));
    const dbUuids = new Set(dbRows.map(r => r.uuid));
    const dbEmbeddings = new Set(dbRows.filter(r => r.has_embedding).map(r => r.uuid));

    const inCacheNotDb = [...cacheSet].filter(u => !dbUuids.has(u));
    const inDbNotCache = [...dbEmbeddings].filter(u => !cacheSet.has(u));
    const hashMismatch = [];

    for (const { uuid, content_hash } of dbRows) {
      if (!cacheSet.has(uuid)) continue;
      const cached = loadEmbeddingCache(uuid);
      if (!cached) continue;
      if (cached.content_hash !== content_hash) hashMismatch.push(uuid);
    }

    console.log('\n📊 Comparaison cache ↔ base SQLite :');
    console.log(`   En cache          : ${cacheSet.size}`);
    console.log(`   En base (emb.)    : ${dbEmbeddings.size}`);
    if (inCacheNotDb.length > 0) {
      console.log(`   ⚠️  Cache orphelin (uuid absent de la base) : ${inCacheNotDb.length}`);
      if (VERBOSE) inCacheNotDb.forEach(u => console.log(`      ${u}`));
    }
    if (inDbNotCache.length > 0) {
      console.log(`   ℹ️  Embeddings en base sans cache local     : ${inDbNotCache.length}`);
    }
    if (hashMismatch.length > 0) {
      console.log(`   ⚠️  Hash incohérent (contenu modifié)       : ${hashMismatch.length}`);
      if (VERBOSE) hashMismatch.forEach(u => console.log(`      ${u}`));
    }
    if (inCacheNotDb.length === 0 && hashMismatch.length === 0) {
      console.log('   ✅ Aucune incohérence détectée');
    }
  } finally {
    db.close();
  }
}

main().catch(err => {
  console.error('Erreur fatale :', err.message);
  process.exit(1);
});
