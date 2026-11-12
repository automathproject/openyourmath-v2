// src/lib/db/contentType.js
// Filtre « qcm » de la recherche : '1' ne garde que les qcm, '0' que les
// exercices. Toute autre valeur laisse les deux types de contenu.

/**
 * @param {unknown} value  valeur du filtre (booléen, '1', '0', 'true', 'false')
 * @param {string} [alias] alias SQL de la table exercises
 * @returns {string | null} condition SQL sans paramètre, ou null si le filtre est inactif
 */
export function qcmFilterClause(value, alias = 'e') {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).toLowerCase();
  if (normalized === '1' || normalized === 'true') return `${alias}.content_type = 'qcm'`;
  if (normalized === '0' || normalized === 'false') return `${alias}.content_type != 'qcm'`;
  return null;
}
