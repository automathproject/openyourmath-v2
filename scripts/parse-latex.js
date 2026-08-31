// scripts/parse-latex.js
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { 
  preprocessLatex, 
  stripComments, 
  wrapAlignWithDollar, 
  isCommandCommented, 
  convertLaTeXToHTML 
} from './utils/tex2html-utils.js';

import {
  extractSaveVerbatimBlocks,
  replaceBUseVerbatimWithPlaceholders,
  restoreCodeBlocksFromPlaceholders,
  convertCodeToHTML
} from './utils/code2html-utils.js';

import { extractIncludegraphicsImages } from './utils/image-artifacts.js';
import { CacheManager } from './utils/cache-manager.js';
import { generatePreview } from './utils/previewUtils.js';
import {
  ARTIFACTS_ROOT,
  CONTENT_ROOT,
  EXERCISES_ROOT,
  getExerciseSourcePath
} from './utils/content-paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fsPromises = fs.promises;

// Chemins de sortie
const TIKZ_ASSETS_PUBLIC_PATH = '/artifacts/tikz';
const ARTIFACTS_OUTPUT_DIR = ARTIFACTS_ROOT;
const CONTENT_ROOT_DIR = CONTENT_ROOT;
const IMAGES_PUBLIC_BASE_PATH = '/artifacts/images';

async function extractExternalPythonCode(latexContent, sourceFilePath) {
  const sourcePath = getExerciseSourcePath(sourceFilePath, EXERCISES_ROOT);
  const sourceName = sourcePath.split('/').filter(Boolean)[0];
  const blocks = new Map();
  const pythonCodeRegex = /\\pythoncode(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let match;

  while ((match = pythonCodeRegex.exec(latexContent)) !== null) {
    const filename = match[1].trim();
    if (filename !== path.basename(filename)) {
      console.warn(`Ignoring unsafe Python source path "${filename}" in ${sourceFilePath}.`);
      continue;
    }
    if (blocks.has(filename)) continue;

    const codePath = path.join(CONTENT_ROOT_DIR, 'code', sourceName, 'python', filename);
    try {
      const content = await fsPromises.readFile(codePath, 'utf8');
      blocks.set(filename, {
        name: filename,
        content,
        language: 'python',
        source_path: path.relative(CONTENT_ROOT_DIR, codePath)
      });
    } catch (error) {
      if (error.code === 'ENOENT') console.warn(`Python source not found for ${sourcePath}: ${filename}`);
      else throw error;
    }
  }

  return blocks;
}

const CONFIG = {
  content: {
    inputDir: EXERCISES_ROOT,
    cacheDir: path.resolve(__dirname, '../cache/exercises')
  },
  commands: [
    { name: 'uuid', jsonKey: 'uuid', isContent: false },
    { name: 'titre', jsonKey: 'title', isContent: false },
    { name: 'chapitre', jsonKey: 'chapter', isContent: false },
    { name: 'sousChapitre', jsonKey: 'subchapter', isContent: false },
    { name: 'theme', jsonKey: 'theme', isContent: false },
    { name: 'auteur', jsonKey: 'author', isContent: false },
    { name: 'organisation', jsonKey: 'organization', isContent: false },
    { name: 'video', jsonKey: 'video_id', isContent: false },
    { name: 'datecreate', jsonKey: 'created_at', isContent: false },
    { name: 'niveau', jsonKey: 'level', isContent: false },
    { name: 'difficulte', jsonKey: 'difficulty', isContent: false },
    { name: 'module', jsonKey: 'module', isContent: false },
    { name: 'texte', jsonKey: 'content', isContent: true, blockType: 'text' },
    { name: 'question', jsonKey: 'content', isContent: true, blockType: 'question' },
    { name: 'indication', jsonKey: 'content', isContent: true, blockType: 'indication' },
    { name: 'reponse', jsonKey: 'content', isContent: true, blockType: 'reponse' },
    { name: 'code', jsonKey: 'content', isContent: true, blockType: 'code', isVerbatim: true },
    { name: 'pythoncode', jsonKey: 'content', isContent: true, blockType: 'code' }
  ]
};

function generateShortUuid() {
  return crypto.randomBytes(3).toString('base64url');
}

async function calculateFileHash(filePath) {
  const content = await fsPromises.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function validateDifficulty(value) {
  if (!value || value.trim() === '') {
    return null;
  }
  
  const parsed = parseInt(value.trim(), 10);
  if (isNaN(parsed) || parsed < 1 || parsed > 5) {
    console.warn(`Invalid difficulty value: "${value}". Expected integer between 1 and 5.`);
    return null;
  }
  
  return parsed;
}

function generateExercisePreview(content) {
  return generatePreview({ content });
}
/**
 * MODIFIÉ : Parsing avec support des images \includegraphics
 */
async function parseLatexFile(filePath) {
  const latexContent = await fsPromises.readFile(filePath, 'utf8');
  const fileHash = await calculateFileHash(filePath);
  const sourcePath = getExerciseSourcePath(filePath, CONFIG.content.inputDir);
  
  const mainData = {
    uuid: "",
    title: "",
    chapter: "",
    subchapter: "",
    theme: "",
    level: "",
    difficulty: null,
    module: "",
    author: "",
    organization: "",
    video_id: "",
    created_at: "",
    updated_at: new Date().toISOString(),
    preview: "",
    content: [],
    artifacts: { 
      tikz: [], 
      images: [],
      geogebra: [], 
      code: [], 
      video: null 
    },
    source_path: sourcePath,
    source_hash: fileHash
  };

  const artifactsData = {
    tikz: [],
    images: [],
    code: []
  };

  const uuidMatch = latexContent.match(/\\uuid\{([^}]+)\}/);
  const exerciseUuid = uuidMatch ? uuidMatch[1].trim() : generateShortUuid();
  mainData.uuid = exerciseUuid;

  // Extraction des blocs SaveVerbatim et des fichiers appelés par \pythoncode.
  const codeBlocks = extractSaveVerbatimBlocks(latexContent);
  const externalPythonBlocks = await extractExternalPythonCode(latexContent, filePath);
  for (const [name, block] of externalPythonBlocks) {
    if (codeBlocks.has(name)) console.warn(`Duplicate code block name "${name}" in ${filePath}; external Python source is used.`);
    codeBlocks.set(name, block);
  }
  let codeBlockIndex = 1;
  
  for (const [blockName, blockData] of codeBlocks) {
    const codeId = `code_${codeBlockIndex}`;
    
    artifactsData.code.push({
      id: codeId,
      name: blockName,
      language: blockData.language,
      content: blockData.content.trim(),
      html: convertCodeToHTML(blockData.content, blockData.language, blockName),
      ...(blockData.source_path && { source_path: blockData.source_path })
    });
    
    mainData.artifacts.code.push(codeId);
    codeBlockIndex++;
  }

  // Extraction des \includegraphics SANS modifier le LaTeX source
  const { images: includedImages, replacements: imageReplacements } =
    await extractIncludegraphicsImages({
      latexContent,
      exerciseUuid,
      sourceFilePath: filePath,
      contentRoot: CONTENT_ROOT_DIR,
      artifactsRoot: ARTIFACTS_OUTPUT_DIR,
      publicBasePath: IMAGES_PUBLIC_BASE_PATH,
      logger: console
    });
  
  if (includedImages.length > 0) {
    artifactsData.images = includedImages;
    mainData.artifacts.images = includedImages.map(img => img.id);
  }

  // NE PAS créer de placeholders dans le LaTeX source !
  // Les imageReplacements seront utilisés uniquement lors de la conversion HTML

  // Extraction TikZ
  const tikzReplacements = new Map();
  const tikzRegex = /(\\begin{tikzpicture}[\s\S]*?\\end{tikzpicture})/g;
  let tikzMatch;
  let tikzBlockIndex = 1;
  
  while ((tikzMatch = tikzRegex.exec(latexContent)) !== null) {
    const tikzBlockWithComments = tikzMatch[1];
    const tikzKey = stripComments(tikzBlockWithComments);
    if (tikzReplacements.has(tikzKey)) continue;

    const tikzId = `tikz_${tikzBlockIndex}`;
    const svgFilename = `${exerciseUuid}-${tikzId}.svg`;
    const publicUrl = `${TIKZ_ASSETS_PUBLIC_PATH}/${svgFilename}`;

    mainData.artifacts.tikz.push(tikzId);
    
    artifactsData.tikz.push({
      id: tikzId,
      url: publicUrl,
      latex: tikzBlockWithComments,
      svg: ""
    });
    
    const imgTag = `<img src="${publicUrl}" alt="Diagramme TikZ ${tikzBlockIndex}" class="tikz-svg-image">`;
    tikzReplacements.set(tikzKey, imgTag);
    tikzBlockIndex++;
  }

  // Parsing du contenu - utiliser le LaTeX ORIGINAL
  const allCommandNames = CONFIG.commands.map(cmd => cmd.name).join('|');
  const commandRegex = new RegExp(`(?<!\\\\)\\\\(${allCommandNames})\\s*(?:\\[[^\\]]*\\]\\s*)?\\{`, 'g');
  let blockOrder = 1;
  let cmdMatch;

  while ((cmdMatch = commandRegex.exec(latexContent)) !== null) {  // <-- Utiliser latexContent, pas processedLatex
    const commandName = cmdMatch[1];
    const commandObj = CONFIG.commands.find(cmd => cmd.name === commandName);
    if (!commandObj) continue;

    const matchStart = cmdMatch.index;
    const lineStart = latexContent.lastIndexOf('\n', matchStart) + 1;
    const line = latexContent.substring(lineStart, latexContent.indexOf('\n', lineStart));
    if (isCommandCommented(line, cmdMatch.index - lineStart)) continue;

    let startIndex = cmdMatch.index + cmdMatch[0].length;
    let index = startIndex;
    let braceCount = 1;
    let content = '';
    while (braceCount > 0 && index < latexContent.length) {
      const char = latexContent[index];
      if (char === '\\') { content += char + latexContent[++index]; }
      else if (char === '{') { braceCount++; content += char; }
      else if (char === '}') { braceCount--; if (braceCount > 0) content += char; }
      else { content += char; }
      index++;
    }
    
    if (commandObj.isContent) {
      if (commandName === 'pythoncode') {
        const filename = content.trim();
        const codeBlock = codeBlocks.get(filename);
        const blockId = `block_${blockOrder++}`;
        mainData.content.push({
          id: blockId,
          type: commandObj.blockType,
          latex: `\\pythoncode{${filename}}`,
          html: codeBlock
            ? convertCodeToHTML(codeBlock.content, codeBlock.language, filename)
            : '<div class="code-error">Source Python introuvable</div>',
          order: blockOrder - 1
        });
        continue;
      }

      const originalBlockLatex = commandObj.isVerbatim ? content.trim() : stripComments(content.trim());
      let htmlContent = "";

      // Pour la conversion HTML, créer une version avec placeholders
      let contentForConversion = originalBlockLatex;
      let codeReplacements = [];
      
      // Créer des placeholders temporaires pour les images SEULEMENT pour cette conversion
      const tempImagePlaceholders = new Map();
      for (const [original, imgTag] of imageReplacements) {
        if (contentForConversion.includes(original)) {
          const placeholder = `IMGPLACEHOLDER${crypto.randomBytes(4).toString('hex')}`;
          contentForConversion = contentForConversion.replace(new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), placeholder);
          tempImagePlaceholders.set(placeholder, imgTag);
        }
      }
      
      // Remplacer les codes
      if (contentForConversion.includes('\\BUseVerbatim{')) {
        const result = replaceBUseVerbatimWithPlaceholders(contentForConversion, codeBlocks);
        contentForConversion = result.content;
        codeReplacements = result.replacements;
      }

      // Conversion HTML
      if (contentForConversion.includes('\\begin{tikzpicture}')) {
        let pandocInput = contentForConversion;
        const replacementsForPandoc = [];

        const wrappedTikzRegex = /\\begin{(center|figure|minipage)(?:\[[^\]]*\])?(?:\{[^}]*\})?}\s*(\\begin{tikzpicture}[\s\S]*?\\end{tikzpicture})\s*\\end{\1}|(\\begin{tikzpicture}[\s\S]*?\\end{tikzpicture})/g;

        pandocInput = pandocInput.replace(wrappedTikzRegex, (match, wrapper, wrappedTikz, unwrappedTikz) => {
          const tikzCode = stripComments(wrappedTikz || unwrappedTikz);
          const imgTag = tikzReplacements.get(tikzCode);

          if (!imgTag) {
            console.warn(`Could not find a replacement for a TikZ block in ${filePath}.`);
            return match;
          }

          let finalHtml = '';
          if (wrapper === 'center' || wrapper === 'figure') {
            finalHtml = `<div class="tikz-container" style="text-align: center;">${imgTag}</div>`;
          } else {
            finalHtml = `<p class="tikz-container">${imgTag}</p>`;
          }
          
          const placeholder = `TIKZHTMLPLACEHOLDER${crypto.randomBytes(4).toString('hex')}`;
          replacementsForPandoc.push({ placeholder, html: finalHtml });
          return placeholder;
        });

        try {
          let htmlWithPlaceholders = await convertLaTeXToHTML(wrapAlignWithDollar(pandocInput));
          let finalHtml = htmlWithPlaceholders;
          
          // Restaurer les TikZ
          for (const item of replacementsForPandoc) {
            finalHtml = finalHtml.replace(item.placeholder, item.html);
          }
          
          // Restaurer les images
          for (const [placeholder, imgTag] of tempImagePlaceholders) {
            finalHtml = finalHtml.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), imgTag);
          }
          
          // Restaurer les blocs de code
          finalHtml = restoreCodeBlocksFromPlaceholders(finalHtml, codeReplacements);
          
          htmlContent = finalHtml;
        } catch (error) {
          console.error(`Pandoc conversion failed for content in ${filePath}:`, error.message);
          htmlContent = `<div class="error">Conversion error: ${error.message}</div>`;
        }
      } else {
        try {
          const pandocInput = wrapAlignWithDollar(contentForConversion);
          let htmlWithPlaceholders = (pandocInput.trim() === '') ? '' : await convertLaTeXToHTML(pandocInput);
          
          // Restaurer les images
          for (const [placeholder, imgTag] of tempImagePlaceholders) {
            htmlWithPlaceholders = htmlWithPlaceholders.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), imgTag);
          }
          
          // Restaurer les blocs de code
          htmlContent = restoreCodeBlocksFromPlaceholders(htmlWithPlaceholders, codeReplacements);
        } catch (error) {
          console.error(`Pandoc conversion failed for ${filePath}:`, error.message);
          htmlContent = `<div class="error">Conversion error: ${error.message}</div>`;
        }
      }

      const blockId = `block_${blockOrder++}`;
      mainData.content.push({
        id: blockId,
        type: commandObj.blockType,
        latex: content.trim(),  // <-- LaTeX ORIGINAL sans placeholders
        html: htmlContent,
        order: blockOrder - 1
      });
    } else {
      // Traitement des métadonnées (non-content)
      const finalContent = stripComments(content.trim());
      const processedContent = preprocessLatex(finalContent);
      if (commandObj.jsonKey === 'theme') {
        mainData[commandObj.jsonKey] = processedContent.split(',').map(s => s.trim()).join(', ');
      } else if (commandObj.jsonKey === 'level') {
        mainData[commandObj.jsonKey] = processedContent;
      } else if (commandObj.jsonKey === 'difficulty') {
        mainData[commandObj.jsonKey] = validateDifficulty(processedContent);
      } else if (commandObj.jsonKey === 'video_id') {
        mainData[commandObj.jsonKey] = processedContent;
        mainData.artifacts.video = processedContent;
      } else if (commandObj.jsonKey === 'module') {
        mainData[commandObj.jsonKey] = processedContent;
      } else {
        mainData[commandObj.jsonKey] = processedContent;
      }
    }
  }

  // Reste du code pour GeoGebra, preview, etc...
  // (inchangé)
  
  // Extraction GeoGebra
  const geogebraRegex = /\\geogebra\{([^}]+)\}/g;
  let geoMatch;
  while ((geoMatch = geogebraRegex.exec(latexContent)) !== null) {
    mainData.artifacts.geogebra.push(geoMatch[1]);
  }

  // Génération de la preview
  let previewContent = '';
  if (mainData.content.length > 0) {
    try {
      previewContent = generateExercisePreview(mainData.content);
    } catch (error) {
      console.warn(`Failed to generate preview for ${filePath}:`, error.message);
      previewContent = '';
    }
  }

  // Réorganiser mainData
  const orderedMainData = {
    uuid: mainData.uuid,
    title: mainData.title,
    chapter: mainData.chapter,
    subchapter: mainData.subchapter,
    theme: mainData.theme,
    level: mainData.level,
    difficulty: mainData.difficulty,
    module: mainData.module,
    author: mainData.author,
    organization: mainData.organization,
    video_id: mainData.video_id,
    created_at: mainData.created_at,
    updated_at: mainData.updated_at,
    preview: previewContent,
    content: mainData.content,
    artifacts: mainData.artifacts,
    source_path: mainData.source_path,
    source_hash: mainData.source_hash
  };

  return { mainData: orderedMainData, artifactsData };
}

/**
 * MODIFIÉ : Sauvegarde des fichiers JSON (principal + artifacts)
 */
async function processFile(inputPath, outputPath, cacheManager, options = {}) {
  try {
    const { incremental = false, force = false } = options;
    if (incremental && !force && await cacheManager.isUpToDate(inputPath, outputPath)) {
      return { skipped: true };
    }
    
    console.log(`📄 Parsing: ${path.relative(CONFIG.content.inputDir, inputPath)}`);
    
    const { mainData, artifactsData } = await parseLatexFile(inputPath);
    
    if (!mainData.title) {
      console.warn(`⚠️  Missing title in ${inputPath}`);
    }

    // 1. Sauvegarder le fichier JSON principal dans le cache
    await cacheManager.save(outputPath, mainData);
    console.log(`✅ Converted: ${path.relative(CONFIG.content.inputDir, inputPath)} → ${path.relative(CONFIG.content.cacheDir, outputPath)}`);
    
    // 2. Sauvegarder le fichier JSON des artifacts si nécessaire
    if (artifactsData.tikz.length > 0 || artifactsData.code.length > 0 || artifactsData.images.length > 0) {
      if (!mainData.uuid) {
        console.error(`❌ Cannot save artifact file for ${inputPath}: Missing UUID.`);
      } else {
        const artifactPath = path.join(ARTIFACTS_OUTPUT_DIR, `${mainData.uuid}.json`);
        await fsPromises.mkdir(ARTIFACTS_OUTPUT_DIR, { recursive: true });
        await fsPromises.writeFile(artifactPath, JSON.stringify(artifactsData, null, 2), 'utf8');
        console.log(`✨ Artifacts saved: → ${path.relative(path.resolve(__dirname, '..'), artifactPath)}`);
      }
    }
    
    return { 
      skipped: false, 
      data: mainData,
      artifacts: mainData.artifacts 
    };

  } catch (error) {
    console.error(`❌ Error processing ${inputPath}:`, error.message);
    return { skipped: false, error: error.message };
  }
}

/**
 * Classe pour gérer l'affichage groupé des fichiers skippés
 */
class SkipTracker {
  constructor(reportInterval = 200) {
    this.count = 0;
    this.reportInterval = reportInterval;
    this.lastReportedCount = 0;
  }

  increment() {
    this.count++;
    if (this.count - this.lastReportedCount >= this.reportInterval) {
      console.log(`⏭️  Skipped ${this.count} files (up to date)`);
      this.lastReportedCount = this.count;
    }
  }

  final() {
    if (this.count > this.lastReportedCount) {
      console.log(`⏭️  Skipped ${this.count} files (up to date)`);
    }
  }

  getCount() {
    return this.count;
  }
}

let globalSkipTracker = null;

async function traverseDirectory(inputDir, outputDir, cacheManager, options = {}) {
  const stats = { processed: 0, skipped: 0, errors: 0 };
  
  const isRoot = globalSkipTracker === null;
  if (isRoot) {
    globalSkipTracker = new SkipTracker(200);
  }
  
  await fsPromises.mkdir(outputDir, { recursive: true });
  const entries = await fsPromises.readdir(inputDir, { withFileTypes: true });
  
  for (const entry of entries) {
    const inputPath = path.join(inputDir, entry.name);
    if (entry.isDirectory()) {
      const subOutputDir = path.join(outputDir, entry.name);
      const subStats = await traverseDirectory(inputPath, subOutputDir, cacheManager, options);
      stats.processed += subStats.processed;
      stats.skipped += subStats.skipped;
      stats.errors += subStats.errors;
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.tex') {
      const outputPath = path.join(outputDir, path.basename(entry.name, '.tex') + '.json');
      const result = await processFile(inputPath, outputPath, cacheManager, options);
      
      if (result.skipped) {
        globalSkipTracker.increment();
        stats.skipped++;
      } else if (result.error) {
        stats.errors++;
      } else {
        stats.processed++;
      }
    }
  }
  
  if (isRoot) {
    globalSkipTracker.final();
    globalSkipTracker = null;
  }
  
  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const positionalArgs = args.filter(arg => !arg.startsWith('--'));
  const [inputArg, outputArg] = positionalArgs;
  const options = {
    incremental: args.includes('--incremental'),
    force: args.includes('--force'),
    inputPath: inputArg || CONFIG.content.inputDir,
    outputPath: outputArg || CONFIG.content.cacheDir
  };
  
  console.log('🚀 OpenYourMath V2 - LaTeX to JSON Parser');
  console.log(`📁 Input:  ${options.inputPath}`);
  console.log(`📁 Output: ${options.outputPath}`);
  console.log(`⚡ Mode:   ${options.incremental ? 'incremental' : 'full'}`);
  if (options.force) console.log('🔄 Force : les fichiers ciblés seront reparsés.');
  
  if (options.incremental) {
    console.log(`📊 Skip reports: every 200 files`);
  }
  
  console.log('');
  
  const cacheManager = new CacheManager(CONFIG.content.cacheDir);
  
  try {
    const inputStats = await fsPromises.stat(options.inputPath);
    let stats;
    
    if (inputStats.isFile()) {
      if (!options.inputPath.endsWith('.tex')) throw new Error('Input file must be .tex');
      const outputPath = path.join(options.outputPath, path.basename(options.inputPath, '.tex') + '.json');
      const result = await processFile(options.inputPath, outputPath, cacheManager, options);
      stats = result.skipped ? { processed: 0, skipped: 1, errors: 0 } : result.error ? { processed: 0, skipped: 0, errors: 1 } : { processed: 1, skipped: 0, errors: 0 };
    } else {
      stats = await traverseDirectory(options.inputPath, options.outputPath, cacheManager, options);
    }
    
    await cacheManager.updateMetadata(stats);
    await cacheManager.flushMetadata();
    
    console.log('\n📊 Summary:');
    console.log(`✅ Processed: ${stats.processed} files`);
    console.log(`⏭️  Skipped:   ${stats.skipped} files`);
    console.log(`❌ Errors:    ${stats.errors} files`);
    
    if (stats.errors > 0) process.exit(1);
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    try {
      await cacheManager.flushMetadata();
    } catch (flushError) {
      console.error('⚠️ Failed to persist cache metadata:', flushError.message);
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

export { parseLatexFile, processFile, CONFIG };
