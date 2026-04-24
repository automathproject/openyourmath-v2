// scripts/ia/test-client.js
import 'dotenv/config';
import { embed, rerank, chat, listModels, withRetry, EMBEDDING_DIMENSION } from '../../src/lib/ia/albert.js';

async function main() {
  console.log('=== Test du client Albert unifié ===\n');

  // Test 1 : lister les modèles
  console.log('1. Liste des modèles...');
  const models = await listModels();
  console.log(`   ✅ ${models.length} modèles disponibles\n`);

  // Test 2 : embedding simple
  console.log('2. Embedding d\'un texte...');
  const vec = await embed('Théorème central limite');
  console.log(`   ✅ Dimension : ${vec.length} (attendu: ${EMBEDDING_DIMENSION})`);
  console.log(`   ✅ Premières valeurs : [${Array.from(vec.slice(0, 3)).map(v => v.toFixed(4)).join(', ')}...]\n`);

  // Test 3 : rerank
  console.log('3. Rerank...');
  const results = await rerank('TCL', [
    'Approximation d\'une somme par la loi normale',
    'Intégration par parties',
    'Application du théorème central limite'
  ]);
  console.log(`   ✅ Résultats triés :`);
  results.forEach(r => console.log(`      [${r.index}] score=${r.score.toFixed(4)}`));
  console.log();

  // Test 4 : chat avec retry
  console.log('4. Chat avec withRetry()...');
  const response = await withRetry(() => chat('En un mot, qu\'est-ce qu\'une intégrale ?'));
  console.log(`   ✅ Réponse : "${response.trim().slice(0, 100)}"\n`);

  console.log('✅ Tous les tests ont réussi');
}

main().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});