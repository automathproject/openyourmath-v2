#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sourceNeedsTikz } from './prepare-exercise.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const EXERCISES_PREFIX = 'content/exercises/';
const EXERCISES_ROOT = path.join(ROOT, 'content/exercises');
const CACHE_ROOT = path.join(ROOT, 'cache/exercises');

export function addedExercisePaths(statusOutput) {
  const paths = new Set();

  for (const record of statusOutput.split('\0')) {
    if (!record) continue;

    const status = record.slice(0, 2);
    const filePath = record.slice(3);
    const isAdded = status === '??' || status[0] === 'A';
    if (isAdded && filePath.startsWith(EXERCISES_PREFIX) && filePath.endsWith('.tex')) {
      paths.add(filePath);
    }
  }

  return [...paths].sort();
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) throw new Error(`Commande échouée : ${command} ${args.join(' ')}`);
  return result.stdout;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) throw new Error(`Commande échouée : ${command} ${args.join(' ')}`);
}

function readUuid(source, filePath) {
  const withoutComments = source.replace(/(?<!\\)%.*$/gm, '');
  const uuid = withoutComments.match(/\\uuid\s*\{([^}]*)\}/)?.[1]?.trim();
  if (!uuid) throw new Error(`UUID absent dans ${filePath}.`);
  return uuid;
}

function cacheDirectoryFor(relativePath) {
  const sourcePath = path.join(ROOT, relativePath);
  return path.join(CACHE_ROOT, path.dirname(path.relative(EXERCISES_ROOT, sourcePath)));
}

async function main() {
  const status = capture('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const paths = addedExercisePaths(status);

  if (paths.length === 0) {
    console.log('Aucun nouveau fichier .tex sous content/exercises/.');
    return;
  }

  const exercises = await Promise.all(paths.map(async relativePath => {
    const source = await fs.readFile(path.join(ROOT, relativePath), 'utf8');
    return { relativePath, source, uuid: readUuid(source, relativePath) };
  }));
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

  console.log(`\n📚 Préparation de ${exercises.length} nouvel exercice(s)\n`);
  for (const exercise of exercises) {
    console.log(`── ${exercise.uuid} (${exercise.relativePath})`);
    run(pnpm, ['check:tex', '--', exercise.relativePath]);
  }

  for (const exercise of exercises) {
    run(process.execPath, [
      'scripts/parse-latex.js',
      exercise.relativePath,
      path.relative(ROOT, cacheDirectoryFor(exercise.relativePath)),
      '--incremental',
      '--force'
    ]);
  }
  const tikzUuids = exercises
    .filter(exercise => sourceNeedsTikz(exercise.source))
    .map(exercise => exercise.uuid);
  if (tikzUuids.length > 0) {
    console.log(`\n🎨 TikZ détecté : compilation ciblée (${tikzUuids.join(', ')}).\n`);
    run(pnpm, ['build:tikz', '--', ...tikzUuids.flatMap(uuid => ['--uuid', uuid])]);
  }
  run(pnpm, ['build:db']);

  for (const exercise of exercises) {
    run(process.execPath, ['scripts/index-exercises.js', '--uuid', exercise.uuid]);
  }

  console.log('\n✅ Nouveaux exercices préparés. Relire puis commiter les sources et métadonnées générées.');
  run('git', ['status', '--short']);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(error => {
    console.error(`\n❌ ${error.message}`);
    process.exitCode = 1;
  });
}
