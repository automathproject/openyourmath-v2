#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { validateSource } from './check-exercise-sources.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

dotenvConfig({ path: path.join(ROOT, '.env'), quiet: true });

const DEFAULT_PREVIEW_DIR = path.join(ROOT, 'reports/ollama-latex-fixes');
const DEFAULT_MAX_TOKENS = 12000;
let ollamaModule = null;

async function getOllamaModule() {
  if (!ollamaModule) {
    ollamaModule = await import('../../src/lib/ia/ollama.js');
  }
  return ollamaModule;
}

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(value);
      value = '';
    } else {
      value += char;
    }
  }

  values.push(value);
  return values;
}

export function parseQualityReport(csvContent) {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const row = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = values[i] ?? '';
    return {
      file: row.file,
      line: Number.parseInt(row.line, 10),
      column: Number.parseInt(row.column, 10),
      code: row.code,
      message: row.message
    };
  });
}

export function groupIssuesByFile(issues) {
  const groups = new Map();
  for (const issue of issues) {
    if (!groups.has(issue.file)) groups.set(issue.file, []);
    groups.get(issue.file).push(issue);
  }
  return groups;
}

function formatIssues(issues) {
  return issues
    .map(issue => `- ligne ${issue.line}, colonne ${issue.column}, code ${issue.code}: ${issue.message}`)
    .join('\n');
}

export function buildCorrectionPrompt({ filePath, source, issues }) {
  return String.raw`
Tu es un correcteur LaTeX pour le dépôt OpenYourMath.

Corrige uniquement les problèmes qualité listés pour le fichier suivant :
${filePath}

Problèmes à corriger :
${formatIssues(issues)}

Règles :
- Tout contenu pédagogique ou mathématique dans \contenu{...} doit être dans \texte{...}, \question{...}, \indication{...} ou \reponse{...}.
- \texte{...} est facultatif : utilise-le seulement pour du contexte ou de l'énoncé qui n'est ni une question, ni une indication, ni une réponse.
- Chaque exercice doit contenir au moins une \question{...}.
- Si une seule question est présente, supprime tout environnement enumerate qui ne contient qu'un seul \item.
- Supprime les commandes \indication{} vides.
- Ne modifie pas les métadonnées top-level : \uuid{}, \titre{}, \chapitre{}, \niveau{}, \module{}, \exo7id{}, \isIndication{}, \isCorrection{}, etc.
- Ne modifie pas les blocs SaveVerbatim.
- Ne corrige pas le style, l'orthographe ou les mathématiques sauf nécessité stricte pour appliquer ces règles.
- Préserve autant que possible l'ordre, les espaces et le contenu original.

Réponds uniquement avec un objet JSON valide, sans Markdown, au format :
{"corrected_latex":"CONTENU COMPLET DU FICHIER CORRIGE"}

Source complète à corriger :
<<<LATEX
${source}
LATEX
`.trim();
}

export function parseModelCorrection(responseText) {
  const trimmed = responseText.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(trimmed);
    const corrected = parsed.corrected_latex ?? parsed.correctedLatex ?? parsed.latex;
    if (typeof corrected === 'string' && corrected.trim() !== '') return corrected;
  } catch {
    // Fallback below.
  }

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    const corrected = parsed.corrected_latex ?? parsed.correctedLatex ?? parsed.latex;
    if (typeof corrected === 'string' && corrected.trim() !== '') return corrected;
  }

  throw new Error('Réponse Ollama invalide: JSON attendu avec la clé corrected_latex.');
}

export async function correctSourceWithChat({
  filePath,
  source,
  issues,
  chatFn = null,
  model = null,
  temperature = 0,
  maxTokens = DEFAULT_MAX_TOKENS
}) {
  const ollama = chatFn ? null : await getOllamaModule();
  const effectiveChatFn = chatFn ?? ollama.ollamaChat;
  const effectiveModel = model ?? ollama?.OLLAMA_MODELS.chat;
  const prompt = buildCorrectionPrompt({ filePath, source, issues });
  const response = await effectiveChatFn(prompt, { model: effectiveModel, temperature, maxTokens, jsonMode: true });
  return parseModelCorrection(response);
}

async function findDefaultReport() {
  const reportsDir = path.join(ROOT, 'reports');
  const fallback = path.join(reportsDir, 'tex-quality-issues.csv');

  try {
    const entries = await fs.readdir(reportsDir, { withFileTypes: true });
    const candidates = entries
      .filter(entry => entry.isFile() && /^tex-quality-issues(?:-\d{4}-\d{2}-\d{2})?\.csv$/.test(entry.name))
      .map(entry => path.join(reportsDir, entry.name));

    if (candidates.length === 0) return fallback;

    const stats = await Promise.all(candidates.map(async candidate => ({
      path: candidate,
      mtimeMs: (await fs.stat(candidate)).mtimeMs
    })));
    stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return stats[0].path;
  } catch {
    return fallback;
  }
}

function parseArgs(args) {
  const options = {
    apply: false,
    fileFilters: [],
    limit: null,
    report: null,
    previewDir: DEFAULT_PREVIEW_DIR,
    maxTokens: DEFAULT_MAX_TOKENS,
    temperature: 0
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--report') options.report = args[++i];
    else if (arg.startsWith('--report=')) options.report = arg.slice('--report='.length);
    else if (arg === '--file') options.fileFilters.push(args[++i]);
    else if (arg.startsWith('--file=')) options.fileFilters.push(arg.slice('--file='.length));
    else if (arg === '--limit') options.limit = Number.parseInt(args[++i], 10);
    else if (arg.startsWith('--limit=')) options.limit = Number.parseInt(arg.slice('--limit='.length), 10);
    else if (arg === '--preview-dir') options.previewDir = path.resolve(args[++i]);
    else if (arg.startsWith('--preview-dir=')) options.previewDir = path.resolve(arg.slice('--preview-dir='.length));
    else if (arg === '--max-tokens') options.maxTokens = Number.parseInt(args[++i], 10);
    else if (arg.startsWith('--max-tokens=')) options.maxTokens = Number.parseInt(arg.slice('--max-tokens='.length), 10);
    else if (arg === '--temperature') options.temperature = Number.parseFloat(args[++i]);
    else if (arg.startsWith('--temperature=')) options.temperature = Number.parseFloat(arg.slice('--temperature='.length));
  }

  if (!Number.isFinite(options.limit) || options.limit < 1) options.limit = null;
  if (!Number.isFinite(options.maxTokens) || options.maxTokens < 1000) options.maxTokens = DEFAULT_MAX_TOKENS;
  if (!Number.isFinite(options.temperature) || options.temperature < 0) options.temperature = 0;

  return options;
}

function selectGroups(groups, { fileFilters, limit }) {
  let entries = [...groups.entries()];

  if (fileFilters.length > 0) {
    const normalizedFilters = new Set(fileFilters.map(file => file.replace(/\\/g, '/')));
    entries = entries.filter(([file]) => normalizedFilters.has(file.replace(/\\/g, '/')));
  }

  if (limit) entries = entries.slice(0, limit);
  return entries;
}

async function writePreview(previewDir, filePath, correctedSource) {
  const outputPath = path.join(previewDir, filePath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, correctedSource, 'utf8');
  return outputPath;
}

async function processFile({ filePath, issues, options }) {
  const absolutePath = path.join(ROOT, filePath);
  const source = await fs.readFile(absolutePath, 'utf8');
  const beforeIssues = validateSource(source, filePath);
  const correctedSource = await correctSourceWithChat({
    filePath,
    source,
    issues,
    maxTokens: options.maxTokens,
    temperature: options.temperature
  });
  const afterIssues = validateSource(correctedSource, filePath);

  const improved = afterIssues.length < beforeIssues.length;
  const unchanged = correctedSource === source;

  if (!improved) {
    return {
      filePath,
      status: unchanged ? 'unchanged' : 'rejected',
      before: beforeIssues.length,
      after: afterIssues.length
    };
  }

  if (options.apply) {
    await fs.writeFile(absolutePath, correctedSource, 'utf8');
    return { filePath, status: 'applied', before: beforeIssues.length, after: afterIssues.length };
  }

  const previewPath = await writePreview(options.previewDir, filePath, correctedSource);
  return {
    filePath,
    status: 'preview',
    before: beforeIssues.length,
    after: afterIssues.length,
    previewPath: path.relative(ROOT, previewPath)
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const reportPath = path.resolve(options.report || await findDefaultReport());
  const { checkOllamaAvailable, OLLAMA_MODELS } = await getOllamaModule();

  const ollama = await checkOllamaAvailable();
  if (!ollama.available || !ollama.hasChat) {
    throw new Error(`Ollama indisponible ou modèle chat absent: OLLAMA_CHAT_MODEL=${OLLAMA_MODELS.chat}`);
  }

  const csv = await fs.readFile(reportPath, 'utf8');
  const issues = parseQualityReport(csv);
  const groups = groupIssuesByFile(issues);
  const selectedGroups = selectGroups(groups, options);

  if (selectedGroups.length === 0) {
    console.log('Aucun fichier à corriger pour les filtres fournis.');
    return;
  }

  console.log(`Rapport: ${path.relative(ROOT, reportPath)}`);
  console.log(`Modèle Ollama: ${OLLAMA_MODELS.chat}`);
  console.log(options.apply
    ? `Mode: application directe sur ${selectedGroups.length} fichier(s)`
    : `Mode: aperçu dans ${path.relative(ROOT, options.previewDir)} pour ${selectedGroups.length} fichier(s)`);

  let successCount = 0;
  for (const [filePath, fileIssues] of selectedGroups) {
    try {
      const result = await processFile({ filePath, issues: fileIssues, options });
      if (result.status === 'applied' || result.status === 'preview') successCount++;

      const detail = result.previewPath ? ` -> ${result.previewPath}` : '';
      console.log(`${result.status}: ${filePath} (${result.before} -> ${result.after})${detail}`);
    } catch (error) {
      console.error(`error: ${filePath}: ${error.message}`);
    }
  }

  if (successCount === 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
