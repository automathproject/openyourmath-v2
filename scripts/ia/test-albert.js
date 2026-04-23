// scripts/test-albert.js
import 'dotenv/config';

const ALBERT_BASE_URL = process.env.ALBERT_BASE_URL;
const ALBERT_API_KEY = process.env.ALBERT_API_KEY;

if (!ALBERT_API_KEY) {
  console.error('❌ ALBERT_API_KEY manquante dans .env');
  process.exit(1);
}

// Helper générique
async function albertFetch(endpoint, options = {}) {
  const response = await fetch(`${ALBERT_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${ALBERT_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${endpoint} → ${response.status}: ${text}`);
  }

  return response.json();
}

// Test 1 : lister les modèles
async function testListModels() {
  console.log('\n=== Test 1 : GET /models ===');
  const data = await albertFetch('/models');
  console.log(`✅ ${data.data.length} modèles disponibles :\n`);
  data.data.forEach(m => {
    console.log(`  - ${m.id}  (type: ${m.type || m.object || '?'})`);
  });
  return data.data;
}

// Test 2 : embedding d'un texte simple
async function testEmbedding(modelId) {
  console.log(`\n=== Test 2 : POST /embeddings (${modelId}) ===`);
  const data = await albertFetch('/embeddings', {
    method: 'POST',
    body: JSON.stringify({
      model: modelId,
      input: "Théorème central limite et intervalle de confiance"
    })
  });

  const vec = data.data[0].embedding;
  console.log(`✅ Embedding reçu`);
  console.log(`   Dimension : ${vec.length}`);
  console.log(`   5 premières valeurs : [${vec.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
  console.log(`   Tokens utilisés : ${data.usage?.total_tokens ?? 'n/a'}`);
  return vec;
}

/// Test 3 : rerank
async function testRerank(modelId) {
  console.log(`\n=== Test 3 : POST /rerank (${modelId}) ===`);
  const query = "application du théorème central limite";
  const documents = [
    "Exercice d'approximation d'une somme par la loi normale, avec calcul d'écart type.",
    "Exercice d'intégration par parties pour une fonction exponentielle.",
    "Exercice sur le calcul du poids total de passagers dans un avion, application du TCL."
  ];

  const data = await albertFetch('/rerank', {
    method: 'POST',
    body: JSON.stringify({
      model: modelId,
      query: query,
      documents: documents   // ← changement: "documents" au lieu de "input"
    })
  });

  console.log(`✅ Rerank reçu pour query : "${query}"\n`);
  console.log('Réponse brute :', JSON.stringify(data, null, 2).slice(0, 500));
  
  // Le format de réponse peut varier, on s'adapte
  const results = data.data || data.results || data;
  if (Array.isArray(results)) {
    results.forEach(item => {
      const idx = item.index;
      const score = item.score ?? item.relevance_score;
      const preview = documents[idx]?.slice(0, 60) + '...';
      console.log(`  ${score?.toFixed(4) ?? '?'}  [${idx}] ${preview}`);
    });
  }
  return results;
}

// Test 4 : chat completion (résumé d'un petit exercice)
async function testChat(modelId) {
  console.log(`\n=== Test 4 : POST /chat/completions (${modelId}) ===`);
  const data = await albertFetch('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: modelId,
      messages: [{
        role: 'user',
        content: 'En une phrase, quel est le théorème central limite ?'
      }],
      temperature: 0,
      max_tokens: 150
    })
  });

  console.log(`✅ Réponse reçue :`);
  console.log(`   "${data.choices[0].message.content.trim()}"`);
  console.log(`   Tokens : ${data.usage?.total_tokens ?? 'n/a'}`);
}

// Exécution séquentielle
async function main() {
  try {
    const models = await testListModels();

    // Identifier les modèles par type d'alias ou par nom
    // On essaie d'abord par alias (plus stable), sinon par pattern de nom
    const findModel = (patterns) => {
      for (const p of patterns) {
        const m = models.find(x => 
          x.id?.toLowerCase().includes(p.toLowerCase()) ||
          x.aliases?.some(a => a.toLowerCase().includes(p.toLowerCase()))
        );
        if (m) return m.id;
      }
      return null;
    };

    const embModel = findModel(['bge-m3', 'embeddings-small', 'embedding']);
    const rerankModel = findModel(['reranker', 'rerank']);
    const chatModel = findModel(['mistral-small', 'openweight-medium', 'gpt-oss', 'instruct']);

    console.log('\n--- Modèles détectés ---');
    console.log(`  Embedding : ${embModel ?? '❌ non trouvé'}`);
    console.log(`  Reranker  : ${rerankModel ?? '❌ non trouvé'}`);
    console.log(`  Chat      : ${chatModel ?? '❌ non trouvé'}`);

    if (embModel) await testEmbedding(embModel);
    if (rerankModel) await testRerank(rerankModel);
    if (chatModel) await testChat(chatModel);

    console.log('\n✅ Tous les tests terminés avec succès');
  } catch (err) {
    console.error('\n❌ Erreur :', err.message);
    process.exit(1);
  }
}

main();