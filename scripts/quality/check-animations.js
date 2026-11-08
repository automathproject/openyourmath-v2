#!/usr/bin/env node
// Vérifie que chaque \animation{nom}{légende} des sources désigne une figure
// existante de content/animations/<source>/<nom>.js et porte une légende (texte
// alternatif de la figure, et seule trace de l'animation dans l'export PDF),
// qu'aucun nom n'est employé par deux sources, et que chaque figure s'enregistre
// sous le nom de son fichier (OYMWidgets.define('<nom>', …)).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANIMATION_NAME, findAnimations, indexAnimationPages } from '../../src/lib/animations.js';
import { definedWidgetNames } from '../../src/lib/widgets/page.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function listFiles(directory, extension) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
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
  const pagePaths = (await listFiles(animationsRoot, '.js'))
    .map((file) => `animations/${path.relative(animationsRoot, file).split(path.sep).join('/')}`);
  const { pages, duplicates } = indexAnimationPages(pagePaths);
  const issues = [];
  const indexed = new Set([...pages.values(), ...[...duplicates.values()].flat()]);
  for (const pagePath of pagePaths.filter((page) => !indexed.has(page))) {
    issues.push({
      filePath: path.join(animationsRoot, pagePath.slice('animations/'.length)),
      name: path.basename(pagePath, '.js'),
      code: 'unserved-animation',
      message: `${pagePath} ne sera pas servie : attendu content/animations/<source>/<nom>.js.`,
    });
  }
  for (const [name, found] of duplicates) {
    issues.push({
      filePath: path.join(animationsRoot, found[0].slice('animations/'.length)),
      name,
      code: 'duplicate-animation',
      message: `« ${name} » existe dans plusieurs sources (${found.join(', ')}) : l'adresse /animation/${name} serait ambiguë.`,
    });
  }
  for (const [name, pagePath] of pages) {
    const filePath = path.join(animationsRoot, pagePath.slice('animations/'.length));
    const defined = definedWidgetNames(await fs.readFile(filePath, 'utf8'));
    if (defined.length !== 1 || defined[0] !== name) {
      issues.push({
        filePath,
        name,
        code: 'widget-name-mismatch',
        message: `${pagePath} doit enregistrer une seule figure, OYMWidgets.define('${name}', …)${defined.length ? ` (trouvé : ${defined.join(', ')})` : ''}.`,
      });
    }
  }
  for (const filePath of await listFiles(exercisesRoot, '.tex')) {
    const source = await fs.readFile(filePath, 'utf8');
    if (!source.includes('\\animation')) continue;
    for (const { name, caption } of findAnimations(source)) {
      const problem = (code, message) => issues.push({ filePath, name, code, message });
      if (!ANIMATION_NAME.test(name)) problem('invalid-name', `Nom d'animation invalide : « ${name} ».`);
      else if (!pages.has(name) && !duplicates.has(name)) {
        problem('missing-animation', `Aucune figure content/animations/<source>/${name}.js.`);
      }
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
