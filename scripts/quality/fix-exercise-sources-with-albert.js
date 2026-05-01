#!/usr/bin/env node
/**
 * Correcteur des sources LaTeX via l'API Albert (Etalab).
 * Lit le rapport qualité CSV, regroupe les erreurs par fichier, envoie chaque
 * fichier + ses erreurs à Albert, valide la correction, puis l'applique ou
 * génère un aperçu.
 *
 * Prérequis :
 *   ALBERT_API_KEY dans l'environnement ou dans .env
 *
 * Usage :
 *   node scripts/quality/fix-exercise-sources-with-albert.js [options]
 *
 * Options :
 *   --apply                   Applique directement (défaut : aperçu)
 *   --report=<path>           Rapport CSV (défaut : plus récent dans reports/)
 *   --file=<path>             Filtre sur ce fichier (répétable)
 *   --limit=N                 Limite le nombre de fichiers traités
 *   --model=<id>              Modèle Albert (défaut : MODELS.chat)
 *   --max-tokens=N            Max tokens en sortie (défaut : 12000)
 *   --preview-dir=<path>      Dossier d'aperçu (défaut : reports/albert-latex-fixes)
 */

import { config as dotenvConfig } from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { chat, MODELS, withRetry, isQuotaExceeded } from '../../src/lib/ia/albert.js';
import { validateSource } from './check-exercise-sources.js';
import { parseQualityReport, groupIssuesByFile } from './fix-exercise-sources-with-ollama.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

dotenvConfig({ path: path.join(ROOT, '.env'), quiet: true });

const DEFAULT_MODEL = MODELS.chat;
const DEFAULT_MAX_TOKENS = 6000;
const DEFAULT_PREVIEW_DIR = path.join(ROOT, 'reports/albert-latex-fixes');

const DELIMITER = '<<<LATEX_CORRIGE';
const DELIMITER_END = 'LATEX_CORRIGE>>>';

function buildPrompt({ filePath, source, issues }) {
  const issueLines = issues
    .map(i => `- ligne ${i.line}, colonne ${i.column}, code ${i.code}: ${i.message}`)
    .join('\n');

  return String.raw`Tu es un correcteur LaTeX pour le dépôt OpenYourMath.

Corrige uniquement les problèmes qualité listés pour le fichier suivant :
${filePath}

Problèmes à corriger :
${issueLines}

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

Réponds en plaçant le fichier corrigé complet entre les délimiteurs suivants, sans rien ajouter avant ou après :
${DELIMITER}
CONTENU COMPLET DU FICHIER CORRIGE
${DELIMITER_END}

Source complète à corriger :
<<<LATEX
${source}
LATEX`.trim();
}

function parseAlbertResponse(responseText) {
  const start = responseText.indexOf(DELIMITER);
  if (start === -1) throw new Error(`Délimiteur "${DELIMITER}" absent de la réponse.`);
  const contentStart = start + DELIMITER.length;
  const end = responseText.indexOf(DELIMITER_END, contentStart);
  if (end === -1) throw new Error(`Délimiteur fermant "${DELIMITER_END}" absent de la réponse.`);
  const corrected = responseText.slice(contentStart, end).replace(/^\n/, '').replace(/\n$/, '');
  if (!corrected.trim()) throw new Error('Contenu corrigé vide entre les délimiteurs.');
  return corrected;
}

async function correctSourceWithAlbert({ filePath, source, issues, model, maxTokens }) {
  const prompt = buildPrompt({ filePath, source, issues });
  const response = await chat(prompt, { model, temperature: 0, maxTokens, jsonMode: false });
  return parseAlbertResponse(response);
}

async function findDefaultReport() {
  const reportsDir = path.join(ROOT, 'reports');
  const fallback = path.join(reportsDir, 'tex-quality-issues.csv');

  try {
    const entries = await fs.readdir(reportsDir, { withFileTypes: true });
    const candidates = entries
      .filter(e => e.isFile() && /^tex-quality-issues(?:-\d{4}-\d{2}-\d{2})?\.csv$/.test(e.name))
      .map(e => path.join(reportsDir, e.name));

    if (candidates.length === 0) return fallback;

    const stats = await Promise.all(candidates.map(async p => ({
      path: p, mtimeMs: (await fs.stat(p)).mtimeMs
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
    model: DEFAULT_MODEL,
    maxTokens: DEFAULT_MAX_TOKENS,
    previewDir: DEFAULT_PREVIEW_DIR
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
    else if (arg === '--model') options.model = args[++i];
    else if (arg.startsWith('--model=')) options.model = arg.slice('--model='.length);
    else if (arg === '--max-tokens') options.maxTokens = Number.parseInt(args[++i], 10);
    else if (arg.startsWith('--max-tokens=')) options.maxTokens = Number.parseInt(arg.slice('--max-tokens='.length), 10);
    else if (arg === '--preview-dir') options.previewDir = path.resolve(args[++i]);
    else if (arg.startsWith('--preview-dir=')) options.previewDir = path.resolve(arg.slice('--preview-dir='.length));
  }

  if (!Number.isFinite(options.limit) || options.limit < 1) options.limit = null;
  if (!Number.isFinite(options.maxTokens) || options.maxTokens < 1000) options.maxTokens = DEFAULT_MAX_TOKENS;
  return options;
}

function selectGroups(groups, { fileFilters, limit }) {
  let entries = [...groups.entries()];

  if (fileFilters.length > 0) {
    const normalized = new Set(fileFilters.map(f => f.replace(/\\/g, '/')));
    entries = entries.filter(([file]) => normalized.has(file.replace(/\\/g, '/')));
  }

  if (limit) entries = entries.slice(0, limit);
  return entries;
}

async function processFile({ filePath, issues, options }) {
  const absolutePath = path.join(ROOT, filePath);
  const source = await fs.readFile(absolutePath, 'utf8');
  const beforeCount = validateSource(source, filePath).length;

  const corrected = await withRetry(
    () => correctSourceWithAlbert({
      filePath,
      source,
      issues,
      model: options.model,
      maxTokens: options.maxTokens
    }),
    { maxAttempts: 3, delayMs: 2000 }
  );

  const afterCount = validateSource(corrected, filePath).length;

  if (corrected === source) return { filePath, status: 'unchanged', before: beforeCount, after: afterCount };
  if (afterCount >= beforeCount) return { filePath, status: 'rejected', before: beforeCount, after: afterCount };

  if (options.apply) {
    await fs.writeFile(absolutePath, corrected, 'utf8');
    return { filePath, status: 'applied', before: beforeCount, after: afterCount };
  }

  const previewPath = path.join(options.previewDir, filePath);
  await fs.mkdir(path.dirname(previewPath), { recursive: true });
  await fs.writeFile(previewPath, corrected, 'utf8');
  return {
    filePath,
    status: 'preview',
    before: beforeCount,
    after: afterCount,
    previewPath: path.relative(ROOT, previewPath)
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!process.env.ALBERT_API_KEY) {
    console.error('Erreur : ALBERT_API_KEY non défini. Ajoutez-le dans .env ou dans l\'environnement.');
    process.exitCode = 1;
    return;
  }

  const reportPath = path.resolve(options.report || await findDefaultReport());
  const csv = await fs.readFile(reportPath, 'utf8');
  const issues = parseQualityReport(csv);
  const groups = groupIssuesByFile(issues);
  const selected = selectGroups(groups, options);

  if (selected.length === 0) {
    console.log('Aucun fichier à corriger pour les filtres fournis.');
    return;
  }

  console.log(`Rapport: ${path.relative(ROOT, reportPath)}`);
  console.log(`Modèle: ${options.model}`);
  console.log(options.apply
    ? `Mode: application directe sur ${selected.length} fichier(s)`
    : `Mode: aperçu dans ${path.relative(ROOT, options.previewDir)} pour ${selected.length} fichier(s)`);

  let successCount = 0;
  const total = selected.length;

  for (let i = 0; i < total; i++) {
    const [filePath, fileIssues] = selected[i];
    const prefix = `[${i + 1}/${total}] ${filePath}`;
    const startMs = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      process.stdout.write(`\r${prefix} … ${elapsed}s`);
    }, 1000);
    process.stdout.write(`${prefix} … 0s`);

    try {
      const result = await processFile({ filePath, issues: fileIssues, options });
      clearInterval(timer);
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      const detail = result.previewPath ? ` -> ${result.previewPath}` : '';
      process.stdout.write(`\r${result.status}: ${filePath} (${result.before} -> ${result.after})${detail} [${elapsed}s]\n`);
      if (result.status === 'applied' || result.status === 'preview') successCount++;
    } catch (error) {
      clearInterval(timer);
      process.stdout.write('\n');
      if (isQuotaExceeded(error)) {
        console.error(`Quota journalier Albert dépassé. Arrêt.`);
        break;
      }
      console.error(`error: ${filePath}: ${error.message}`);
    }
  }

  console.log(`\n${successCount}/${selected.length} fichier(s) corrigé(s).`);
  if (successCount === 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
