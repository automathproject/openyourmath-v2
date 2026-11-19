// src/lib/search/queryIntent.js
// Transforme en filtres les mots de la requête qui n'ont presque aucun sens
// mathématique (niveau, filière, type de contenu, présence d'une solution…).
//
//   « suites MPSI »              → q = « suites », filière MPSI
//   « qcm matrices L1 »          → q = « matrices », QCM, niveau L1
//   « séries entières corrigées » → q = « séries entières », avec solution
//
// Seuls les mots sans ambiguïté sont pris (niveau 1 de confiance). Les modules,
// chapitres et la difficulté, qui sont aussi des mots de contenu, restent du
// texte. Un filtre déjà choisi par l'utilisateur gagne toujours : le mot
// correspondant reste alors dans la requête.
//
// Les valeurs produites sont celles du store client ('1' / '0' pour les
// drapeaux) ; filterValueForServer() les convertit pour l'API.

const LEVELS = new Set(['L1', 'L2', 'L3']);

// Sigles courts ou homonymes d'un mot mathématique (ψ, produit…) : reconnus
// seulement s'ils sont tapés en majuscules.
const FILIERES_UPPERCASE_ONLY = new Set(['MP', 'MPI', 'PC', 'PSI', 'PT']);
const FILIERES_ANY_CASE = new Set(['BCPST', 'MP2I', 'MPSI', 'PCSI', 'PTSI']);

// Mots qui font de « L1 », « L2 »… un espace fonctionnel, pas un niveau.
const LEVEL_GUARDS = new Set([
  'norme', 'normes', 'espace', 'espaces', 'convergence', 'converge', 'dans',
  'fonction', 'fonctions', 'integrable', 'integrables', 'distance'
]);

// Mots de liaison retirés avec le niveau ou la filière qui les suit
// (« exercices de L1 », « suites en MPSI », « niveau L2 »).
const LEAD_INS = new Set(['de', 'en', 'pour', 'niveau', 'filiere', 'classe']);

// Drapeaux : mot seul, ou précédé de « avec » / « sans ».
const FLAG_WORDS = new Map([
  ['corrige', 'hasSolution'], ['corriges', 'hasSolution'],
  ['corrigee', 'hasSolution'], ['corrigees', 'hasSolution'],
  ['video', 'hasVideo'], ['videos', 'hasVideo'],
  ['indication', 'hasIndication'], ['indications', 'hasIndication']
]);
// Mots ambigus seuls (« solution d'une équation ») : drapeau seulement après avec / sans.
const FLAG_WORDS_AFTER_PREPOSITION = new Map([
  ...FLAG_WORDS,
  ['solution', 'hasSolution'], ['solutions', 'hasSolution'],
  ['correction', 'hasSolution'], ['corrections', 'hasSolution']
]);
const QCM_WORDS = new Set(['qcm', 'qcms']);

function fold(word) {
  return word.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function isSet(value) {
  return value !== undefined && value !== null && value !== '' && value !== false;
}

function matchFiliere(word) {
  const upper = word.toUpperCase();
  if (FILIERES_ANY_CASE.has(upper)) return upper;
  if (FILIERES_UPPERCASE_ONLY.has(word)) return word;
  return null;
}

/**
 * @param {string} query
 * @param {Record<string, unknown>} [filters]  filtres déjà actifs
 * @returns {{ originalQuery: string, remainingQuery: string,
 *             applied: Array<{ key: string, value: string, token: string }> }}
 */
export function interpretQuery(query, filters = {}) {
  const originalQuery = String(query ?? '').trim();
  const words = Array.from(originalQuery.matchAll(/[\p{L}\p{N}]+/gu), (m) => ({
    text: m[0],
    folded: fold(m[0]),
    start: m.index,
    end: m.index + m[0].length
  }));

  const applied = [];
  const consumed = new Set();
  const taken = (key) => isSet(filters?.[key]) || applied.some((a) => a.key === key);
  const take = (key, value, indexes) => {
    indexes.forEach((i) => consumed.add(i));
    const token = originalQuery.slice(words[indexes[0]].start, words[indexes[indexes.length - 1]].end);
    applied.push({ key, value, token });
  };
  const withLeadIn = (i) => (i > 0 && !consumed.has(i - 1) && LEAD_INS.has(words[i - 1].folded) ? [i - 1, i] : [i]);

  for (let i = 0; i < words.length; i++) {
    if (consumed.has(i)) continue;
    const w = words[i];

    // avec / sans + drapeau
    if ((w.folded === 'avec' || w.folded === 'sans') && i + 1 < words.length) {
      const next = words[i + 1].folded;
      const key = FLAG_WORDS_AFTER_PREPOSITION.get(next) ?? (QCM_WORDS.has(next) ? 'qcm' : null);
      if (key && !taken(key)) {
        take(key, w.folded === 'avec' ? '1' : '0', [i, i + 1]);
        i++;
        continue;
      }
    }

    const upper = w.text.toUpperCase();
    if (LEVELS.has(upper) && !taken('level')) {
      const prev = i > 0 ? words[i - 1].folded : '';
      if (!LEVEL_GUARDS.has(prev)) {
        take('level', upper, withLeadIn(i));
        continue;
      }
    }

    const filiere = matchFiliere(w.text);
    if (filiere && !taken('filiere') && !isSet(filters?.cpge)) {
      take('filiere', filiere, withLeadIn(i));
      continue;
    }

    if (QCM_WORDS.has(w.folded) && !taken('qcm')) {
      take('qcm', '1', [i]);
      continue;
    }

    const flag = FLAG_WORDS.get(w.folded);
    if (flag && !taken(flag)) {
      take(flag, '1', [i]);
    }
  }

  if (applied.length === 0) {
    return { originalQuery, remainingQuery: originalQuery, applied };
  }

  let remaining = '';
  let cursor = 0;
  words.forEach((w, i) => {
    if (!consumed.has(i)) return;
    remaining += originalQuery.slice(cursor, w.start);
    cursor = w.end;
  });
  remaining += originalQuery.slice(cursor);
  remaining = remaining
    .replace(/\s+([,;:.!?])/g, '$1')
    .replace(/([,;:])(?=[,;:])/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:.\-–]+|[\s,;:\-–]+$/g, '')
    .trim();

  return { originalQuery, remainingQuery: remaining, applied };
}

/** Valeur attendue par les filtres côté serveur (booléens pour les drapeaux). */
export function filterValueForServer(key, value) {
  if (['hasSolution', 'hasIndication', 'hasVideo', 'qcm'].includes(key)) return value === '1';
  return value;
}
