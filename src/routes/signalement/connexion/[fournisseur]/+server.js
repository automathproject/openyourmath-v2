// src/routes/signalement/connexion/[fournisseur]/+server.js
// Démarre la connexion OAuth (forge ou GitHub) avant un signalement.
import { error, redirect } from '@sveltejs/kit';
import { FOURNISSEURS, secretSession } from '$lib/server/signalement/fournisseurs.js';
import { aleatoire, cheminLocal, defiPkce, signer } from '$lib/server/signalement/session.js';
import { COOKIE_OAUTH, DUREE_OAUTH_S, optionsCookie } from '$lib/server/signalement/cookies.js';

export function GET({ params, url, cookies }) {
  const fournisseur = FOURNISSEURS[params.fournisseur];
  if (!fournisseur || !fournisseur.configure() || !secretSession()) {
    throw error(404, 'Connexion indisponible');
  }
  const state = aleatoire();
  const verificateur = aleatoire();
  const retour = cheminLocal(url.searchParams.get('retour'));
  cookies.set(
    COOKIE_OAUTH,
    signer({ fournisseur: fournisseur.id, state, verificateur, retour }, secretSession(), DUREE_OAUTH_S),
    optionsCookie(DUREE_OAUTH_S)
  );
  const redirection = `${url.origin}/signalement/retour/${fournisseur.id}`;
  throw redirect(303, fournisseur.autorisation({ state, defi: defiPkce(verificateur), redirection }));
}
