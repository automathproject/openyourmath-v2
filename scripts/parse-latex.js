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

import { CacheManager } from './utils/cache-manager.js';
import { generatePreview } from './utils/previewUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fsPromises = fs.promises;

// Chemins de sortie
const TIKZ_ASSETS_PUBLIC_PATH = '/artifacts/tikz';
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
    { name: 'niveau', jsonKey: 'level', isContent: false },
    { name: 'difficulte', jsonKey: 'difficulty', isContent: false },
    { name: 'module', jsonKey: 'module', isContent: false },
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
  const exerciseForPreview = {
    contenu: content.map(block => ({
      type: block.type === 'text' ? 'description' : block.type,
      value: {
        html: block.html
      }
    }))
  };
  
  return generatePreview(exerciseForPreview);
}

/**
 * NOUVEAU : Résout le chemin d'une image \includegraphics
 * TOUTES les images sont dans content/images/{source}/{format}/
 */
async function resolveImagePath(imagePath, exerciseUuid, sourceFilePath) {
  const contentDir = path.resolve(__dirname, '../content');
  
  // Déterminer la source (amscc, exo7, etc.)
  const relativePath = path.relative(path.join(contentDir, 'exercises'), sourceFilePath);
  const sourceName = relativePath.split(path.sep)[0];
  
  // Formats à ignorer (sources, non artifacts)
  const SKIP_FORMATS = ['eps', 'ps', 'tex', 'tikz', 'maple', 'dvi'];
  
  // Extensions à essayer si pas spécifiée (ordre de priorité pour le web)
  const SEARCH_EXTENSIONS = ['svg', 'png', 'jpg', 'jpeg', 'pdf'];
  
  // Extraire l'extension si présente
  let ext = path.extname(imagePath).toLowerCase().replace('.', '');
  
  // Vérifier si format à ignorer
  if (ext && SKIP_FORMATS.includes(ext)) {
    console.log(`  ⏭️  Skipping ${ext.toUpperCase()} source: ${imagePath}`);
    return null;
  }
  
  // Parser le chemin pour extraire format et nom de fichier
  // Exemples:
  // - "pdf/4R9m-tikz-1.pdf" → format: pdf, filename: 4R9m-tikz-1.pdf
  // - "pdf/4R9m-tikz-1" → format: pdf, filename: 4R9m-tikz-1 (sans ext)
  // - "../images/pdf/roOt-1.pdf" → format: pdf, filename: roOt-1.pdf
  // - "4R9m-tikz-1.pdf" → format: à deviner depuis extension, filename: 4R9m-tikz-1.pdf
  
  let format = null;
  let filename = null;
  
  if (imagePath.includes('/') || imagePath.includes('\\')) {
    // Chemin avec répertoires
    const pathParts = imagePath.split(/[/\\]/);
    
    // Chercher "images" dans le chemin (ex: ../images/pdf/file.pdf)
    const imagesIndex = pathParts.indexOf('images');
    
    if (imagesIndex !== -1 && pathParts.length > imagesIndex + 2) {
      // Format après "images": ../images/pdf/file.pdf → format: pdf
      format = pathParts[imagesIndex + 1];
      filename = pathParts.slice(imagesIndex + 2).join('/');
    } else {
      // Sinon, le premier élément est probablement le format
      // Ex: pdf/4R9m-tikz-1.pdf → format: pdf
      format = pathParts[0];
      filename = pathParts.slice(1).join('/');
    }
  } else {
    // Juste un nom de fichier (ex: 4R9m-tikz-1.pdf)
    filename = imagePath;
    // Format sera déduit de l'extension
    if (ext) {
      format = ext;
    }
  }
  
  if (!filename) {
    console.warn(`⚠️  Could not parse image path: ${imagePath}`);
    return null;
  }
  
  // Fonction helper pour chercher un fichier
  async function searchInFormat(formatDir, fname, needsExt) {
    if (!fs.existsSync(formatDir)) {
      return null;
    }
    
    if (needsExt) {
      // Essayer toutes les extensions
      for (const tryExt of SEARCH_EXTENSIONS) {
        const testPath = path.join(formatDir, fname + '.' + tryExt);
        if (fs.existsSync(testPath)) {
          return testPath;
        }
      }
      
      // Essayer avec insensibilité à la casse
      try {
        const files = await fsPromises.readdir(formatDir);
        for (const tryExt of SEARCH_EXTENSIONS) {
          const searchName = (fname + '.' + tryExt).toLowerCase();
          for (const file of files) {
            if (file.toLowerCase() === searchName) {
              return path.join(formatDir, file);
            }
          }
        }
      } catch (err) {
        // Ignore
      }
    } else {
      // Chercher le fichier exact
      const exactPath = path.join(formatDir, fname);
      if (fs.existsSync(exactPath)) {
        return exactPath;
      }
      
      // Insensibilité à la casse
      try {
        const files = await fsPromises.readdir(formatDir);
        const searchName = fname.toLowerCase();
        for (const file of files) {
          if (file.toLowerCase() === searchName) {
            return path.join(formatDir, file);
          }
        }
      } catch (err) {
        // Ignore
      }
    }
    
    return null;
  }
  
  // Chercher l'image avec priorité web-optimale
  const needsExtension = !ext;
  
  // Si on a un format explicite ET une extension dans filename,
  // extraire le basename pour chercher des alternatives
  let baseFilename = filename;
  if (ext && filename.endsWith('.' + ext)) {
    baseFilename = filename.slice(0, -(ext.length + 1));
  }
  
  // NOUVEAU : Ordre de priorité des formats pour le web
  const WEB_FORMAT_PRIORITY = ['svg', 'png', 'jpg', 'jpeg', 'pdf'];
  
  if (format) {
    // Stratégie : chercher d'abord les alternatives web-optimales
    // Exemple : \includegraphics{pdf/diagram.pdf}
    // → Chercher diagram.svg dans images/{source}/svg/
    // → Sinon diagram.png dans images/{source}/png/
    // → Sinon diagram.pdf dans images/{source}/pdf/ (fallback)
    
    if (ext) {
      // Extension explicite dans le filename
      // Chercher des alternatives avec le même basename
      for (const webFormat of WEB_FORMAT_PRIORITY) {
        const webFormatDir = path.join(contentDir, 'images', sourceName, webFormat);
        const webFormatDirAlt = path.join(contentDir, 'images', sourceName, webFormat.toUpperCase());
        
        // Chercher avec le nouveau format
        const webFilename = baseFilename + '.' + webFormat;
        
        let found = await searchInFormat(webFormatDir, webFilename, false);
        if (found) {
          if (webFormat !== format) {
            console.log(`  ✨ Using web-optimized: ${webFormat.toUpperCase()} instead of ${format.toUpperCase()}`);
          }
          console.log(`  ℹ️  Found: images/${sourceName}/${webFormat}/${path.basename(found)}`);
          return found;
        }
        
        // Essayer avec majuscules (PNG vs png)
        found = await searchInFormat(webFormatDirAlt, webFilename, false);
        if (found) {
          if (webFormat !== format) {
            console.log(`  ✨ Using web-optimized: ${webFormat.toUpperCase()} instead of ${format.toUpperCase()}`);
          }
          console.log(`  ℹ️  Found: images/${sourceName}/${webFormat.toUpperCase()}/${path.basename(found)}`);
          return found;
        }
      }
    } else {
      // Pas d'extension : chercher avec ordre de priorité web
      for (const webFormat of WEB_FORMAT_PRIORITY) {
        const webFormatDir = path.join(contentDir, 'images', sourceName, webFormat);
        const webFormatDirAlt = path.join(contentDir, 'images', sourceName, webFormat.toUpperCase());
        
        let found = await searchInFormat(webFormatDir, filename, true);
        if (found) {
          console.log(`  ℹ️  Found: images/${sourceName}/${webFormat}/${path.basename(found)}`);
          return found;
        }
        
        found = await searchInFormat(webFormatDirAlt, filename, true);
        if (found) {
          console.log(`  ℹ️  Found: images/${sourceName}/${webFormat.toUpperCase()}/${path.basename(found)}`);
          return found;
        }
      }
    }
  }
  
  // Si pas de format ou pas trouvé, chercher dans tous les formats possibles
  const formatsToTry = ext ? [ext, ext.toUpperCase()] : SEARCH_EXTENSIONS;
  
  for (const tryFormat of formatsToTry) {
    const formatDir = path.join(contentDir, 'images', sourceName, tryFormat);
    const formatDirAlt = path.join(contentDir, 'images', sourceName, tryFormat.toUpperCase());
    
    let found = await searchInFormat(formatDir, filename, needsExtension);
    if (found) {
      console.log(`  ℹ️  Found: images/${sourceName}/${tryFormat}/${path.basename(found)}`);
      return found;
    }
    
    found = await searchInFormat(formatDirAlt, filename, needsExtension);
    if (found) {
      console.log(`  ℹ️  Found: images/${sourceName}/${tryFormat.toUpperCase()}/${path.basename(found)}`);
      return found;
    }
  }
  
  console.warn(`⚠️  Image not found: ${imagePath}`);
  console.warn(`    Searched in: images/${sourceName}/{format}/`);
  return null;
}

/**
 * NOUVEAU : Extrait et copie les images \includegraphics
 */
async function extractIncludegraphicsImages(latexContent, exerciseUuid, sourceFilePath) {
  const images = [];
  const replacements = new Map();
  
  const regex = /\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}/g;
  let match;
  let imgIndex = 1;
  
  const contentDir = path.resolve(__dirname, '../content');
  const outputDir = path.join(ARTIFACTS_OUTPUT_DIR, 'images', exerciseUuid);
  
  await fsPromises.mkdir(outputDir, { recursive: true });
  
  console.log(`\n🔍 Searching for images...`);
  
  while ((match = regex.exec(latexContent)) !== null) {
    const options = match[1] || '';
    const imagePath = match[2].trim();
    
    const absoluteSourcePath = await resolveImagePath(imagePath, exerciseUuid, sourceFilePath);
    
    if (!absoluteSourcePath) {
      continue;
    }
    
    const ext = path.extname(absoluteSourcePath).toLowerCase().replace('.', '');
    const SUPPORTED_FORMATS = ['pdf', 'png', 'svg', 'jpg', 'jpeg'];
    
    if (!SUPPORTED_FORMATS.includes(ext)) {
      console.warn(`⚠️  Unsupported format for artifacts: ${ext}`);
      continue;
    }
    
    const imgId = `img_${imgIndex}`;
    const destFilename = `${imgId}.${ext}`;
    const destPath = path.join(outputDir, destFilename);
    const publicUrl = `/artifacts/images/${exerciseUuid}/${destFilename}`;
    
    try {
      const needsCopy = await shouldCopyFile(absoluteSourcePath, destPath);
      if (needsCopy) {
        await fsPromises.copyFile(absoluteSourcePath, destPath);
        const relativeSrc = path.relative(contentDir, absoluteSourcePath);
        console.log(`  📸 Copied: ${relativeSrc} → ${destFilename}`);
      }
    } catch (error) {
      console.error(`❌ Failed to copy ${imagePath}:`, error.message);
      continue;
    }
    
    images.push({
      id: imgId,
      url: publicUrl,
      originalPath: imagePath,
      sourcePath: path.relative(contentDir, absoluteSourcePath),
      sourceFilename: path.basename(absoluteSourcePath),
      format: ext,
      ...(options && { options })
    });
    
    const imgTag = `<img src="${publicUrl}" alt="Image ${imgIndex}" class="includegraphics-image">`;
    replacements.set(match[0], imgTag);
    
    imgIndex++;
  }
  
  if (images.length > 0) {
    console.log(`  ✅ Found ${images.length} image(s)`);
  } else {
    console.log(`  ℹ️  No images to process`);
  }
  
  return { images, replacements };
}

async function shouldCopyFile(sourcePath, destPath) {
  try {
    const [sourceStat, destStat] = await Promise.all([
      fsPromises.stat(sourcePath),
      fsPromises.stat(destPath).catch(() => null)
    ]);
    
    if (!destStat) return true;
    return sourceStat.mtime > destStat.mtime;
  } catch {
    return true;
  }
}

/**
 * MODIFIÉ : Parsing avec support des images \includegraphics
 */
async function parseLatexFile(filePath) {
  const latexContent = await fsPromises.readFile(filePath, 'utf8');
  const fileHash = await calculateFileHash(filePath);
  
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
      images: [],  // NOUVEAU
      geogebra: [], 
      code: [], 
      video: null 
    },
    source_hash: fileHash
  };

  const artifactsData = {
    tikz: [],
    images: [],  // NOUVEAU
    code: []
  };

  const uuidMatch = latexContent.match(/\\uuid\{([^}]+)\}/);
  const exerciseUuid = uuidMatch ? uuidMatch[1].trim() : generateShortUuid();
  mainData.uuid = exerciseUuid;

  // Extraction des blocs SaveVerbatim (code)
  const codeBlocks = extractSaveVerbatimBlocks(latexContent);
  let codeBlockIndex = 1;
  
  for (const [blockName, blockData] of codeBlocks) {
    const codeId = `code_${codeBlockIndex}`;
    
    artifactsData.code.push({
      id: codeId,
      name: blockName,
      language: blockData.language,
      content: blockData.content.trim(),
      html: convertCodeToHTML(blockData.content, blockData.language, blockName)
    });
    
    mainData.artifacts.code.push(codeId);
    codeBlockIndex++;
  }

  // NOUVEAU : Extraction des \includegraphics
  const { images: includedImages, replacements: imageReplacements } = 
    await extractIncludegraphicsImages(latexContent, exerciseUuid, filePath);
  
  if (includedImages.length > 0) {
    artifactsData.images = includedImages;
    mainData.artifacts.images = includedImages.map(img => img.id);
  }

  // Créer les placeholders pour les images (avant conversion Pandoc)
  let processedLatex = latexContent;
  const imagePlaceholders = new Map();
  
  for (const [original, imgTag] of imageReplacements) {
    const placeholder = `IMGPLACEHOLDER${crypto.randomBytes(4).toString('hex')}`;
    processedLatex = processedLatex.replace(original, placeholder);
    imagePlaceholders.set(placeholder, imgTag);
  }

  // Extraction TikZ (sur le contenu avec placeholders)
  const tikzReplacements = new Map();
  const tikzRegex = /(\\begin{tikzpicture}[\s\S]*?\\end{tikzpicture})/g;
  let tikzMatch;
  let tikzBlockIndex = 1;
  
  while ((tikzMatch = tikzRegex.exec(processedLatex)) !== null) {
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

  // Parsing du contenu
  const allCommandNames = CONFIG.commands.map(cmd => cmd.name).join('|');
  const commandRegex = new RegExp(`(?<!\\\\)\\\\(${allCommandNames})\\s*\\{`, 'g');
  let blockOrder = 1;
  let cmdMatch;

  while ((cmdMatch = commandRegex.exec(processedLatex)) !== null) {
    const commandName = cmdMatch[1];
    const commandObj = CONFIG.commands.find(cmd => cmd.name === commandName);
    if (!commandObj) continue;

    const matchStart = cmdMatch.index;
    const lineStart = processedLatex.lastIndexOf('\n', matchStart) + 1;
    const line = processedLatex.substring(lineStart, processedLatex.indexOf('\n', lineStart));
    if (isCommandCommented(line, cmdMatch.index - lineStart)) continue;

    let startIndex = cmdMatch.index + cmdMatch[0].length;
    let index = startIndex;
    let braceCount = 1;
    let content = '';
    while (braceCount > 0 && index < processedLatex.length) {
      const char = processedLatex[index];
      if (char === '\\') { content += char + processedLatex[++index]; }
      else if (char === '{') { braceCount++; content += char; }
      else if (char === '}') { braceCount--; if (braceCount > 0) content += char; }
      else { content += char; }
      index++;
    }
    
    if (commandObj.isContent) {
      const originalBlockLatex = commandObj.isVerbatim ? content.trim() : stripComments(content.trim());
      let htmlContent = "";

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
          
          // Restaurer les TikZ
          for (const item of replacementsForPandoc) {
            finalHtml = finalHtml.replace(item.placeholder, item.html);
          }
          
          // Restaurer les images \includegraphics
          for (const [placeholder, imgTag] of imagePlaceholders) {
            finalHtml = finalHtml.replace(placeholder, imgTag);
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
          const pandocInput = wrapAlignWithDollar(processedContent);
          let htmlWithPlaceholders = (pandocInput.trim() === '') ? '' : await convertLaTeXToHTML(pandocInput);
          
          // Restaurer les images
          for (const [placeholder, imgTag] of imagePlaceholders) {
            htmlWithPlaceholders = htmlWithPlaceholders.replace(placeholder, imgTag);
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
        latex: content.trim(),
        html: htmlContent,
        order: blockOrder - 1
      });
    } else {
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

  // Réorganiser mainData pour placer preview avant content
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
    source_hash: mainData.source_hash
  };

  return { mainData: orderedMainData, artifactsData };
}

/**
 * MODIFIÉ : Sauvegarde des fichiers JSON (principal + artifacts)
 */
async function processFile(inputPath, outputPath, cacheManager, options = {}) {
  try {
    const { incremental = false } = options;
    if (incremental && await cacheManager.isUpToDate(inputPath, outputPath)) {
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
  const options = {
    incremental: args.includes('--incremental'),
    inputPath: args.find(arg => !arg.startsWith('--')) || CONFIG.content.inputDir,
    outputPath: args.find((arg, i) => !arg.startsWith('--') && i > 0) || CONFIG.content.cacheDir
  };
  
  console.log('🚀 OpenYourMath V2 - LaTeX to JSON Parser');
  console.log(`📁 Input:  ${options.inputPath}`);
  console.log(`📁 Output: ${options.outputPath}`);
  console.log(`⚡ Mode:   ${options.incremental ? 'incremental' : 'full'}`);
  
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