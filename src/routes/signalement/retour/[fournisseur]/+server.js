// src/routes/signalement/retour/[fournisseur]/+server.js
// Retour du fournisseur OAuth : vérifie l'état, lit le profil, ouvre la session.
import { redirect } from '@sveltejs/kit';
import { FOURNISSEURS, secretSession } from '$lib/server/signalement/fournisseurs.js';
import { signer, verifier } from '$lib/server/signalement/session.js';
import { COOKIE_OAUTH, COOKIE_SESSION, DUREE_SESSION_S, optionsCookie } from '$lib/server/signalement/cookies.js';

function avecStatut(retour, statut) {
  const [chemin] = retour.split('#');
  const separateur = chemin.includes('?') ? '&' : '?';
  return `${chemin}${separateur}signalement=${statut}`;
}

export async function GET({ params, url, cookies }) {
  const fournisseur = FOURNISSEURS[params.fournisseur];
  const oauth = verifier(cookies.get(COOKIE_OAUTH), secretSession());
  cookies.delete(COOKIE_OAUTH, { path: '/' });
  const retour = oauth?.retour || '/';

  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!fournisseur || !oauth || oauth.fournisseur !== fournisseur.id || !state || state !== oauth.state || !code) {
    throw redirect(303, avecStatut(retour, 'connexion-refusee'));
  }

  let profil;
  try {
    const redirection = `${url.origin}/signalement/retour/${fournisseur.id}`;
    const jeton = await fournisseur.jeton({ code, verificateur: oauth.verificateur, redirection });
    profil = await fournisseur.profil(jeton);
  } catch (err) {
    console.error('Signalement, connexion :', err.message);
    throw redirect(303, avecStatut(retour, 'connexion-echouee'));
  }

  cookies.set(
    COOKIE_SESSION,
    signer({ fournisseur: fournisseur.id, ...profil }, secretSession(), DUREE_SESSION_S),
    optionsCookie(DUREE_SESSION_S)
  );
  throw redirect(303, avecStatut(retour, 'connecte'));
}
