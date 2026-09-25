// src/lib/latex/listLatexDraft.js
// Brouillons du source LaTeX modifié depuis le mode « Éditer » d'une liste.
//
// Le source d'une liste est régénéré à chaque ouverture : sans brouillon, la
// moindre retouche serait perdue en changeant de mode ou en rechargeant la
// page. Un brouillon est rangé sous la composition exacte de la liste (ses
// uuids, dans l'ordre) et garde le source généré qui lui a servi de base, pour
// signaler quand les exercices ont changé depuis.
//
// Toutes les fonctions reçoivent le stockage en paramètre : le module ne
// touche jamais `localStorage` directement, ce qui le rend testable hors
// navigateur et tolérant à un stockage indisponible (navigation privée).

export const DRAFTS_STORAGE_KEY = 'oym-list-latex-drafts-v1';

/** Au-delà, les brouillons les plus anciens sont oubliés. */
export const MAX_DRAFTS = 10;

/**
 * @typedef {Object} ListLatexDraft
 * @property {string[]} uuids   — composition de la liste au moment de l'édition
 * @property {string}   source  — source modifié par l'utilisateur
 * @property {string}   base    — source généré à partir duquel il a été modifié
 * @property {{ includeHints: boolean, includeSolutions: boolean, solutionsAtEnd: boolean }} content
 *   — options de contenu ayant produit `base`
 * @property {number}   savedAt — horodatage de la dernière modification (ms)
 */

/**
 * Clé d'un brouillon : l'ordre compte, puisqu'il détermine le document.
 * @param {string[]} uuids
 */
export function draftKey(uuids) {
  return uuids.join(',');
}

/**
 * @param {Storage | null | undefined} storage
 * @returns {Record<string, ListLatexDraft>}
 */
export function readDrafts(storage) {
  try {
    const raw = storage?.getItem(DRAFTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // Stockage indisponible ou contenu corrompu : on repart sans brouillon.
    return {};
  }
}

/**
 * @param {Storage | null | undefined} storage
 * @param {Record<string, ListLatexDraft>} drafts
 */
function writeDrafts(storage, drafts) {
  try {
    storage?.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Stockage plein ou refusé : non bloquant, le source reste dans l'éditeur.
  }
}

/**
 * Cherche le brouillon d'une liste.
 *
 * Sans brouillon pour cette composition exacte, propose le plus récent qui
 * partage au moins un exercice avec elle : ajouter un exercice à une liste
 * déjà retouchée ne doit pas faire disparaître les retouches sans prévenir.
 *
 * @param {Record<string, ListLatexDraft>} drafts
 * @param {string[]} uuids
 * @returns {{ draft: ListLatexDraft, exact: boolean } | null}
 */
export function findDraft(drafts, uuids) {
  if (uuids.length === 0) return null;
  const exact = drafts[draftKey(uuids)];
  if (isValidDraft(exact)) return { draft: exact, exact: true };

  const wanted = new Set(uuids);
  let best = null;
  for (const draft of Object.values(drafts)) {
    if (!isValidDraft(draft)) continue;
    if (!draft.uuids.some((uuid) => wanted.has(uuid))) continue;
    if (!best || draft.savedAt > best.savedAt) best = draft;
  }
  return best ? { draft: best, exact: false } : null;
}

/**
 * Enregistre un brouillon sous la composition qu'il porte, en ne gardant que
 * les `MAX_DRAFTS` plus récents.
 *
 * @param {Storage | null | undefined} storage
 * @param {ListLatexDraft} draft
 */
export function saveDraft(storage, draft) {
  const drafts = readDrafts(storage);
  drafts[draftKey(draft.uuids)] = draft;
  const kept = Object.entries(drafts)
    .filter(([, value]) => isValidDraft(value))
    .sort(([, a], [, b]) => b.savedAt - a.savedAt)
    .slice(0, MAX_DRAFTS);
  writeDrafts(storage, Object.fromEntries(kept));
}

/**
 * @param {Storage | null | undefined} storage
 * @param {string[]} uuids
 */
export function removeDraft(storage, uuids) {
  const drafts = readDrafts(storage);
  const key = draftKey(uuids);
  if (!(key in drafts)) return;
  delete drafts[key];
  writeDrafts(storage, drafts);
}

/**
 * Ligne (1-indexée) où commence un exercice dans le source.
 *
 * Le générateur ouvre chaque exercice par un commentaire portant son uuid
 * entre crochets. On le retrouve par ce marqueur plutôt que par les ancres
 * calculées à la génération : elles ne valent plus rien dès que l'utilisateur
 * a ajouté ou retiré des lignes au-dessus.
 *
 * @param {string} source
 * @param {string} uuid
 * @returns {number | null}
 */
export function findExerciseLine(source, uuid) {
  if (!uuid) return null;
  const marker = `[${uuid}]`;
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimStart();
    if (line.startsWith('%') && line.includes(marker)) return i + 1;
  }
  return null;
}

/** @param {unknown} draft */
function isValidDraft(draft) {
  return Boolean(
    draft &&
      typeof draft === 'object' &&
      Array.isArray(/** @type {any} */ (draft).uuids) &&
      typeof (/** @type {any} */ (draft).source) === 'string' &&
      typeof (/** @type {any} */ (draft).base) === 'string' &&
      typeof (/** @type {any} */ (draft).savedAt) === 'number',
  );
}
