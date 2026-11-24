#!/usr/bin/env node

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveImagePath } from '../utils/image-artifacts.js';
import { analyzeDisplayMath, analyzeInlineMath, findDisplayMath, findInlineMath } from './latex-math-layout.js';
import { QCM_TYPES } from '../../src/lib/qcm/source.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const DEFAULT_INPUT = path.join(ROOT, 'content/exercises');
// Contenus qcm (format exo7qcm, voir content/qcm/FORMAT.md dans exobase).
const QCM_INPUT = path.join(ROOT, 'content/qcm');
const DEFAULT_MAX_ERRORS = 200;
const CSV_COLUMNS = ['file', 'line', 'column', 'code', 'message'];

function reportDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

const TOP_LEVEL_COMMANDS = new Set([
  'uuid',
  'titre',
  'chapitre',
  'sousChapitre',
  'theme',
  'auteur',
  'organisation',
  'video',
  'datecreate',
  'niveau',
  'difficulte',
  'cpge',
  'module',
  'exo7id',
  'isIndication',
  'isCorrection',
  'contenu'
]);

const CONTENT_COMMANDS = new Set(['texte', 'question', 'indication', 'reponse']);

// En-tête d'un qcm : celui des exercices, plus trois champs propres aux qcm.
const QCM_TOP_LEVEL_COMMANDS = new Set([...TOP_LEVEL_COMMANDS, 'licence', 'serie', 'exo7qcmid']);
const QCM_REQUIRED_METADATA = ['uuid', 'titre', 'auteur', 'organisation', 'datecreate', 'niveau', 'module', 'chapitre'];

const IGNORED_CONTENT_ENVIRONMENTS = new Set([
  'center',
  'tabular',
  'tabularx',
  'array',
  'tikzpicture',
  'Piton',
  'minipage',
  'multicols'
]);

const IGNORED_CONTENT_COMMANDS = new Set([
  'colonnes',
  'fincolonnes',
  'setcounter',
  'smallskip',
  'medskip',
  'bigskip',
  'vspace',
  'hspace',
  'paragraph',
  'subsection',
  'subsubsection',
  'href',
  'includegraphics',
  'hfill',
  'renewcommand',
  'label'
]);

function isEscaped(source, index) {
  let slashCount = 0;
  for (let i = index - 1; i >= 0 && source[i] === '\\'; i--) slashCount++;
  return slashCount % 2 === 1;
}

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

function lineAndColumn(source, index) {
  const before = source.slice(0, index);
  const lines = before.split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function parseBracedArgument(source, openBraceIndex) {
  if (source[openBraceIndex] !== '{') return null;

  let depth = 1;
  for (let i = openBraceIndex + 1; i < source.length; i++) {
    if (source[i] === '\\') {
      i++;
      continue;
    }
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) {
      return {
        bodyStart: openBraceIndex + 1,
        bodyEnd: i,
        end: i + 1,
        body: source.slice(openBraceIndex + 1, i)
      };
    }
  }

  return null;
}

function findCommandCalls(source, names = null) {
  const calls = [];
  const commandRegex = /\\([A-Za-z][A-Za-z0-9]*)\s*\{/g;
  let match;

  while ((match = commandRegex.exec(source)) !== null) {
    if (isEscaped(source, match.index)) continue;

    const name = match[1];
    if (names && !names.has(name)) continue;

    const openBraceIndex = source.indexOf('{', match.index + match[0].length - 1);
    const argument = parseBracedArgument(source, openBraceIndex);
    if (!argument) {
      calls.push({
        name,
        start: match.index,
        end: source.length,
        bodyStart: openBraceIndex + 1,
        bodyEnd: source.length,
        body: source.slice(openBraceIndex + 1),
        malformed: true
      });
      continue;
    }

    calls.push({
      name,
      start: match.index,
      end: argument.end,
      bodyStart: argument.bodyStart,
      bodyEnd: argument.bodyEnd,
      body: argument.body,
      malformed: false
    });
  }

  return calls;
}

function isInsideRange(index, ranges) {
  return ranges.some(range => index >= range.start && index < range.end);
}

function blankRange(chars, start, end) {
  for (let i = Math.max(0, start); i < Math.min(chars.length, end); i++) {
    if (chars[i] !== '\n') chars[i] = ' ';
  }
}

function skipWhitespace(source, index) {
  while (index < source.length && /\s/.test(source[index])) index++;
  return index;
}

function parseBracketArgument(source, openBracketIndex) {
  if (source[openBracketIndex] !== '[') return null;

  let depth = 1;
  for (let i = openBracketIndex + 1; i < source.length; i++) {
    if (source[i] === '\\') {
      i++;
      continue;
    }
    if (source[i] === '[') depth++;
    if (source[i] === ']') depth--;
    if (depth === 0) {
      return {
        bodyStart: openBracketIndex + 1,
        end: i + 1
      };
    }
  }

  return null;
}

function blankIgnoredContentCommands(chars, source) {
  const commandRegex = /\\([A-Za-z][A-Za-z0-9]*)\*?/g;
  let match;

  while ((match = commandRegex.exec(source)) !== null) {
    if (isEscaped(source, match.index) || !IGNORED_CONTENT_COMMANDS.has(match[1])) {
      continue;
    }

    let end = match.index + match[0].length;
    let consumedArgument = false;

    while (true) {
      end = skipWhitespace(source, end);

      if (source[end] === '[') {
        const argument = parseBracketArgument(source, end);
        if (!argument) break;
        end = argument.end;
        consumedArgument = true;
        continue;
      }

      if (source[end] === '{') {
        const argument = parseBracedArgument(source, end);
        if (!argument) break;
        end = argument.end;
        consumedArgument = true;
        continue;
      }

      break;
    }

    blankRange(chars, match.index, consumedArgument ? end : match.index + match[0].length);
  }
}

function summarizeChunk(chunk) {
  return chunk.replace(/\s+/g, ' ').trim().slice(0, 90);
}

function findRawTextChunks(source, baseOffset, typedCommandCalls) {
  const chars = source.split('');

  for (const call of typedCommandCalls) {
    blankRange(chars, call.start - baseOffset, call.end - baseOffset);
  }

  for (const environment of IGNORED_CONTENT_ENVIRONMENTS) {
    for (const block of findEnvironmentBlocks(source, environment)) {
      blankRange(chars, block.start, block.end);
    }
  }

  blankIgnoredContentCommands(chars, source);

  const masked = chars
    .join('')
    .replace(/\\begin\s*\{[^}]+\}/g, match => ' '.repeat(match.length))
    .replace(/\\end\s*\{[^}]+\}/g, match => ' '.repeat(match.length))
    .replace(/\\item\s*(?:\[[^\]]*\])?/g, match => ' '.repeat(match.length))
    .replace(/[$&_^{}~#]/g, ' ');

  const chunks = [];
  const rawTextRegex = /[A-Za-zÀ-ÖØ-öø-ÿ0-9][\s\S]*?(?=(?:\n\s*\n)|$)/g;
  let match;

  while ((match = rawTextRegex.exec(masked)) !== null) {
    const text = summarizeChunk(match[0]);
    if (!text) continue;
    chunks.push({
      index: baseOffset + match.index,
      text
    });
  }

  return chunks;
}

function findEnumerateBlocks(source) {
  const blocks = [];
  const stack = [];
  const regex = /\\(begin|end)\s*\{enumerate\}/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    if (isEscaped(source, match.index)) continue;

    if (match[1] === 'begin') {
      stack.push({
        start: match.index,
        bodyStart: match.index + match[0].length
      });
    } else if (stack.length > 0) {
      const start = stack.pop();
      blocks.push({
        start: start.start,
        bodyStart: start.bodyStart,
        bodyEnd: match.index,
        end: match.index + match[0].length,
        body: source.slice(start.bodyStart, match.index)
      });
    }
  }

  return blocks;
}

function findEnvironmentBlocks(source, environmentName) {
  const escapedName = environmentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blocks = [];
  const stack = [];
  const regex = new RegExp(`\\\\(begin|end)\\s*\\{${escapedName}\\}(?:\\s*\\{[^}]*\\})?`, 'g');
  let match;

  while ((match = regex.exec(source)) !== null) {
    if (isEscaped(source, match.index)) continue;

    if (match[1] === 'begin') {
      stack.push({ start: match.index });
    } else if (stack.length > 0) {
      const start = stack.pop();
      blocks.push({
        start: start.start,
        end: match.index + match[0].length
      });
    }
  }

  return blocks;
}

function countTopLevelItems(source) {
  const regex = /\\begin\s*\{enumerate\}|\\end\s*\{enumerate\}|\\item\b/g;
  let depth = 0;
  let count = 0;
  let match;

  while ((match = regex.exec(source)) !== null) {
    if (isEscaped(source, match.index)) continue;

    if (match[0].startsWith('\\begin')) depth++;
    else if (match[0].startsWith('\\end')) depth = Math.max(0, depth - 1);
    else if (depth === 0) count++;
  }

  return count;
}

async function listTexFiles(inputPath) {
  const stat = await fs.stat(inputPath);
  if (stat.isFile()) return inputPath.endsWith('.tex') ? [inputPath] : [];

  const entries = await fs.readdir(inputPath, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const entryPath = path.join(inputPath, entry.name);
    if (entry.isDirectory()) return listTexFiles(entryPath);
    if (entry.isFile() && entry.name.endsWith('.tex')) return [entryPath];
    return [];
  }));

  return files.flat();
}

function addIssue(issues, source, filePath, index, code, message) {
  const { line, column } = lineAndColumn(source, index);
  issues.push({
    filePath,
    line,
    column,
    code,
    message
  });
}

/**
 * Détecte les UUID présents plusieurs fois dans un ensemble de sources.
 *
 * La validation structurelle reste volontairement locale (et utilisable par
 * les scripts de correction). Cette validation-ci doit au contraire comparer
 * les sources entre elles avant leur intégration à la base.
 *
 * @param {{ source: string, filePath: string }[]} sources
 * @returns {{ filePath: string, line: number, column: number, code: string, message: string }[]}
 */
export function validateUuidUniqueness(sources) {
  const byUuid = new Map();

  for (const entry of sources) {
    const cleanSource = stripCommentsPreserveLength(entry.source);
    const uuidCall = findCommandCalls(cleanSource, new Set(['uuid']))
      .find(call => !call.malformed && call.body.trim());

    if (!uuidCall) continue;

    const uuid = uuidCall.body.trim();
    const entries = byUuid.get(uuid) || [];
    entries.push({ ...entry, uuidCall });
    byUuid.set(uuid, entries);
  }

  const issues = [];
  for (const [uuid, entries] of byUuid) {
    if (entries.length < 2) continue;

    const paths = entries.map(entry => entry.filePath).join(', ');
    for (const entry of entries) {
      const { line, column } = lineAndColumn(entry.source, entry.uuidCall.start);
      issues.push({
        filePath: entry.filePath,
        line,
        column,
        code: 'duplicate-uuid',
        message: `UUID dupliqué « ${uuid} » : ${paths}.`
      });
    }
  }

  return issues;
}

/**
 * Vérifie que chaque image référencée par \includegraphics est résolue avec la
 * même logique que le parseur de contenu.
 *
 * @param {{ source: string, filePath: string, sourceFilePath?: string }[]} sources
 * @param {{ contentRoot?: string }} options
 * @returns {Promise<{ filePath: string, line: number, column: number, code: string, message: string }[]>}
 */
export async function validateImageReferences(sources, { contentRoot = path.join(ROOT, 'content') } = {}) {
  const issues = [];
  const includegraphics = /\\(includegraphics|qimage)(?:\[[^\]]*\])?\{([^}]+)\}/g;

  for (const entry of sources) {
    // Préserver les positions pour fournir une ligne/colonne exacte tout en
    // ignorant les références désactivées dans des commentaires LaTeX.
    const cleanSource = stripCommentsPreserveLength(entry.source);
    let match;

    while ((match = includegraphics.exec(cleanSource)) !== null) {
      const imagePath = match[2].trim();
      if (!imagePath) continue;

      const resolvedPath = await resolveImagePath({
        imagePath,
        sourceFilePath: imageLookupPath(entry.sourceFilePath || path.resolve(ROOT, entry.filePath)),
        contentRoot,
        logger: null
      });

      if (resolvedPath) continue;

      const { line, column } = lineAndColumn(entry.source, match.index);
      issues.push({
        filePath: entry.filePath,
        line,
        column,
        code: 'missing-image',
        message: `Image introuvable pour \\${match[1]}{${imagePath}} dans content/images/.`
      });
    }
  }

  return issues;
}

const CPGE_PROGRAMMES = path.join(ROOT, 'content/referentials/cpge/programmes');
const CPGE_NODE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

/**
 * Identifiants des sections et sous-sections du référentiel CPGE, lus dans les
 * titres `{#…}` des programmes. null si le référentiel est absent : seule la
 * forme des identifiants est alors contrôlée.
 *
 * @param {string} programmesDir
 * @returns {Promise<Set<string> | null>}
 */
export async function loadCpgeNodeIds(programmesDir = CPGE_PROGRAMMES) {
  let names;
  try {
    names = await fs.readdir(programmesDir);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const ids = new Set();
  for (const name of names.filter(name => name.endsWith('.md')).sort()) {
    const text = await fs.readFile(path.join(programmesDir, name), 'utf8');
    for (const match of text.matchAll(/^#{3,4} .*\{#([^}\s]+)\}\s*$/gm)) ids.add(match[1]);
  }
  return ids;
}

/**
 * Contrôle les identifiants de \cpge{} : forme, répétition et présence dans le
 * référentiel CPGE. Mêmes codes que tools/check_exercise_sources.py d'exobase.
 *
 * @param {{ source: string, filePath: string }[]} sources
 * @param {{ nodeIds?: Set<string> | null }} options
 * @returns {{ filePath: string, line: number, column: number, code: string, message: string }[]}
 */
export function validateCpgeReferences(sources, { nodeIds = null } = {}) {
  const issues = [];
  for (const entry of sources) {
    const cleanSource = stripCommentsPreserveLength(entry.source);
    for (const call of findCommandCalls(cleanSource, new Set(['cpge']))) {
      if (call.malformed) continue;
      const seen = new Set();
      for (const raw of call.body.split(',')) {
        const node = raw.trim();
        let code = null;
        let message = null;
        if (!node) {
          [code, message] = ['invalid-cpge', 'Identifiant vide dans \\cpge{...}.'];
        } else if (!CPGE_NODE_ID.test(node)) {
          [code, message] = ['invalid-cpge', `Identifiant CPGE mal formé « ${node} ».`];
        } else if (seen.has(node)) {
          [code, message] = ['invalid-cpge', `Identifiant CPGE « ${node} » répété.`];
        } else if (nodeIds && !nodeIds.has(node)) {
          [code, message] = ['unknown-cpge-node',
            `Identifiant CPGE « ${node} » absent du référentiel content/referentials/cpge/.`];
        }
        seen.add(node);
        if (code) addIssue(issues, entry.source, entry.filePath, call.start, code, message);
      }
    }
  }
  return issues;
}

function csvEscape(value) {
  const stringValue = String(value ?? '');
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

async function writeIssuesCsv(issues, outputPath) {
  const rows = [
    CSV_COLUMNS.join(','),
    ...issues.map(issue => [
      issue.filePath,
      issue.line,
      issue.column,
      issue.code,
      issue.message
    ].map(csvEscape).join(','))
  ];

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${rows.join('\n')}\n`, 'utf8');
}

/**
 * Avertissements de mise en page des formules (voir latex-math-layout.js).
 *
 * Ce ne sont pas des erreurs de structure : `validateSource` n'en tient pas
 * compte et le code de sortie du contrôle non plus. Ils signalent une formule
 * en ligne qui ne peut pas se replier (codes `inline-math-…`), ou un
 * enchaînement de relations en formule affichée qu'un align* logerait (code
 * `display-math-relation-chain`) : dans les deux cas elle dépasse de la colonne.
 *
 * @param {string} source
 * @param {string} [filePath]
 * @returns {{ filePath: string, line: number, column: number, code: string, message: string, fixable: boolean, fixableWithOption: boolean }[]}
 */
export function validateMathLayout(source, filePath = '<source>') {
  const warnings = [];
  for (const formula of findInlineMath(source)) {
    for (const issue of analyzeInlineMath(formula.text)) {
      const { line, column } = lineAndColumn(source, formula.start);
      warnings.push({
        filePath,
        line,
        column,
        code: `inline-math-${issue.code}`,
        message: issue.message,
        fixable: issue.fixable,
        fixableWithOption: Boolean(issue.fixableWithOption)
      });
    }
  }
  for (const formula of findDisplayMath(source)) {
    if (formula.hasComment) continue;
    for (const issue of analyzeDisplayMath(formula.text)) {
      const { line, column } = lineAndColumn(source, formula.start);
      warnings.push({
        filePath,
        line,
        column,
        code: `display-math-${issue.code}`,
        message: issue.message,
        fixable: issue.fixable,
        fixableWithOption: false
      });
    }
  }
  return warnings;
}

/**
 * Chemin à partir duquel chercher les images d'une source. Un qcm range ses
 * images comme un exercice de la même source (content/images/<source>/) : on
 * le traite comme content/exercises/<source>/<fichier>, ainsi que le fait
 * scripts/parse-qcm.js.
 */
function imageLookupPath(sourceFilePath) {
  const relative = path.relative(QCM_INPUT, sourceFilePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return sourceFilePath;
  return path.join(DEFAULT_INPUT, relative.split(path.sep)[0], path.basename(sourceFilePath));
}

/**
 * Une source est un qcm si elle est rangée sous content/qcm/ ou si son contenu
 * suit la syntaxe exo7qcm (environnement question), absente des exercices.
 */
export function isQcmSource(source, filePath = '') {
  if (/(^|[\\/])content[\\/]qcm[\\/]/.test(filePath)) return true;
  return /\\begin\s*\{question\}/.test(stripCommentsPreserveLength(source));
}

function reportTextOutsideContenu(issues, source, filePath, cleanSource, topLevelCalls) {
  const topLevelMask = cleanSource.split('');
  for (const call of topLevelCalls) blankRange(topLevelMask, call.start, call.end);
  for (const block of findEnvironmentBlocks(cleanSource, 'SaveVerbatim')) {
    blankRange(topLevelMask, block.start, block.end);
  }
  const outsideText = topLevelMask.join('');
  const outsideRegex = /[A-Za-zÀ-ÖØ-öø-ÿ0-9][^\n]*/g;
  let outsideMatch;
  while ((outsideMatch = outsideRegex.exec(outsideText)) !== null) {
    addIssue(
      issues,
      source,
      filePath,
      outsideMatch.index,
      'text-outside-contenu',
      `Texte hors \\contenu{...}: "${summarizeChunk(outsideMatch[0])}".`
    );
  }
}

/** Texte restant une fois retirés les commandes de mise en page et l'espace. */
function leftoverText(fragment) {
  return fragment
    .replace(/\\(?:vskip\s*-?[\d.]+\s*[a-z]{2}|vspace\*?\{[^}]*\}|(?:small|med|big)skip\b|noindent\b)/g, '')
    .trim();
}

/**
 * Vérifie un contenu qcm : en-tête, \contenu{} au format exo7qcm, et pour
 * chaque question un bloc answers de \good{}/\bad{} cohérent avec \qtype{}.
 * Reprend les règles de tools/validate/check_qcm_sources.py d'exobase, avec la
 * position de chaque problème.
 *
 * @param {string} source
 * @param {string} [filePath]
 * @returns {{ filePath: string, line: number, column: number, code: string, message: string }[]}
 */
export function validateQcmSource(source, filePath = '<source>') {
  const issues = [];
  const cleanSource = stripCommentsPreserveLength(source);
  const topLevelCalls = findCommandCalls(cleanSource, QCM_TOP_LEVEL_COMMANDS);
  const contenuCalls = topLevelCalls.filter(call => call.name === 'contenu');
  const firstCall = name => topLevelCalls.find(call => call.name === name && !call.malformed);
  const report = (index, code, message) => addIssue(issues, source, filePath, index, code, message);

  for (const call of topLevelCalls) {
    if (call.malformed) {
      report(call.start, 'malformed-command', `La commande \\${call.name}{...} n'est pas fermée correctement.`);
    }
  }

  for (const name of QCM_REQUIRED_METADATA) {
    const call = firstCall(name);
    if (!call || !call.body.trim()) {
      report(call ? call.start : 0, 'missing-metadata', `Métadonnée manquante ou vide : \\${name}{...}.`);
    }
  }

  const uuidCall = firstCall('uuid');
  const fileStem = path.basename(filePath, '.tex');
  const namedByUuid = /(^|[\\/])content[\\/]qcm[\\/]/.test(filePath);
  if (namedByUuid && uuidCall && uuidCall.body.trim() && uuidCall.body.trim() !== fileStem) {
    report(uuidCall.start, 'uuid-filename-mismatch', `\\uuid{${uuidCall.body.trim()}} ne correspond pas au nom du fichier (${fileStem}.tex).`);
  }

  const difficultyCall = firstCall('difficulte');
  const difficulty = difficultyCall?.body.trim();
  if (difficulty && !['1', '2', '3'].includes(difficulty)) {
    report(difficultyCall.start, 'invalid-difficulty', `\\difficulte{${difficulty}} hors de 1 à 3.`);
  }

  reportTextOutsideContenu(issues, source, filePath, cleanSource, topLevelCalls);

  const contenu = contenuCalls.find(call => !call.malformed);
  if (!contenu) {
    if (contenuCalls.length === 0) report(0, 'missing-contenu', 'Le fichier doit contenir un bloc \\contenu{...}.');
    return issues;
  }

  const body = contenu.body;
  const offset = contenu.bodyStart;

  let balanced = true;
  for (const environment of ['question', 'answers', 'explanations']) {
    const opened = (body.match(new RegExp(`\\\\begin\\s*\\{${environment}\\}`, 'g')) || []).length;
    const closed = (body.match(new RegExp(`\\\\end\\s*\\{${environment}\\}`, 'g')) || []).length;
    if (opened !== closed) {
      balanced = false;
      report(offset, 'unbalanced-environment', `Environnement ${environment} : ${opened} ouverture(s) pour ${closed} fermeture(s).`);
    }
  }

  const questions = [];
  const questionRegex = /\\begin\s*\{question\}(?:\[[^\]]*\])?([\s\S]*?)\\end\s*\{question\}/dg;
  for (const match of body.matchAll(questionRegex)) {
    questions.push({
      start: offset + match.index,
      end: offset + match.index + match[0].length,
      bodyStart: offset + match.indices[1][0],
      body: match[1]
    });
  }

  if (questions.length === 0) {
    report(contenu.start, 'missing-question', 'Le contenu doit contenir au moins un environnement question.');
  }

  const serieCall = firstCall('serie');
  const ordered = serieCall?.body.trim() === 'ordonnee';
  if (ordered && questions.length < 2) {
    report(serieCall.start, 'qcm-serie', '\\serie{ordonnee} sur un contenu d\'une seule question.');
  }
  if (!ordered && questions.length > 1) {
    report(questions[1].start, 'qcm-serie', `${questions.length} questions sans \\serie{ordonnee}.`);
  }

  // Tout le texte du contenu est dans \texte{} ou dans une question. Un
  // environnement mal fermé est déjà signalé : son texte n'est pas repris ici.
  const contenuMask = body.split('');
  for (const call of findCommandCalls(body, new Set(['texte']))) blankRange(contenuMask, call.start, call.end);
  for (const question of questions) blankRange(contenuMask, question.start - offset, question.end - offset);
  const leftover = contenuMask.join('').replace(/\\(?:begin|end)\s*\{[^}]+\}/g, m => ' '.repeat(m.length));
  const leftoverRegex = /[A-Za-zÀ-ÖØ-öø-ÿ0-9][\s\S]*?(?=(?:\n\s*\n)|$)/g;
  let leftoverMatch;
  while (balanced && (leftoverMatch = leftoverRegex.exec(leftover)) !== null) {
    report(
      offset + leftoverMatch.index,
      'untyped-content-text',
      `Texte dans \\contenu{...} hors \\texte{} et des environnements question: "${summarizeChunk(leftoverMatch[0])}".`
    );
  }

  questions.forEach((question, rank) => {
    const where = `Question ${rank + 1}`;
    const answersRegex = /\\begin\s*\{answers\}([\s\S]*?)\\end\s*\{answers\}/dg;
    const answersBlocks = [...question.body.matchAll(answersRegex)];
    if (answersBlocks.length !== 1) {
      report(question.start, 'qcm-answers-block', `${where} : ${answersBlocks.length} bloc(s) answers, un seul attendu.`);
      return;
    }
    const answersBlock = answersBlocks[0];
    const answersBody = answersBlock[1];
    const answersStart = question.bodyStart + answersBlock.indices[1][0];
    const answersAt = question.bodyStart + answersBlock.index;

    const typeMatch = /\\qtype\s*\{([^}]*)\}/.exec(question.body);
    const type = typeMatch ? typeMatch[1].trim() : 'onetoall';
    if (!QCM_TYPES.includes(type)) {
      report(question.bodyStart + typeMatch.index, 'qcm-unknown-type', `${where} : \\qtype{${type}} non pris en charge (${QCM_TYPES.join(', ')}).`);
    }

    const answers = [];
    const answersMask = answersBody.split('');
    for (const call of findCommandCalls(answersBody, new Set(['good', 'bad']))) {
      if (call.malformed) {
        report(answersStart + call.start, 'malformed-command', `La commande \\${call.name}{...} n'est pas fermée correctement.`);
        blankRange(answersMask, call.start, answersBody.length);
        continue;
      }
      answers.push({ ...call, correct: call.name === 'good' });
      blankRange(answersMask, call.start, call.end);
    }
    // Une ponctuation après \good{...} (fréquente dans l'import exo7) est
    // perdue sans dommage ; un mot ou une formule, non.
    const strayText = leftoverText(answersMask.join(''));
    if (/[A-Za-zÀ-ÖØ-öø-ÿ0-9$\\]/.test(strayText)) {
      report(answersAt, 'qcm-text-in-answers', `${where} : texte dans answers hors \\good{} et \\bad{}: "${summarizeChunk(strayText)}".`);
    }

    for (const answer of answers) {
      const text = answer.body.replace(/\\feedback\s*\{[\s\S]*\}/, '').trim();
      if (!text) report(answersStart + answer.start, 'qcm-empty-answer', `${where} : réponse \\${answer.name}{} vide.`);
    }

    const good = answers.filter(answer => answer.correct).length;
    if (answers.length < 2) {
      report(answersAt, 'qcm-too-few-answers', `${where} : ${answers.length} réponse(s), au moins deux attendues.`);
    }
    if (good === 0 && type !== 'zerotoall') {
      report(answersAt, 'qcm-no-correct-answer', `${where} : aucune réponse \\good{} (ajouter \\qtype{zerotoall} si c'est voulu).`);
    }
    if ((type === 'onlyone' || type === 'truefalse') && good !== 1) {
      report(answersAt, 'qcm-type-mismatch', `${where} : \\qtype{${type}} avec ${good} réponses \\good{}, une seule attendue.`);
    }

    const stem = question.body
      .slice(0, answersBlock.index)
      .replace(/\\q(?:tags|classification|type|id|num|author|tolerance)\s*\{[^}]*\}/g, '')
      .replace(/\\q(?:keeporder|oneline|multicols|idontknow)\b/g, '');
    if (!leftoverText(stem)) report(question.start, 'qcm-empty-stem', `${where} : énoncé vide.`);

    const afterIndex = answersBlock.index + answersBlock[0].length;
    const after = question.body
      .slice(afterIndex)
      .replace(/\\begin\s*\{explanations\}[\s\S]*?\\end\s*\{explanations\}/g, '');
    const afterText = leftoverText(after);
    if (afterText) {
      report(question.bodyStart + afterIndex, 'qcm-text-after-answers', `${where} : texte après les réponses, hors explanations: "${summarizeChunk(afterText)}".`);
    }
  });

  return issues;
}

export function validateSource(source, filePath = '<source>') {
  if (isQcmSource(source, filePath)) return validateQcmSource(source, filePath);

  const issues = [];
  const cleanSource = stripCommentsPreserveLength(source);
  const topLevelCalls = findCommandCalls(cleanSource, TOP_LEVEL_COMMANDS);
  const contenuCalls = topLevelCalls.filter(call => call.name === 'contenu');
  const contentCalls = findCommandCalls(cleanSource, CONTENT_COMMANDS);
  const contenuRanges = contenuCalls.map(call => ({ start: call.bodyStart, end: call.bodyEnd }));
  const questionCalls = contentCalls.filter(call => call.name === 'question' && isInsideRange(call.start, contenuRanges));

  if (contenuCalls.length === 0) {
    addIssue(issues, source, filePath, 0, 'missing-contenu', 'Le fichier doit contenir un bloc \\contenu{...}.');
  }

  if (questionCalls.length === 0) {
    addIssue(issues, source, filePath, 0, 'missing-question', 'Le contenu doit contenir au moins une \\question{...}.');
  }

  for (const call of topLevelCalls) {
    if (call.malformed) {
      addIssue(issues, source, filePath, call.start, 'malformed-command', `La commande \\${call.name}{...} n'est pas fermée correctement.`);
    }
  }

  for (const call of contentCalls) {
    if (call.malformed) {
      addIssue(issues, source, filePath, call.start, 'malformed-command', `La commande \\${call.name}{...} n'est pas fermée correctement.`);
    }
    if (!isInsideRange(call.start, contenuRanges)) {
      addIssue(issues, source, filePath, call.start, 'content-outside-contenu', `La commande \\${call.name}{...} doit être dans \\contenu{...}.`);
    }
    if (call.name === 'indication' && call.body.trim() === '') {
      addIssue(issues, source, filePath, call.start, 'empty-indication', 'La commande \\indication{...} ne doit pas être vide.');
    }
  }

  reportTextOutsideContenu(issues, source, filePath, cleanSource, topLevelCalls);

  for (const contenuCall of contenuCalls) {
    const typedCallsInContenu = contentCalls.filter(call => call.start >= contenuCall.bodyStart && call.end <= contenuCall.bodyEnd);
    const rawChunks = findRawTextChunks(cleanSource.slice(contenuCall.bodyStart, contenuCall.bodyEnd), contenuCall.bodyStart, typedCallsInContenu);

    for (const chunk of rawChunks) {
      addIssue(
        issues,
        source,
        filePath,
        chunk.index,
        'untyped-content-text',
        `Texte dans \\contenu{...} hors \\texte{}, \\question{}, \\indication{} ou \\reponse{}: "${chunk.text}".`
      );
    }

    if (questionCalls.length === 1) {
      for (const block of findEnumerateBlocks(cleanSource.slice(contenuCall.bodyStart, contenuCall.bodyEnd))) {
        if (countTopLevelItems(block.body) === 1) {
          addIssue(
            issues,
            source,
            filePath,
            contenuCall.bodyStart + block.start,
            'single-item-enumerate',
            'Un exercice avec une seule question ne doit pas contenir un environnement enumerate avec un seul \\item.'
          );
        }
      }
    }
  }

  return issues;
}

async function main() {
  const args = process.argv.slice(2);
  let inputArg = null;
  let maxErrors = DEFAULT_MAX_ERRORS;
  let csvOutput = null;
  let showWarnings = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--warnings') {
      showWarnings = true;
    } else if (arg === '--max-errors') {
      maxErrors = Number.parseInt(args[++i], 10);
    } else if (arg.startsWith('--max-errors=')) {
      maxErrors = Number.parseInt(arg.slice('--max-errors='.length), 10);
    } else if (arg === '--csv') {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        csvOutput = nextArg;
        i++;
      } else {
        csvOutput = `reports/tex-quality-issues-${reportDateString()}.csv`;
      }
    } else if (arg.startsWith('--csv=')) {
      csvOutput = arg.slice('--csv='.length);
    } else if (!arg.startsWith('--') && !inputArg) {
      inputArg = arg;
    }
  }

  if (!Number.isFinite(maxErrors) || maxErrors < 0) maxErrors = DEFAULT_MAX_ERRORS;

  // Sans argument : les exercices et les qcm. Les deux partagent l'espace des
  // UUID (listes mixtes), d'où un seul registre pour le contrôle d'unicité.
  const registryRoots = [DEFAULT_INPUT, QCM_INPUT].filter(root => existsSync(root));
  const inputs = inputArg ? [path.resolve(inputArg)] : registryRoots;
  const files = (await Promise.all(inputs.map(listTexFiles))).flat().sort();
  const allIssues = [];
  const allWarnings = [];
  const sources = [];
  const validatedSources = [];

  for (const filePath of files) {
    const source = await fs.readFile(filePath, 'utf8');
    const relativePath = path.relative(ROOT, filePath);
    const entry = { source, filePath: relativePath, sourceFilePath: filePath };
    sources.push(entry);
    validatedSources.push(entry);
    allIssues.push(...validateSource(source, relativePath));
    allWarnings.push(...validateMathLayout(source, relativePath));
  }

  // Lorsqu'une partie seulement des exercices ou des qcm est contrôlée, elle
  // doit tout de même être comparée au registre complet pour éviter une
  // collision à l'ajout. Les autres fichiers ne reçoivent pas d'erreur dans ce
  // mode ciblé.
  const isInside = (root, target) => {
    const relative = path.relative(root, target);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  };
  if (inputArg && registryRoots.some(root => isInside(root, inputs[0]))) {
    const knownPaths = new Set(files.map(filePath => path.resolve(filePath)));
    const registryFiles = (await Promise.all(registryRoots.map(listTexFiles))).flat().sort();
    for (const filePath of registryFiles) {
      if (knownPaths.has(path.resolve(filePath))) continue;
      sources.push({
        source: await fs.readFile(filePath, 'utf8'),
        filePath: path.relative(ROOT, filePath),
        sourceFilePath: filePath
      });
    }
  }

  const validatedPaths = new Set(files.map(filePath => path.relative(ROOT, filePath)));
  allIssues.push(...validateUuidUniqueness(sources).filter(issue => validatedPaths.has(issue.filePath)));
  allIssues.push(...await validateImageReferences(validatedSources));
  allIssues.push(...validateCpgeReferences(validatedSources, { nodeIds: await loadCpgeNodeIds() }));

  if (csvOutput) {
    const outputPath = path.resolve(csvOutput);
    await writeIssuesCsv(allIssues, outputPath);
    console.error(`Rapport CSV écrit: ${path.relative(ROOT, outputPath)}`);
  }

  // Les avertissements ne changent pas le code de sortie : on les résume, ou on
  // les détaille avec --warnings.
  const reportWarnings = () => {
    if (allWarnings.length === 0) return;
    if (showWarnings) {
      for (const warning of allWarnings) {
        console.error(`${warning.filePath}:${warning.line}:${warning.column} [${warning.code}] ${warning.message}`);
      }
    }
    const fixable = allWarnings.filter(warning => warning.fixable).length;
    const withOption = allWarnings.filter(warning => warning.fixableWithOption).length;
    console.error(`${allWarnings.length} avertissement(s) de mise en page des formules dans ${new Set(allWarnings.map(w => w.filePath)).size} fichier(s)`
      + ` (${fixable} corrigeable(s) par fix:tex:det${withOption ? `, ${withOption} de plus avec --left-right` : ''})${showWarnings ? '' : ' ; --warnings pour le détail'}.`);
  };

  if (allIssues.length > 0) {
    const visibleIssues = allIssues.slice(0, maxErrors);
    for (const issue of visibleIssues) {
      console.error(`${issue.filePath}:${issue.line}:${issue.column} [${issue.code}] ${issue.message}`);
    }
    if (visibleIssues.length < allIssues.length) {
      if (maxErrors === 0) {
        console.error('... détails masqués par --max-errors=0.');
      } else {
        console.error(`... affichage limité aux ${visibleIssues.length} premiers problèmes. Utilisez --max-errors=0 pour seulement le résumé ou --max-errors=N pour ajuster.`);
      }
    }
    console.error(`\n${allIssues.length} problème(s) détecté(s) dans ${files.length} fichier(s) LaTeX.`);
    reportWarnings();
    process.exitCode = 1;
    return;
  }

  console.log(`Sources LaTeX OK (${files.length} fichier(s) vérifié(s)).`);
  reportWarnings();
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
