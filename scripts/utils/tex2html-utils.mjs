// scripts/utils/tex2html-utils.mjs
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import os from 'os';

const execPromise = util.promisify(exec);

/**
 * Remplace les caractères accentués LaTeX par leurs équivalents Unicode
 */
export function preprocessLatex(latex) {
  // CORRECTION FINALE : Syntaxe de l'objet entièrement validée.
  // La règle est : pour une clé comme \"e, la chaîne JavaScript doit être "\\\"e".
  const replacements = {
    // Accents aigus
    "\\'E": '\u00C9', "\\'e": '\u00E9', "\\'a": '\u00E1', "\\'i": '\u00ED', "\\'o": '\u00F3', "\\'u": '\u00FA',
    "\\'A": '\u00C1', "\\'I": '\u00CD', "\\'O": '\u00D3', "\\'U": '\u00DA',
    // Accents graves
    "\\`E": '\u00C8', "\\`e": '\u00E8', "\\`a": '\u00E0', "\\`i": '\u00EC', "\\`o": '\u00F2', "\\`u": '\u00F9',
    "\\`A": '\u00C0', "\\`I": '\u00CC', "\\`O": '\u00D2', "\\`U": '\u00D9',
    // Accents circonflexes
    "\\^E": '\u00CA', "\\^e": '\u00EA', "\\^a": '\u00E2', "\\^i": '\u00EE', "\\^o": '\u00F4', "\\^u": '\u00FB',
    "\\^A": '\u00C2', "\\^I": '\u00CE', "\\^O": '\u00D4', "\\^U": '\u00DB',
    // Trémas
    "\\\"E": '\u00CB', "\\\"e": '\u00EB', "\\\"a": '\u00E4', "\\\"i": '\u00EF', "\\\"o": '\u00F6', "\\\"u": '\u00FC',
    "\\\"A": '\u00C4', "\\\"I": '\u00CF', "\\\"O": '\u00D6', "\\\"U": '\u00DC',
    // Cédilles et tildes
    "\\c{C}": '\u00C7', "\\c{c}": '\u00E7',
    "\\~N": '\u00D1', "\\~n": '\u00F1'
  };

  let processed = latex;
  for (const [pattern, replacement] of Object.entries(replacements)) {
    const escapedPattern = pattern.replace(/[\\{}^$*+?.()|[\]]/g, '\\$&');
    const regex = new RegExp(escapedPattern, 'g');
    processed = processed.replace(regex, replacement);
  }
  
  return processed;
}

/**
 * Supprime les commentaires LaTeX (% non échappés)
 */
export function stripComments(str) {
  return str.replace(/(?<!\\)%.*$/gm, '').trim();
}

/**
 * Enveloppe les blocs align* avec $$$ pour KaTeX
 */
export function wrapAlignWithDollar(content) {
  return content
    .replace(/\\begin\{align\*\}([\s\S]*?)\\end\{align\*\}/g, '$$$\\begin{align*}$1\\end{align*}$$$')
    .replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, '$$$\\begin{equation}$1\\end{equation}$$$')
    .replace(/\\begin\{gather\*?\}([\s\S]*?)\\end\{gather\*?\}/g, '$$$\\begin{gather}$1\\end{gather}$$$');
}

/**
 * Vérifie si une commande est commentée
 */
export function isCommandCommented(line, commandPosInLine) {
  for (let i = 0; i < commandPosInLine; i++) {
    if (line[i] === '%' && (i === 0 || line[i - 1] !== '\\')) {
      return true;
    }
  }
  return false;
}

/**
 * Vérifie la disponibilité de Pandoc
 */
async function checkPandocAvailable() {
  try {
    await execPromise('pandoc --version');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Convertit du LaTeX en HTML avec Pandoc (optimisé pour OpenYourMath V2)
 */
export async function convertLaTeXToHTML(latex) {
  try {
    const pandocAvailable = await checkPandocAvailable();
    if (!pandocAvailable) {
      console.warn('Pandoc not available, using fallback conversion');
      return convertLaTeXToHTMLFallback(latex);
    }

    const latexPreprocessed = preprocessLatex(latex);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'latex-convert-'));
    const tempInputPath = path.join(tempDir, 'temp_input.tex');
    const tempOutputPath = path.join(tempDir, 'temp_output.html');

    const fullDocument = `
\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}
${latexPreprocessed}
\\end{document}
`;
    
    fs.writeFileSync(tempInputPath, fullDocument, 'utf8');

    const pandocCommand = [
      'pandoc',
      `"${tempInputPath}"`,
      '-f latex+smart',
      '-t html',
      '--mathjax',
      '--wrap=preserve',
      '-o', `"${tempOutputPath}"`
    ].join(' ');

    await execPromise(pandocCommand);

    let html = fs.readFileSync(tempOutputPath, 'utf8');
    html = cleanPandocHTML(html);

    fs.unlinkSync(tempInputPath);
    fs.unlinkSync(tempOutputPath);
    fs.rmdirSync(tempDir);

    return html;

  } catch (error) {
    console.error('Pandoc conversion error. The fallback function will be used. Error details:', error);
    return convertLaTeXToHTMLFallback(latex);
  }
}

/**
 * Nettoie le HTML généré par Pandoc pour OpenYourMath
 */
function cleanPandocHTML(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    // CORRECTION D'UN BUG : Il faut utiliser bodyMatch[1] (le contenu)
    // et non bodyMatch (l'array de la regex).
    html = bodyMatch[1];
  }

  html = html
    .replace(/\s+id="[^"]*"/g, '')
    .replace(/\s+data-[^=]*="[^"]*"/g, '')
    .replace(/\s+>/g, '>')
    .trim();

  return html;
}

/**
 * Conversion fallback sans Pandoc (basique)
 */
function convertLaTeXToHTMLFallback(latex) {
  console.warn('Using basic LaTeX→HTML fallback conversion');
  
  let html = latex;
  const basicConversions = {
    '\n\n': '</p><p>',
    '\\\\textbf\\{([^}]+)\\}': '<strong>$1</strong>',
    '\\\\textit\\{([^}]+)\\}': '<em>$1</em>',
    '\\\\emph\\{([^}]+)\\}': '<em>$1</em>',
    '\\\\begin\\{itemize\\}': '<ul>',
    '\\\\end\\{itemize\\}': '</ul>',
    '\\\\begin\\{enumerate\\}': '<ol>',
    '\\\\end\\{enumerate\\}': '</ol>',
    '\\\\item': '<li>',
    '\\\\\\\\': '<br>',
    '\\\\section\\{([^}]+)\\}': '<h2>$1</h2>',
    '\\\\subsection\\{([^}]+)\\}': '<h3>$1</h3>',
    '\\\\subsubsection\\{([^}]+)\\}': '<h4>$1</h4>'
  };

  for (const [pattern, replacement] of Object.entries(basicConversions)) {
    const regex = new RegExp(pattern, 'g');
    html = html.replace(regex, replacement);
  }

  if (!html.includes('<p>') && !html.includes('<ul>') && !html.includes('<ol>')) {
    html = `<p>${html}</p>`;
  }
  return html;
}