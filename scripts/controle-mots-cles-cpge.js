#!/usr/bin/env node
// scripts/controle-mots-cles-cpge.js
//
// Contrôle gratuit de l'étiquetage CPGE : repère les exercices gardés en CPGE
// dont l'énoncé, l'indication ou la réponse emploie un terme hors du programme
// de toutes les filières (règle d'exclusion, voir docs/classification-cpge.md).
// Un terme peut être défini par l'énoncé, ce qui n'exclut pas : les cas
// repérés vont à un arbitre, ils ne sont pas exclus automatiquement.
//
// Usage :
//   node scripts/controle-mots-cles-cpge.js [--sortie F.json] [fichiers de reports/cpge-pilote…]

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { PROJECT_ROOT } from './utils/content-paths.js';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const option = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const REPORTS = path.join(PROJECT_ROOT, 'reports/cpge-pilote');
// Ordre de priorité : la première étiquette trouvée pour un exercice l'emporte.
const FICHIERS = args.filter(a => a.endsWith('.jsonl')).length ? args.filter(a => a.endsWith('.jsonl')) : [
  'claude_opus-5-5+haiku-5-5.algebre-l1.final.jsonl',
  'claude_claude-haiku-5-5.v9.exo7-l1-essai.jsonl',
  'claude_claude-haiku-5-5.v9.masse.jsonl',
  'albert_deepseek-v4-flash-0731.v9.masse.jsonl'
];

// Termes absents des programmes de toutes les filières (texte officiel vérifié).
const TERMES = [
  ['fonction hyperbolique réciproque', /\barg\s*(sh|ch|th)\b|\b(argsh|argch|argth)\b/i],
  ['division suivant les puissances croissantes', /puissances\s+croissantes/i],
  ['enveloppe convexe', /enveloppe\s+convexe/i],
  ['espace topologique', /espaces?\s+topologiques?|\btopologie\s+(induite|produit|discr[eè]te|grossi[eè]re|de\s+zariski)|\bhausdorff\b/i],
  ['espace métrique', /espaces?\s+m[ée]triques?/i],
  ['connexité (autre que par arcs)', /\bconnexes?\b(?!\s+par\s+arcs)|\bconnexit[ée]\b(?!\s+par\s+arcs)/i],
  ['fonction holomorphe', /holomorphe|m[ée]romorphe/i],
  ['résidus, série de Laurent', /th[ée]or[èe]me\s+des\s+r[ée]sidus|s[ée]ries?\s+de\s+laurent/i],
  ['décomposition de Dunford', /dunford/i],
  ['réduction de Jordan', /(?<!gauss\s*-?\s*)\bjordan\b/i],
  ['birapport', /birapport/i],
  ['magma', /\bmagmas?\b/i],
  ['différence symétrique', /diff[ée]rence\s+sym[ée]trique/i],
  ['séries de Fourier', /\bfourier\b/i],
  ['critère d\'Eisenstein', /eisenstein/i],
  ['caractéristique d\'un corps', /caract[ée]ristique\s+(d'un|du|de\s+ce)\s+corps|corps\s+de\s+caract[ée]ristique/i],
  ['anneau principal, factoriel, euclidien', /anneaux?\s+(principa(l|ux)|factoriels?|euclidiens?)/i],
  ['idéal premier ou maximal', /id[ée]aux?\s+(premiers?|maxima(l|ux))/i],
  ['structure quotient', /(espace|groupe|anneau)s?\s+quotients?/i],
  ['formule du crible (nommée)', /formule\s+du\s+crible|inclusion[\s-]+exclusion/i],
  ['limite supérieure ou inférieure', /\\lim\s*sup|\\limsup|\\liminf|\blim\s*sup\b|\blim\s*inf\b/i],
  ['lemme de Gronwall', /gr[oö]nwall/i],
  ['statistique inférentielle', /intervalles?\s+de\s+confiance|test\s+du\s+(chi|khi|χ)|loi\s+de\s+student|estimateurs?|vraisemblance|p-valeur/i],
  ['réseau de neurones', /r[ée]seaux?\s+de\s+neurones|perceptron/i],
  // Termes repérés dans les concepts des exercices de L3, vérifiés absents du texte officiel.
  ['analyse complexe', /formule\s+(int[ée]grale\s+)?de\s+cauchy|liouville|cauchy[\s-]+riemann|fonctions?\s+enti[èe]res?|prolongement\s+analytique|logarithme\s+complexe|d[ée]termination\s+(principale\s+)?du\s+logarithme|singularit[ée]s?\s+isol[ée]es?|int[ée]grales?\s+curvilignes?|int[ée]grales?\s+de\s+contour|fonctions?\s+harmoniques?/i],
  ['théorie des groupes avancée', /sous[\s-]+groupes?\s+(distingu[ée]s?|normaux|normal)|actions?\s+de\s+groupes?|action\s+d'un\s+groupe|stabilisateur|sylow|\bp-groupes?|semi[\s-]+direct|groupes?\s+(r[ée]solubles?|simples?)|di[ée]dral|centre\s+(d'un|du)\s+groupe|\bcommutateurs?\b|indice\s+d'un\s+sous[\s-]+groupe/i],
  ['extension de corps, corps fini', /extensions?\s+de\s+corps|degr[ée]\s+d'une\s+extension|corps\s+finis?/i],
  ['forme quadratique ou sesquilinéaire', /formes?\s+quadratiques?|sesquilin[ée]aires?/i],
  ['rayon spectral, quaternions', /rayon\s+spectral|quaternions?/i],
  ['espace complet, Banach, Hilbert', /espaces?\s+(m[ée]triques?\s+|vectoriels?\s+norm[ée]s?\s+)?complets?|banach|suites?\s+de\s+cauchy|espaces?\s+de\s+hilbert|\bbaire\b|ascoli|stone[\s-]+weierstrass|hom[ée]omorphismes?|th[ée]or[èe]me\s+du\s+point\s+fixe/i],
  ['intégrale de Lebesgue, mesure', /int[ée]grale\s+de\s+lebesgue|mesure\s+de\s+lebesgue|fonctions?\s+mesurables?|\bfatou\b|convergence\s+monotone/i],
  ['sous-variété, difféomorphisme', /sous[\s-]+vari[ée]t[ée]s?|diff[ée]omorphismes?|inversion\s+locale|fonctions?\s+implicites|formes?\s+diff[ée]rentielles?/i],
  ['géométrie projective', /g[ée]om[ée]trie\s+projective|espaces?\s+projectifs?|homographies?/i],
  ['transformée de Laplace', /transform[ée]e\s+de\s+laplace/i]
];

// Accents LaTeX des anciennes sources exo7 : {\'e}, \'{e}, \`a, \^o…
const ACCENTS = { "'": { e: 'é', E: 'É', a: 'á' }, '`': { a: 'à', e: 'è', u: 'ù', A: 'À', E: 'È' }, '^': { a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û' }, '"': { e: 'ë', i: 'ï', o: 'ö', u: 'ü' } };
const normaliser = s => s
  // Commentaires LaTeX (TikZ notamment) : hors du texte lu par l'élève.
  .replace(/(?<!\\)%.*$/gm, '')
  .replace(/\{?\\(['`^"])\{?\\?([a-zA-Z])\}?\}?/g, (m, a, l) => ACCENTS[a]?.[l] ?? l)
  .replace(/\\i\b/g, 'i')
  .replace(/~/g, ' ');

const etiquettes = new Map();
for (const f of FICHIERS) {
  for (const line of fs.readFileSync(path.join(REPORTS, f), 'utf8').split('\n').filter(Boolean)) {
    const e = JSON.parse(line);
    if (!e.erreur && !etiquettes.has(e.uuid)) etiquettes.set(e.uuid, { ...e, fichier: f });
  }
}

const mod = require('better-sqlite3');
const Database = mod.default || mod;
const db = new Database(path.join(PROJECT_ROOT, 'data/exercises.sqlite'), { readonly: true });
const lire = db.prepare('SELECT content_json FROM exercises WHERE uuid = ?');

const signales = [];
for (const [uuid, e] of etiquettes) {
  if (e.releve_cpge === false) continue;
  const row = lire.get(uuid);
  if (!row) continue;
  const texte = normaliser(JSON.parse(row.content_json).map(b => `[${b.type}] ${b.latex}`).join('\n'));
  const trouves = [];
  for (const [terme, re] of TERMES) {
    const m = texte.match(re);
    if (!m) continue;
    const i = m.index;
    const avant = texte.slice(0, i).lastIndexOf('[');
    trouves.push({ terme, bloc: texte.slice(avant + 1, texte.indexOf(']', avant)), extrait: texte.slice(Math.max(0, i - 80), i + 60).replace(/\s+/g, ' ') });
  }
  if (trouves.length) signales.push({ uuid, fichier: e.fichier, niveau: e.niveau, chapitre: e.chapitre, termes: trouves });
}

const gardes = [...etiquettes.values()].filter(e => e.releve_cpge !== false).length;
console.log(`${etiquettes.size} exercices étiquetés, ${gardes} gardés en CPGE, ${signales.length} signalés`);
const parTerme = {};
const parFichier = {};
for (const s of signales) {
  parFichier[s.fichier] = (parFichier[s.fichier] ?? 0) + 1;
  for (const t of s.termes) parTerme[t.terme] = (parTerme[t.terme] ?? 0) + 1;
}
for (const [t, n] of Object.entries(parTerme).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${t}`);
console.log('Par étiqueteur :');
for (const [f, n] of Object.entries(parFichier)) console.log(`  ${String(n).padStart(4)}  ${f}`);
if (option('--sortie')) fs.writeFileSync(option('--sortie'), `${JSON.stringify(signales, null, 1)}\n`);
