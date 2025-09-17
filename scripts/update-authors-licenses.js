#!/usr/bin/env node
// Add default license info to every author entry in content/authors.json
// - Adds: license_code: "exo7", license_url: "http://exo7.emath.fr/licence.html"
// - Preserves existing values if already present

import fs from 'fs';
import path from 'path';

const AUTHORS_PATH = path.resolve('content/authors.json');
const DEFAULT_CODE = 'exo7';
const DEFAULT_URL = 'http://exo7.emath.fr/licence.html';

function main() {
  if (!fs.existsSync(AUTHORS_PATH)) {
    console.error(`authors.json not found at ${AUTHORS_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(AUTHORS_PATH, 'utf8').trim();
  if (!raw) {
    console.log('authors.json is empty; nothing to update.');
    process.exit(0);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse JSON in content/authors.json:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error('Expected authors.json to contain a JSON array of authors.');
    process.exit(1);
  }

  let changed = 0;
  const updated = data.map((author) => {
    if (!author || typeof author !== 'object') return author;
    const next = { ...author };
    if (!('license_code' in next)) { next.license_code = DEFAULT_CODE; changed++; }
    if (!('license_url' in next)) { next.license_url = DEFAULT_URL; changed++; }
    return next;
  });

  if (changed === 0) {
    console.log('No changes needed; all authors already have license fields.');
    process.exit(0);
  }

  const pretty = JSON.stringify(updated, null, 2) + '\n';
  fs.writeFileSync(AUTHORS_PATH, pretty, 'utf8');
  console.log(`Updated authors.json: added ${changed} field(s) across ${updated.length} author(s).`);
}

main();

