// src/lib/latex/export.js
// Utilitaires pour la génération de code LaTeX à partir d'exercices

/**
 * Extrait le contenu textuel/LaTeX brut d'un bloc de contenu.
 * Priorité : latex > text > html (strippé)
 * @param {Object} block
 * @returns {string}
 */
export function blockToLatex(block) {
  if (!block) return '';
  if (block.latex) return block.latex.trim();
  if (block.text) return block.text.trim();
  if (block.html) {
    return block.html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }
  return '';
}

/**
 * Échappe les caractères spéciaux LaTeX dans une chaîne de texte brut
 * (titres, noms d'auteurs, etc. — pas pour du contenu mathématique).
 * @param {string} str
 * @returns {string}
 */
export function latexEscapeText(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/\{/g, '\\{').replace(/\}/g, '\\}')
    .replace(/\$/g, '\\$').replace(/%/g, '\\%')
    .replace(/&/g, '\\&').replace(/#/g, '\\#')
    .replace(/_/g, '\\_').replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/**
 * Regroupe les blocs de contenu d'un exercice en groupes question/indications/solutions.
 * Reflète la logique de ExerciseContent.svelte.
 * @param {Object[]} content — tableau de blocs triés par `order`
 * @returns {{ question: Object|null, hints: Object[], solutions: Object[] }[]}
 */
export function groupContentBlocks(content) {
  const sorted = [...content].sort((a, b) => (a.order || 0) - (b.order || 0));
  const groups = [];
  let current = null;

  for (const block of sorted) {
    const type = block.type || 'text';
    if (type === 'question') {
      if (current) groups.push(current);
      current = { question: block, hints: [], solutions: [] };
    } else if (type === 'hint' || type === 'indication') {
      if (current) {
        current.hints.push(block);
      } else {
        groups.push({ question: null, hints: [block], solutions: [] });
      }
    } else if (type === 'reponse' || type === 'solution' || type === 'answer') {
      if (current) {
        current.solutions.push(block);
      } else {
        groups.push({ question: null, hints: [], solutions: [block] });
      }
    } else {
      // Bloc texte standalone
      if (current) groups.push(current);
      current = { question: block, hints: [], solutions: [] };
    }
  }
  if (current) groups.push(current);

  return groups;
}

/**
 * Options de génération LaTeX.
 * @typedef {Object} LatexExportOptions
 * @property {boolean} [includeHints=true]       — inclure les indications
 * @property {boolean} [includeSolutions=true]    — inclure les solutions
 * @property {string}  [hintLabel='Indication :'] — libellé pour les indications
 * @property {string}  [solutionLabel='Solution :'] — libellé pour les solutions
 * @property {string}  [documentClass='article']
 * @property {string}  [fontSize='12pt']
 * @property {string}  [paperSize='a4paper']
 * @property {string}  [margin='2.5cm']
 * @property {string}  [language='french']
 */

/**
 * Génère un document LaTeX complet à partir d'une liste d'exercices.
 * @param {Object[]} exercises   — liste d'objets exercice (avec .title, .content ou .fullExercise.content)
 * @param {string}   title       — titre de la liste
 * @param {LatexExportOptions} options
 * @returns {string}
 */
export function generateLatexDocument(exercises, title, options = {}) {
  const {
    includeHints = true,
    includeSolutions = true,
    hintLabel = 'Indication :',
    solutionLabel = 'Solution :',
    documentClass = 'article',
    fontSize = '12pt',
    paperSize = 'a4paper',
    margin = '2.5cm',
    language = 'french',
  } = options;

  const docTitle = title || "Liste d'exercices";

  const lines = [
    `\\documentclass[${paperSize},${fontSize}]{${documentClass}}`,
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage[T1]{fontenc}',
    `\\usepackage[${language}]{babel}`,
    '\\usepackage{amsmath,amssymb,amsthm}',
    '\\usepackage{geometry}',
    `\\geometry{margin=${margin}}`,
    '',
    `\\title{${latexEscapeText(docTitle)}}`,
    '\\date{}',
    '\\author{}',
    '',
    '\\begin{document}',
    '\\maketitle',
    '',
  ];

  exercises.forEach((ex, i) => {
    const content = ex.fullExercise?.content || ex.content || [];
    const exTitle = ex.title
      ? latexEscapeText(ex.title)
      : `Exercice ${i + 1}`;

    lines.push(`\\section*{Exercice ${i + 1} -- ${exTitle}}`);
    lines.push('');

    const groups = groupContentBlocks(content);

    groups.forEach((group, gi) => {
      if (gi > 0) lines.push('');

      if (group.question) {
        lines.push(blockToLatex(group.question));
        lines.push('');
      }

      if (includeHints && group.hints.length > 0) {
        lines.push(`\\medskip\\textbf{${hintLabel}}`);
        lines.push('');
        group.hints.forEach(h => {
          lines.push(blockToLatex(h));
          lines.push('');
        });
      }

      if (includeSolutions && group.solutions.length > 0) {
        lines.push(`\\medskip\\textbf{${solutionLabel}}`);
        lines.push('');
        group.solutions.forEach(s => {
          lines.push(blockToLatex(s));
          lines.push('');
        });
      }
    });

    lines.push('');
  });

  lines.push('\\end{document}');
  return lines.join('\n');
}

/**
 * Déclenche le téléchargement d'un fichier .tex dans le navigateur.
 * @param {string} content  — contenu LaTeX
 * @param {string} basename — nom de fichier sans extension
 */
export function downloadTexFile(content, basename = 'exercices') {
  const filename = basename.replace(/[^a-z0-9\-_]/gi, '_').toLowerCase();
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.tex`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
