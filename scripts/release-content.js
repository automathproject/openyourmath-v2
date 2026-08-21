#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

export function isReleaseVersion(version) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(version));
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) throw new Error(`Commande échouée : ${command} ${args.join(' ')}`);
  return result.stdout.trim();
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) throw new Error(`Commande échouée : ${command} ${args.join(' ')}`);
}

function assertReleasePreconditions() {
  const changes = capture('git', ['status', '--porcelain', '--untracked-files=all']);
  if (changes) {
    throw new Error('Le dépôt doit être propre avant une release. Committer ou remiser les modifications en cours.');
  }

  const branch = capture('git', ['branch', '--show-current']);
  if (branch !== 'main') {
    throw new Error(`La release doit partir de main (branche courante : ${branch || 'détachée'}).`);
  }
}

function main() {
  assertReleasePreconditions();

  const packagePath = path.join(ROOT, 'package.json');
  const { version } = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (!isReleaseVersion(version)) {
    throw new Error(`Version package.json invalide : « ${version} ».`);
  }

  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  console.log(`\n🚀 Préparation de la release ${version}\n`);
  run(pnpm, ['test:build']);
  run(pnpm, ['build:content:incremental']);
  run(pnpm, ['docker:release']);

  console.log(`\n✅ Image publiée : ghcr.io/automathproject/openyourmath:${version}`);
  console.log('\nSur le serveur de production :');
  console.log(`  export APP_VERSION=${version}`);
  console.log('  docker compose pull app');
  console.log('  docker compose up -d app');
  console.log('  curl --fail --silent --show-error https://openyourmath.org/api/health');
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    main();
  } catch (error) {
    console.error(`\n❌ ${error.message}`);
    process.exitCode = 1;
  }
}
