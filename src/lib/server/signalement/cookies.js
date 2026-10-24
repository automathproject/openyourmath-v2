// src/lib/server/signalement/cookies.js
// Cookies du signalement d'erreur : la session (identité vérifiée, 30 jours)
// et l'état d'une connexion OAuth en cours (10 minutes).

export const COOKIE_SESSION = 'oym_signalement';
export const COOKIE_OAUTH = 'oym_signalement_oauth';

export const DUREE_SESSION_S = 30 * 24 * 3600;
export const DUREE_OAUTH_S = 10 * 60;

/** Options communes : illisibles par le JavaScript de la page, envoyées seulement au même site. */
export const optionsCookie = maxAge => ({ path: '/', httpOnly: true, sameSite: 'lax', maxAge });
