#!/usr/bin/env node
// scripts/ia/revalidate-hashes.js
// Re-valide les content_hash après un nettoyage LaTeX purement formel.
//
// computeContentHash() hache le JSON brut des blocs (id, order, html inclus) :
// retirer un \texte{} vide renumérote les blocs suivants et invalide l'exercice,
// alors que le contenu mathématique est inchangé. Ce script compare la source .tex
// d'avant le nettoyage à la source actuelle ; si le texte est identique modulo la
// mise en forme, il réécrit le content_hash du store versionné, réarme indexed_at
// en base et re-clé le cache d'embeddings — sans aucun appel API.
//
// Usage :
//   node scripts/ia/revalidate-hashes.js --base <rev>            # re-valide
//   node scripts/ia/revalidate-hashes.js --base <rev> --dry-run  # affiche sans écrire
//   node scripts/ia/revalidate-hashes.js --base <rev> --strict   # exige un texte identique au caractère près

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { getMetadataPath } from '../utils/content-paths.js';
import { getCacheFilePath, loadEmbeddingCache } from '../../src/lib/ia/embedding-cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const ROOT     = path.resolve(__dirname, '../..');
const DB_PATH  = path.join(ROOT, 'data/exercises.sqlite');
const TEX_ROOT = 'content/exercises';

// --- CLI args ---
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const STRICT  = args.includes('--strict');
const BASE    = args.find((_, i) => args[i - 1] === '--base');

if (!BASE) {
  console.error('❌ --base <rev> est obligatoire (révision git d\'avant le nettoyage).');
  process.exit(1);
}

/**
 * Normalisation du LaTeX. On retire ce que le nettoyage a pu déplacer sans
 * changer le sens : commentaires, blocs vides, espaces, macros de bloc et
 * balisage de liste. Ce qui reste est le texte mathématique lui-même.
 */
function normalize(tex, { structure = true } = {}) {
  let s = tex
    .replace(/(^|[^\\])%.*$/gm, '$1')       // commentaires de ligne
    .replace(/\\texte?\s*\{\s*\}/g, ' ')     // \texte{} / \text{} vides
    .replace(/\s+/g, ' ')
    .trim();
  if (!structure) return s;
  return s
    .replace(/\\(texte|question|enonce)\s*\{/g, '\\BLOC{') // retypage \texte -> \question
    .replace(/\\(begin|end)\s*\{enumerate\}/g, ' ')
    .replace(/\\item/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lit en une passe toutes les versions `base` des sources concernées. */
function readSourcesAtBase(rows) {
  const specs = rows.map(r => `${BASE}:${TEX_ROOT}/${r.source_path}`).join('\n') + '\n';
  const out = execFileSync('git', ['cat-file', '--batch'], {
    cwd: ROOT, input: specs, maxBuffer: 1 << 30
  });

  const sources = new Map();
  let pos = 0;
  for (const row of rows) {
    const nl = out.indexOf(0x0a, pos);
    const header = out.toString('utf8', pos, nl);
    if (/ (missing|ambiguous)$/.test(header)) { pos = nl + 1; continue; }
    const size = parseInt(header.split(' ')[2], 10);
    sources.set(row.uuid, out.toString('utf8', nl + 1, nl + 1 + size));
    pos = nl + 1 + size + 1;
  }
  return sources;
}

function openDb() {
  const mod = require('better-sqlite3');
  const Database = mod.default || mod;
  return new Database(DB_PATH);
}

function main() {
  console.log('🔁 Re-validation des content_hash');
  console.log(`   base   : ${BASE}`);
  console.log(`   mode   : ${DRY_RUN ? 'dry-run' : 'écriture'}${STRICT ? ' (strict)' : ''}\n`);

  const db = openDb();
  const rows = db.prepare(`
    SELECT uuid, source_path, content_hash
    FROM exercises
    WHERE indexed_at IS NULL AND source_path IS NOT NULL AND content_hash IS NOT NULL
    ORDER BY uuid
  `).all();
  console.log(`📋 ${rows.length} exercice(s) en attente d'indexation\n`);

  const sources = readSourcesAtBase(rows);

  const restore = db.prepare(`
    UPDATE exercises
    SET summary = ?, concepts = ?, methods = ?, objects = ?, indexed_at = ?
    WHERE uuid = ?
  `);

  const stats = { revalides: 0, aReindexer: 0, sansMetadata: 0, absentBase: 0, embeddingsRecles: 0 };
  const aReindexer = [];

  const run = db.transaction(() => {
    for (const row of rows) {
      const oldTex = sources.get(row.uuid);
      if (oldTex === undefined) { stats.absentBase++; aReindexer.push(row.uuid); continue; }

      const curPath = path.join(ROOT, TEX_ROOT, row.source_path);
      const curTex  = fs.readFileSync(curPath, 'utf8');
      const opts    = { structure: !STRICT };
      if (normalize(oldTex, opts) !== normalize(curTex, opts)) {
        stats.aReindexer++;
        aReindexer.push(row.uuid);
        continue;
      }

      const metaPath = getMetadataPath(row.uuid, row.source_path);
      let meta = null;
      try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch { /* absent */ }
      if (!meta?.summary) { stats.sansMetadata++; aReindexer.push(row.uuid); continue; }

      const oldHash = meta.content_hash;
      if (!DRY_RUN) {
        // 1. Store versionné : la clé de correspondance suit le nouveau contenu.
        fs.writeFileSync(metaPath, JSON.stringify({
          ...meta,
          content_hash:          row.content_hash,
          previous_content_hash: oldHash,
          revalidated_at:        new Date().toISOString()
        }, null, 2) + '\n');

        // 2. Base : réarmer Pipeline B depuis le store.
        restore.run(
          meta.summary,
          JSON.stringify(meta.concepts ?? []),
          JSON.stringify(meta.methods  ?? []),
          JSON.stringify(meta.objects  ?? []),
          meta.indexed_at ?? new Date().toISOString(),
          row.uuid
        );

        // 3. Cache d'embeddings : le vecteur dérive du résumé, inchangé — on
        //    se contente de le re-clé sur le nouveau hash.
        const cached = loadEmbeddingCache(row.uuid);
        if (cached && cached.content_hash === oldHash) {
          fs.writeFileSync(
            getCacheFilePath(row.uuid),
            JSON.stringify({ ...cached, content_hash: row.content_hash }, null, 2),
            'utf-8'
          );
          stats.embeddingsRecles++;
        }
      }
      stats.revalides++;
    }
  });
  run();
  db.close();

  console.log('📊 Résultats :');
  console.log(`   ✅ ${stats.revalides} re-validés (aucun appel API)`);
  console.log(`   ↻  ${stats.embeddingsRecles} embeddings re-clés dans le cache`);
  console.log(`   🧠 ${stats.aReindexer} à réindexer (contenu réellement modifié)`);
  if (stats.sansMetadata) console.log(`   ⚠️  ${stats.sansMetadata} sans métadonnées versionnées → à réindexer`);
  if (stats.absentBase)   console.log(`   ⚠️  ${stats.absentBase} absents de ${BASE} → à réindexer`);

  const listPath = path.join(ROOT, 'cache/revalidate-todo.txt');
  fs.mkdirSync(path.dirname(listPath), { recursive: true });
  fs.writeFileSync(listPath, aReindexer.join('\n') + '\n');
  console.log(`\n📝 Liste des exercices à réindexer : ${path.relative(ROOT, listPath)}`);
  if (DRY_RUN) console.log('\n💡 Dry-run : aucune écriture. Relancez sans --dry-run pour appliquer.');
}

main();
