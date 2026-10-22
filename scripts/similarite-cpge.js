#!/usr/bin/env node
// scripts/similarite-cpge.js
//
// Tri préalable de l'étiquetage CPGE par similarité d'embeddings : pour chaque
// exercice, la similarité cosinus maximale entre le vecteur bge-m3 de son
// résumé (exercise_embeddings) et le texte officiel de chaque groupe du
// programme (mêmes vecteurs que la présélection). Un exercice très éloigné de
// tous les programmes est probablement hors CPGE.
//
// Usage :
//   node scripts/similarite-cpge.js --uuids a,b,c --sortie sim.json
//   → { uuid: { max, groupe } }

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { collectReferentiel } from './build-referentiel-cpge.js';
import { loadConcordance, indexNodes, buildCandidates } from './utils/cpge-candidats.js';
import { PROJECT_ROOT } from './utils/content-paths.js';
import { ollamaEmbed } from '../src/lib/ia/ollama.js';
import { embeddingsGroupes, cosinus, vecteurBlob } from './utils/cpge-preselection.js';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const option = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const referentiel = collectReferentiel();
const index = indexNodes(referentiel.nodes);
const racines = referentiel.nodes.filter(node => !node.parent_id).map(node => node.id);
const concordance = loadConcordance(path.join(PROJECT_ROOT, 'content/referentials/cpge/concordance.json'));
const groups = buildCandidates(racines, index, { concordance });
const vecs = await embeddingsGroupes(groups, index, {
  embed: ollamaEmbed, cacheFile: path.join(PROJECT_ROOT, 'cache/cpge/groupes-embeddings.json')
});

const mod = require('better-sqlite3');
const Database = mod.default || mod;
const db = new Database(path.join(PROJECT_ROOT, 'data/exercises.sqlite'), { readonly: true });
const lire = db.prepare('SELECT embedding_summary FROM exercise_embeddings WHERE uuid = ?');
const sortie = {};
for (const uuid of option('--uuids').split(',').filter(Boolean)) {
  const row = lire.get(uuid);
  if (!row) continue;
  const v = vecteurBlob(row.embedding_summary);
  let max = -1;
  let groupe = null;
  groups.forEach(g => {
    const s = cosinus(v, vecs.get(g.noeuds[0]));
    if (s > max) [max, groupe] = [s, g.code];
  });
  sortie[uuid] = { max: Math.round(max * 1000) / 1000, groupe };
}
fs.writeFileSync(option('--sortie'), `${JSON.stringify(sortie)}\n`);
console.log(`${Object.keys(sortie).length} exercices`);
