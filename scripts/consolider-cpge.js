#!/usr/bin/env node
// scripts/consolider-cpge.js
//
// Étiquetage CPGE consolidé : un exercice par ligne, avec la meilleure source
// disponible (voir docs/classification-cpge.md), dans cet ordre :
//   1. la relecture humaine (pages de contrôle, export de leur base) ;
//   2. l'algèbre de L1 en deux passages arbitrés, avec les règles tranchées ;
//   3. l'essai Haiku 5.5 (v9), puis 4. la masse Haiku 5.5 (v9) ;
//   5. la masse Albert (deepseek-v4-flash, v9) ;
//   6. les deux chapitres en deux passages (passage A quand A et B concordent) ;
//   7. le pilote Opus (v7) ;
//   8. pour le niveau M1, hors CPGE par règle, sans appel au modèle.
// Les décisions du contrôle par mots-clés et les verdicts corrigés par le
// relecteur s'appliquent ensuite.
//
// Usage :
//   node scripts/consolider-cpge.js --avis-controle F.json --avis-divergences F.json [--sortie F.jsonl]
//
// La sortie, versionnée, est allégée : verdict, nœuds et groupes, source et
// drapeaux. La version complète, avec motifs, confiances et justifications,
// va dans cache/cpge/consolide-complet.jsonl (non versionné).

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { collectReferentiel } from './build-referentiel-cpge.js';
import { loadConcordance, indexNodes, buildCandidates } from './utils/cpge-candidats.js';
import { PROJECT_ROOT } from './utils/content-paths.js';

const args = process.argv.slice(2);
const option = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const REPORTS = path.join(PROJECT_ROOT, 'reports/cpge-pilote');
const SORTIE = option('--sortie') ?? path.join(REPORTS, 'consolide.jsonl');
const SORTIE_COMPLETE = path.join(PROJECT_ROOT, 'cache/cpge/consolide-complet.jsonl');

// Verdicts que le relecteur a tranchés en appliquant la règle d'exclusion (v8).
const VERDICTS_RELECTEUR = {
  XhZo: 'connexité autre que par arcs',
  buqo: 'différence symétrique Δ employée sans définition',
  '2MXQ': 'différence symétrique Δ employée sans définition'
};

const lireJsonl = f => new Map(fs.readFileSync(path.join(REPORTS, f), 'utf8').split('\n').filter(Boolean)
  .map(line => JSON.parse(line)).filter(e => !e.erreur).map(e => [e.uuid, e]));
const lireAvis = f => {
  const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
  return (doc.data ?? doc).exercices;
};

const { nodes } = collectReferentiel();
const index = indexNodes(nodes);
const groupes = buildCandidates(nodes.filter(n => !n.parent_id).map(n => n.id), index,
  { concordance: loadConcordance(path.join(PROJECT_ROOT, 'content/referentials/cpge/concordance.json')) });
const groupeDe = new Map(groupes.flatMap(g => g.noeuds.map(n => [n, g])));

// Décision du relecteur sur un groupe : celle d'un de ses nœuds (clé « a:b:c »).
const decision = (avis, g) => g.noeuds.map(n => avis.groupes?.[n.replaceAll('.', ':')]).find(Boolean) ?? '';

/** Étiquette issue de la relecture : groupes gardés et ajouts, verdict du relecteur. */
function depuisAvis(avis, base, releve) {
  const gardes = new Set([
    ...groupes.filter(g => decision(avis, g) === 'garder'),
    ...(avis.ajouts ?? []).map(k => groupeDe.get(k.replaceAll(':', '.'))).filter(Boolean)
  ]);
  const difficile = {};
  for (const [k, filieres] of Object.entries(avis.difficile ?? {})) {
    const g = groupeDe.get(k.replaceAll(':', '.'));
    if (g && filieres?.length) difficile[g.code] = filieres;
  }
  return {
    ...base,
    releve_cpge: releve,
    motif: releve ? base.motif : `Hors CPGE pour le relecteur.${avis.remarque ? ` ${avis.remarque}` : ''}`,
    propositions: releve ? [...gardes].flatMap(g => g.noeuds.map(noeud => ({ noeud, groupe: g.code, origine: 'relecteur', confiance: 1 }))) : [],
    ...(Object.keys(difficile).length ? { difficile } : {}),
    ...(avis.remarque ? { remarque_relecteur: avis.remarque } : {})
  };
}

const consolide = new Map();
const poser = (uuid, entry, source) => {
  if (!consolide.has(uuid)) consolide.set(uuid, { ...entry, source });
};

// 1. Relecture humaine.
const v7 = lireJsonl('claude_claude-opus-5-5.v7.jsonl');
const direct = lireJsonl('claude_claude-opus-5-5.v7.direct.jsonl');
const A2 = lireJsonl('claude_claude-opus-5-5.deux-chapitres.A.jsonl');
const B2 = lireJsonl('claude_claude-opus-5-5.deux-chapitres.B.jsonl');
for (const [uuid, avis] of Object.entries(lireAvis(option('--avis-controle')))) {
  if (!avis.relu || !v7.has(uuid)) continue;
  // Le verdict affiché sur la page était celui des deux méthodes Opus quand elles concordaient.
  const r1 = v7.get(uuid).releve_cpge !== false;
  const r2 = direct.get(uuid)?.releve_cpge !== false;
  const affiche = r1 === r2 ? r1 : true;
  const releve = avis.cpge ? (avis.cpge === 'accord' ? affiche : !affiche) : affiche;
  poser(uuid, depuisAvis(avis, v7.get(uuid), releve), 'relecteur (échantillon de contrôle)');
}
for (const [uuid, avis] of Object.entries(lireAvis(option('--avis-divergences')))) {
  if (!avis.relu || !A2.has(uuid)) continue;
  const affiche = A2.get(uuid).releve_cpge !== false || B2.get(uuid)?.releve_cpge !== false;
  const releve = avis.cpge ? (avis.cpge === 'accord' ? affiche : !affiche) : affiche;
  poser(uuid, depuisAvis(avis, A2.get(uuid), releve), 'relecteur (divergences des deux chapitres)');
}

// 2 à 5. Étiquetages v8-v9.
for (const [f, source] of [
  ['claude_opus-5-5+haiku-5-5.algebre-l1.final.jsonl', 'algèbre de L1 (deux passages Opus, arbitrage)'],
  ['claude_claude-haiku-5-5.v9.exo7-l1-essai.jsonl', 'Haiku 5.5 v9 (essai)'],
  ['claude_claude-haiku-5-5.v9.masse.jsonl', 'Haiku 5.5 v9'],
  ['albert_deepseek-v4-flash-0731.v9.masse.jsonl', 'Albert deepseek-v4-flash v9']
]) for (const [uuid, e] of lireJsonl(f)) poser(uuid, e, source);

// 6. Deux chapitres : passage A quand les deux passages concordent sur le verdict.
for (const [uuid, a] of A2) {
  const b = B2.get(uuid);
  if (!b || (a.releve_cpge !== false) === (b.releve_cpge !== false)) poser(uuid, a, 'deux chapitres (passage A, concordant)');
}

// 7. Pilote Opus v7.
for (const [uuid, e] of v7) poser(uuid, e, 'pilote Opus v7');

// 8. Niveau M1 : hors du périmètre des programmes de CPGE, sans appel au modèle.
const require = createRequire(import.meta.url);
const mod = require('better-sqlite3');
const db = new (mod.default || mod)(path.join(PROJECT_ROOT, 'data/exercises.sqlite'), { readonly: true });
for (const row of db.prepare("SELECT uuid, level, chapter, subchapter, title FROM exercises WHERE level = 'M1'").all()) {
  poser(row.uuid, {
    uuid: row.uuid, niveau: row.level, chapitre: row.chapter, sous_chapitre: row.subchapter, titre: row.title,
    releve_cpge: false, motif: 'Niveau M1 : hors du périmètre des programmes de CPGE.', propositions: []
  }, 'niveau M1 (règle)');
}

// Verdicts corrigés par le relecteur, puis contrôle par mots-clés.
for (const [uuid, terme] of Object.entries(VERDICTS_RELECTEUR)) {
  const e = consolide.get(uuid);
  if (e) Object.assign(e, { releve_cpge: false, propositions: [], motif: `Hors CPGE pour le relecteur : ${terme}.`, verdict_relecteur: true });
}
const decisions = JSON.parse(fs.readFileSync(path.join(REPORTS, 'controle-mots-cles.decisions.json'), 'utf8'));
for (const d of decisions) {
  const e = consolide.get(d.uuid);
  if (!e) continue;
  e.controle = { decision: d.decision, terme: d.terme, raison: d.raison, incertain: d.incertain };
  if (d.decision === 'exclure') Object.assign(e, { releve_cpge: false, propositions: [], motif: `Contrôle par mots-clés : ${d.raison}` });
}

// Verdict : celui du modèle ou du relecteur ; sans verdict, le chapitre écarté par
// la table (pilote) est hors CPGE, et un énoncé vide n'est pas classable.
const verdict = e => (e.releve_cpge !== undefined ? e.releve_cpge !== false
  : !(e.exclu_par_table || e.hors_programme || e.remarque === 'énoncé vide'));
const motifDe = e => e.motif ?? (e.exclu_par_table ? 'Chapitre sans équivalent en CPGE dans la table de correspondance.' : e.remarque);
const lignes = [...consolide.values()].sort((a, b) => a.uuid.localeCompare(b.uuid)).map(e => ({
  uuid: e.uuid, source: e.source, pilote: e.pilote, niveau: e.niveau, chapitre: e.chapitre, sous_chapitre: e.sous_chapitre,
  titre: e.titre, releve_cpge: verdict(e), motif: motifDe(e), propositions: e.propositions ?? [],
  ...(e.remarque === 'énoncé vide' ? { enonce_vide: true } : {}),
  ...(verdict(e) && !(e.propositions ?? []).length ? { sans_rattachement: true } : {}),
  ...(e.difficile ? { difficile: e.difficile } : {}),
  ...(e.incertain ? { incertain: true, raison_incertitude: e.raison_incertitude } : {}),
  ...(e.remarque_relecteur ? { remarque_relecteur: e.remarque_relecteur } : {}),
  ...(e.verdict_relecteur ? { verdict_relecteur: true } : {}),
  ...(e.controle ? { controle: e.controle } : {})
}));
fs.mkdirSync(path.dirname(SORTIE_COMPLETE), { recursive: true });
fs.writeFileSync(SORTIE_COMPLETE, lignes.map(e => `${JSON.stringify(e)}\n`).join(''));
const leger = e => ({
  uuid: e.uuid,
  niveau: e.niveau,
  chapitre: e.chapitre,
  releve_cpge: e.releve_cpge,
  noeuds: [...new Set(e.propositions.map(p => p.noeud))],
  groupes: [...new Set(e.propositions.map(p => p.groupe))],
  source: e.source,
  ...(e.releve_cpge ? {} : { motif: String(e.motif ?? '').slice(0, 200) }),
  ...(e.difficile ? { difficile: e.difficile } : {}),
  ...(e.sans_rattachement ? { sans_rattachement: true } : {}),
  ...(e.enonce_vide ? { enonce_vide: true } : {}),
  ...(e.controle ? { controle: e.controle.decision } : {})
});
fs.writeFileSync(SORTIE, lignes.map(e => `${JSON.stringify(leger(e))}\n`).join(''));

const parSource = {};
for (const e of lignes) {
  const s = parSource[e.source] ??= { n: 0, hors: 0 };
  s.n++; if (!e.releve_cpge) s.hors++;
}
console.log(`${lignes.length} exercices, ${lignes.filter(e => !e.releve_cpge).length} hors CPGE, ` +
  `${lignes.filter(e => e.sans_rattachement).length} en CPGE sans rattachement, ${lignes.filter(e => e.enonce_vide).length} à l'énoncé vide`);
for (const [s, c] of Object.entries(parSource)) console.log(`  ${String(c.n).padStart(5)}  ${s} (hors CPGE ${c.hors})`);
