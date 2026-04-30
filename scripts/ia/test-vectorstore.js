// scripts/ia/test-vectorstore.js
import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadVectorStore, cosineTopK, getStoreStats } from '../../src/lib/db/vectorStore.js';
import { embed } from '../../src/lib/ia/albert.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/exercises.sqlite');

function openDb() {
  return new Database(DB_PATH, { readonly: true, fileMustExist: true });
}

async function main() {
  // Test 1 : chargement
  loadVectorStore();
  console.log('\n📊 Stats:', getStoreStats());

  // Test 4 : idempotence (appel immédiat, aucun message "Chargement" ne doit réapparaître)
  console.log('\n🔄 Test idempotence (deuxième appel loadVectorStore)...');
  loadVectorStore();
  console.log('   ✅ Pas de rechargement');

  // Vectorisation query
  const query = 'théorème central limite';
  console.log(`\n🔍 Recherche pour "${query}" (sans filtre)`);

  let t0 = Date.now();
  const queryVector = await embed(query);
  console.log(`   Vectorisation query: ${Date.now() - t0}ms`);

  // Test 2 : recherche sans filtre
  t0 = Date.now();
  const top10 = cosineTopK(queryVector, 10);
  console.log(`   cosineTopK: ${Date.now() - t0}ms`);

  const db = openDb();
  function resolveTitles(uuids) {
    if (uuids.length === 0) return {};
    const placeholders = uuids.map(() => '?').join(',');
    const rows = db.prepare(`SELECT uuid, title FROM exercises WHERE uuid IN (${placeholders})`).all(...uuids);
    return Object.fromEntries(rows.map(r => [r.uuid, r.title]));
  }

  const titles = resolveTitles(top10.map(r => r.uuid));
  console.log('   Top 10:');
  for (const r of top10) {
    console.log(`     ${r.score.toFixed(4)} — ${r.uuid} — ${titles[r.uuid] ?? '(titre inconnu)'}`);
  }

  // Test 3 : filtrage par niveau L2
  console.log(`\n🔍 Recherche pour "${query}" (filtre: niveau L2)`);
  const l2Uuids = db.prepare("SELECT uuid FROM exercises WHERE level = 'L2'").all().map(r => r.uuid);
  const l2Set = new Set(l2Uuids);
  console.log(`   ${l2Set.size} UUIDs autorisés`);

  t0 = Date.now();
  const top10L2 = cosineTopK(queryVector, 10, l2Set);
  console.log(`   cosineTopK: ${Date.now() - t0}ms`);

  const titlesL2 = resolveTitles(top10L2.map(r => r.uuid));
  console.log('   Top 10:');
  for (const r of top10L2) {
    console.log(`     ${r.score.toFixed(4)} — ${r.uuid} — ${titlesL2[r.uuid] ?? '(titre inconnu)'}`);
  }

  db.close();
  console.log('\n✅ Tous les tests terminés.');
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
