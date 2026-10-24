// src/lib/utils/cpgeTexte.js
//
// Rendu HTML des textes officiels des programmes de CPGE (cpge_noeuds.texte et
// contenus). Ces textes sont un Markdown restreint — paragraphes, listes à
// puces, gras et italique — avec des formules entre $…$ que KaTeX rend
// ensuite (MathRenderer). Tout le HTML est échappé d'abord : seules les
// balises produites ici, et les <br> des commentaires, sont rendues.

function echapper(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Gras et italique, hors formules : les * des formules ($a*b$) sont laissés tels quels.
function enLigne(texte) {
  return texte
    .split(/(\$[^$]*\$)/)
    .map((morceau, i) => (i % 2
      ? morceau
      : morceau
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')))
    .join('');
}

/**
 * Markdown restreint → HTML sûr.
 * @param {string|null|undefined} markdown
 * @returns {string}
 */
export function markdownCpge(markdown) {
  if (!markdown) return '';
  const blocs = [];
  let liste = null;
  let paragraphe = [];
  const fermerParagraphe = () => {
    if (paragraphe.length) blocs.push(`<p>${enLigne(paragraphe.join(' '))}</p>`);
    paragraphe = [];
  };
  const fermerListe = () => {
    if (liste) blocs.push(`<ul>${liste.map(item => `<li>${enLigne(item)}</li>`).join('')}</ul>`);
    liste = null;
  };
  for (const ligne of echapper(markdown).split(/\r?\n/)) {
    const puce = ligne.match(/^\s*[-*]\s+(.*)$/);
    if (puce) {
      fermerParagraphe();
      (liste ??= []).push(puce[1]);
    } else if (!ligne.trim()) {
      fermerParagraphe();
      fermerListe();
    } else if (liste && /^\s+/.test(ligne)) {
      liste[liste.length - 1] += ` ${ligne.trim()}`;
    } else {
      fermerListe();
      paragraphe.push(ligne.trim());
    }
  }
  fermerParagraphe();
  fermerListe();
  return blocs.join('\n');
}

/**
 * Une cellule du tableau des contenus : texte échappé, <br> conservés.
 * @param {string|null|undefined} texte
 * @returns {string}
 */
export function celluleCpge(texte) {
  return enLigne(echapper(texte).replace(/&lt;br\s*\/?&gt;/gi, '<br>'));
}
