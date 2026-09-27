// scripts/utils/code2html-utils.js
import crypto from 'crypto';
import { stripComments } from './tex2html-utils.js';

/**
 * Détecte le langage de programmation à partir du nom du bloc SaveVerbatim
 * @param {string} blockName - Le nom du bloc (ex: "j0O1python", "code1sql")
 * @returns {string} - Le langage détecté ou "text" par défaut
 */
export function detectLanguageFromBlockName(blockName) {
  const name = blockName.toLowerCase();
  
  if (name.includes('python') || name.includes('py')) return 'python';
  if (name.includes('javascript') || name.includes('js')) return 'javascript';
  if (name.includes('java') && !name.includes('javascript')) return 'java';
  if (name.includes('sql')) return 'sql';
  if (name.includes('r') && name.length <= 3) return 'r';
  if (name.includes('cpp') || name.includes('c++')) return 'cpp';
  if (name.includes('c') && !name.includes('css')) return 'c';
  if (name.includes('html')) return 'html';
  if (name.includes('css')) return 'css';
  if (name.includes('php')) return 'php';
  if (name.includes('bash') || name.includes('shell')) return 'bash';
  if (name.includes('matlab')) return 'matlab';
  
  return 'text'; // Par défaut
}

/**
 * Nettoie et formate le code pour l'affichage HTML
 * @param {string} code - Le code source
 * @returns {string} - Le code nettoyé avec indentation préservée
 */
export function cleanCodeContent(code) {
  // Supprimer les commentaires LaTeX du début et de la fin
  let cleaned = stripComments(code);
  
  // Supprimer les lignes vides au début et à la fin
  cleaned = cleaned.replace(/^\s*\n+/, '').replace(/\n+\s*$/, '');
  
  // Préserver l'indentation en normalisant les espaces/tabs
  const lines = cleaned.split('\n');
  
  // Trouver l'indentation minimale (en excluant les lignes vides)
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim().length > 0) {
      const leadingSpaces = line.match(/^[ \t]*/)[0].length;
      minIndent = Math.min(minIndent, leadingSpaces);
    }
  }
  
  // Supprimer l'indentation minimale commune
  if (minIndent !== Infinity && minIndent > 0) {
    const normalizedLines = lines.map(line => {
      if (line.trim().length === 0) return '';
      return line.substring(minIndent);
    });
    cleaned = normalizedLines.join('\n');
  }
  
  return cleaned;
}

/**
 * Convertit un bloc de code en HTML avec coloration syntaxique basique
 * @param {string} code - Le code source
 * @param {string} language - Le langage de programmation
 * @param {string} blockName - Le nom du bloc original
 * @returns {string} - Le HTML généré
 */
export function convertCodeToHTML(code, language, blockName) {
  const cleanedCode = cleanCodeContent(code);
  
  // Échapper les caractères HTML
  const escapedCode = cleanedCode
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  // Créer le HTML avec les classes appropriées pour la coloration syntaxique
  const html = `<div class="code-block" data-language="${language}" data-block-name="${blockName}">
  <div class="code-header">
    <span class="language-label">${language.toUpperCase()}</span>
    <span class="block-name">${blockName}</span>
  </div>
  <pre><code class="language-${language}">${escapedCode}</code></pre>
</div>`;
  
  return html;
}

/**
 * Extrait tous les blocs SaveVerbatim d'un contenu LaTeX
 * @param {string} latexContent - Le contenu LaTeX complet
 * @returns {Map<string, {name: string, content: string, language: string}>} - Map des blocs trouvés
 */
export function extractSaveVerbatimBlocks(latexContent) {
  const blocks = new Map();
  
  // Regex pour capturer les blocs SaveVerbatim
  const saveVerbatimRegex = /\\begin\{SaveVerbatim\}\{([^}]+)\}([\s\S]*?)\\end\{SaveVerbatim\}/g;
  
  let match;
  while ((match = saveVerbatimRegex.exec(latexContent)) !== null) {
    const blockName = match[1];
    const blockContent = match[2];
    const language = detectLanguageFromBlockName(blockName);
    
    blocks.set(blockName, {
      name: blockName,
      content: blockContent,
      language: language
    });
  }
  
  return blocks;
}

/**
 * Remplace les références \BUseVerbatim{blockName} par un placeholder temporaire
 * @param {string} content - Le contenu LaTeX avec les références
 * @param {Map} codeBlocks - Map des blocs de code disponibles
 * @returns {Object} - { content: string, replacements: Array }
 */
export function replaceBUseVerbatimWithPlaceholders(content, codeBlocks) {
  const replacements = [];
  
  // Regex plus complexe pour capturer les contextes LaTeX autour de \BUseVerbatim
  const patterns = [
    // Pattern 1: {\centering \fbox{\BUseVerbatim{name}}\par}
    /\{\\centering\s+\\fbox\{\\BUseVerbatim\{([^}]+)\}\}\\par\}/g,
    // Pattern 2: \fbox{\BUseVerbatim{name}}
    /\\fbox\{\\BUseVerbatim\{([^}]+)\}\}/g,
    // Pattern 3: {\BUseVerbatim{name}\par}
    /\{\\BUseVerbatim\{([^}]+)\}\\par\}/g,
    // Pattern 4: \BUseVerbatim{name} (simple)
    /\\BUseVerbatim\{([^}]+)\}/g
  ];
  
  let processedContent = content;
  
  for (const pattern of patterns) {
    processedContent = processedContent.replace(pattern, (match, blockName) => {
      const block = codeBlocks.get(blockName);
      if (!block) {
        console.warn(`Code block "${blockName}" not found for reference`);
        return `<div class="code-error">Code block "${blockName}" not found</div>`;
      }
      
      const placeholder = `CODEBLOCKPLACEHOLDER${crypto.randomBytes(4).toString('hex')}`;
      const html = convertCodeToHTML(block.content, block.language, blockName);
      
      replacements.push({ placeholder, html });
      
      return placeholder;
    });
  }
  
  return { content: processedContent, replacements };
}

/**
 * Remplace les appels \pythoncode{fichier.py} par un placeholder temporaire.
 *
 * Pandoc ignore cette commande : sans placeholder, l'extrait disparaissait du
 * bloc qui l'appelle et ne subsistait qu'en bloc séparé, affiché après tout le
 * bloc plutôt qu'à sa place. Le \begin{center} qui l'entoure d'ordinaire est
 * absorbé avec lui, le bloc de code étant déjà un élément de bloc.
 *
 * @param {string} content - Le contenu LaTeX avec les appels
 * @param {Map} codeBlocks - Extraits disponibles, par nom de fichier
 * @returns {Object} - { content: string, replacements: Array }
 */
export function replacePythonCodeWithPlaceholders(content, codeBlocks) {
  const replacements = [];
  const call = String.raw`\\pythoncode\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}`;
  const patterns = [
    new RegExp(String.raw`\\begin\{center\}\s*${call}\s*\\end\{center\}`, 'g'),
    new RegExp(call, 'g')
  ];

  let processedContent = content;
  for (const pattern of patterns) {
    processedContent = processedContent.replace(pattern, (match, rawName) => {
      const name = rawName.trim();
      const block = codeBlocks.get(name);
      const placeholder = `CODEBLOCKPLACEHOLDER${crypto.randomBytes(4).toString('hex')}`;
      replacements.push({
        placeholder,
        html: block
          ? convertCodeToHTML(block.content, block.language, name)
          : '<div class="code-error">Source Python introuvable</div>'
      });
      // Isolé par des lignes vides, le placeholder forme son propre
      // paragraphe, que la restauration remplace en entier.
      return `\n\n${placeholder}\n\n`;
    });
  }

  return { content: processedContent, replacements };
}

/**
 * Restaure les blocs de code HTML à partir des placeholders
 * @param {string} html - Le HTML avec les placeholders
 * @param {Array} replacements - Les remplacements à effectuer
 * @returns {string} - Le HTML final avec les blocs de code
 */
export function restoreCodeBlocksFromPlaceholders(html, replacements) {
  let finalHtml = html;
  for (const item of replacements) {
    // Seul sur sa ligne, le placeholder devient un paragraphe : le bloc de
    // code le remplace entièrement, un <div> ne pouvant figurer dans un <p>.
    const alone = new RegExp(`<p>\\s*${item.placeholder}\\s*</p>`);
    // Resté dans un paragraphe (après un « \\ », par exemple), il le scinde.
    const inParagraph = new RegExp(`(<p>(?:(?!</p>)[\\s\\S])*?)${item.placeholder}((?:(?!<p>)[\\s\\S])*?</p>)`);
    if (alone.test(finalHtml)) {
      finalHtml = finalHtml.replace(alone, () => item.html);
    } else if (inParagraph.test(finalHtml)) {
      finalHtml = finalHtml
        .replace(inParagraph, (_, before, after) => `${before}</p>${item.html}<p>${after}`)
        .replace(/(?:\s*<br\s*\/?>)+\s*<\/p>/g, '</p>')
        .replace(/<p>\s*<\/p>/g, '');
    } else {
      finalHtml = finalHtml.replace(item.placeholder, () => item.html);
    }
  }
  return finalHtml;
}
