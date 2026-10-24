// src/lib/signalement/retour.js
// Retour de la connexion (forge, GitHub) pendant un signalement : le site
// revient sur la page de départ avec ?signalement=<statut>. Sur une page qui
// affiche plusieurs exercices (Ma liste, fiches), il faut savoir lequel
// était en cours de signalement pour le réafficher.

const CLE_EN_COURS = 'oym-signalement:en-cours';

/** Mémorise l'exercice en cours de signalement avant de partir se connecter. */
export function memoriserEnCours(uuid) {
  try { sessionStorage.setItem(CLE_EN_COURS, uuid); } catch { /* stockage indisponible */ }
}

export function oublierEnCours() {
  try { sessionStorage.removeItem(CLE_EN_COURS); } catch { /* stockage indisponible */ }
}

/**
 * Identifiant de l'exercice dont on revient de la connexion, ou null si la
 * page n'est pas un retour de connexion.
 * @param {URL} url
 */
export function exerciceEnRetour(url) {
  if (!url.searchParams.has('signalement')) return null;
  try { return sessionStorage.getItem(CLE_EN_COURS); } catch { return null; }
}
