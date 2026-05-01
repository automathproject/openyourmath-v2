#!/usr/bin/env node
/**
 * Correcteur déterministe des sources LaTeX — sans IA.
 * Gère les cas mécaniquement sûrs :
 *   - empty-indication  : supprime \indication{} dont le corps est vide
 *   - single-item-enumerate : supprime le wrapper \begin{enumerate}...\end{enumerate}
 *     quand il ne contient qu'un seul \item (uniquement si l'exercice a une seule \question)
 *
 * Usage :
 *   node scripts/quality/fix-exercise-sources-deterministic.js [--apply] [--file=<path>] [--limit=N]
 *
 * Par défaut : mode aperçu (preview) dans reports/deterministic-latex-fixes/
 * Avec --apply : modification directe des fichiers sources
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { validateSource } from './check-exercise-sources.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const DEFAULT_PREVIEW_DIR = path.join(ROOT, 'reports/deterministic-latex-fixes');
const INPUT_DIR = path.join(ROOT, 'content/exercises');

// ---- Helpers (logique parallèle à check-exercise-sources.js) ----

function isEscaped(source, index) {
  let slashCount = 0;
  for (let i = index - 1; i >= 0 && source[i] === '\\'; i--) slashCount++;
  return slashCount % 2 === 1;
}

// Remplace les commentaires LaTeX par des espaces (préserve les longueurs et positions).
function stripCommentsPreserveLength(source) {
  let result = '';
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '%' && !isEscaped(source, i)) {
      while (i < source.length && source[i] !== '\n') {
        result += ' ';
        i++;
      }
      if (i < source.length) result += '\n';
    } else {
      result += source[i];
    }
  }
  return result;
}

function findEnumerateBlocks(source) {
  const blocks = [];
  const stack = [];
  const regex = /\\(begin|end)\s*\{enumerate\}/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    if (match[1] === 'begin') {
      stack.push({ start: match.index, bodyStart: match.index + match[0].length });
    } else if (stack.length > 0) {
      const frame = stack.pop();
      blocks.push({
        start: frame.start,
        bodyStart: frame.bodyStart,
        bodyEnd: match.index,
        end: match.index + match[0].length,
        body: source.slice(frame.bodyStart, match.index)
      });
    }
  }

  return blocks;
}

function countTopLevelItems(body) {
  const regex = /\\begin\s*\{enumerate\}|\\end\s*\{enumerate\}|\\item\b/g;
  let depth = 0;
  let count = 0;
  let match;

  while ((match = regex.exec(body)) !== null) {
    if (match[0].startsWith('\\begin')) depth++;
    else if (match[0].startsWith('\\end')) depth = Math.max(0, depth - 1);
    else if (depth === 0) count++;
  }

  return count;
}

// Retourne le contenu après le premier \item de haut niveau (sans le \item lui-même).
function extractItemContent(body) {
  const regex = /\\begin\s*\{enumerate\}|\\end\s*\{enumerate\}|\\item\b(?:\s*\[[^\]]*\])?/g;
  let depth = 0;
  let match;

  while ((match = regex.exec(body)) !== null) {
    if (match[0].startsWith('\\begin')) depth++;
    else if (match[0].startsWith('\\end')) depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      return body.slice(match.index + match[0].length).trim();
    }
  }

  return null;
}

// ---- Fonctions de correction ----

function fixEmptyIndications(source) {
  const clean = stripCommentsPreserveLength(source);
  const regex = /[ \t]*\\indication\s*\{\s*\}[ \t]*\n?/g;
  const replacements = [];
  let match;
  while ((match = regex.exec(clean)) !== null) {
    replacements.push({ start: match.index, end: match.index + match[0].length });
  }
  replacements.sort((a, b) => b.start - a.start);
  let result = source;
  for (const r of replacements) {
    result = result.slice(0, r.start) + result.slice(r.end);
  }
  return result;
}

function fixSingleItemEnumerates(source) {
  const blocks = findEnumerateBlocks(source);
  const replacements = [];

  for (const block of blocks) {
    if (countTopLevelItems(block.body) === 1) {
      const content = extractItemContent(block.body);
      if (content !== null) {
        replacements.push({ start: block.start, end: block.end, replacement: content });
      }
    }
  }

  // Appliquer de la fin vers le début pour préserver les indices
  replacements.sort((a, b) => b.start - a.start);
  let result = source;
  for (const r of replacements) {
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
  }

  return result;
}

export function applyDeterministicFixes(source) {
  let fixed = source;
  fixed = fixEmptyIndications(fixed);
  fixed = fixSingleItemEnumerates(fixed);
  return fixed;
}

// ---- Utilitaires CLI ----

async function listTexFiles(inputPath) {
  const stat = await fs.stat(inputPath);
  if (stat.isFile()) return inputPath.endsWith('.tex') ? [inputPath] : [];

  const entries = await fs.readdir(inputPath, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const p = path.join(inputPath, entry.name);
    if (entry.isDirectory()) return listTexFiles(p);
    if (entry.isFile() && entry.name.endsWith('.tex')) return [p];
    return [];
  }));

  return files.flat();
}

function parseArgs(args) {
  const options = {
    apply: false,
    fileFilters: [],
    limit: null,
    previewDir: DEFAULT_PREVIEW_DIR
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--file') {
      options.fileFilters.push(args[++i]);
    } else if (arg.startsWith('--file=')) {
      options.fileFilters.push(arg.slice('--file='.length));
    } else if (arg === '--limit') {
      options.limit = Number.parseInt(args[++i], 10);
    } else if (arg.startsWith('--limit=')) {
      options.limit = Number.parseInt(arg.slice('--limit='.length), 10);
    } else if (arg === '--preview-dir') {
      options.previewDir = path.resolve(args[++i]);
    } else if (arg.startsWith('--preview-dir=')) {
      options.previewDir = path.resolve(arg.slice('--preview-dir='.length));
    }
  }

  if (!Number.isFinite(options.limit) || options.limit < 1) options.limit = null;
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  let files = (await listTexFiles(INPUT_DIR)).sort();

  if (options.fileFilters.length > 0) {
    const normalized = new Set(options.fileFilters.map(f => f.replace(/\\/g, '/')));
    files = files.filter(f => {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      return normalized.has(rel) || normalized.has(f.replace(/\\/g, '/'));
    });
  }

  if (options.limit) files = files.slice(0, options.limit);

  console.log(options.apply
    ? `Mode: application directe sur ${files.length} fichier(s)`
    : `Mode: aperçu dans ${path.relative(ROOT, options.previewDir)} pour ${files.length} fichier(s)`);

  let applied = 0;
  let rejected = 0;
  let unchanged = 0;

  for (const filePath of files) {
    const source = await fs.readFile(filePath, 'utf8');
    const relPath = path.relative(ROOT, filePath);
    const fixed = applyDeterministicFixes(source);

    if (fixed === source) {
      unchanged++;
      continue;
    }

    const before = validateSource(source, relPath).length;
    const after = validateSource(fixed, relPath).length;

    if (after >= before) {
      console.log(`rejected: ${relPath} (${before} -> ${after})`);
      rejected++;
      continue;
    }

    applied++;

    if (options.apply) {
      await fs.writeFile(filePath, fixed, 'utf8');
      console.log(`applied:  ${relPath} (${before} -> ${after})`);
    } else {
      const previewPath = path.join(options.previewDir, relPath);
      await fs.mkdir(path.dirname(previewPath), { recursive: true });
      await fs.writeFile(previewPath, fixed, 'utf8');
      console.log(`preview:  ${relPath} (${before} -> ${after}) -> ${path.relative(ROOT, previewPath)}`);
    }
  }

  console.log(`\n${applied} corrigé(s), ${rejected} rejeté(s), ${unchanged} inchangé(s) sur ${files.length} fichier(s).`);
  if (applied === 0 && files.length > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
