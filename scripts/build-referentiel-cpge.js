#!/usr/bin/env node
//
// scripts/build-referentiel-cpge.js
//
// Construit le référentiel CPGE dans la base : tables `cpge_programmes`,
// `cpge_filieres`, `cpge_noeuds` à partir de
// content/referentials/cpge/programmes/*.md, et `exercise_cpge` à partir des
// rattachements de content/classifications/cpge/<source>/<uuid>.json. Les deux
// répertoires sont importés d'exobase par pnpm sync:exobase.
//
// Le Markdown fait autorité : un nœud est un titre qui porte un identifiant
// `{#…}` (voir le README du référentiel et docs/classification-cpge.md). Un
// rattachement vers un identifiant disparu est une erreur bloquante : c'est ce
// qui garantit la stabilité des identifiants quand un programme est retouché.
//
// Reconstruction intégrale à chaque exécution : moins d'un millier de nœuds.
//
// Usage :
//   node scripts/build-referentiel-cpge.js            # construit
//   node scripts/build-referentiel-cpge.js --check    # vérifie sans écrire, sort en 1 si écart

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parseProgramme } from './utils/parse-programme-cpge.js';
import {
  REFERENTIEL_CPGE_ROOT,
  CLASSIFICATIONS_CPGE_ROOT,
  PROJECT_ROOT,
  toPosixPath
} from './utils/content-paths.js';

export const ORIGINES = ['manuel', 'llm', 'concordance', 'chapitre'];
const REQUIRED_META = ['programme', 'titre', 'filieres', 'annee'];

function walkFiles(directory, accept) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full, accept));
    else if (accept(entry.name)) files.push(full);
  }
  return files.sort();
}

/**
 * Lit tous les programmes et vérifie leur cohérence d'ensemble.
 * `errors` rend le référentiel faux (identifiant en double, parent inconnu,
 * programme mal déclaré) ; `warnings` le laisse utilisable.
 */
export function collectReferentiel(root = REFERENTIEL_CPGE_ROOT) {
  const programmes = [];
  const nodes = [];
  const errors = [];
  const warnings = [];
  const seen = new Map();

  for (const file of walkFiles(path.join(root, 'programmes'), name => name.endsWith('.md'))) {
    const fileName = path.basename(file);
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = parseProgramme(raw, fileName);
    warnings.push(...parsed.warnings);
    const { meta } = parsed;

    const missing = REQUIRED_META.filter(key => meta[key] === undefined || meta[key] === '');
    if (missing.length) {
      errors.push(`${fileName} : front matter incomplet (${missing.join(', ')})`);
      continue;
    }
    if (meta.programme !== path.basename(file, '.md')) {
      errors.push(`${fileName} : programme « ${meta.programme} » ≠ nom du fichier`);
      continue;
    }

    programmes.push({
      programme: meta.programme,
      titre: meta.titre,
      annee: meta.annee,
      filieres: meta.filieres,
      bo: meta.bo ?? null,
      nor: JSON.stringify(meta.nor ?? []),
      arrete: meta.arrete ?? null,
      rentree: meta.rentree ?? null,
      source_url: meta.source ?? null,
      bo_url: meta.bo_url ?? null,
      pages: meta.pages != null ? String(meta.pages) : null,
      source_path: toPosixPath(path.relative(path.join(PROJECT_ROOT, 'content'), file)),
      source_hash: crypto.createHash('sha256').update(raw).digest('hex')
    });

    for (const node of parsed.nodes) {
      if (!node.id.startsWith(`${meta.programme}.`)) {
        errors.push(`${fileName} : identifiant ${node.id} hors du préfixe ${meta.programme}.`);
      }
      if (seen.has(node.id)) {
        errors.push(`identifiant ${node.id} en double (${seen.get(node.id)} et ${fileName})`);
        continue;
      }
      seen.set(node.id, fileName);
      nodes.push(node);
    }
  }

  const ids = new Set(nodes.map(node => node.id));
  for (const node of nodes) {
    if (node.parent_id && !ids.has(node.parent_id)) {
      errors.push(`${node.id} : parent ${node.parent_id} inconnu`);
    }
    if (node.type === 'sous-section' && !node.parent_id) {
      errors.push(`${node.id} : sous-section sans section`);
    }
  }

  return { programmes, nodes, errors, warnings };
}

/**
 * Lit les rattachements d'exercices. Un nœud inconnu est une erreur : le
 * référentiel a perdu un identifiant sur lequel repose une classification.
 */
export function collectRattachements(nodeIds, root = CLASSIFICATIONS_CPGE_ROOT) {
  const rattachements = [];
  const errors = [];
  const warnings = [];

  for (const file of walkFiles(root, name => name.endsWith('.json'))) {
    const relative = toPosixPath(path.relative(root, file));
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      errors.push(`${relative} : JSON invalide (${error.message})`);
      continue;
    }

    const uuid = data.uuid ?? path.basename(file, '.json');
    if (uuid !== path.basename(file, '.json')) {
      warnings.push(`${relative} : uuid « ${uuid} » ≠ nom du fichier`);
    }
    const seen = new Set();
    for (const entry of data.rattachements ?? []) {
      if (!nodeIds.has(entry.noeud)) {
        errors.push(`${relative} : nœud ${entry.noeud} absent du référentiel`);
        continue;
      }
      if (!ORIGINES.includes(entry.origine)) {
        errors.push(`${relative} : origine « ${entry.origine} » inconnue pour ${entry.noeud}`);
        continue;
      }
      if (seen.has(entry.noeud)) {
        warnings.push(`${relative} : ${entry.noeud} rattaché deux fois, second ignoré`);
        continue;
      }
      seen.add(entry.noeud);
      const confiance = typeof entry.confiance === 'number' ? entry.confiance : null;
      if (confiance !== null && (confiance < 0 || confiance > 1)) {
        warnings.push(`${relative} : confiance ${confiance} hors de [0, 1] pour ${entry.noeud}`);
      }
      rattachements.push({
        uuid,
        noeud_id: entry.noeud,
        origine: entry.origine,
        confiance,
        valide: entry.valide === true ? 1 : 0
      });
    }
  }

  return { rattachements, errors, warnings };
}

/**
 * Écrit le référentiel et les rattachements dans la base.
 * Les rattachements d'exercices absents de la base ne sont pas écrits : ils
 * restent dans leur fichier et reviennent quand l'exercice est publié.
 */
export function insertReferentiel(db, { programmes, nodes }, rattachements = []) {
  const known = new Set(db.prepare('SELECT uuid FROM exercises').all().map(row => row.uuid));

  const insertProgramme = db.prepare(`
    INSERT INTO cpge_programmes (programme, titre, annee, bo, nor, arrete, rentree,
                                 source_url, bo_url, pages, source_path, source_hash)
    VALUES (@programme, @titre, @annee, @bo, @nor, @arrete, @rentree,
            @source_url, @bo_url, @pages, @source_path, @source_hash)
  `);
  const insertFiliere = db.prepare('INSERT OR IGNORE INTO cpge_filieres (filiere, programme) VALUES (?, ?)');
  const insertNoeud = db.prepare(`
    INSERT INTO cpge_noeuds (id, programme, type, parent_id, partie, semestre, lettre,
                             titre, texte, contenus, ordre)
    VALUES (@id, @programme, @type, @parent_id, @partie, @semestre, @lettre,
            @titre, @texte, @contenus, @ordre)
  `);
  const insertRattachement = db.prepare(`
    INSERT INTO exercise_cpge (uuid, noeud_id, origine, confiance, valide)
    VALUES (@uuid, @noeud_id, @origine, @confiance, @valide)
  `);

  const orphelins = [];
  const run = db.transaction(() => {
    for (const table of ['exercise_cpge', 'cpge_noeuds', 'cpge_filieres', 'cpge_programmes']) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
    for (const programme of programmes) {
      insertProgramme.run(programme);
      for (const filiere of programme.filieres) insertFiliere.run(filiere, programme.programme);
    }
    for (const node of nodes) {
      insertNoeud.run({ ...node, contenus: JSON.stringify(node.contenus) });
    }
    for (const rattachement of rattachements) {
      if (!known.has(rattachement.uuid)) {
        orphelins.push(rattachement.uuid);
        continue;
      }
      insertRattachement.run(rattachement);
    }
  });

  run();
  return { orphelins: [...new Set(orphelins)] };
}

function report(referentiel, classification, outcome) {
  const { programmes, nodes } = referentiel;
  const sections = nodes.filter(node => node.type === 'section').length;
  console.log(`\n🎓 ${programmes.length} programme(s), ${nodes.length} nœud(s) : ${sections} section(s), ${nodes.length - sections} sous-section(s)`);
  for (const programme of programmes) {
    const count = nodes.filter(node => node.programme === programme.programme).length;
    console.log(`   ${programme.programme.padEnd(10)} ${programme.filieres.join(', ').padEnd(11)} année ${programme.annee} — ${count} nœud(s)`);
  }
  console.log(`\n🔗 ${classification.rattachements.length} rattachement(s) d'exercice lu(s)`);

  const errors = [...referentiel.errors, ...classification.errors];
  const warnings = [...referentiel.warnings, ...classification.warnings];
  if (outcome?.orphelins.length) {
    warnings.push(`${outcome.orphelins.length} exercice(s) rattaché(s) absent(s) de la base : ${outcome.orphelins.slice(0, 10).join(', ')}`);
  }

  if (errors.length) {
    console.log(`\n❌ ${errors.length} erreur(s) :`);
    for (const error of errors.slice(0, 30)) console.log(`   ${error}`);
    if (errors.length > 30) console.log(`   … et ${errors.length - 30} autre(s)`);
  }
  if (warnings.length) {
    console.log(`\n⚠️  ${warnings.length} avertissement(s) :`);
    for (const warning of warnings.slice(0, 20)) console.log(`   ${warning}`);
    if (warnings.length > 20) console.log(`   … et ${warnings.length - 20} autre(s)`);
  }
  return { blocking: errors.length, soft: warnings.length };
}

async function main() {
  const check = process.argv.includes('--check');
  console.log('🎓 OpenYourMath — construction du référentiel CPGE');

  const referentiel = collectReferentiel();
  const classification = collectRattachements(new Set(referentiel.nodes.map(node => node.id)));

  if (check) {
    const { blocking, soft } = report(referentiel, classification, null);
    console.log('\nVérification seule, base inchangée.');
    if (blocking || soft) process.exitCode = 1;
    return;
  }

  // Un référentiel incohérent ne doit pas remplacer celui de la base.
  if (referentiel.errors.length || classification.errors.length) {
    report(referentiel, classification, null);
    console.log('\nBase inchangée.');
    process.exitCode = 1;
    return;
  }

  const { createDatabase, loadDatabaseModule } = await import('./build-db.js');
  loadDatabaseModule();
  const db = createDatabase(path.join(PROJECT_ROOT, 'data/exercises.sqlite'));
  try {
    const outcome = insertReferentiel(db, referentiel, classification.rattachements);
    report(referentiel, classification, outcome);
    const noeuds = db.prepare('SELECT COUNT(*) AS n FROM cpge_noeuds').get().n;
    const liens = db.prepare('SELECT COUNT(*) AS n FROM exercise_cpge').get().n;
    console.log(`\n✅ ${noeuds} nœud(s) et ${liens} rattachement(s) écrits dans la base.`);
  } finally {
    db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Échec de la construction du référentiel CPGE :', error);
    process.exit(1);
  });
}
