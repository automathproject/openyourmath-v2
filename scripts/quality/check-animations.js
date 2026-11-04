#!/usr/bin/env node
// Vérifie que chaque \animation{nom}{légende} des sources désigne une page
// existante de content/animations/ et porte une légende (texte alternatif de la
// figure, et seule trace de l'animation dans l'export PDF).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANIMATION_NAME, findAnimations } from '../../src/lib/animations.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function listFiles(directory, extension) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(entryPath, extension);
    return entry.isFile() && entry.name.endsWith(extension) ? [entryPath] : [];
  }));
  return nested.flat();
}

/**
 * @param {{ exercisesRoot: string, animationsRoot: string }} roots
 * @returns {Promise<{ filePath: string, name: string, code: string, message: string }[]>}
 */
export async function checkAnimations({ exercisesRoot, animationsRoot }) {
  const available = new Set(
    (await fs.readdir(animationsRoot).catch(() => []))
      .filter((file) => file.endsWith('.html'))
      .map((file) => file.slice(0, -'.html'.length)),
  );
  const issues = [];
  for (const filePath of await listFiles(exercisesRoot, '.tex')) {
    const source = await fs.readFile(filePath, 'utf8');
    if (!source.includes('\\animation')) continue;
    for (const { name, caption } of findAnimations(source)) {
      const problem = (code, message) => issues.push({ filePath, name, code, message });
      if (!ANIMATION_NAME.test(name)) problem('invalid-name', `Nom d'animation invalide : « ${name} ».`);
      else if (!available.has(name)) problem('missing-animation', `content/animations/${name}.html n'existe pas.`);
      if (!caption) problem('missing-caption', `L'animation « ${name} » n'a pas de légende.`);
      // La légende sert d'attribut, de titre d'iframe et d'étiquette : du texte simple.
      else if (/[$\\]/.test(caption)) problem('formula-in-caption', `La légende de « ${name} » doit être du texte simple, sans formule.`);
    }
  }
  return issues;
}

async function main() {
  const issues = await checkAnimations({
    exercisesRoot: path.join(ROOT, 'content/exercises'),
    animationsRoot: path.join(ROOT, 'content/animations'),
  });
  for (const { filePath, code, message } of issues) {
    console.error(`${path.relative(ROOT, filePath)} : ${code} — ${message}`);
  }
  if (issues.length > 0) process.exit(1);
  console.log('Animations : toutes les références sont valides.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
