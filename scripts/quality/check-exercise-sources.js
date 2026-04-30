#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const DEFAULT_INPUT = path.join(ROOT, 'content/exercises');
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
  'module',
  'exo7id',
  'isIndication',
  'isCorrection',
  'contenu'
]);

const CONTENT_COMMANDS = new Set(['texte', 'question', 'indication', 'reponse']);

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

function summarizeChunk(chunk) {
  return chunk.replace(/\s+/g, ' ').trim().slice(0, 90);
}

function findRawTextChunks(source, baseOffset, typedCommandCalls) {
  const chars = source.split('');

  for (const call of typedCommandCalls) {
    blankRange(chars, call.start - baseOffset, call.end - baseOffset);
  }

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

export function validateSource(source, filePath = '<source>') {
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

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--max-errors') {
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

  const input = path.resolve(inputArg || DEFAULT_INPUT);
  const files = (await listTexFiles(input)).sort();
  const allIssues = [];

  for (const filePath of files) {
    const source = await fs.readFile(filePath, 'utf8');
    allIssues.push(...validateSource(source, path.relative(ROOT, filePath)));
  }

  if (csvOutput) {
    const outputPath = path.resolve(csvOutput);
    await writeIssuesCsv(allIssues, outputPath);
    console.error(`Rapport CSV écrit: ${path.relative(ROOT, outputPath)}`);
  }

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
    process.exitCode = 1;
    return;
  }

  console.log(`Sources LaTeX OK (${files.length} fichier(s) vérifié(s)).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
