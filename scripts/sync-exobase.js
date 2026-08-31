#!/usr/bin/env node

/**
 * Imports versioned editorial content from exobase.
 *
 * exobase is the factory: it owns the .tex sources, images, code snippets and
 * the author registry, for every source it carries. OpenYourMath owns only the
 * derived data and the semantic metadata, and must not edit the sources it
 * receives.
 *
 * The comparison is three-way against the exobase commit recorded in
 * content/provenance/exobase.json. A strict mirror would be enough as long as
 * nothing edits the sources here, so the third way is the safety net that makes
 * an accidental local edit visible instead of silently destroying it.
 *
 * Default mode is a dry run. Files that exist only in OpenYourMath are never
 * deleted, only reported.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXOBASE_ROOT = process.env.EXOBASE_ROOT || path.resolve(ROOT, '../exobase');
const SOURCE_CONTENT = path.join(EXOBASE_ROOT, 'content');
const TARGET_CONTENT = path.join(ROOT, 'content');
const PROVENANCE = path.join(TARGET_CONTENT, 'provenance/exobase.json');

const LABELS = {
  sources: 'Sources .tex',
  images: 'Images et sources graphiques',
  code: 'Extraits Python',
  auteurs: 'Référentiel auteurs'
};
const ACTIONS = {
  add: { mark: '+', title: 'Ajouts' },
  update: { mark: '~', title: 'Mises à jour depuis exobase' },
  local: { mark: '=', title: 'Modifications locales préservées — à remonter dans exobase' },
  conflict: { mark: 'x', title: 'Conflits — modifiés des deux côtés' }
};

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const check = args.has('--check');
const force = args.has('--force');
const unknownArgs = [...args].filter(arg => !['--apply', '--check', '--force'].includes(arg));
if (unknownArgs.length || (apply && check)) {
  console.error('Usage: node scripts/sync-exobase.js [--check | --apply] [--force]');
  process.exit(2);
}

class SyncError extends Error {}

function git(gitArgs, options = {}) {
  return spawnSync('git', ['-C', EXOBASE_ROOT, ...gitArgs], { maxBuffer: 512 * 1024 * 1024, ...options });
}

function gitText(gitArgs, message) {
  const result = git(gitArgs, { encoding: 'utf8' });
  if (result.status !== 0) throw new SyncError(message);
  return result.stdout;
}

const exobaseHead = () =>
  gitText(['rev-parse', 'HEAD'], `${EXOBASE_ROOT} n'est pas un dépôt Git exploitable.`).trim();

const exobaseIsClean = () =>
  gitText(['status', '--porcelain'], "Impossible de lire l'état Git d'exobase.").trim() === '';

const commitExists = commit => git(['cat-file', '-e', `${commit}^{commit}`]).status === 0;

function baseContent(commit, repoPath) {
  const result = git(['show', `${commit}:${repoPath}`]);
  return result.status === 0 ? result.stdout : null;
}

/** Every source exobase carries, discovered rather than hard-coded. */
async function discoverSources() {
  const entries = await fs.readdir(path.join(SOURCE_CONTENT, 'exercises'), { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
}

function mappingsFor(sources) {
  return sources.flatMap(source => [
    { source, kind: 'sources', dir: `exercises/${source}`, accept: name => name.endsWith('.tex') },
    { source, kind: 'images', dir: `images/${source}`, accept: () => true },
    { source, kind: 'code', dir: `code/${source}/python`, accept: name => name.endsWith('.py') }
  ]);
}

function tracked(repoPath, mappings) {
  return mappings.some(mapping =>
    repoPath.startsWith(`content/${mapping.dir}/`) && mapping.accept(path.posix.basename(repoPath)));
}

/** Files removed or renamed in exobase since the reference commit. */
function exobaseRemovals(base, head, mappings) {
  const result = git(['diff', '--name-status', '-M', base, head, '--', 'content'], { encoding: 'utf8' });
  if (result.status !== 0) return [];
  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map(line => line.split('\t'))
    .filter(([status, from]) => (status.startsWith('D') || status.startsWith('R')) && tracked(from, mappings))
    .map(([status, from, to]) => ({ status: status[0], from, to }));
}

async function walk(directory, accept) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const result = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(fullPath, accept));
    else if (entry.isFile() && accept(entry.name)) result.push(fullPath);
  }
  return result.sort();
}

async function readOptional(file) {
  try {
    return await fs.readFile(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/** Three-way decision for one file: exobase now, OpenYourMath now, reference state. */
function decide(repoPath, base, upstream, downstream) {
  if (downstream === null) return { action: 'add' };
  if (upstream.equals(downstream)) return { action: 'unchanged' };
  if (!base) return { action: 'local', reason: 'référence inconnue' };
  const reference = baseContent(base, repoPath);
  if (reference === null) return { action: 'conflict', reason: 'créé des deux côtés' };
  if (reference.equals(downstream)) return { action: 'update' };
  if (reference.equals(upstream)) return { action: 'local', reason: 'modifié dans OpenYourMath' };
  return { action: 'conflict', reason: 'modifié des deux côtés' };
}

async function planFile(relative, source, kind, base) {
  const sourcePath = path.join(SOURCE_CONTENT, relative);
  const targetPath = path.join(TARGET_CONTENT, relative);
  const repoPath = path.posix.join('content', relative.split(path.sep).join('/'));
  const upstream = await fs.readFile(sourcePath);
  const downstream = await readOptional(targetPath);
  return {
    source,
    kind,
    sourcePath,
    targetPath,
    relativeTargetPath: path.relative(ROOT, targetPath),
    ...decide(repoPath, base, upstream, downstream)
  };
}

async function plan(mappings, base) {
  const entries = [];
  for (const mapping of mappings) {
    const directory = path.join(SOURCE_CONTENT, mapping.dir);
    for (const sourcePath of await walk(directory, mapping.accept)) {
      const relative = path.join(mapping.dir, path.relative(directory, sourcePath));
      entries.push(await planFile(relative, mapping.source, mapping.kind, base));
    }
  }
  entries.push(await planFile('authors.json', 'commun', 'auteurs', base));
  return entries;
}

function summarize(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const key = `${entry.source} ${entry.kind}`;
    const bucket = counts.get(key) ?? { add: 0, update: 0, local: 0, conflict: 0, unchanged: 0 };
    bucket[entry.action]++;
    counts.set(key, bucket);
  }
  return counts;
}

function report(entries, action) {
  const selected = entries.filter(entry => entry.action === action);
  if (!selected.length) return;
  const { mark, title } = ACTIONS[action];
  console.log(`\n${title} :`);
  for (const entry of selected.slice(0, 40)) {
    console.log(`  ${mark} ${entry.relativeTargetPath}${entry.reason ? ` (${entry.reason})` : ''}`);
  }
  if (selected.length > 40) console.log(`  … et ${selected.length - 40} autre(s)`);
}

async function recordSync(commit, sources, entries, previous) {
  const provenance = JSON.parse(await fs.readFile(PROVENANCE, 'utf8'));
  if (previous === commit) return false;
  const fichiers = {};
  for (const entry of entries) fichiers[entry.kind] = (fichiers[entry.kind] ?? 0) + 1;
  provenance.sync = { commit, date: new Date().toISOString(), sources, fichiers };
  await fs.writeFile(PROVENANCE, `${JSON.stringify(provenance, null, 2)}\n`);
  return true;
}

async function main() {
  try {
    await fs.access(SOURCE_CONTENT);
  } catch {
    throw new SyncError(`exobase introuvable : ${EXOBASE_ROOT}. Définir EXOBASE_ROOT si nécessaire.`);
  }

  const head = exobaseHead();
  const provenance = JSON.parse(await fs.readFile(PROVENANCE, 'utf8'));
  let base = provenance.sync?.commit ?? null;

  console.log(`exobase : ${EXOBASE_ROOT}`);
  console.log(`Commit exobase : ${head.slice(0, 7)}`);
  if (base && !commitExists(base)) {
    console.log(`Attention : référence ${base.slice(0, 7)} introuvable dans exobase (historique réécrit ?).`);
    base = null;
  }
  console.log(base
    ? `Référence : ${base.slice(0, 7)}`
    : 'Référence : aucune — les fichiers divergents seront préservés, jamais écrasés.');

  const sources = await discoverSources();
  const mappings = mappingsFor(sources);
  console.log(`Sources : ${sources.join(', ')}`);

  const entries = await plan(mappings, base);
  console.log();
  for (const [key, counts] of summarize(entries)) {
    const [source, kind] = key.split(' ');
    console.log(`${source.padEnd(8)} ${LABELS[kind]} — ${counts.add} ajout(s), ${counts.update} mise(s) à jour, ` +
      `${counts.local} local(aux), ${counts.conflict} conflit(s), ${counts.unchanged} identique(s)`);
  }

  if (base) {
    const removals = exobaseRemovals(base, head, mappings);
    if (removals.length) {
      console.log('\nSupprimés ou renommés dans exobase (jamais répercuté automatiquement) :');
      for (const removal of removals.slice(0, 20)) {
        console.log(removal.status === 'R' ? `  -> ${removal.from} -> ${removal.to}` : `  - ${removal.from}`);
      }
      if (removals.length > 20) console.log(`  … et ${removals.length - 20} autre(s)`);
    }
  }

  const overridden = force
    ? entries.filter(entry => entry.action === 'local' || entry.action === 'conflict')
    : [];
  if (overridden.length) {
    console.log('\nÉcrasés par --force — exobase fait autorité :');
    for (const entry of overridden.slice(0, 40)) {
      console.log(`  ~ ${entry.relativeTargetPath}${entry.reason ? ` (${entry.reason})` : ''}`);
    }
    if (overridden.length > 40) console.log(`  … et ${overridden.length - 40} autre(s)`);
    for (const action of ['add', 'update']) report(entries, action);
  } else {
    for (const action of ['conflict', 'add', 'update', 'local']) report(entries, action);
  }

  const conflicts = force ? [] : entries.filter(entry => entry.action === 'conflict');
  const copies = [
    ...entries.filter(entry => entry.action === 'add' || entry.action === 'update'),
    ...overridden
  ];

  if (!apply) {
    if (conflicts.length) {
      console.log('\nRésolvez les conflits, ou tranchez en faveur d’exobase avec --force.');
    }
    if (copies.length || conflicts.length) {
      console.log('\nAperçu uniquement. Pour appliquer : node scripts/sync-exobase.js --apply');
    } else if (base === head) {
      console.log('\nOpenYourMath est à jour vis-à-vis d’exobase.');
    } else {
      console.log(`\nAucun fichier à copier. Lancez --apply pour enregistrer la référence ${head.slice(0, 7)}.`);
    }
    if (check && (copies.length || conflicts.length)) process.exitCode = 1;
    return;
  }

  if (!exobaseIsClean() && !force) {
    throw new SyncError(
      'exobase a des modifications non committées : la référence enregistrée serait fausse. ' +
      'Committez-les dans exobase, ou relancez avec --force.');
  }

  for (const entry of copies) {
    await fs.mkdir(path.dirname(entry.targetPath), { recursive: true });
    await fs.copyFile(entry.sourcePath, entry.targetPath);
  }
  console.log(`\n${copies.length} fichier(s) copié(s) depuis exobase.`);

  if (conflicts.length) {
    console.log(`Attention : ${conflicts.length} conflit(s) non résolu(s) : la référence reste à ` +
      `${base ? base.slice(0, 7) : 'aucune'}. Résolvez-les puis relancez.`);
    process.exitCode = 1;
    return;
  }

  const recorded = await recordSync(head, sources, entries, base);
  if (recorded) console.log(`Référence enregistrée : ${head.slice(0, 7)} dans content/provenance/exobase.json`);

  const buildCommand = copies.some(entry => entry.kind === 'code') ? 'pnpm build:content:full' : 'pnpm build:content';
  if (copies.length) console.log(`\nExécutez ensuite ${buildCommand} et préparez les exercices modifiés.`);
}

main().catch(error => {
  if (error instanceof SyncError) {
    console.error(`\nErreur : ${error.message}`);
    process.exitCode = 1;
  } else {
    console.error(`\nErreur : ${error.stack}`);
    process.exitCode = 3;
  }
});
