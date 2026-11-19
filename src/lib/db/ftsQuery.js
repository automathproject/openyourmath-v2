// src/lib/db/ftsQuery.js
// Construction des requêtes FTS5, partagée par la recherche rapide (queries.js)
// et la composante BM25 de la recherche hybride (hybridSearch.js).
//
// Index : tokenize='unicode61 remove_diacritics 1' — casse et accents repliés.
//
// Trois traitements par rapport à un simple « tous les mots en préfixe » :
//   1. toute ponctuation sépare les mots, comme le tokenizer de l'index
//      (« l'intégrale » → l, intégrale ; « Cauchy-Schwarz » → cauchy, schwarz) ;
//      la supprimer collait les morceaux (« cauchyschwarz », introuvable) ;
//   2. les mots vides (de, la, une…) sont retirés, sauf si la requête n'est
//      faite que de ça ;
//   3. les pluriels réguliers sont ramenés au singulier avant le préfixe
//      (« exponentielles » → exponentielle*, qui attrape aussi le pluriel).
//
// Enfin, resolveFtsQuery() bascule en OU quand aucun exercice ne contient tous
// les mots : une requête longue avec un seul terme absent du corpus ne vide
// plus la liste, BM25 classe alors en tête les exercices qui en couvrent le plus.

const STOPWORDS = new Set([
  'a', 'au', 'aux', 'avec', 'ce', 'ces', 'cet', 'cette', 'd', 'dans', 'de', 'des',
  'du', 'en', 'est', 'et', 'l', 'la', 'le', 'les', 'leur', 'leurs', 'n', 'ne',
  'ou', 'par', 'pas', 'pour', 'qu', 'que', 'qui', 's', 'sa', 'sans', 'se', 'ses',
  'son', 'sont', 'sur', 'un', 'une', 'y'
]);

/** Ramène un pluriel régulier au singulier (le préfixe couvre les deux formes). */
export function singularize(token) {
  if (token.length >= 5 && token.endsWith('aux')) return token.slice(0, -2); // normaux → norma
  if (token.length >= 4 && token.endsWith('eux')) return token.slice(0, -1); // jeux → jeu
  if (token.length >= 4 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function stripDiacritics(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Découpe une requête en termes FTS (minuscules, sans ponctuation ni mots vides,
 * pluriels ramenés au singulier). Retourne [] si rien d'exploitable.
 */
export function tokenizeSearchQuery(query) {
  if (!query) return [];
  const raw = String(query)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (raw.length === 0) return [];

  const meaningful = raw.filter((t) => !STOPWORDS.has(stripDiacritics(t)));
  const kept = meaningful.length > 0 ? meaningful : raw;
  return Array.from(new Set(kept.map(singularize)));
}

/**
 * Expression MATCH FTS5. `mode` : 'and' (tous les termes) ou 'or' (au moins un).
 * Retourne null si la requête ne contient aucun terme.
 */
export function buildFtsQuery(query, mode = 'and') {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `${t}*`).join(mode === 'or' ? ' OR ' : ' ');
}

const resolveCache = new Map();
const RESOLVE_CACHE_MAX = 500;

/**
 * Choisit l'expression MATCH : ET si au moins un exercice contient tous les
 * termes, OU sinon. Le choix ignore les filtres, pour rester stable quand on
 * en change (comptages contextuels, facettes).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} query
 * @returns {{ match: string, relaxed: boolean } | null}
 */
export function resolveFtsQuery(db, query) {
  const andQuery = buildFtsQuery(query, 'and');
  if (!andQuery) return null;
  if (!andQuery.includes(' ')) return { match: andQuery, relaxed: false };

  const cached = resolveCache.get(andQuery);
  if (cached) return cached;

  let resolved = { match: andQuery, relaxed: false };
  try {
    const hit = db
      .prepare('SELECT 1 FROM fts_exercises WHERE fts_exercises MATCH ? LIMIT 1')
      .get(andQuery);
    if (!hit) resolved = { match: buildFtsQuery(query, 'or'), relaxed: true };
  } catch {
    // Table absente ou expression refusée : on garde le ET, l'appelant gère l'erreur.
  }

  if (resolveCache.size >= RESOLVE_CACHE_MAX) {
    resolveCache.delete(resolveCache.keys().next().value);
  }
  resolveCache.set(andQuery, resolved);
  return resolved;
}
