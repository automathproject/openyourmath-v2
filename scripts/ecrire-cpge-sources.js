#!/usr/bin/env node
// scripts/ecrire-cpge-sources.js
//
// Écrit les rattachements CPGE consolidés (reports/cpge-pilote/consolide.jsonl)
// dans la macro \cpge{} des sources .tex de content/exercises. La provenance de
// chaque rattachement (modèle, relecture, règle) reste dans consolide.jsonl.
// Un exercice hors CPGE n'a pas de \cpge{} : la ligne est retirée si elle
// existait. Relancer le script remplace la ligne sans la dupliquer.
//
// Usage :
//   node scripts/ecrire-cpge-sources.js [--consolide F.jsonl] [--verifier]

import fs from 'fs';
import path from 'path';
import { EXERCISES_ROOT, PROJECT_ROOT } from './utils/content-paths.js';

const args = process.argv.slice(2);
const option = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const CONSOLIDE = option('--consolide') ?? path.join(PROJECT_ROOT, 'reports/cpge-pilote/consolide.jsonl');
const VERIFIER = args.includes('--verifier');

// Métadonnées d'en-tête après lesquelles placer \cpge{}, de la plus à la moins précise.
const ANCRES = ['sousChapitre', 'chapitre', 'module', 'niveau', 'titre', 'uuid'];

function* fichiersTex(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* fichiersTex(full);
    else if (entry.name.endsWith('.tex')) yield full;
  }
}

/** Source modifiée : ligne \cpge{} remplacée, insérée ou retirée. */
export function ecrireCpge(tex, noeuds) {
  const sans = tex.replace(/^\\cpge\{[^}]*\}[ \t]*\r?\n/m, '');
  if (!noeuds.length) return sans;
  const ligne = `\\cpge{${noeuds.join(', ')}}\n`;
  for (const ancre of ANCRES) {
    const re = new RegExp(`^\\\\${ancre}\\{.*\\}[ \\t]*\\r?\\n`, 'm');
    const m = sans.match(re);
    if (m) return sans.slice(0, m.index + m[0].length) + ligne + sans.slice(m.index + m[0].length);
  }
  return null;
}

const parUuid = new Map();
for (const file of fichiersTex(EXERCISES_ROOT)) {
  const m = fs.readFileSync(file, 'utf8').match(/\\uuid\{([^}]+)\}/);
  if (m) parUuid.set(m[1].trim(), file);
}

const lignes = fs.readFileSync(CONSOLIDE, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
const bilan = { ecrits: 0, retires: 0, inchanges: 0, introuvables: [], sansAncre: [] };
for (const e of lignes) {
  const file = parUuid.get(e.uuid);
  if (!file) {
    bilan.introuvables.push(e.uuid);
    continue;
  }
  const tex = fs.readFileSync(file, 'utf8');
  const noeuds = e.releve_cpge ? [...new Set(e.noeuds)] : [];
  const nouveau = ecrireCpge(tex, noeuds);
  if (nouveau === null) {
    bilan.sansAncre.push(e.uuid);
    continue;
  }
  if (nouveau === tex) {
    bilan.inchanges++;
    continue;
  }
  if (!VERIFIER) fs.writeFileSync(file, nouveau);
  if (noeuds.length) bilan.ecrits++;
  else bilan.retires++;
}
console.log(`${VERIFIER ? 'À modifier' : 'Modifiés'} : ${bilan.ecrits} \\cpge{} écrits, ${bilan.retires} retirés, ${bilan.inchanges} inchangés`);
if (bilan.introuvables.length) console.log(`Sources introuvables (${bilan.introuvables.length}) : ${bilan.introuvables.join(', ')}`);
if (bilan.sansAncre.length) console.log(`Sans métadonnée d'en-tête (${bilan.sansAncre.length}) : ${bilan.sansAncre.join(', ')}`);
if (VERIFIER && bilan.ecrits + bilan.retires) process.exitCode = 1;
