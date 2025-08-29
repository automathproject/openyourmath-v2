// scripts/parse-latex.mjs
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
} from './utils/tex2html-utils.mjs';

import {
  extractSaveVerbatimBlocks,
  replaceBUseVerbatimWithPlaceholders,
  restoreCodeBlocksFromPlaceholders,
  convertCodeToHTML
} from './utils/code2html-utils.mjs';

import { CacheManager } from './utils/cache-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fsPromises = fs.promises;

// Chemins de sortie
const TIKZ_ASSETS_PUBLIC_PATH = '/artifacts/tikz';
// NOUVEAU : Chemin de sortie pour les fichiers JSON des artéfacts
const ARTIFACTS_OUTPUT_DIR = path.resolve(__dirname, '../static/artifacts');

const CONFIG = {
  content: {
    inputDir: path.resolve(__dirname, '../content/exercises'),
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
    { name: 'niveau', jsonKey: 'difficulty', isContent: false },
    { name: 'texte', jsonKey: 'content', isContent: true, blockType: 'text' },
    { name: 'question', jsonKey: 'content', isContent: true, blockType: 'question' },
    { name: 'indication', jsonKey: 'content', isContent: true, blockType: 'indication' },
    { name: 'reponse', jsonKey: 'content', isContent: true, blockType: 'reponse' },
    { name: 'code', jsonKey: 'content', isContent: true, blockType: 'code', isVerbatim: true }
  ]
};

function generateShortUuid() {
  return crypto.randomBytes(3).toString('base64url');
}

async function calculateFileHash(filePath) {
  const content = await fsPromises.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * MODIFIÉ : Retourne maintenant un objet { mainData, artifactsData }
 */
async function parseLatexFile(filePath) {
  const latexContent = await fsPromises.readFile(filePath, 'utf8');
  const fileHash = await calculateFileHash(filePath);
  
  // Données principales pour le cache
  const mainData = {
    uuid: "",
    title: "",
    chapter: "",
    subchapter: "",
    theme: "",
    difficulty: null,
    author: "",
    organization: "",
    video_id: "",
    created_at: "",
    updated_at: new Date().toISOString(),
    content: [],
    artifacts: { 
      // Le champ tikz ne contiendra que les IDs
      tikz: [], 
      geogebra: [], 
      code: [], 
      video: null 
    },
    source_hash: fileHash
  };

  // NOUVEAU : Objet pour le fichier JSON des artéfacts
  const artifactsData = {
    tikz: [],
    code: []  // NOUVEAU : Ajout des blocs de code
  };

  const uuidMatch = latexContent.match(/\\uuid\{([^}]+)\}/);
  const exerciseUuid = uuidMatch ? uuidMatch[1].trim() : generateShortUuid();
  mainData.uuid = exerciseUuid;

  // NOUVEAU : Extraction des blocs SaveVerbatim
  const codeBlocks = extractSaveVerbatimBlocks(latexContent);
  let codeBlockIndex = 1;
  
  // Traiter chaque bloc SaveVerbatim trouvé
  for (const [blockName, blockData] of codeBlocks) {
    const codeId = `code_${codeBlockIndex}`;
    
    // Ajouter à l'objet des artéfacts
    artifactsData.code.push({
      id: codeId,
      name: blockName,
      language: blockData.language,
      content: blockData.content.trim(),
      html: convertCodeToHTML(blockData.content, blockData.language, blockName)
    });
    
    // Ajouter l'ID à la liste des artéfacts de code
    mainData.artifacts.code.push(codeId);
    
    codeBlockIndex++;
  }

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

    // MODIFIÉ : Remplissage des deux objets de données
    mainData.artifacts.tikz.push(tikzId); // On ne stocke que l'ID dans le JSON principal
    
    // On stocke l'objet complet dans le JSON des artéfacts
    artifactsData.tikz.push({
      id: tikzId,
      url: publicUrl,
      latex: tikzBlockWithComments,
      svg: "" // Champ prêt à être rempli par le prochain script de build
    });
    
    const imgTag = `<img src="${publicUrl}" alt="Diagramme TikZ ${tikzBlockIndex}" class="tikz-svg-image">`;
    tikzReplacements.set(tikzKey, imgTag);
    tikzBlockIndex++;
  }

  // Le reste de la logique de parsing, mais avec traitement des références de code
  const allCommandNames = CONFIG.commands.map(cmd => cmd.name).join('|');
  const commandRegex = new RegExp(`(?<!\\\\)\\\\(${allCommandNames})\\s*\\{`, 'g');
  let blockOrder = 1;
  let cmdMatch;

  while ((cmdMatch = commandRegex.exec(latexContent)) !== null) {
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
      const originalBlockLatex = commandObj.isVerbatim ? content.trim() : stripComments(content.trim());
      let htmlContent = "";

      // NOUVEAU : Traitement des références \BUseVerbatim avec placeholders
      let processedContent = originalBlockLatex;
      let codeReplacements = [];
      
      if (processedContent.includes('\\BUseVerbatim{')) {
        const result = replaceBUseVerbatimWithPlaceholders(processedContent, codeBlocks);
        processedContent = result.content;
        codeReplacements = result.replacements;
      }

      if (processedContent.includes('\\begin{tikzpicture}')) {
        let pandocInput = processedContent;
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
          
          // Restaurer d'abord les TikZ
          for (const item of replacementsForPandoc) {
            finalHtml = finalHtml.replace(item.placeholder, item.html);
          }
          
          // Puis restaurer les blocs de code
          finalHtml = restoreCodeBlocksFromPlaceholders(finalHtml, codeReplacements);
          
          htmlContent = finalHtml;
        } catch (error) {
          console.error(`Pandoc conversion failed for content in ${filePath}:`, error.message);
          htmlContent = `<div class="error">Conversion error: ${error.message}</div>`;
        }
      } else {
        try {
          // MODIFIÉ : Traitement standard avec placeholders
          const pandocInput = wrapAlignWithDollar(processedContent);
          let htmlWithPlaceholders = (pandocInput.trim() === '') ? '' : await convertLaTeXToHTML(pandocInput);
          
          // Restaurer les blocs de code après conversion Pandoc
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
        latex: content.trim(),
        html: htmlContent,
        order: blockOrder - 1
      });

      // MODIFIÉ : Ne pas ajouter les blocs normaux aux artéfacts de code
      // Les SaveVerbatim sont déjà traités séparément
    } else {
      const finalContent = stripComments(content.trim());
      const processedContent = preprocessLatex(finalContent);
      if (commandObj.jsonKey === 'theme') mainData[commandObj.jsonKey] = processedContent.split(',').map(s => s.trim()).join(', ');
      else if (commandObj.jsonKey === 'difficulty') mainData[commandObj.jsonKey] = parseInt(processedContent) || null;
      else if (commandObj.jsonKey === 'video_id') {
        mainData[commandObj.jsonKey] = processedContent;
        mainData.artifacts.video = processedContent;
      } else {
        mainData[commandObj.jsonKey] = processedContent;
      }
    }
  }

  const geogebraRegex = /\\geogebra\{([^}]+)\}/g;
  let geoMatch;
  while ((geoMatch = geogebraRegex.exec(latexContent)) !== null) {
    mainData.artifacts.geogebra.push(geoMatch[1]);
  }

  // On retourne les deux objets
  return { mainData, artifactsData };
}

/**
 * MODIFIÉ : Sauvegarde maintenant deux fichiers si nécessaire.
 */
async function processFile(inputPath, outputPath, cacheManager, options = {}) {
  try {
    const { incremental = false } = options;
    if (incremental && await cacheManager.isUpToDate(inputPath, outputPath)) {
      console.log(`⏭️  Skipped (up to date): ${path.relative(CONFIG.content.inputDir, inputPath)}`);
      return { skipped: true };
    }
    
    console.log(`🔄 Parsing: ${path.relative(CONFIG.content.inputDir, inputPath)}`);
    
    const { mainData, artifactsData } = await parseLatexFile(inputPath);
    
    if (!mainData.title) {
      console.warn(`⚠️  Missing title in ${inputPath}`);
    }

    // 1. Sauvegarder le fichier JSON principal dans le cache
    await cacheManager.save(outputPath, mainData);
    console.log(`✅ Converted: ${path.relative(CONFIG.content.inputDir, inputPath)} → ${path.relative(CONFIG.content.cacheDir, outputPath)}`);
    
    // 2. MODIFIÉ : Sauvegarder le fichier JSON des artéfacts dans static/ 
    // si il y a des tikz OU des blocs de code
    if (artifactsData.tikz.length > 0 || artifactsData.code.length > 0) {
      if (!mainData.uuid) {
        console.error(`❌ Cannot save artifact file for ${inputPath}: Missing UUID.`);
      } else {
        const artifactPath = path.join(ARTIFACTS_OUTPUT_DIR, `${mainData.uuid}.json`);
        // S'assurer que le dossier de destination existe
        await fsPromises.mkdir(ARTIFACTS_OUTPUT_DIR, { recursive: true });
        // Écrire le fichier
        await fsPromises.writeFile(artifactPath, JSON.stringify(artifactsData, null, 2), 'utf8');
        console.log(`✨ Artifacts saved: → ${path.relative(path.resolve(__dirname, '..'), artifactPath)}`);
      }
    }
    
    return { 
      skipped: false, 
      data: mainData, // On retourne les données principales pour les stats
      artifacts: mainData.artifacts 
    };

  } catch (error) {
    console.error(`❌ Error processing ${inputPath}:`, error.message);
    return { skipped: false, error: error.message };
  }
}

// Le reste du fichier (traverseDirectory, main) est INCHANGÉ

async function traverseDirectory(inputDir, outputDir, cacheManager, options = {}) {
  const stats = { processed: 0, skipped: 0, errors: 0 };
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
      if (result.skipped) stats.skipped++;
      else if (result.error) stats.errors++;
      else stats.processed++;
    }
  }
  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    incremental: args.includes('--incremental'),
    inputPath: args.find(arg => !arg.startsWith('--')) || CONFIG.content.inputDir,
    outputPath: args.find((arg, i) => !arg.startsWith('--') && i > 0) || CONFIG.content.cacheDir
  };
  console.log('🚀 OpenYourMath V2 - LaTeX to JSON Parser');
  console.log(`📁 Input:  ${options.inputPath}`);
  console.log(`📁 Output: ${options.outputPath}`);
  console.log(`⚡ Mode:   ${options.incremental ? 'incremental' : 'full'}`);
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
    console.log('\n📊 Summary:');
    console.log(`✅ Processed: ${stats.processed} files`);
    console.log(`⏭️  Skipped:   ${stats.skipped} files`);
    console.log(`❌ Errors:    ${stats.errors} files`);
    if (stats.errors > 0) process.exit(1);
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
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