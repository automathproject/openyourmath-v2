#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const EXERCISES_ROOT = path.join(ROOT, 'content/exercises');

function withoutComments(source) {
  return source.replace(/(?<!\\)%.*$/gm, '');
}

export function sourceNeedsTikz(source) {
  return /\\begin\s*\{tikzpicture\}/.test(withoutComments(source));
}

async function listTexFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTexFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.tex') ? [entryPath] : [];
  }));
  return nested.flat();
}

export async function findExercisesByUuid(uuid, exercisesRoot = EXERCISES_ROOT) {
  const files = await listTexFiles(exercisesRoot);
  const matches = [];

  for (const filePath of files) {
    const source = await fs.readFile(filePath, 'utf8');
    const declaredUuid = withoutComments(source).match(/\\uuid\s*\{([^}]*)\}/)?.[1]?.trim();
    if (declaredUuid === uuid) matches.push({ filePath, source });
  }

  return matches;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(`Commande échouée : ${command} ${args.join(' ')}`);
  }
}

async function main() {
  const [uuid] = process.argv.slice(2);
  if (!uuid || uuid.startsWith('-')) {
    throw new Error('Usage : pnpm exercise:prepare -- <uuid>');
  }

  const matches = await findExercisesByUuid(uuid);
  if (matches.length === 0) {
    throw new Error(`Aucun exercice avec l'UUID « ${uuid} » n'a été trouvé.`);
  }
  if (matches.length > 1) {
    const paths = matches.map(match => path.relative(ROOT, match.filePath)).join(', ');
    throw new Error(`UUID « ${uuid} » dupliqué : ${paths}`);
  }

  const [{ filePath, source }] = matches;
  const relativePath = path.relative(ROOT, filePath);
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

  console.log(`\n📘 Préparation de ${uuid} (${relativePath})\n`);
  run(pnpm, ['check:tex', '--', relativePath]);
  run(pnpm, ['build:cache']);

  if (sourceNeedsTikz(source)) {
    console.log('\n🎨 TikZ détecté : compilation des artefacts.\n');
    run(pnpm, ['build:tikz']);
  }

  run(pnpm, ['build:db']);
  run(process.execPath, ['scripts/index-exercises.js', '--uuid', uuid]);

  console.log(`\n✅ Exercice ${uuid} préparé.`);
  console.log('Relire puis commiter la source et content/metadata/ correspondante.');
  run('git', ['status', '--short']);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(error => {
    console.error(`\n❌ ${error.message}`);
    process.exitCode = 1;
  });
}
