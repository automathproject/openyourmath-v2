#!/usr/bin/env node
// scripts/ia/restore-embedding-cache.js
// Reconstruit cache/embeddings/ depuis la table exercise_embeddings de la DB.
// Utile pour initialiser le cache sur une nouvelle machine après avoir reçu la DB.
//
// Usage :
//   node scripts/ia/restore-embedding-cache.js           # tout restaurer
//   node scripts/ia/restore-embedding-cache.js --dry-run # compter sans écrire

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const DB_PATH    = path.resolve(__dirname, '../../data/exercises.sqlite');
const CACHE_ROOT = path.resolve(__dirname, '../../cache/embeddings');

const DRY_RUN = process.argv.includes('--dry-run');

if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ DB absente : ${DB_PATH}`);
  console.error('   Lancez d\'abord pnpm build:content');
  process.exit(1);
}

const mod = require('better-sqlite3');
const Database = mod.default || mod;
const db = new Database(DB_PATH, { readonly: true });

const rows = db.prepare(`
  SELECT ee.uuid, ee.embedding_summary, ee.model_version, ee.dimension, e.content_hash
  FROM exercise_embeddings ee
  JOIN exercises e ON e.uuid = ee.uuid
  WHERE ee.embedding_summary IS NOT NULL
`).all();

db.close();

console.log(`📦 ${rows.length} embedding(s) trouvé(s) en base`);
if (DRY_RUN) console.log('   (dry-run : aucune écriture)');

if (!DRY_RUN) fs.mkdirSync(CACHE_ROOT, { recursive: true });

let restored = 0, skipped = 0, errors = 0;

for (const row of rows) {
  const filePath = path.join(CACHE_ROOT, `${row.uuid}.json`);

  if (fs.existsSync(filePath)) {
    skipped++;
    continue;
  }

  if (DRY_RUN) { restored++; continue; }

  try {
    const buf = Buffer.from(row.embedding_summary);
    const vector = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const data = {
      uuid:             row.uuid,
      model:            row.model_version,
      dimension:        row.dimension ?? vector.length,
      content_hash:     row.content_hash,
      embedding_base64: buf.toString('base64'),
      created_at:       new Date().toISOString()
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    restored++;
  } catch (err) {
    console.warn(`⚠️  ${row.uuid} : ${err.message}`);
    errors++;
  }
}

console.log(`✅ ${restored} restauré(s)  |  ${skipped} déjà présent(s)  |  ${errors} erreur(s)`);
