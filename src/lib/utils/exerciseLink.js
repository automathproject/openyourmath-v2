/**
 * Point unique de vérité pour l'ouverture d'un exercice depuis la recherche.
 *
 * La destination était dupliquée dans quatre composants (`window.open(..., '_blank')`
 * recopié à l'identique) pendant que le raccourci clavier, écrit à part, naviguait
 * dans l'onglet courant : les boutons et la touche Entrée ne faisaient pas la même
 * chose. Tout passe désormais par ce module.
 *
 * Choix actuel — nouvel onglet : le retour arrière restaure bien la requête et les
 * filtres (ils sont dans l'URL) mais **perd la pagination et la position de scroll**
 * (40 résultats chargés → 20, scroll → 0). Ouvrir sur place ferait donc perdre à
 * l'utilisateur tout son parcours de résultats.
 *
 * Le jour où `export const snapshot` restaurera cet état dans `src/routes/+page.svelte`,
 * il suffira de passer OPEN_IN_NEW_TAB à false ici : la navigation redeviendra
 * normale partout, et Ctrl/Cmd+clic restera disponible pour qui veut un onglet.
 */

/** @see le commentaire d'en-tête pour la condition de bascule. */
export const OPEN_IN_NEW_TAB = true;

/** Valeurs d'attributs pour une ancre ; `null` fait omettre l'attribut par Svelte. */
export const EXERCISE_LINK_TARGET = OPEN_IN_NEW_TAB ? '_blank' : null;
export const EXERCISE_LINK_REL = OPEN_IN_NEW_TAB ? 'noopener' : null;

/**
 * @param {string | null | undefined} uuid
 * @returns {string} l'URL de la page complète de l'exercice
 */
export function exerciseHref(uuid) {
  return `/exercise/${uuid ?? ''}`;
}

/**
 * Libellé accessible aligné sur la destination réelle : un lien qui ouvre un
 * onglet doit l'annoncer.
 * @param {string} base
 */
export function exerciseOpenLabel(base = "Ouvrir l'exercice") {
  return OPEN_IN_NEW_TAB ? `${base} dans un nouvel onglet` : base;
}

/**
 * Ouverture par programme, pour les déclencheurs qui ne sont pas des ancres
 * (raccourci clavier, boutons des panneaux de prévisualisation).
 * @param {string | null | undefined} uuid
 */
export function openExercise(uuid) {
  if (typeof window === 'undefined' || !uuid) return;
  const href = exerciseHref(uuid);
  if (OPEN_IN_NEW_TAB) window.open(href, '_blank', 'noopener');
  else window.location.href = href;
}

/**
 * Vrai quand le navigateur doit traiter le clic lui-même : Ctrl/Cmd/Maj/Alt+clic
 * ou clic d'un autre bouton que le gauche. Permet à une ancre de conserver ses
 * comportements natifs tout en interceptant le clic simple.
 * @param {MouseEvent} event
 */
export function isModifiedClick(event) {
  if (!event) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true;
  return typeof event.button === 'number' && event.button !== 0;
}
