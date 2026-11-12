// src/lib/server/exerciseMath.js
// Compose côté serveur les formules d'un exercice avant de l'envoyer.

import { renderMathInHtmlCached } from '../katexRender.js';
import { mapBlockHtml } from '../qcm/blocks.js';

/**
 * Remplace le HTML de chaque bloc par sa version dont les formules sont déjà
 * rendues, et le signale par `mathRendered` pour que l'affichage s'en tienne là.
 * Un bloc sans HTML (LaTeX seul) reste tel quel : le navigateur le composera.
 */
export function withRenderedMath(exercise) {
  if (!Array.isArray(exercise?.content)) return exercise;
  return {
    ...exercise,
    content: exercise.content.map((block) =>
      block?.html
        ? { ...mapBlockHtml(block, renderMathInHtmlCached), mathRendered: true }
        : block,
    ),
  };
}
