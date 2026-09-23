import { writable, derived, get } from 'svelte/store';

/**
 * Point unique de vérité pour l'ouverture d'un exercice depuis la recherche.
 *
 * La destination était dupliquée dans quatre composants (`window.open(..., '_blank')`
 * recopié à l'identique) pendant que le raccourci clavier, écrit à part, naviguait
 * dans l'onglet courant : les boutons et la touche Entrée ne faisaient pas la même
 * chose. Tout passe désormais par ce module.
 *
 * Choix actuel — la destination dépend de la plateforme, parce que le compromis
 * n'y est pas le même :
 *
 *  • Desktop → nouvel onglet. La liste de résultats reste ouverte, intacte et
 *    sans dépendre d'aucun cache. C'est précieux quand on prépare une séance,
 *    d'autant que le panneau de prévisualisation affiche déjà l'exercice
 *    complet : « Ouvrir » y sert surtout à lire au calme, imprimer ou partager.
 *
 *  • Mobile → onglet courant. Le nouvel onglet y est un piège : le geste
 *    « retour », réflexe universel, ne ramène pas aux résultats — il faut passer
 *    par le gestionnaire d'onglets. Et le bouton est le gros appel à l'action de
 *    chaque carte, donc le piège est tendu souvent. Le retour reste sans perte
 *    grâce à la restauration de l'état dans `searchStore.js`.
 *
 * Dans les deux cas, les titres de résultats étant de vraies ancres, Ctrl/Cmd+clic
 * reste disponible : le choix final appartient à l'utilisateur.
 */

const DESKTOP_QUERY = '(min-width: 1024px)';

function detectNewTab() {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/** Vrai quand l'ouverture doit se faire dans un nouvel onglet. */
export const opensInNewTab = writable(detectNewTab());

if (typeof window !== 'undefined' && window.matchMedia) {
  window
    .matchMedia(DESKTOP_QUERY)
    .addEventListener('change', (event) => opensInNewTab.set(event.matches));
}

/** Valeurs d'attributs pour une ancre ; `null` fait omettre l'attribut par Svelte. */
export const exerciseLinkTarget = derived(opensInNewTab, (newTab) => (newTab ? '_blank' : null));
export const exerciseLinkRel = derived(opensInNewTab, (newTab) => (newTab ? 'noopener' : null));

/**
 * Libellé accessible aligné sur la destination réelle : un lien qui ouvre un
 * onglet doit l'annoncer, un lien qui navigue sur place ne doit pas le prétendre.
 */
export const exerciseOpenLabel = derived(opensInNewTab, (newTab) =>
  newTab ? "Ouvrir l'exercice dans un nouvel onglet" : "Ouvrir l'exercice"
);

/**
 * @param {string | null | undefined} uuid
 * @returns {string} l'URL de la page complète de l'exercice
 */
export function exerciseHref(uuid) {
  return `/exercise/${uuid ?? ''}`;
}

/**
 * Ouverture par programme, pour les déclencheurs qui ne sont pas des ancres
 * (raccourci clavier, boutons des panneaux de prévisualisation).
 * @param {string | null | undefined} uuid
 */
export function openExercise(uuid) {
  if (typeof window === 'undefined' || !uuid) return;
  const href = exerciseHref(uuid);
  if (get(opensInNewTab)) window.open(href, '_blank', 'noopener');
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
