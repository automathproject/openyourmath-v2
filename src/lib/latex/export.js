// src/lib/latex/export.js
// Utilitaires pour la génération de code LaTeX à partir d'exercices

// Équivalents LaTeX des macros KaTeX définies dans src/lib/macros.js
const LATEX_MACROS = [
  // Ensembles de nombres
  '\\newcommand{\\N}{\\mathbb{N}}',
  '\\newcommand{\\Nn}{\\mathbb{N}}',
  '\\newcommand{\\R}{\\mathbb{R}}',
  '\\newcommand{\\Rr}{\\mathbb{R}}',
  '\\newcommand{\\Z}{\\mathbb{Z}}',
  '\\newcommand{\\Zz}{\\mathbb{Z}}',
  '\\newcommand{\\Kk}{\\mathbb{K}}',
  '\\newcommand{\\Q}{\\mathbb{Q}}',
  '\\newcommand{\\Qq}{\\mathbb{Q}}',
  '\\newcommand{\\Cp}{\\mathbb{C}}',
  '\\newcommand{\\CC}{\\mathbb{C}}',
  '\\newcommand{\\Cc}{\\mathbb{C}}',
  '\\newcommand{\\C}{\\mathbb{C}}',
  '\\newcommand{\\BB}{\\mathbb{B}}',
  '\\newcommand{\\DD}{\\mathbb{D}}',
  '\\newcommand{\\EE}{\\mathbb{E}}',
  '\\renewcommand{\\AA}{\\mathbb{A}}',
  // Analyse complexe
  '\\newcommand{\\RRe}{\\mathrm{Re}}',
  '\\newcommand{\\IIm}{\\mathrm{Im}}',
  // Probabilités
  '\\newcommand{\\E}{\\mathbb{E}}',
  '\\newcommand{\\EX}{\\mathbb{E}(X)}',
  '\\newcommand{\\var}{\\mathrm{Var}}',
  '\\newcommand{\\V}{\\mathrm{V}}',
  '\\newcommand{\\PP}{\\mathrm{P}}',
  '\\newcommand{\\prob}{\\mathrm{P}}',
  '\\newcommand{\\p}{\\mathrm{P}}',
  // Opérateurs
  '\\newcommand{\\pgcd}{\\mathrm{pgcd}}',
  '\\newcommand{\\ppcm}{\\mathrm{ppcm}}',
  '\\newcommand{\\card}{\\mathrm{card}}',
  '\\newcommand{\\Vect}{\\mathrm{Vect}}',
  '\\newcommand{\\Ker}{\\mathrm{Ker}}',
  '\\newcommand{\\id}{\\mathrm{id}}',
  '\\newcommand{\\Id}{\\mathrm{Id}}',
  // Fonctions trigonométriques / hyperboliques
  '\\newcommand{\\cotan}{\\mathrm{cotan}}',
  '\\newcommand{\\Arccos}{\\mathrm{Arccos}}',
  '\\newcommand{\\Arcsin}{\\mathrm{Arcsin}}',
  '\\newcommand{\\Arctan}{\\mathrm{Arctan}}',
  '\\newcommand{\\Argch}{\\mathrm{Argch}}',
  '\\newcommand{\\Argsh}{\\mathrm{Argsh}}',
  '\\newcommand{\\Argth}{\\mathrm{Argth}}',
  // Géométrie / vecteurs
  '\\newcommand{\\uu}{\\overrightarrow{u}}',
  '\\newcommand{\\vv}{\\overrightarrow{v}}',
  '\\newcommand{\\ww}{\\overrightarrow{w}}',
  // Intégrales / différentielles
  '\\newcommand{\\dx}{\\hspace{.6mm}\\mathrm{d}x}',
  '\\newcommand{\\dy}{\\hspace{.6mm}\\mathrm{d}y}',
  '\\newcommand{\\dz}{\\hspace{.6mm}\\mathrm{d}z}',
  '\\newcommand{\\dt}{\\hspace{.6mm}\\mathrm{d}t}',
  '\\newcommand{\\du}{\\hspace{.6mm}\\mathrm{d}u}',
  '\\newcommand{\\dv}{\\hspace{.6mm}\\mathrm{d}v}',
  '\\newcommand{\\dd}{\\textup{d}}',
  // Dérivées partielles (avec arguments)
  '\\newcommand{\\dpa}[2]{\\frac{\\partial #1}{\\partial #2}}',
  '\\newcommand{\\dpsm}[3]{\\frac{\\partial^2 #1}{\\partial #2 \\, \\partial #3}}',
  '\\newcommand{\\dpsp}[2]{\\frac{\\partial^2 #1}{\\partial #2^2}}',
  // Ensembles solutions / parties
  '\\newcommand{\\Sol}{\\mathscr{S}}',
  '\\newcommand{\\Pn}{\\mathscr{P}}',
  '\\newcommand{\\Pnn}{\\mathscr{P}}',
  // Norme triple
  '\\newcommand{\\vvvert}{\\vert\\!\\vert\\!\\vert}',
  // Abréviations logique / texte
  '\\newcommand{\\et}{\\text{ et }}',
  '\\newcommand{\\ou}{\\text{ ou }}',
  '\\newcommand{\\qeq}{\\quad\\text{et}\\quad}',
  '\\newcommand{\\eq}{\\;\\Leftrightarrow\\;}',
  '\\newcommand{\\impl}{\\;\\Rightarrow\\;}',
  '\\newcommand{\\lr}{\\longrightarrow}',
  '\\newcommand{\\vide}{\\varnothing}',
  '\\newcommand{\\ep}{\\varepsilon}',
  '\\newcommand{\\dlim}{\\displaystyle\\lim}',
];

// Nom de macro extrait de sa définition, pour la détection d'usage
const MACRO_DEFS = LATEX_MACROS.map((def) => {
  const m = def.match(/\\(?:re)?newcommand\{\\([a-zA-Z]+)\}/);
  return { name: m ? m[1] : null, def };
}).filter((d) => d.name);

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
  return normalizeLatexTypography(str)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/\{/g, '\\{').replace(/\}/g, '\\}')
    .replace(/\$/g, '\\$').replace(/%/g, '\\%')
    .replace(/&/g, '\\&').replace(/#/g, '\\#')
    .replace(/_/g, '\\_').replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/**
 * Remplace les apostrophes typographiques qu'insèrent fréquemment les IA ou
 * les traitements de texte par l'apostrophe ASCII, sûre avec tous les moteurs
 * LaTeX ciblés par l'export. Les lettres accentuées restent quant à elles
 * inchangées et sont prises en charge par l'encodage UTF-8 du document.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeLatexTypography(value) {
  return String(value || '').replace(/[\u2018\u2019\u02BC]/g, "'");
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

/** Contenu (blocs) d'un exercice, quel que soit son niveau de chargement. */
function exerciseContent(ex) {
  return ex?.fullExercise?.content || ex?.content || [];
}

/** Concaténation du LaTeX brut de tous les blocs d'un exercice. */
function exerciseRawLatex(ex) {
  return exerciseContent(ex).map((b) => b.latex || '').join('\n');
}

/**
 * Indique si un exercice référence des ressources externes (images, blocs de
 * code SaveVerbatim) nécessitant le chargement de son fichier d'artifacts.
 * @param {Object} ex
 * @returns {boolean}
 */
export function exerciseNeedsArtifacts(ex) {
  return /\\(?:BUseVerbatim|includegraphics)\b/.test(exerciseRawLatex(ex));
}

/**
 * Charge les fichiers d'artifacts (/artifacts/<uuid>.json) des exercices qui
 * en ont besoin (images \includegraphics, blocs de code SaveVerbatim).
 * @param {Object[]} exercises
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<Record<string, Object>>} map uuid → artifacts
 */
export async function fetchArtifactsMap(exercises, fetchFn = typeof fetch !== 'undefined' ? fetch : null) {
  const map = {};
  if (!fetchFn) return map;

  const targets = (exercises || []).filter((ex) => ex?.uuid && exerciseNeedsArtifacts(ex));
  await Promise.all(
    targets.map(async (ex) => {
      try {
        const res = await fetchFn(`/artifacts/${ex.uuid}.json`);
        if (res.ok) {
          map[ex.uuid] = await res.json();
        }
      } catch {
        // artifacts indisponibles : l'export reste utilisable (chemins d'origine conservés)
      }
    })
  );
  return map;
}

/**
 * Options de génération LaTeX.
 * @typedef {Object} LatexExportOptions
 * @property {boolean} [includeHints=true]      — inclure les indications
 * @property {boolean} [includeSolutions=true]  — inclure les réponses
 * @property {boolean} [solutionsAtEnd=false]   — regrouper les réponses dans une section finale
 * @property {Record<string, Object>} [artifactsMap] — artifacts par uuid (images / code)
 * @property {string}  [origin='']              — origine du site pour les URLs des images
 * @property {string}  [hintLabel='Indication.']
 * @property {string}  [solutionLabel='Solution.']
 * @property {string}  [documentClass='article']
 * @property {string}  [fontSize='12pt']
 * @property {string}  [paperSize='a4paper']
 * @property {string}  [margin='2.5cm']
 * @property {string}  [language='french']
 */

const SEPARATOR = '% ' + '='.repeat(68);

/** Ligne de commentaire sûre (sans retour à la ligne). */
function commentLine(text) {
  return `% ${String(text).replace(/\s+/g, ' ').trim()}`;
}

/**
 * Supprime l'indentation commune héritée du fichier source
 * (la première ligne est déjà trimée par blockToLatex).
 */
function dedentLatex(latex) {
  const lines = latex.split('\n');
  if (lines.length <= 1) return latex;

  let prefix = null;
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const ws = line.match(/^[ \t]*/)[0];
    if (prefix === null) {
      prefix = ws;
    } else {
      let k = 0;
      while (k < prefix.length && k < ws.length && prefix[k] === ws[k]) k++;
      prefix = prefix.slice(0, k);
    }
    if (!prefix) return latex;
  }
  if (!prefix) return latex;

  return lines
    .map((line, i) => (i === 0 ? line : line.startsWith(prefix) ? line.slice(prefix.length) : line))
    .join('\n');
}

/**
 * Corrige des erreurs de transcription fréquentes dans les blocs produits par
 * l'assistant IA avant de construire le document autonome destiné au PDF.
 * La source OpenYourMath d'origine reste inchangée : cette passe ne s'applique
 * qu'à l'export compilable.
 *
 * @param {string} latex
 * @returns {string}
 */
export function normalizeLatexForCompilation(latex) {
  const corrected = normalizeLatexTypography(latex)
    // `\\textbf` est une double échappement de l'IA. Deux antislashs suivis
    // directement de `textbf` ne forment pas une commande LaTeX valide.
    .replace(/\\\\(textbf|textit|emph|underline)\b/g, '\\$1');

  return corrected.split('\n').map((line) => {
    const indentation = line.match(/^[ \t]*/)?.[0] || '';
    const content = line.trim();
    // Une commande opérateur isolée est une formule, mais l'IA oublie parfois
    // les délimiteurs. On ne touche pas aux lignes déjà mathématiques ou aux
    // environnements LaTeX.
    if (
      /^\\operatorname\b/.test(content) &&
      !content.includes('$') &&
      !content.startsWith('\\[') &&
      !content.startsWith('\\begin{')
    ) {
      return `${indentation}$${content}$`;
    }
    return line;
  }).join('\n');
}

/**
 * Réécrit les chemins \includegraphics d'un exercice vers un dossier local
 * images/ et renvoie la liste des fichiers à télécharger.
 */
function rewriteImagePaths(latex, artifacts) {
  const images = artifacts?.images || [];
  const required = [];
  let out = latex;

  for (const img of images) {
    if (!img?.originalPath || !img?.url) continue;
    const localPath = img.url.replace(/^\/artifacts\/images\//, 'images/');
    if (out.includes(`{${img.originalPath}}`)) {
      out = out.split(`{${img.originalPath}}`).join(`{${localPath}}`);
      required.push({ localPath, url: img.url });
    }
  }
  return { latex: out, required };
}

/** Blocs SaveVerbatim requis par le LaTeX d'un exercice. */
function requiredCodeBlocks(latex, artifacts) {
  const codes = artifacts?.code || [];
  return codes.filter((c) => c?.name && latex.includes(`\\BUseVerbatim{${c.name}}`));
}

/**
 * Construit le préambule minimal en fonction du corps du document :
 * seules les macros réellement utilisées et les packages nécessaires
 * sont inclus.
 */
function buildPreamble(body, docTitle, options) {
  const {
    documentClass = 'article',
    fontSize = '12pt',
    paperSize = 'a4paper',
    margin = '2.5cm',
    language = 'french',
  } = options;

  // Macros utilisées dans le corps
  const usedMacros = MACRO_DEFS.filter(({ name }) =>
    new RegExp(`\\\\${name}(?![a-zA-Z])`).test(body)
  ).map(({ def }) => def);

  // Détection de packages sur corps + macros retenues
  const scan = body + '\n' + usedMacros.join('\n');
  const has = (re) => re.test(scan);

  const lines = [`\\documentclass[${paperSize},${fontSize}]{${documentClass}}`];
  lines.push('\\usepackage[utf8]{inputenc}');
  lines.push('\\usepackage[T1]{fontenc}');
  lines.push('\\usepackage{lmodern}');
  lines.push(`\\usepackage[${language}]{babel}`);
  lines.push('\\usepackage{amsmath,amssymb}');
  if (has(/\\mathscr\b/)) lines.push('\\usepackage{mathrsfs}');
  if (has(/\\llbracket|\\rrbracket|\\llparenthesis/)) lines.push('\\usepackage{stmaryrd}');
  if (has(/\\includegraphics\b/)) lines.push('\\usepackage{graphicx}');
  if (has(/\\begin\{(?:SaveVerbatim|Verbatim|BVerbatim)\}|\\BUseVerbatim\b/)) {
    lines.push('\\usepackage{fancyvrb}');
  }
  if (has(/\\begin\{tikzpicture\}/)) {
    lines.push('\\usepackage{tikz}');
    lines.push('\\usetikzlibrary{arrows,arrows.meta,calc,positioning,shapes,patterns,decorations.markings,decorations.pathmorphing}');
  } else if (has(/\\textcolor\b|\\definecolor\b|\\color[{[]/)) {
    lines.push('\\usepackage{xcolor}');
  }
  if (has(/\\begin\{multicols\}/)) lines.push('\\usepackage{multicol}');
  if (has(/\\toprule|\\midrule|\\bottomrule/)) lines.push('\\usepackage{booktabs}');
  if (has(/\\SI\{|\\si\{|\\num\{/)) lines.push('\\usepackage{siunitx}');
  lines.push(`\\usepackage[margin=${margin}]{geometry}`);
  if (has(/\\url\{|\\href\{/)) lines.push('\\usepackage[hidelinks]{hyperref}');

  if (has(/\\geogebra\b/)) {
    lines.push('');
    lines.push('% Les animations GeoGebra ne sont visibles qu\'en ligne');
    lines.push('\\newcommand{\\geogebra}[1]{\\par\\noindent\\emph{[Animation GeoGebra : \\texttt{#1}]}\\par}');
  }

  if (usedMacros.length > 0) {
    lines.push('');
    lines.push('% Macros utilisées par les exercices de cette liste');
    lines.push(...usedMacros);
  }

  lines.push('');
  lines.push(`\\title{${latexEscapeText(docTitle)}}`);
  lines.push('\\date{}');
  lines.push('\\author{}');

  return lines;
}

/**
 * Génère le document LaTeX complet et les ancres de navigation.
 *
 * @param {Object[]} exercises — liste d'objets exercice (format listStore)
 * @param {string}   title     — titre de la liste
 * @param {LatexExportOptions} options
 * @returns {{ source: string, anchors: { uuid: string, title: string, index: number, line: number }[] }}
 *   `line` : numéro de ligne (1-indexé) du début de l'exercice dans `source`.
 */
export function buildLatexExport(exercises, title, options = {}) {
  const {
    includeHints = true,
    includeSolutions = true,
    solutionsAtEnd = false,
    artifactsMap = {},
    origin = '',
    hintLabel = 'Indication.',
    solutionLabel = 'Solution.',
  } = options;

  const docTitle = title || "Liste d'exercices";
  const list = exercises || [];

  const body = [];
  const anchors = [];
  const allImages = [];
  // Réponses collectées pour la section finale : { num, title, items: [{label, latex}] }
  const deferredSolutions = [];

  list.forEach((ex, i) => {
    const num = i + 1;
    const artifacts = artifactsMap[ex.uuid];
    const exTitle = ex.title || `Exercice ${num}`;

    if (body.length > 0) body.push('');

    // En-tête de navigation
    anchors.push({ uuid: ex.uuid, title: exTitle, index: i, line: body.length + 1 });
    body.push(SEPARATOR);
    body.push(commentLine(`Exercice ${num} — ${exTitle}  [${ex.uuid}]`));
    const meta = [ex.chapter, ex.author, ex.level, ex.difficulty ? `difficulté ${ex.difficulty}/5` : '']
      .filter(Boolean).join(' — ');
    if (meta) body.push(commentLine(meta));
    body.push(SEPARATOR);

    // Réécriture des images + collecte des fichiers requis
    const rewriteBlock = (latex) => {
      const { latex: rewritten, required } = rewriteImagePaths(latex, artifacts);
      for (const r of required) {
        if (!allImages.some((im) => im.localPath === r.localPath)) allImages.push(r);
      }
      return rewritten;
    };

    const rawLatex = exerciseRawLatex(ex);

    // Blocs de code SaveVerbatim requis par cet exercice
    const codeBlocks = requiredCodeBlocks(rawLatex, artifacts);
    if (codeBlocks.length > 0) {
      body.push('');
      for (const code of codeBlocks) {
        body.push(commentLine(`Code ${code.language || 'texte'}`));
        body.push(`\\begin{SaveVerbatim}{${code.name}}`);
        body.push(...String(code.content || '').split('\n'));
        body.push('\\end{SaveVerbatim}');
      }
    }

    body.push('');
    body.push(`\\section*{Exercice ${num} — ${latexEscapeText(exTitle)}}`);
    body.push('');

    const groups = groupContentBlocks(exerciseContent(ex));
    const isQuestionGroup = (g) => g.question?.type === 'question';
    const questionIndices = groups
      .map((g, gi) => (isQuestionGroup(g) ? gi : -1))
      .filter((gi) => gi >= 0);
    const useEnumerate = questionIndices.length >= 2;
    const lastQuestionIndex = questionIndices.length > 0 ? questionIndices[questionIndices.length - 1] : -1;

    const exSolutions = [];
    let questionNumber = 0;
    let inEnumerate = false;

    const pushBlockLatex = (block, indent = '') => {
      let latex = rewriteBlock(dedentLatex(blockToLatex(block)));
      if (block?.type !== 'code') latex = normalizeLatexForCompilation(latex);
      if (block?.type === 'code') {
        body.push(`${indent}\\begin{Verbatim}`);
        body.push(...latex.split('\n'));
        body.push(`${indent}\\end{Verbatim}`);
      } else {
        body.push(...latex.split('\n').map((l) => (l ? indent + l : l)));
      }
    };

    const pushLabelled = (label, blocks, indent) => {
      body.push('');
      // L'intitulé est un petit paragraphe autonome : il ne se confond pas
      // avec le texte qui suit et reste correct si le bloc débute par une
      // formule affichée, un tableau ou un autre environnement.
      body.push(`${indent}\\par\\smallskip\\noindent{\\small\\textbf{${label}}}\\par\\nobreak\\smallskip`);
      blocks.forEach((b) => pushBlockLatex(b, indent));
    };

    groups.forEach((group, gi) => {
      const isQuestion = isQuestionGroup(group);

      if (isQuestion) {
        questionNumber++;
        if (useEnumerate && !inEnumerate) {
          body.push('\\begin{enumerate}');
          inEnumerate = true;
        }
        if (useEnumerate) {
          body.push('');
          body.push('  \\item');
        }
      } else if (inEnumerate && gi > lastQuestionIndex) {
        // Plus aucune question à venir : on peut refermer la liste
        body.push('\\end{enumerate}');
        body.push('');
        inEnumerate = false;
      } else if (inEnumerate) {
        // Texte intercalé entre deux questions : reste dans la liste
        // pour préserver la numérotation
        body.push('');
      }

      const indent = inEnumerate ? '  ' : '';

      if (group.question) {
        pushBlockLatex(group.question, indent);
        if (!inEnumerate) body.push('');
      }

      if (includeHints && group.hints.length > 0) {
        pushLabelled(hintLabel, group.hints, indent);
      }

      if (includeSolutions && group.solutions.length > 0) {
        if (solutionsAtEnd) {
          exSolutions.push({
            label: isQuestion && useEnumerate ? `Question ${questionNumber}.` : '',
            blocks: group.solutions,
          });
        } else {
          pushLabelled(solutionLabel, group.solutions, indent);
        }
      }
    });

    if (inEnumerate) {
      body.push('\\end{enumerate}');
    }

    if (exSolutions.length > 0) {
      deferredSolutions.push({ num, title: exTitle, items: exSolutions, rewriteBlock });
    }
  });

  // Section finale des réponses regroupées
  if (includeSolutions && solutionsAtEnd && deferredSolutions.length > 0) {
    body.push('');
    body.push(SEPARATOR);
    body.push(commentLine('Réponses'));
    body.push(SEPARATOR);
    body.push('');
    body.push('\\clearpage');
    body.push('\\section*{Réponses}');

    for (const sol of deferredSolutions) {
      body.push('');
      body.push(`\\subsection*{Exercice ${sol.num} — ${latexEscapeText(sol.title)}}`);
      sol.items.forEach((item, idx) => {
        if (idx > 0 || item.label) body.push('');
        if (item.label) {
          body.push(`\\par\\medskip\\noindent\\textbf{${item.label}}`);
        }
        item.blocks.forEach((b) => {
          let latex = sol.rewriteBlock(dedentLatex(blockToLatex(b)));
          if (b?.type !== 'code') latex = normalizeLatexForCompilation(latex);
          if (b?.type === 'code') {
            body.push('\\begin{Verbatim}');
            body.push(...latex.split('\n'));
            body.push('\\end{Verbatim}');
          } else {
            body.push(...latex.split('\n'));
          }
        });
      });
    }
  }

  const bodyText = body.join('\n');
  const preamble = buildPreamble(bodyText, docTitle, options);

  // En-tête du fichier
  const header = [SEPARATOR];
  header.push(commentLine(docTitle));
  header.push(commentLine(`Généré par OpenYourMath — ${list.length} exercice${list.length > 1 ? 's' : ''}`));
  const optsDesc = [
    includeHints ? 'indications incluses' : 'sans indications',
    includeSolutions ? (solutionsAtEnd ? 'réponses regroupées à la fin' : 'réponses incluses') : 'sans réponses',
  ].join(', ');
  header.push(commentLine(optsDesc));
  if (allImages.length > 0) {
    header.push('%');
    header.push(commentLine('Images requises — à placer à côté du fichier .tex :'));
    for (const img of allImages) {
      header.push(commentLine(`${img.localPath}  ←  ${origin}${img.url}`));
    }
  }
  header.push(SEPARATOR);
  header.push('');

  const preambleLines = [...header, ...preamble, '', '\\begin{document}', '\\maketitle', ''];

  const source = [...preambleLines, ...body, '', '\\end{document}', ''].join('\n');

  const offset = preambleLines.length;
  const shiftedAnchors = anchors.map((a) => ({ ...a, line: a.line + offset }));

  return { source, anchors: shiftedAnchors };
}

/**
 * Génère un document LaTeX complet à partir d'une liste d'exercices.
 * (wrapper rétro-compatible autour de buildLatexExport)
 * @param {Object[]} exercises
 * @param {string}   title
 * @param {LatexExportOptions} options
 * @returns {string}
 */
export function generateLatexDocument(exercises, title, options = {}) {
  return buildLatexExport(exercises, title, options).source;
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
