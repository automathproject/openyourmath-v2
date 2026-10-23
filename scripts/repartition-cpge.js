#!/usr/bin/env node
// scripts/repartition-cpge.js
//
// Répartition de l'étiquetage CPGE du reste de la base entre Albert et Haiku
// (voir docs/classification-cpge.md). Un exercice est fait dès qu'il figure,
// sans erreur et en v6 ou plus, dans un fichier de reports/cpge-pilote/.
// - File d'Albert (deepseek-v4-flash, gratuit, ~180 exercices par jour) :
//   la L1 et la L2, dans l'ordre, là où les exclusions sont rares.
// - File de Haiku (sous-agents, à la demande) : les autres niveaux d'abord,
//   puis la L1 et la L2 en partant de la fin, pour ne pas croiser Albert.
//
// Usage :
//   node scripts/repartition-cpge.js --etat
//   node scripts/repartition-cpge.js --albert F.txt     # uuids de la file d'Albert
//   node scripts/repartition-cpge.js --haiku N F.txt    # N prochains uuids de la file de Haiku

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { PROJECT_ROOT } from './utils/content-paths.js';
import { horsProgrammeParRegle } from './utils/cpge-regles.js';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const option = (name, i = 1) => {
  const k = args.indexOf(name);
  return k >= 0 ? args[k + i] : undefined;
};

const REPORTS = path.join(PROJECT_ROOT, 'reports/cpge-pilote');
const NIVEAUX_ALBERT = new Set(['L1', 'L2']);
// Mesuré sur l'essai et les premiers lots de masse.
const JETONS_HAIKU_PAR_EXERCICE = 12_000;

const faits = new Map();
for (const f of fs.readdirSync(REPORTS).filter(f => f.endsWith('.jsonl'))) {
  for (const line of fs.readFileSync(path.join(REPORTS, f), 'utf8').split('\n').filter(Boolean)) {
    const e = JSON.parse(line);
    if (!e.erreur && e.pilote >= 6 && !faits.has(e.uuid)) faits.set(e.uuid, f);
  }
}

const mod = require('better-sqlite3');
const Database = mod.default || mod;
const db = new Database(path.join(PROJECT_ROOT, 'data/exercises.sqlite'), { readonly: true });
// Les exercices hors CPGE par règle (M1, chapitres de L3 hors programme,
// voir utils/cpge-regles.js) n'entrent dans aucune file.
const restants = db.prepare('SELECT uuid, level, chapter FROM exercises ORDER BY level, chapter, uuid').all()
  .filter(row => !faits.has(row.uuid) && !horsProgrammeParRegle(row.level, row.chapter));
const pourAlbert = restants.filter(row => NIVEAUX_ALBERT.has(row.level));
const fileHaiku = [...restants.filter(row => !NIVEAUX_ALBERT.has(row.level)), ...pourAlbert.toReversed()];

if (args.includes('--etat')) {
  const parFichier = {};
  for (const f of faits.values()) parFichier[f] = (parFichier[f] ?? 0) + 1;
  console.log(`Faits : ${faits.size}`);
  for (const [f, n] of Object.entries(parFichier).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${f}`);
  const parNiveau = {};
  for (const row of restants) parNiveau[row.level ?? '?'] = (parNiveau[row.level ?? '?'] ?? 0) + 1;
  console.log(`Restants : ${restants.length} (${Object.entries(parNiveau).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  console.log(`  file d'Albert (L1, L2) : ${pourAlbert.length}`);
  console.log(`  hors file d'Albert : ${restants.length - pourAlbert.length}`);
  console.log(`Si Haiku faisait tout le reste : ≈ ${Math.round(restants.length * JETONS_HAIKU_PAR_EXERCICE / 1e6)} M de jetons`);
}

if (option('--albert')) {
  fs.writeFileSync(option('--albert'), pourAlbert.map(row => row.uuid).join(','));
  console.log(`${pourAlbert.length} exercices dans la file d'Albert`);
}

if (option('--haiku')) {
  const n = Number(option('--haiku'));
  const choisis = fileHaiku.slice(0, n);
  fs.writeFileSync(option('--haiku', 2), choisis.map(row => row.uuid).join(','));
  const parNiveau = {};
  for (const row of choisis) parNiveau[row.level ?? '?'] = (parNiveau[row.level ?? '?'] ?? 0) + 1;
  console.log(`${choisis.length} exercices pour Haiku (${Object.entries(parNiveau).map(([k, v]) => `${k} ${v}`).join(', ')}), ` +
    `≈ ${(choisis.length * JETONS_HAIKU_PAR_EXERCICE / 1e6).toFixed(1)} M de jetons`);
}
