// src/routes/animation/[name]/+server.js
// Sert une animation de content/animations/<name>.html, isolée du site.
//
// Le HTML d'une animation est du JavaScript arbitraire : la politique CSP le
// place dans un bac à sable sans « allow-same-origin ». Il tourne alors dans une
// origine opaque, sans accès aux cookies ni à la page qui l'embarque. L'en-tête
// vaut aussi pour une ouverture directe de l'adresse, pas seulement pour l'iframe.

import { error } from '@sveltejs/kit';
import { ANIMATION_NAME } from '$lib/animations.js';

// Les pages sont incluses dans le paquet du serveur : aucun chemin à retrouver en production.
const pages = import.meta.glob('/content/animations/*.html', { query: '?raw', import: 'default' });

const CSP = [
  'sandbox allow-scripts',
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  'img-src data:',
  "frame-ancestors 'self'",
].join('; ');

export async function GET({ params }) {
  const { name } = params;
  const load = ANIMATION_NAME.test(name) ? pages[`/content/animations/${name}.html`] : undefined;
  if (!load) throw error(404, 'Animation introuvable');

  return new Response(await load(), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': CSP,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'cache-control': 'public, max-age=300',
    },
  });
}
