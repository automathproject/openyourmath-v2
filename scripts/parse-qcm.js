#!/usr/bin/env node
// scripts/parse-qcm.js
// Contenus qcm : content/qcm/**/*.tex → cache/qcm/**/*.json.
//
// Un qcm entre dans le site comme un exercice dont les questions portent des
// réponses à cocher. Son JSON a la forme de celui d'un exercice, avec
// content_type: 'qcm' ; chaque question est un bloc « question » enrichi d'un
// champ `qcm` (énoncé, réponses, corrigé), suivi d'un bloc « reponse ». Ce
// qui ne connaît pas les qcm (recherche, export LaTeX, aperçus) les lit donc
// comme une question et sa correction ; ce qui les connaît lit `qcm` et les
// rend interactifs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { convertLaTeXToHTML, wrapAlignWithDollar } from './utils/tex2html-utils.js';
import { extractIncludegraphicsImages } from './utils/image-artifacts.js';
import { getPreview } from './utils/previewUtils.js';
import {
  ARTIFACTS_ROOT,
  CONTENT_ROOT,
  QCM_CACHE_ROOT,
  QCM_ROOT,
  normalizeContentRelativePath,
  toPosixPath,
} from './utils/content-paths.js';
import { choiceLetter, correctLetters, licenseUrl, parseQcmSource } from '../src/lib/qcm/source.js';

const fsPromises = fs.promises;

/** À incrémenter quand la forme du JSON change : le cache est alors refait. */
export const QCM_PARSER_VERSION = 1;
const FRAGMENT_MARK = 'OYMQCMFRAGMENTMARK';
const IMAGES_PUBLIC_BASE_PATH = '/artifacts/images';

/**
 * Prépare un fragment de exo7qcm pour pandoc : les commandes de mise en page
 * papier disparaissent, celles que KaTeX ignore prennent une forme équivalente.
 */
export function prepareFragment(latex) {
  return wrapAlignWithDollar(
    String(latex ?? '')
      .replace(/\\vskip\s*-?[\d.]+\s*[a-z]{2}/g, '')
      .replace(/\\(?:small|med|big)skip\b/g, '')
      .replace(/\\vspace\*?\{[^{}]*\}/g, '')
      .replace(/\\noindent\b/g, '')
      .replace(/\\centerline\s*\{/g, '{')
      // \makebox[1.5cm][c]{ et } : un mot espacé au milieu d'une formule.
      .replace(/\\makebox\s*(?:\[[^\]]*\]){0,2}\s*\{([^{}]*)\}/g, (_, word) => `\\quad\\text{${word.trim()}}\\quad `)
      .replace(/\\mbox\s*\{/g, '\\text{')
      // Numéro d'équation de TeX, inconnu de KaTeX : l'étiquette suit la formule.
      .replace(/\\l?eqno\b\s*/g, '\\qquad ')
      .replace(/\\qimage\b/g, '\\includegraphics'),
  );
}

/** Un seul appel à pandoc pour tous les fragments d'un contenu. */
async function convertFragments(fragments) {
  const filled = fragments.map((fragment) => fragment.trim());
  if (filled.every((fragment) => fragment === '')) return filled;
  const joined = filled.map((fragment) => fragment || 'OYMQCMEMPTY').join(`\n\n${FRAGMENT_MARK}\n\n`);
  const html = await convertLaTeXToHTML(joined);
  const parts = html.split(new RegExp(`<p>\\s*${FRAGMENT_MARK}\\s*</p>`));
  if (parts.length === filled.length) {
    return parts.map((part) => (part.includes('OYMQCMEMPTY') ? '' : part.trim()));
  }
  // Un fragment a débordé sur son voisin (environnement mal fermé) : un par un.
  const single = [];
  for (const fragment of filled) single.push(fragment ? (await convertLaTeXToHTML(fragment)).trim() : '');
  return single;
}

/** Retire le <p> qui enveloppe un fragment d'un seul paragraphe. */
function unwrapParagraph(html) {
  const match = /^<p>([\s\S]*)<\/p>$/.exec(html.trim());
  return match && !match[1].includes('<p>') ? match[1] : html;
}

/** Réponses d'une question, en liste LaTeX à cocher, pour l'export papier. */
function answersLatex(answers) {
  const items = answers.map((answer, index) => `  \\item[$\\square$ \\textbf{${choiceLetter(index)}.}] ${answer.latex}`);
  return `\\begin{itemize}\n${items.join('\n')}\n\\end{itemize}`;
}

export async function parseQcmFile(filePath, { qcmRoot = QCM_ROOT, contentRoot = CONTENT_ROOT, artifactsRoot = ARTIFACTS_ROOT, logger = null } = {}) {
  const latex = await fsPromises.readFile(filePath, 'utf8');
  const sourceHash = crypto.createHash('sha256').update(latex).digest('hex');
  const sourcePath = normalizeContentRelativePath(toPosixPath(path.relative(qcmRoot, filePath)));
  const sourceName = sourcePath.split('/')[0];
  const parsed = parseQcmSource(latex);
  if (parsed.errors.length) throw new Error(parsed.errors.join(' ; '));
  const { meta } = parsed;
  if (!meta.uuid) throw new Error('\\uuid{} absent');

  // Images : les \qimage sont publiées comme les \includegraphics des exercices.
  // La recherche d'image part du dossier de la source, comme pour un exercice.
  let imageReplacements = new Map();
  let images = [];
  const prepared = prepareFragment(latex);
  if (prepared.includes('\\includegraphics')) {
    const result = await extractIncludegraphicsImages({
      latexContent: prepared,
      exerciseUuid: meta.uuid,
      sourceFilePath: path.join(contentRoot, 'exercises', sourceName, `${meta.uuid}.tex`),
      contentRoot,
      artifactsRoot,
      publicBasePath: IMAGES_PUBLIC_BASE_PATH,
      logger,
    });
    imageReplacements = result.replacements;
    images = result.images;
  }
  const imagePlaceholders = new Map();
  const withImagePlaceholders = (fragment) => {
    let output = prepareFragment(fragment);
    for (const [original, tag] of imageReplacements) {
      if (!output.includes(original)) continue;
      const placeholder = `OYMQCMIMG${imagePlaceholders.size}X`;
      imagePlaceholders.set(placeholder, `<p class="qcm-figure">${tag}</p>`);
      output = output.split(original).join(`\n\n${placeholder}\n\n`);
    }
    return output;
  };
  const restoreImages = (html) => {
    let output = html;
    for (const [placeholder, tag] of imagePlaceholders) {
      output = output.replace(new RegExp(`<p>\\s*${placeholder}\\s*</p>`, 'g'), tag).split(placeholder).join(tag);
    }
    return output;
  };

  // Tous les fragments du contenu passent ensemble par pandoc.
  const fragments = [parsed.context];
  for (const question of parsed.questions) {
    fragments.push(question.stem, question.explanation);
    for (const answer of question.answers) fragments.push(answer.latex, answer.feedback);
  }
  const converted = (await convertFragments(fragments.map(withImagePlaceholders))).map(restoreImages);
  let cursor = 0;
  const next = () => converted[cursor++];

  const content = [];
  let order = 0;
  const push = (block) => content.push({ id: `block_${++order}`, ...block, order });

  const contextHtml = next();
  if (parsed.context) push({ type: 'text', latex: parsed.context, html: contextHtml });

  let firstStemHtml = '';
  for (const question of parsed.questions) {
    const stemHtml = next();
    const explanationHtml = next();
    const choices = question.answers.map((answer) => {
      const html = unwrapParagraph(next());
      const feedbackHtml = unwrapParagraph(next());
      return { html, correct: answer.correct, ...(feedbackHtml && { feedback_html: feedbackHtml }) };
    });
    firstStemHtml ||= stemHtml;

    const letters = correctLetters(question.answers);
    const staticChoices = choices
      .map((choice, index) => `<li><span class="qcm-lettre">${choiceLetter(index)}.</span> ${choice.html}</li>`)
      .join('');
    push({
      type: 'question',
      latex: `${question.stem}\n${answersLatex(question.answers)}`.trim().replace(/\\qimage\b/g, '\\includegraphics'),
      html: `${stemHtml}<ul class="qcm-choix">${staticChoices}</ul>`,
      qcm: {
        type: question.type,
        keepOrder: question.keepOrder,
        stem_html: stemHtml,
        choices,
        explanation_html: explanationHtml,
        source: question.source,
      },
    });
    push({
      type: 'reponse',
      latex: `\\textbf{Réponses justes :} ${letters}.${question.explanation ? `\n\n${question.explanation}` : ''}`,
      html: `<p><strong>Réponses justes : ${letters}.</strong></p>${explanationHtml}`,
      qcmAnswer: true,
    });
  }

  const difficulty = Number.parseInt(meta.difficulty, 10);
  const mainData = {
    uuid: meta.uuid,
    content_type: 'qcm',
    title: meta.title || '',
    chapter: meta.chapter || '',
    subchapter: meta.subchapter || '',
    theme: (meta.theme || '').split(',').map((word) => word.trim()).filter(Boolean).join(', '),
    level: meta.level || '',
    difficulty: Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 5 ? difficulty : null,
    module: meta.module || '',
    author: meta.author || '',
    organization: meta.organization || '',
    ...(meta.license_code && { license_code: meta.license_code, license_url: licenseUrl(meta.license_code) }),
    video_id: '',
    created_at: meta.created_at || '',
    updated_at: new Date().toISOString(),
    preview: getPreview(contextHtml || firstStemHtml),
    question_count: parsed.questions.length,
    ordered: parsed.ordered,
    content,
    artifacts: { tikz: [], images: images.map((image) => image.id), geogebra: [], code: [], video: null },
    source_path: sourcePath,
    source_hash: sourceHash,
    parser_version: QCM_PARSER_VERSION,
  };

  return { mainData, artifactsData: { tikz: [], images, code: [] } };
}

async function listTexFiles(directory) {
  const entries = await fsPromises.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listTexFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.tex')) files.push(fullPath);
  }
  return files.sort();
}

async function isUpToDate(sourceFile, cacheFile) {
  try {
    const [source, cached] = await Promise.all([
      fsPromises.readFile(sourceFile),
      fsPromises.readFile(cacheFile, 'utf8'),
    ]);
    const data = JSON.parse(cached);
    return data.parser_version === QCM_PARSER_VERSION
      && data.source_hash === crypto.createHash('sha256').update(source).digest('hex');
  } catch {
    return false;
  }
}

async function removeStale(cacheRoot, expected) {
  let removed = 0;
  async function scan(directory) {
    let entries;
    try {
      entries = await fsPromises.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await scan(fullPath);
      else if (entry.name.endsWith('.json') && !expected.has(fullPath)) {
        await fsPromises.rm(fullPath);
        removed++;
      }
    }
  }
  await scan(cacheRoot);
  return removed;
}

async function main() {
  const args = process.argv.slice(2);
  const incremental = args.includes('--incremental');
  const stats = { processed: 0, skipped: 0, errors: 0 };

  console.log('🚀 OpenYourMath V2 - QCM vers JSON');
  console.log(`📁 Entrée : ${QCM_ROOT}`);
  console.log(`📁 Sortie : ${QCM_CACHE_ROOT}`);

  if (!fs.existsSync(QCM_ROOT)) {
    console.log('ℹ️  Aucun contenu qcm (content/qcm/ absent).');
    return;
  }

  const files = await listTexFiles(QCM_ROOT);
  const expected = new Set();
  for (const file of files) {
    const relative = path.relative(QCM_ROOT, file).replace(/\.tex$/, '.json');
    const cacheFile = path.join(QCM_CACHE_ROOT, relative);
    expected.add(cacheFile);
    if (incremental && await isUpToDate(file, cacheFile)) {
      stats.skipped++;
      continue;
    }
    try {
      const { mainData, artifactsData } = await parseQcmFile(file);
      await fsPromises.mkdir(path.dirname(cacheFile), { recursive: true });
      await fsPromises.writeFile(cacheFile, JSON.stringify(mainData, null, 2), 'utf8');
      if (artifactsData.images.length > 0) {
        await fsPromises.mkdir(ARTIFACTS_ROOT, { recursive: true });
        await fsPromises.writeFile(
          path.join(ARTIFACTS_ROOT, `${mainData.uuid}.json`),
          JSON.stringify(artifactsData, null, 2),
          'utf8',
        );
      }
      stats.processed++;
      if (stats.processed % 100 === 0) console.log(`📄 ${stats.processed} qcm convertis…`);
    } catch (error) {
      stats.errors++;
      console.error(`❌ ${path.relative(QCM_ROOT, file)} : ${error.message}`);
    }
  }

  const removed = await removeStale(QCM_CACHE_ROOT, expected);
  console.log('\n📊 Bilan :');
  console.log(`✅ Convertis : ${stats.processed}`);
  console.log(`⏭️  Inchangés : ${stats.skipped}`);
  if (removed) console.log(`🧹 Retirés du cache : ${removed}`);
  console.log(`❌ Erreurs   : ${stats.errors}`);
  if (stats.errors > 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Erreur inattendue :', error);
    process.exit(1);
  });
}
