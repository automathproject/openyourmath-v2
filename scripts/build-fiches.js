#!/usr/bin/env node
//
// scripts/build-fiches.js
//
// Construit les tables `fiches` et `fiche_items` à partir de
// content/fiches/<source>/*.txt.
//
// Les fiches référencent les exercices par l'identifiant de leur source
// d'origine — pour exo7, l'entier de `\exo7id{}`. Ce lien est résolu ici, à
// partir des `.tex` qui font autorité, et non depuis le cache : le cache est
// invalidé par le seul hash du `.tex`, donc un champ ajouté au parser y
// resterait absent jusqu'à une reconstruction complète. Les fiches stockent
// l'uuid résolu, si bien que l'application n'a jamais à connaître les
// identifiants d'origine ; `source_ref` les conserve pour le diagnostic.
//
// Reconstruction intégrale à chaque exécution : 167 fiches et quelques
// milliers de références, l'incrémental n'apporterait rien.
//
// Usage :
//   node scripts/build-fiches.js            # construit
//   node scripts/build-fiches.js --check    # vérifie sans écrire, sort en 1 si écart

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parseFiche } from './utils/parse-fiche.js';
import { FICHES_ROOT, EXERCISES_ROOT, PROJECT_ROOT, toPosixPath } from './utils/content-paths.js';

/**
 * Comment lire les références d'une source.
 * `exo7id` : l'entier des fiches exo7 renvoie au `\exo7id{}` des exercices.
 * Une source absente de ce registre référence directement des uuid — ce que
 * feront les fiches rédigées dans OpenYourMath.
 */
const REFERENCE_SCHEMES = {
  exo7: 'exo7id'
};

function listDirectories(root) {
  try {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

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
 * Table `\exo7id{}` -> uuid, lue directement dans les sources d'une source.
 * Signale les identifiants portés par plusieurs exercices : la résolution
 * serait alors arbitraire, et une fiche pointerait au hasard.
 */
function buildReferenceIndex(source, scheme, warnings) {
  const index = new Map();
  if (scheme !== 'exo7id') return index;

  const seen = new Map();
  for (const file of walkFiles(path.join(EXERCISES_ROOT, source), name => name.endsWith('.tex'))) {
    const text = fs.readFileSync(file, 'utf8');
    const ref = text.match(/\\exo7id\{(\d+)\}/)?.[1];
    if (!ref) continue;
    const uuid = text.match(/\\uuid\{([^}]*)\}/)?.[1];
    if (!uuid) {
      warnings.push(`${toPosixPath(path.relative(EXERCISES_ROOT, file))} porte \\exo7id{${ref}} sans \\uuid{} : ignoré`);
      continue;
    }
    if (seen.has(ref)) {
      warnings.push(`\\exo7id{${ref}} porté par ${seen.get(ref)} et ${uuid} : résolution ambiguë, ignoré`);
      index.delete(ref);
      continue;
    }
    seen.set(ref, uuid);
    index.set(ref, uuid);
  }
  return index;
}

/** Lit et résout toutes les fiches présentes sous content/fiches/. */
export function collectFiches() {
  const fiches = [];
  const warnings = [];

  for (const source of listDirectories(FICHES_ROOT)) {
    const scheme = REFERENCE_SCHEMES[source] ?? 'uuid';
    const index = buildReferenceIndex(source, scheme, warnings);

    for (const file of walkFiles(path.join(FICHES_ROOT, source), name => name.endsWith('.txt'))) {
      const relative = toPosixPath(path.relative(FICHES_ROOT, file));
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = parseFiche(raw, relative);
      warnings.push(...parsed.warnings);

      const slug = path.basename(file, '.txt');
      const uuid = parsed.id ?? slug;
      const items = parsed.items.map(item => ({
        position: item.position,
        section_path: JSON.stringify(item.path),
        exercise_uuid: scheme === 'uuid' ? item.ref : (index.get(item.ref) ?? null),
        source_ref: item.ref
      }));

      fiches.push({
        uuid,
        slug,
        title: parsed.title || slug,
        author: parsed.author,
        organization: source,
        created_at: parsed.date,
        intro: parsed.intro || null,
        max_depth: parsed.maxDepth,
        source_path: `fiches/${relative}`,
        source_hash: crypto.createHash('sha256').update(raw).digest('hex'),
        items
      });
    }
  }

  return { fiches, warnings };
}

/**
 * Écrit les fiches dans la base et renvoie le bilan.
 * Les références dont l'exercice est absent de la base sont conservées avec un
 * `exercise_uuid` nul : la fiche reste fidèle à sa source, et la lacune reste
 * réparable sans réimport.
 */
export function insertFiches(db, fiches) {
  const known = new Set(db.prepare('SELECT uuid FROM exercises').all().map(row => row.uuid));

  const deleteItems = db.prepare('DELETE FROM fiche_items');
  const deleteFiches = db.prepare('DELETE FROM fiches');
  const insertFiche = db.prepare(`
    INSERT INTO fiches (uuid, slug, title, author, organization, created_at, intro,
                        exercise_count, missing_count, max_depth, source_path, source_hash)
    VALUES (@uuid, @slug, @title, @author, @organization, @created_at, @intro,
            @exercise_count, @missing_count, @max_depth, @source_path, @source_hash)
  `);
  const insertItem = db.prepare(`
    INSERT INTO fiche_items (fiche_uuid, position, section_path, exercise_uuid, source_ref)
    VALUES (@fiche_uuid, @position, @section_path, @exercise_uuid, @source_ref)
  `);

  const missing = [];
  const duplicates = [];

  const run = db.transaction(() => {
    deleteItems.run();
    deleteFiches.run();
    const inserted = new Set();

    for (const fiche of fiches) {
      if (inserted.has(fiche.uuid)) {
        duplicates.push(fiche.source_path);
        continue;
      }
      inserted.add(fiche.uuid);

      let resolved = 0;
      for (const item of fiche.items) {
        // Un uuid inconnu de la base vaut une référence non résolue : l'exercice
        // peut exister en source sans avoir été publié.
        if (item.exercise_uuid && !known.has(item.exercise_uuid)) item.exercise_uuid = null;
        if (item.exercise_uuid) resolved++;
        else missing.push({ fiche: fiche.slug, ref: item.source_ref });
      }

      insertFiche.run({
        ...fiche,
        exercise_count: resolved,
        missing_count: fiche.items.length - resolved
      });
      for (const item of fiche.items) insertItem.run({ fiche_uuid: fiche.uuid, ...item });
    }
  });

  run();
  return { missing, duplicates };
}

/**
 * Affiche le bilan et distingue deux gravités : ce qui empêche d'écrire une
 * fiche fidèle (identifiant en double) de ce qui la laisse simplement
 * incomplète (référence sans exercice, source amont malformée). Seule la
 * première fait échouer une construction ; `--check` se veut plus strict.
 */
function report({ fiches, warnings }, outcome) {
  const items = fiches.reduce((sum, fiche) => sum + fiche.items.length, 0);
  const depths = fiches.reduce((acc, fiche) => {
    acc[fiche.max_depth] = (acc[fiche.max_depth] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\n📚 ${fiches.length} fiche(s), ${items} référence(s) d'exercice`);
  for (const depth of Object.keys(depths).sort()) {
    const label = depth === '0' ? 'liste plate' : `${depth} niveau${depth > 1 ? 'x' : ''} de titres`;
    console.log(`   ${String(depths[depth]).padStart(4)} — ${label}`);
  }

  const duplicates = outcome?.duplicates ?? [];
  if (duplicates.length) {
    console.log(`\n❌ Identifiant de fiche en double : ${duplicates.join(', ')}`);
  }

  // Sans base, les références non résolues se lisent déjà dans les fiches
  // collectées : la résolution par les sources .tex a eu lieu au parse.
  const missing = outcome?.missing ?? fiches.flatMap(fiche =>
    fiche.items.filter(item => !item.exercise_uuid).map(item => ({ fiche: fiche.slug, ref: item.source_ref })));

  if (missing.length) {
    const byFiche = new Map();
    for (const entry of missing) {
      if (!byFiche.has(entry.fiche)) byFiche.set(entry.fiche, []);
      byFiche.get(entry.fiche).push(entry.ref);
    }
    console.log(`\n⚠️  ${missing.length} référence(s) sans exercice au corpus :`);
    for (const [fiche, refs] of byFiche) console.log(`   ${fiche} : ${refs.join(', ')}`);
  }

  if (warnings.length) {
    console.log(`\n⚠️  ${warnings.length} avertissement(s) de lecture :`);
    for (const warning of warnings.slice(0, 20)) console.log(`   ${warning}`);
    if (warnings.length > 20) console.log(`   … et ${warnings.length - 20} autre(s)`);
  }

  return { blocking: duplicates.length, soft: missing.length + warnings.length };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const check = args.has('--check');

  console.log('📋 OpenYourMath — construction des fiches');
  const collected = collectFiches();

  if (!collected.fiches.length) {
    console.log('Aucune fiche sous content/fiches/ : rien à faire.');
    return;
  }

  if (check) {
    const { blocking, soft } = report(collected, null);
    console.log('\nVérification seule, base inchangée.');
    if (blocking || soft) process.exitCode = 1;
    return;
  }

  const { createDatabase, loadDatabaseModule } = await import('./build-db.js');
  loadDatabaseModule();
  const db = createDatabase(path.join(PROJECT_ROOT, 'data/exercises.sqlite'));
  try {
    const outcome = insertFiches(db, collected.fiches);
    const { blocking } = report(collected, outcome);
    const total = db.prepare('SELECT COUNT(*) as n FROM fiches').get().n;
    const linked = db.prepare('SELECT COUNT(*) as n FROM fiche_items WHERE exercise_uuid IS NOT NULL').get().n;
    console.log(`\n✅ ${total} fiche(s) et ${linked} lien(s) exercice écrits dans la base.`);
    // Une lacune amont laisse la fiche utilisable : seul un doublon d'identifiant
    // rend le résultat faux et doit interrompre la chaîne de build.
    if (blocking) process.exitCode = 1;
  } finally {
    db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Échec de la construction des fiches :', error);
    process.exit(1);
  });
}
