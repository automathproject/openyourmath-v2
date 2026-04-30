// scripts/ia/test-hybrid-search.js
import 'dotenv/config';
import { hybridSearch } from '../../src/lib/db/hybridSearch.js';

const queries = [
  { query: 'théorème central limite', filters: {} },
  { query: 'matrice diagonalisable', filters: { level: 'L2' } },
  { query: 'intégrale par parties', filters: {} },
  { query: 'suite récurrente convergence', filters: { level: 'L1' } },
  { query: 'passagers avion poids', filters: {} }
];

async function runQuery(q) {
  console.log(`\n=== Query: "${q.query}" ${JSON.stringify(q.filters)} ===`);
  const t0 = Date.now();
  const results = await hybridSearch({ ...q, limit: 5 });
  const elapsed = Date.now() - t0;
  console.log(`Latence: ${elapsed}ms — ${results.length} résultat(s)`);
  results.forEach((r, i) => {
    const bm25 = r.scoreBM25 !== null ? `BM25#${r.scoreBM25}` : 'BM25-';
    const vec  = r.scoreVector !== null ? `vec=${r.scoreVector.toFixed(3)}` : 'vec-';
    console.log(`  ${i + 1}. [${r.uuid}] ${r.title} (${r.level ?? '?'}) — ${bm25}, ${vec}, RRF=${r.score.toFixed(4)}`);
  });
  return { elapsed, results };
}

async function testFiltersOnly() {
  console.log('\n=== Test robustesse : query vide ===');
  const r = await hybridSearch({ query: '', filters: { level: 'L2' }, limit: 3 });
  console.log(`  ${r.length} résultats (attendu: >0, niveau L2 uniquement)`);
  r.forEach(ex => console.log(`  — [${ex.uuid}] ${ex.title} level=${ex.level}`));
  const badLevel = r.find(ex => ex.level?.toUpperCase() !== 'L2');
  if (badLevel) console.error(`  ❌ Exercice hors L2 : ${badLevel.uuid}`);
  else console.log('  ✅ Tous L2');
}

async function testEmptyFilters() {
  console.log('\n=== Test robustesse : query non vide + filtres vides ===');
  const r = await hybridSearch({ query: 'intégrale', filters: {}, limit: 5 });
  console.log(`  ${r.length} résultats — corpus complet`);
}

async function testExoticQuery() {
  console.log('\n=== Test robustesse : query exotique sans résultat BM25 attendu ===');
  const r = await hybridSearch({ query: 'xyzqwerty123absurde', filters: {}, limit: 5 });
  console.log(`  ${r.length} résultats (attendu: 0 ou uniquement vectoriels)`);
  if (r.length > 0) {
    r.forEach(ex => console.log(`  — [${ex.uuid}] ${ex.title} BM25=${ex.scoreBM25} vec=${ex.scoreVector?.toFixed(3)}`));
  } else {
    console.log('  ✅ Aucun résultat, retour propre');
  }
}

async function testFilterL2Strict() {
  console.log('\n=== Test 4 : filtres level=L2 stricts ===');
  const r = await hybridSearch({ query: 'matrice', filters: { level: 'L2' }, limit: 10 });
  const nonL2 = r.filter(ex => ex.level?.toUpperCase() !== 'L2');
  if (nonL2.length > 0) {
    console.error(`  ❌ ${nonL2.length} exercice(s) hors L2 trouvés`);
    nonL2.forEach(ex => console.log(`     [${ex.uuid}] level=${ex.level}`));
  } else {
    console.log(`  ✅ ${r.length} résultats, tous L2`);
  }
}

async function testParallelism() {
  console.log('\n=== Test 6 : timing embed vs BM25 ===');
  // On instancie un embed isolé pour mesurer
  const { embed } = await import('../../src/lib/ia/albert.js');
  const { loadVectorStore, cosineTopK } = await import('../../src/lib/db/vectorStore.js');
  loadVectorStore();

  const query = 'convergence suite';

  // Mesure embed seul
  let t = Date.now();
  const vec = await embed(query);
  const embedMs = Date.now() - t;
  console.log(`  embed seul : ${embedMs}ms`);

  // Mesure hybridSearch (embed + BM25 + RRF + hydrate)
  t = Date.now();
  await hybridSearch({ query, filters: {}, limit: 5 });
  const hybridMs = Date.now() - t;
  console.log(`  hybridSearch : ${hybridMs}ms`);
  console.log(`  Surcoût BM25+RRF+hydrate : ~${Math.max(0, hybridMs - embedMs)}ms`);
  if (hybridMs < embedMs * 1.5) {
    console.log('  ✅ Parallelisme confirmé (hybridSearch ≈ embed seul)');
  } else {
    console.log('  ⚠️  hybridSearch significativement plus lent que embed seul');
  }
}

async function main() {
  // Requêtes principales
  for (const q of queries) {
    await runQuery(q);
  }

  // Vérification "passagers avion poids" → iQqS dans le top via vectoriel
  console.log('\n--- Vérification Test 2 : "passagers avion poids" ---');
  const passagersRes = await hybridSearch({ query: 'passagers avion poids', filters: {}, limit: 5 });
  const iQqS = passagersRes.find(r => r.uuid === 'iQqS');
  if (iQqS) {
    console.log(`✅ iQqS trouvé en position ${passagersRes.indexOf(iQqS) + 1} — BM25=${iQqS.scoreBM25 ?? '-'}, vec=${iQqS.scoreVector?.toFixed(3) ?? '-'}`);
    if (iQqS.scoreBM25 === null) console.log('   ✅ Non trouvé via BM25 (attendu)');
  } else {
    console.log('❌ iQqS absent du top 5');
  }

  // Tests de robustesse
  await testFiltersOnly();
  await testEmptyFilters();
  await testExoticQuery();
  await testFilterL2Strict();
  await testParallelism();

  console.log('\n✅ Tous les tests terminés.');
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
