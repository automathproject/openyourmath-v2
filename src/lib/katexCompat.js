// src/lib/katexCompat.js
// Ce qui sépare le LaTeX des sources de ce que KaTeX sait rendre.
//
// Le registre (src/lib/macros.js) décrit les macros propres aux exercices,
// connues de KaTeX comme de l'export. Les commandes ci-dessous, elles, existent
// en LaTeX mais pas dans KaTeX : l'export ne doit surtout pas les redéfinir, le
// site doit seulement les traduire. Elles faisaient échouer plus de 1 700
// formules, surtout dans exo7.

import { macros } from './macros.js';

/** Commandes LaTeX que KaTeX 0.18 ignore, traduites en leur équivalent. */
export const KATEX_ONLY_MACROS = {
  // Boîte de texte dans une formule : « \mbox{ si } x > 0 ».
  '\\mbox': '\\text{#1}',
  // Hors d'une formule, \ensuremath en ouvre une ; dans KaTeX on y est déjà.
  '\\ensuremath': '#1',
  // Étiquette d'équation, que \ref et \eqref citent dans le PDF : KaTeX n'en
  // fait rien. Le \def consomme l'argument sans rien afficher.
  '\\label': '\\def\\oymIgnoredLabel{#1}',
  // Petites capitales des noms propres, « \textsc{Cauchy} » : texte droit.
  '\\textsc': '\\text{#1}',
  // Réglages d'espacement, sans objet dans une formule rendue en HTML.
  '\\hfill': '',
  '\\hfil': '',
  '\\null': '',
  '\\bigskip': '',
  // Boîte invisible de la hauteur d'une ligne, à l'appui d'un tableau.
  '\\strut': '\\vphantom{(}',
  // Guillemets de babel-french, souvent dans un \text{…}.
  '\\og': '«\\,',
  '\\fg': '\\,»',
  // Fin de démonstration d'amsthm.
  '\\qed': '\\square',
  // Filet vertical dans une cellule, « 0 &\vline& J ».
  '\\vline': '\\vert',
  // Texte entre deux lignes d'un align : rendu dans la ligne, faute de mieux.
  '\\intertext': '\\text{#1}',
};

/** Macros passées à KaTeX : celles du registre, puis ses seules traductions. */
export const katexMacros = { ...macros, ...KATEX_ONLY_MACROS };

/**
 * Prépare une formule pour KaTeX.
 *
 * L'option de position d'un tableau, « \begin{array}[t]{cccc} », aligne son
 * haut ou son bas sur la ligne de base ; KaTeX la refuse (« Unknown column
 * alignment: [ ») et n'affichait rien. Sans elle, le tableau est centré, comme
 * [c] le demande déjà. \vspace, étoilé ou non, est retiré.
 *
 * @param {string} math
 * @returns {string}
 */
export function prepareMathForKatex(math) {
  return String(math)
    .replace(/\\begin\{array\}\s*\[[tbc]\]/g, '\\begin{array}')
    // Espace vertical, « \vspace*{0.3cm} » : la forme étoilée échappe aux macros.
    .replace(/\\vspace\*?\s*\{[^{}]*\}/g, '');
}
