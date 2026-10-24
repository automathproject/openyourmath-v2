// src/lib/server/signalement/fournisseurs.js
//
// Les deux dépôts où arrivent les signalements, et la connexion qui va avec :
// - la forge des communs numériques éducatifs (GitLab), réservée aux
//   personnels de l'Éducation nationale : tickets dans automath/exobase ;
// - GitHub, pour les autres contributeurs : tickets dans automathproject/exobase.
// La connexion ne demande que la lecture du profil ; le ticket est créé par
// un jeton propre au dépôt, qui ne sert qu'à cela.

import { env } from '$env/dynamic/private';

const FORGE_URL = () => (env.FORGE_URL || 'https://forge.apps.education.fr').replace(/\/$/, '');

export const FOURNISSEURS = {
  forge: {
    id: 'forge',
    libelle: 'la forge (enseignants)',
    configure: () => Boolean(env.FORGE_OAUTH_CLIENT_ID && env.FORGE_OAUTH_CLIENT_SECRET && env.SIGNALEMENT_FORGE_TOKEN),
    depot: () => env.SIGNALEMENT_FORGE_PROJET || 'automath/exobase',
    autorisation({ state, defi, redirection }) {
      const url = new URL(`${FORGE_URL()}/oauth/authorize`);
      url.search = new URLSearchParams({
        client_id: env.FORGE_OAUTH_CLIENT_ID,
        redirect_uri: redirection,
        response_type: 'code',
        scope: 'read_user',
        state,
        code_challenge: defi,
        code_challenge_method: 'S256'
      });
      return url.toString();
    },
    async jeton({ code, verificateur, redirection }) {
      const reponse = await fetch(`${FORGE_URL()}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({
          client_id: env.FORGE_OAUTH_CLIENT_ID,
          client_secret: env.FORGE_OAUTH_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirection,
          code_verifier: verificateur
        })
      });
      const donnees = await reponse.json().catch(() => ({}));
      if (!reponse.ok || !donnees.access_token) throw new Error(`forge : échange du code refusé (${reponse.status})`);
      return donnees.access_token;
    },
    async profil(jeton) {
      const reponse = await fetch(`${FORGE_URL()}/api/v4/user`, { headers: { authorization: `Bearer ${jeton}` } });
      if (!reponse.ok) throw new Error(`forge : profil illisible (${reponse.status})`);
      const u = await reponse.json();
      return { id: String(u.id), login: u.username, nom: u.name || u.username, profil: u.web_url };
    },
    lienSource: chemin => `${FORGE_URL()}/${FOURNISSEURS.forge.depot()}/-/blob/main/${chemin}`,
    async creerTicket({ titre, corps, etiquettes }) {
      const projet = encodeURIComponent(FOURNISSEURS.forge.depot());
      const reponse = await fetch(`${FORGE_URL()}/api/v4/projects/${projet}/issues`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'private-token': env.SIGNALEMENT_FORGE_TOKEN },
        body: JSON.stringify({ title: titre, description: corps, labels: etiquettes.join(',') })
      });
      const donnees = await reponse.json().catch(() => ({}));
      if (!reponse.ok) throw new Error(`forge : création du ticket refusée (${reponse.status})`);
      return { url: donnees.web_url, numero: donnees.iid };
    }
  },

  github: {
    id: 'github',
    libelle: 'GitHub',
    configure: () => Boolean(env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET && env.SIGNALEMENT_GITHUB_TOKEN),
    depot: () => env.SIGNALEMENT_GITHUB_DEPOT || 'automathproject/exobase',
    autorisation({ state, defi, redirection }) {
      const url = new URL('https://github.com/login/oauth/authorize');
      // Aucune portée : l'application ne lit que le profil public.
      url.search = new URLSearchParams({
        client_id: env.GITHUB_OAUTH_CLIENT_ID,
        redirect_uri: redirection,
        state,
        code_challenge: defi,
        code_challenge_method: 'S256'
      });
      return url.toString();
    },
    async jeton({ code, verificateur, redirection }) {
      const reponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({
          client_id: env.GITHUB_OAUTH_CLIENT_ID,
          client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
          code,
          redirect_uri: redirection,
          code_verifier: verificateur
        })
      });
      const donnees = await reponse.json().catch(() => ({}));
      if (!reponse.ok || !donnees.access_token) throw new Error(`github : échange du code refusé (${reponse.status})`);
      return donnees.access_token;
    },
    async profil(jeton) {
      const reponse = await fetch('https://api.github.com/user', {
        headers: { authorization: `Bearer ${jeton}`, accept: 'application/vnd.github+json', 'user-agent': 'openyourmath' }
      });
      if (!reponse.ok) throw new Error(`github : profil illisible (${reponse.status})`);
      const u = await reponse.json();
      return { id: String(u.id), login: u.login, nom: u.name || u.login, profil: u.html_url };
    },
    lienSource: chemin => `https://github.com/${FOURNISSEURS.github.depot()}/blob/main/${chemin}`,
    async creerTicket({ titre, corps, etiquettes }) {
      const reponse = await fetch(`https://api.github.com/repos/${FOURNISSEURS.github.depot()}/issues`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.SIGNALEMENT_GITHUB_TOKEN}`,
          accept: 'application/vnd.github+json',
          'content-type': 'application/json',
          'user-agent': 'openyourmath'
        },
        body: JSON.stringify({ title: titre, body: corps, labels: etiquettes })
      });
      const donnees = await reponse.json().catch(() => ({}));
      if (!reponse.ok) throw new Error(`github : création du ticket refusée (${reponse.status})`);
      return { url: donnees.html_url, numero: donnees.number };
    }
  }
};

/** Fournisseurs utilisables : ceux dont les secrets sont présents. */
export function fournisseursDisponibles() {
  return Object.values(FOURNISSEURS)
    .filter(f => f.configure())
    .map(f => ({ id: f.id, libelle: f.libelle }));
}

/** Secret de signature des cookies de signalement. */
export function secretSession() {
  return env.SIGNALEMENT_SESSION_SECRET || '';
}
