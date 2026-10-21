#!/usr/bin/env node
// scripts/assembler-arbitrage-cpge.js
//
// Étiquetage en deux passages (voir docs/classification-cpge.md) : assemble
// la décision finale à partir des passages A et B et des arbitrages.
// - exercice où A et B concordent (même verdict, mêmes groupes, mêmes
//   filières) : la proposition de A ;
// - exercice divergent : les groupes que l'arbitre garde, avec les filières
//   qu'il précise, et son verdict.
//
// Étape 1 : écrit les réponses au format d'import de classify-cpge.js.
//   node scripts/assembler-arbitrage-cpge.js --a A.jsonl --b B.jsonl --arbitrages DIR --reponses R.json
// puis : node scripts/classify-cpge.js --uuids … --preselection --reponses R.json --modele … --sortie F.jsonl
// Étape 2 : ajoute à F.jsonl l'origine de chaque décision, les filières où
// l'exercice est jugé trop difficile et les cas incertains.
//   node scripts/assembler-arbitrage-cpge.js --a A.jsonl --b B.jsonl --arbitrages DIR --annoter F.jsonl

import fs from 'fs';
import path from 'path';

const option = name => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const PROGRAMME_VERS_FILIERE = {
  'mpsi-mp2i': 'MPSI/MP2I', pcsi: 'PCSI', ptsi: 'PTSI', bcpst1: 'BCPST1',
  'mp-mpi': 'MP/MPI', pc: 'PC', psi: 'PSI', pt: 'PT', bcpst2: 'BCPST2'
};

const lireJsonl = file => new Map(fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
  .map(line => JSON.parse(line)).map(entry => [entry.uuid, entry]));

// Groupes d'un passage : code → proposition de tête, programmes retenus, écarts non tranchés.
function groupes(entry) {
  const m = new Map();
  for (const p of entry.propositions ?? []) {
    if (!m.has(p.groupe)) m.set(p.groupe, { confiance: p.confiance, justification: p.justification, programmes: new Set(), aVerifier: false });
    const g = m.get(p.groupe);
    g.programmes.add(p.noeud.split('.')[0]);
    if (p.a_verifier) g.aVerifier = true;
  }
  return m;
}

const cle = entry => [...groupes(entry)].map(([g, x]) => `${g}[${[...x.programmes].sort()}]`).sort().join(' ');
const releve = entry => entry.releve_cpge !== false;
const concordent = (a, b) => releve(a) === releve(b) && (!releve(a) || cle(a) === cle(b));

// Filières d'un groupe telles que le passage les a retenues ; aucune si
// l'écart entre filières n'a pas été tranché (l'import le signalera de nouveau).
const filieres = g => (g.aVerifier ? undefined : [...g.programmes].map(p => PROGRAMME_VERS_FILIERE[p]));

function lireArbitrages(dir) {
  const decisions = new Map();
  for (const f of fs.readdirSync(dir).filter(f => /^arbitrage-\d+\.json$/.test(f)).sort()) {
    for (const [uuid, d] of Object.entries(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))) decisions.set(uuid, { ...d, fichier: f });
  }
  return decisions;
}

function reponseArbitree(a, b, d) {
  const ga = groupes(a);
  const gb = groupes(b);
  const rattachements = [];
  for (const [code, choix] of Object.entries(d.groupes ?? {})) {
    if (choix !== 'garder') continue;
    const x = ga.get(code) ?? gb.get(code);
    if (!x) continue;
    const autre = ga.has(code) && gb.has(code) ? gb.get(code) : null;
    const accord = !autre || [...x.programmes].sort().join() === [...autre.programmes].sort().join();
    rattachements.push({
      groupe: code,
      confiance: x.confiance,
      justification: x.justification,
      filieres: d.filieres?.[code] ?? (accord ? filieres(x) : undefined)
    });
  }
  for (const ajout of d.ajouts ?? []) {
    const code = typeof ajout === 'string' ? ajout : ajout.groupe;
    rattachements.push({
      groupe: code,
      confiance: Number(ajout.confiance) || 0.7,
      justification: ajout.justification ?? "ajouté par l'arbitre",
      filieres: d.filieres?.[code] ?? ajout.filieres
    });
  }
  return { releve_cpge: d.releve_cpge !== false, motif: d.motif, rattachements };
}

function main() {
  const A = lireJsonl(option('--a'));
  const B = lireJsonl(option('--b'));
  const decisions = lireArbitrages(option('--arbitrages'));
  const manquants = [...A.keys()].filter(u => !concordent(A.get(u), B.get(u)) && !decisions.has(u));
  if (manquants.length) throw new Error(`${manquants.length} exercices divergents sans arbitrage : ${manquants.join(', ')}`);

  if (option('--reponses')) {
    const reponses = {};
    for (const [uuid, a] of A) {
      const d = decisions.get(uuid);
      reponses[uuid] = d
        ? reponseArbitree(a, B.get(uuid), d)
        : {
            releve_cpge: releve(a),
            motif: a.motif,
            rattachements: [...groupes(a)].map(([groupe, x]) => ({ groupe, confiance: x.confiance, justification: x.justification, filieres: filieres(x) }))
          };
    }
    fs.writeFileSync(option('--reponses'), `${JSON.stringify(reponses, null, 1)}\n`);
    console.log(`${A.size} réponses · ${decisions.size} arbitrées · ${A.size - decisions.size} concordantes`);
  }

  if (option('--annoter')) {
    const file = option('--annoter');
    const lignes = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)).map(entry => {
      const d = decisions.get(entry.uuid);
      if (!d) return { ...entry, decision: 'concordance A/B' };
      return {
        ...entry,
        decision: `arbitrage ${d.fichier}`,
        ...(Object.keys(d.difficile ?? {}).length ? { difficile: d.difficile } : {}),
        ...(d.incertain ? { incertain: true, raison_incertitude: d.raison_incertitude } : {})
      };
    });
    fs.writeFileSync(file, lignes.map(entry => `${JSON.stringify(entry)}\n`).join(''));
    console.log(`${lignes.length} lignes annotées · incertaines ${lignes.filter(e => e.incertain).length}`);
  }
}

main();
