// src/routes/animation/[name]/+server.js
// Sert la figure interactive content/animations/<source>/<name>.js, isolée du
// site, dans une page qui l'assemble avec le kit (voir lib/widgets/page.js).
//
// Le fichier d'une figure est du JavaScript arbitraire : la politique CSP le
// place dans un bac à sable sans « allow-same-origin ». Il tourne alors dans une
// origine opaque, sans accès aux cookies ni à la page qui l'embarque. L'en-tête
// vaut aussi pour une ouverture directe de l'adresse, pas seulement pour l'iframe.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { ANIMATION_NAME, indexAnimationPages } from '$lib/animations.js';
import { widgetPage } from '$lib/widgets/page.js';
import kitScript from '$lib/widgets/kit.js?raw';
import kitStyle from '$lib/widgets/kit.css?raw';

// Les figures sont incluses dans le paquet du serveur : aucun chemin à retrouver en production.
const loaders = import.meta.glob('/content/animations/*/*.js', { query: '?raw', import: 'default' });
// L'adresse ne porte que le nom : la source est retrouvée ici, un nom ambigu
// n'est pas servi (pnpm check:animations le signale).
const { pages } = indexAnimationPages(Object.keys(loaders));

// En développement, la figure est relue sur le disque à chaque requête : le
// serveur de vite ne recharge pas les fichiers de content/ importés en ?raw, et
// l'auteur voit sa modification en rechargeant la page.
async function loadFromDisk(name) {
  const root = path.resolve('content/animations');
  const sources = await readdir(root, { withFileTypes: true }).catch(() => []);
  const paths = [];
  for (const source of sources.filter((entry) => entry.isDirectory())) {
    for (const file of await readdir(path.join(root, source.name)).catch(() => [])) {
      paths.push(`/content/animations/${source.name}/${file}`);
    }
  }
  const found = indexAnimationPages(paths).pages.get(name);
  return found ? () => readFile(path.resolve(found.slice(1)), 'utf8') : undefined;
}

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
  let load;
  if (ANIMATION_NAME.test(name)) load = dev ? await loadFromDisk(name) : pages.has(name) ? loaders[pages.get(name)] : undefined;
  if (!load) throw error(404, 'Animation introuvable');

  return new Response(widgetPage({ name, kitScript, kitStyle, widgetScript: await load() }), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': CSP,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'cache-control': 'public, max-age=300',
    },
  });
}
