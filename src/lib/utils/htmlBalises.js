// src/lib/utils/htmlBalises.js
//
// Rééquilibre un fragment HTML tronqué (aperçu d'exercice coupé à ~150
// caractères). Injecté tel quel par {@html}, un <p> resté ouvert est refermé
// par le navigateur ailleurs que dans le rendu du serveur : l'hydratation de
// Svelte échoue et la page est rendue une seconde fois sous la première.

// Éléments vides : ils n'ont pas de balise fermante.
const VIDES = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/**
 * Referme les balises restées ouvertes et retire les fermetures orphelines.
 * Une balise coupée en plein milieu (« <span cla ») est retirée.
 * @param {string|null|undefined} html
 * @returns {string}
 */
export function fermerBalises(html) {
  if (!html) return '';
  let texte = String(html).replace(/<[^>]*$/, '');
  const ouvertes = [];
  texte = texte.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g, (balise, fermante, nom, autoFermee) => {
    const tag = nom.toLowerCase();
    if (VIDES.has(tag) || autoFermee) return balise;
    if (!fermante) {
      ouvertes.push(tag);
      return balise;
    }
    const i = ouvertes.lastIndexOf(tag);
    if (i < 0) return '';
    // Fermer aussi ce qui a été ouvert à l'intérieur et laissé ouvert.
    const internes = ouvertes.splice(i).slice(1).reverse();
    return internes.map(t => `</${t}>`).join('') + balise;
  });
  return texte + ouvertes.reverse().map(t => `</${t}>`).join('');
}
