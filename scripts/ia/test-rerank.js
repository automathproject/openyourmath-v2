// scripts/ia/test-rerank.js
import 'dotenv/config';
import { hybridSearch } from '../../src/lib/db/hybridSearch.js';

const testCases = [
  {
    label: '"passagers avion poids" — cible iQqS attendu top 2 après rerank',
    query: 'passagers avion poids',
    filters: {},
    targetUuid: 'iQqS',
    limit: 5
  },
  {
    label: '"théorème central limite" — cohérence lexicale + sémantique',
    query: 'théorème central limite',
    filters: {},
    targetUuid: 'alNi',
    limit: 5
  },
  {
    label: '"suite récurrente convergence" level=L1 — régression : vectoriel pur doit tenir',
    query: 'suite récurrente convergence',
    filters: { level: 'L1' },
    targetUuid: null,
    limit: 5
  },
  {
    label: '"matrice diagonalisable" level=L2',
    query: 'matrice diagonalisable',
    filters: { level: 'L2' },
    targetUuid: null,
    limit: 5
  }
];

function positionOf(results, uuid) {
  const idx = results.findIndex(r => r.uuid === uuid);
  return idx === -1 ? null : idx + 1;
}

function printResults(results, targetUuid) {
  results.forEach((r, i) => {
    const flag = r.uuid === targetUuid ? ' ◀' : '';
    const bm25  = r.scoreBM25    !== null ? `BM25#${r.scoreBM25}` : 'BM25-';
    const vec   = r.scoreVector  !== null ? `vec=${r.scoreVector.toFixed(3)}` : 'vec-';
    const rrf   = `RRF=${r.score.toFixed(4)}`;
    const rrk   = r.rerankScore != null ? `rerank=${r.rerankScore.toFixed(4)}` : 'rerank-';
    console.log(`    ${i + 1}. [${r.uuid}] ${r.title?.slice(0, 50)} (${r.level ?? '?'}) — ${bm25}, ${vec}, ${rrf}, ${rrk}${flag}`);
  });
}

async function runCase(tc) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📋 ${tc.label}`);

  // Sans rerank
  let t0 = Date.now();
  const noRerank = await hybridSearch({ query: tc.query, filters: tc.filters, limit: tc.limit, rerank: false });
  const msNoRerank = Date.now() - t0;

  // Avec rerank
  t0 = Date.now();
  const withRerank = await hybridSearch({ query: tc.query, filters: tc.filters, limit: tc.limit, rerank: true, rerankCandidates: 50 });
  const msWithRerank = Date.now() - t0;

  console.log(`\n  Sans rerank  (${msNoRerank}ms):`);
  printResults(noRerank, tc.targetUuid);

  console.log(`\n  Avec rerank  (${msWithRerank}ms, Δ+${msWithRerank - msNoRerank}ms):`);
  printResults(withRerank, tc.targetUuid);

  if (tc.targetUuid) {
    const posBefore = positionOf(noRerank, tc.targetUuid);
    const posAfter  = positionOf(withRerank, tc.targetUuid);
    const arrow = posAfter !== null && posBefore !== null
      ? (posAfter < posBefore ? `↑ ${posBefore}→${posAfter}` : posAfter === posBefore ? `= ${posAfter}` : `↓ ${posBefore}→${posAfter}`)
      : `avant=${posBefore ?? 'absent'} après=${posAfter ?? 'absent'}`;
    console.log(`\n  Cible ${tc.targetUuid} : ${arrow}`);
    if (posAfter !== null && posAfter <= 2) console.log('  ✅ Dans le top 2 après rerank');
    else if (posAfter !== null) console.log(`  ⚠️  Position ${posAfter} après rerank (attendu ≤ 2)`);
    else console.log('  ❌ Absent du top après rerank');
  }

  // Régression : les UUIDs du top-5 no-rerank sont-ils tous encore présents après rerank ?
  const noRerankUuids = new Set(noRerank.map(r => r.uuid));
  const withRerankUuids = new Set(withRerank.map(r => r.uuid));
  const disappeared = [...noRerankUuids].filter(u => !withRerankUuids.has(u));
  if (disappeared.length > 0) {
    console.log(`  ℹ️  ${disappeared.length} UUID(s) remplacés après rerank : ${disappeared.join(', ')}`);
  } else {
    console.log('  ✅ Même ensemble de résultats (ordre différent seulement)');
  }
}

async function testTimeout() {
  console.log(`\n${'═'.repeat(70)}`);
  console.log('🔧 Test timeout/fallback : simulation indirecte');
  console.log('  (timeout réel nécessiterait de mocker Albert — on vérifie juste le fallback log)');
  // On peut vérifier que rerankDocuments avec une query normale retourne rerankScore non-null
  const res = await hybridSearch({ query: 'intégrale', filters: {}, limit: 3, rerank: true });
  const allHaveScore = res.every(r => r.rerankScore !== null);
  console.log(`  rerankScore présent sur tous les résultats : ${allHaveScore ? '✅' : '❌ (fallback RRF déclenché)'}`);
  res.forEach(r => console.log(`    [${r.uuid}] rerankScore=${r.rerankScore?.toFixed(4) ?? 'null'}`));
}

async function main() {
  for (const tc of testCases) {
    await runCase(tc);
  }
  await testTimeout();
  console.log(`\n${'═'.repeat(70)}`);
  console.log('✅ Tests terminés.');
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
