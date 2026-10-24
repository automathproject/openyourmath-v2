// src/lib/server/signalement/session.js
//
// Jetons signés (HMAC-SHA256) portés par des cookies httpOnly : l'identité
// vérifiée de la personne qui signale, et l'état d'une connexion OAuth en
// cours. Ils ne contiennent aucun jeton des fournisseurs : celui-ci sert une
// seule fois à lire le profil, puis il est oublié.

import { createHmac, randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const b64url = buf => Buffer.from(buf).toString('base64url');

/**
 * @param {object} donnees
 * @param {string} secret
 * @param {number} dureeS  durée de validité en secondes
 */
export function signer(donnees, secret, dureeS) {
  const charge = b64url(JSON.stringify({ ...donnees, exp: Math.floor(Date.now() / 1000) + dureeS }));
  const signature = createHmac('sha256', secret).update(charge).digest('base64url');
  return `${charge}.${signature}`;
}

/**
 * @param {string|undefined} jeton
 * @param {string} secret
 * @returns {object|null}  les données, ou null si le jeton est absent, altéré ou expiré
 */
export function verifier(jeton, secret) {
  if (!jeton || !secret) return null;
  const [charge, signature] = jeton.split('.');
  if (!charge || !signature) return null;
  // Comparaison du texte, pas des octets décodés : le dernier caractère
  // base64url porte des bits ignorés, plusieurs écritures donneraient les
  // mêmes octets.
  const attendue = Buffer.from(createHmac('sha256', secret).update(charge).digest('base64url'));
  const recue = Buffer.from(signature);
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) return null;
  try {
    const donnees = JSON.parse(Buffer.from(charge, 'base64url').toString('utf8'));
    if (typeof donnees.exp !== 'number' || donnees.exp < Date.now() / 1000) return null;
    return donnees;
  } catch {
    return null;
  }
}

export const aleatoire = (octets = 32) => b64url(randomBytes(octets));

/** Défi PKCE (S256) d'un vérificateur. */
export const defiPkce = verificateur => createHash('sha256').update(verificateur).digest('base64url');

/** Chemin de retour sûr : uniquement un chemin local du site. */
export function cheminLocal(valeur, defaut = '/') {
  if (typeof valeur !== 'string' || !valeur.startsWith('/') || valeur.startsWith('//') || valeur.includes('\\')) {
    return defaut;
  }
  return valeur;
}
