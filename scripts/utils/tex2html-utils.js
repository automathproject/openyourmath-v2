// scripts/utils/tex2html-utils.js
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

/** Délimiteurs mathématiques, environnements d'affichage et commentaires. */
const MATH_TOKEN = /\\\\|\\\$|\$\$|\$|\\\[|\\\]|\\\(|\\\)|\\(begin|end)\{(align\*?|gather\*?|equation\*?)\}|(?<!\\)%[^\n]*/g;
const MATH_CLOSER = { '$$': '$$', '$': '$', '\\[': '\\]', '\\(': '\\)' };
/** Forme valable, à l'intérieur d'une formule, des environnements d'affichage. */
const INNER_FORM = { 'align*': 'aligned', align: 'aligned', 'gather*': 'gathered', gather: 'gathered' };

/**
 * Enveloppe les environnements d'affichage avec $$ pour KaTeX.
 *
 * Seuls ceux écrits dans le texte le sont : un align* déjà ouvert dans une
 * formule, « $$\left\{\begin{align*}…\end{align*}\right.$$ », y couperait la
 * formule en morceaux et séparerait \left de son \right. Il y prend plutôt sa
 * forme interne, aligned (ou gathered), la seule que LaTeX accepte là.
 */
export function wrapAlignWithDollar(content) {
  const edits = [];
  const stack = [];
  let math = null;

  for (const match of content.matchAll(MATH_TOKEN)) {
    const [token, action, name] = match;
    if (token.startsWith('%') || token === '\\$' || token === '\\\\') continue;

    if (action === 'begin') {
      stack.push({ match, name, inner: Boolean(math) || stack.length > 0 });
      continue;
    }
    if (action === 'end') {
      const open = stack.pop();
      if (!open) continue;
      const begin = open.match;
      const end = match;
      if (open.inner) {
        const form = INNER_FORM[open.name];
        if (form) {
          edits.push([begin.index, begin.index + begin[0].length, `\\begin{${form}}`]);
          edits.push([end.index, end.index + end[0].length, `\\end{${form}}`]);
        }
      } else if (open.name !== 'align') {
        // Forme historique : l'étoile d'equation et de gather est retirée.
        const env = open.name === 'align*' ? 'align*' : open.name.replace('*', '');
        edits.push([begin.index, begin.index + begin[0].length, `$$\\begin{${env}}`]);
        edits.push([end.index, end.index + end[0].length, `\\end{${env}}$$`]);
      }
      continue;
    }
    // Les $ d'un environnement d'affichage ne délimitent pas de formule.
    if (stack.length > 0) continue;
    if (math === null) math = MATH_CLOSER[token] ?? null;
    else if (token === math) math = null;
  }

  let output = content;
  for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0])) {
    output = output.slice(0, start) + text + output.slice(end);
  }
  return output;
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

/** Nombre groupé par milliers, « 28000 » → « 28\,000 », comme \numprint. */
function groupThousands(value) {
  const match = String(value).trim().match(/^(-?)(\d+)([.,]\d+)?$/);
  if (!match) return value;
  const [, sign, integer, decimals = ''] = match;
  return sign + integer.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') + decimals.replace('.', '{,}').replace(/^,/, '{,}');
}

/**
 * Commandes des feuilles d'Exercices (sources amscc) que pandoc ignore.
 *
 * \colonnes et \fincolonnes règlent la mise en colonnes selon l'affichage des
 * solutions : sans objet sur le site, elles y apparaissaient telles quelles.
 * \numprint et \nombre disparaissaient, et avec eux le nombre qu'ils mettent
 * en forme ; ils sont remplacés par ce nombre groupé par milliers, valable en
 * texte comme en formule.
 */
export function expandExercicesCommands(latex) {
  return markTextBoxes(String(latex || '')
    .replace(/\\(?:fin)?colonnes\s*\{[^{}]*\}\s*\{[^{}]*\}\s*\{[^{}]*\}/g, '')
    .replace(/\\(?:numprint|nombre)\s*\{([^{}]*)\}/g, (_, number) => groupThousands(number)));
}

const BOX_OPEN = 'OYMFBOXOPENMARK';
const BOX_CLOSE = 'OYMFBOXCLOSEMARK';

/** Positions de la chaîne situées dans une formule. */
function mathPositions(content) {
  const inside = new Uint8Array(content.length);
  let closer = null;
  let depth = 0;
  let start = 0;
  for (const match of content.matchAll(MATH_TOKEN)) {
    const [token, action] = match;
    if (token.startsWith('%') || token === '\\$' || token === '\\\\') continue;
    if (action === 'begin') {
      if (closer === null && depth === 0) start = match.index + token.length;
      depth++;
    } else if (action === 'end') {
      depth = Math.max(0, depth - 1);
      if (closer === null && depth === 0) inside.fill(1, start, match.index);
    } else if (depth > 0) {
      continue;
    } else if (closer === null) {
      closer = MATH_CLOSER[token] ?? null;
      start = match.index + token.length;
    } else if (token === closer) {
      inside.fill(1, start, match.index);
      closer = null;
    }
  }
  return inside;
}

/**
 * Encadrés du texte : pandoc supprimait \fbox et \framebox avec leur contenu,
 * si bien que les résultats encadrés d'exo7 manquaient au site. Leur contenu
 * est entouré de marqueurs, que pandoc laisse passer et que
 * restoreTextBoxes() change en <span class="fbox">. Dans une formule, KaTeX
 * les connaît et les rend lui-même.
 */
function markTextBoxes(content) {
  const inMath = mathPositions(content);
  const call = /\\(?:fbox|framebox(?:\s*\[[^\]]*\]){0,2})\s*\{/g;
  let output = '';
  let cursor = 0;
  for (const match of content.matchAll(call)) {
    if (match.index < cursor || inMath[match.index]) continue;
    let depth = 1;
    let end = match.index + match[0].length;
    for (; end < content.length && depth > 0; end++) {
      if (content[end] === '\\') { end++; continue; }
      if (content[end] === '{') depth++;
      else if (content[end] === '}') depth--;
    }
    if (depth > 0) continue;
    const inner = content.slice(match.index + match[0].length, end - 1);
    output += content.slice(cursor, match.index) + BOX_OPEN + inner + BOX_CLOSE;
    cursor = end;
  }
  return output + content.slice(cursor);
}

/** Change en encadrés les marqueurs posés par markTextBoxes(). */
function restoreTextBoxes(html) {
  return html.split(BOX_OPEN).join('<span class="fbox">').split(BOX_CLOSE).join('</span>');
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

    const latexPreprocessed = preprocessLatex(expandExercicesCommands(latex));
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
    html = restoreTextBoxes(cleanPandocHTML(html));

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