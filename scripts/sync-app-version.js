#!/usr/bin/env node
// ./scripts/sync-app-version.js
// Écrit APP_VERSION dans .env à partir de la version de package.json,
// pour que docker compose reste correct même en dehors de pnpm docker:prod
// (redémarrage manuel, restart du démon, etc).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const envPath = path.join(ROOT, '.env');
const line = `APP_VERSION=${version}`;
const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

const hasLine = /^APP_VERSION=.*$/m.test(existing);
const updated = hasLine
  ? existing.replace(/^APP_VERSION=.*$/m, line)
  : (existing.length && !existing.endsWith('\n') ? `${existing}\n${line}\n` : `${existing}${line}\n`);

if (updated !== existing) {
  fs.writeFileSync(envPath, updated);
  console.log(`✅ .env mis à jour : ${line}`);
} else {
  console.log(`ℹ️  .env déjà à jour : ${line}`);
}
