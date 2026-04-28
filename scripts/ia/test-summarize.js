// scripts/ia/test-summarize.js
import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import { summarizeExercise, buildEmbeddingText } from '../../src/lib/ia/summarize.js';
import { ollamaChat, checkOllamaAvailable, OLLAMA_MODELS } from '../../src/lib/ia/ollama.js';

const DB_PATH = path.resolve('data/exercises.sqlite');

// UUIDs à tester — à adapter avec des exos variés de ton corpus.
// L'idéal : 1 par niveau/module pour voir la qualité transversale.
const TEST_UUIDS = [
  'TORD',  // Ton exo de TCL en probabilités (L2)
  'CV3e', 
  'taba',
  'mN4p',

  // Ajoute ici 4-5 UUIDs d'exos variés : analyse L1, algèbre L2, topologie L3, etc.
];

async function main() {
  const ollama = await checkOllamaAvailable();
  if (!ollama.available || !ollama.hasChat) {
    console.error(`❌ Ollama indisponible ou modèle chat absent (${OLLAMA_MODELS.chat})`);
    console.error(`   Modèles installés : ${(ollama.models ?? []).join(', ') || 'aucun'}`);
    process.exit(1);
  }
  console.log(`✅ Ollama OK — modèle chat : ${OLLAMA_MODELS.chat}\n`);

  const db = new Database(DB_PATH, { readonly: true });

  for (const uuid of TEST_UUIDS) {
    const row = db.prepare(`
      SELECT uuid, title, level, module, chapter, subchapter, theme, content_json
      FROM exercises WHERE uuid = ?
    `).get(uuid);

    if (!row) {
      console.log(`❌ ${uuid} introuvable`);
      continue;
    }

    const exercise = { ...row, content: JSON.parse(row.content_json) };

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📝 ${uuid} — ${exercise.title}`);
    console.log(`   ${exercise.level} / ${exercise.module} / ${exercise.chapter}`);
    console.log('='.repeat(70));

    const t0 = Date.now();
    try {
      const summary = await summarizeExercise(exercise, { chatFn: ollamaChat });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      console.log(`\n⏱️  ${elapsed}s`);
      console.log(`\n📄 Summary:\n${summary.summary}`);
      console.log(`\n🧩 Concepts: ${summary.concepts.join(' · ')}`);
      console.log(`🔧 Methods:  ${summary.methods.join(' · ')}`);
      console.log(`📦 Objects:  ${summary.objects.join(' · ')}`);

      console.log(`\n🎯 Texte à embedder:\n${buildEmbeddingText(summary)}`);
    } catch (err) {
      console.error(`❌ ${err.message}`);
    }
  }

  db.close();
}

main().catch(err => {
  console.error('💥', err);
  process.exit(1);
});