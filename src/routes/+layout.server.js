// src/routes/+layout.server.js
import { fournisseursDisponibles } from '$lib/server/signalement/fournisseurs.js';

/** Signalement d'erreur, proposé sur toute page qui affiche un exercice :
 *  comptes de connexion disponibles et identité déjà vérifiée (sans les
 *  identifiants internes). */
export function load({ locals }) {
  const auteur = locals.auteur;
  return {
    signalement: {
      fournisseurs: fournisseursDisponibles(),
      auteur: auteur ? { fournisseur: auteur.fournisseur, login: auteur.login, profil: auteur.profil } : null
    }
  };
}
