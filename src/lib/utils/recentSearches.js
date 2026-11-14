// Recherches récentes, gardées dans ce navigateur seulement. Le stockage peut
// être indisponible (navigation privée, données bloquées) : on fait alors
// comme si la liste était vide.

const KEY = 'oym:recherches-recentes';
const MAX = 5;

/** @returns {string[]} */
export function getRecentSearches() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Place `query` en tête, sans doublon (à la casse près). */
export function addRecentSearch(query) {
  const q = query?.trim();
  if (!q) return;
  const rest = getRecentSearches().filter((item) => item.toLowerCase() !== q.toLowerCase());
  try {
    localStorage.setItem(KEY, JSON.stringify([q, ...rest].slice(0, MAX)));
  } catch {
    // Stockage indisponible : rien à mémoriser.
  }
}
