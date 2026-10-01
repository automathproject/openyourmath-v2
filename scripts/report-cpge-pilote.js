#!/usr/bin/env node
// scripts/report-cpge-pilote.js
//
// Bilan du pilote d'étiquetage CPGE : lit reports/cpge-pilote/*.jsonl (un
// fichier par modèle, écrit par scripts/classify-cpge.js) et affiche, par
// modèle, la couverture par filière, le nombre de rattachements, les
// confiances et les exercices jugés hors programme, puis l'accord entre
// modèles exercice par exercice.
//
// Usage : node scripts/report-cpge-pilote.js [--json FICHIER]

import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from './utils/content-paths.js';

const DIR = path.join(PROJECT_ROOT, 'reports/cpge-pilote');
const FILIERES = ['mpsi-mp2i', 'pcsi', 'ptsi', 'bcpst1'];
const args = process.argv.slice(2);
const jsonOut = args.find((_, i) => args[i - 1] === '--json');

function load(file) {
  const byUuid = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
    const entry = JSON.parse(line);
    byUuid.set(entry.uuid, entry); // la dernière tentative l'emporte
  }
  return byUuid;
}

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)} %` : '—');
const nodesOf = entry => new Set((entry.propositions ?? []).map(p => p.noeud));
const groupsOf = entry => new Set((entry.propositions ?? []).filter(p => p.origine === 'llm').map(p => p.noeud));

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  const inter = [...a].filter(x => b.has(x)).length;
  return inter / (a.size + b.size - inter);
}

function stats(entries) {
  const ok = entries.filter(e => !e.erreur);
  const withAny = ok.filter(e => e.propositions.length);
  const chosen = ok.map(e => groupsOf(e).size);
  const confidences = ok.flatMap(e => e.propositions.filter(p => p.origine === 'llm').map(p => p.confiance));
  const coverage = Object.fromEntries(FILIERES.map(f =>
    [f, ok.filter(e => e.propositions.some(p => p.noeud.startsWith(`${f}.`))).length]));
  return {
    n: entries.length,
    erreurs: entries.length - ok.length,
    rejets: ok.reduce((s, e) => s + (e.rejets?.length ?? 0), 0),
    avec_rattachement: withAny.length,
    hors_programme: ok.filter(e => e.hors_programme).length,
    choisis_moyenne: chosen.reduce((s, x) => s + x, 0) / (ok.length || 1),
    choisis_repartition: chosen.reduce((acc, x) => ({ ...acc, [x]: (acc[x] ?? 0) + 1 }), {}),
    confiance_haute: confidences.filter(c => c >= 0.85).length,
    confiance_moyenne: confidences.filter(c => c >= 0.6 && c < 0.85).length,
    confiance_basse: confidences.filter(c => c < 0.6).length,
    couverture: coverage,
    ok: ok.length
  };
}

function printStats(label, s) {
  console.log(`\n■ ${label} — ${s.n} exercice(s)${s.erreurs ? `, ${s.erreurs} en erreur` : ''}`);
  console.log(`  avec au moins un rattachement : ${s.avec_rattachement} (${pct(s.avec_rattachement, s.ok)})` +
    ` · hors programme signalé : ${s.hors_programme} · codes invalides rejetés : ${s.rejets}`);
  console.log(`  sous-sections choisies par exercice : ${s.choisis_moyenne.toFixed(2)} en moyenne — ` +
    Object.entries(s.choisis_repartition).sort(([a], [b]) => a - b).map(([k, v]) => `${k} : ${v}`).join(', '));
  console.log(`  confiance ≥ 0,85 : ${s.confiance_haute} · 0,6–0,85 : ${s.confiance_moyenne} · < 0,6 : ${s.confiance_basse}`);
  console.log(`  couverture par filière : ` + FILIERES.map(f => `${f} ${pct(s.couverture[f], s.ok)}`).join(' · '));
}

function main() {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.jsonl')).sort();
  if (!files.length) throw new Error(`aucun résultat dans ${DIR}`);
  const models = files.map(f => ({ name: f.replace(/\.jsonl$/, ''), data: load(path.join(DIR, f)) }));
  const report = { modeles: {}, accord: null };

  for (const { name, data } of models) {
    const entries = [...data.values()];
    const all = stats(entries);
    report.modeles[name] = { global: all, par_chapitre: {} };
    printStats(name, all);
    const byChapter = new Map();
    for (const e of entries) {
      const key = `${e.source} · ${e.chapitre}`;
      if (!byChapter.has(key)) byChapter.set(key, []);
      byChapter.get(key).push(e);
    }
    console.log('  par chapitre :');
    for (const [key, list] of [...byChapter].sort()) {
      const s = stats(list);
      report.modeles[name].par_chapitre[key] = s;
      console.log(`    ${key.padEnd(48)} ${String(s.n).padStart(3)} ex. · ${s.choisis_moyenne.toFixed(1)} choisies · ` +
        `hors prog. ${s.hors_programme} · ` + FILIERES.map(f => `${f.split('-')[0]} ${pct(s.couverture[f], s.ok)}`).join(' '));
    }
  }

  if (models.length >= 2) {
    const [a, b] = models;
    const common = [...a.data.keys()].filter(uuid => b.data.has(uuid) && !a.data.get(uuid).erreur && !b.data.get(uuid).erreur);
    const scores = common.map(uuid => jaccard(nodesOf(a.data.get(uuid)), nodesOf(b.data.get(uuid))));
    const identical = scores.filter(x => x === 1).length;
    const disjoint = common.filter(uuid => {
      const x = nodesOf(a.data.get(uuid));
      const y = nodesOf(b.data.get(uuid));
      return (x.size || y.size) && ![...x].some(n => y.has(n));
    });
    report.accord = {
      modeles: [a.name, b.name],
      exercices: common.length,
      jaccard_moyen: scores.reduce((s, x) => s + x, 0) / (scores.length || 1),
      identiques: identical,
      disjoints: disjoint
    };
    console.log(`\n■ Accord ${a.name} / ${b.name} sur ${common.length} exercice(s)`);
    console.log(`  indice de Jaccard moyen : ${report.accord.jaccard_moyen.toFixed(2)} · ensembles identiques : ` +
      `${identical} (${pct(identical, common.length)}) · sans aucun nœud commun : ${disjoint.length}`);
  }

  if (jsonOut) fs.writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
}

main();
