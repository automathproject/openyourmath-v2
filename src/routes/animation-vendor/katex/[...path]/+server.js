// src/routes/animation-vendor/katex/[...path]/+server.js
// Fichiers KaTeX pour les animations, servies sans origine (voir routes/animation).
//
// Une page sans origine charge ses polices en mode CORS, avec « Origin: null » :
// sans en-tête Access-Control-Allow-Origin, le navigateur les refuse et les
// formules s'affichent avec une police de secours. Les fichiers statiques du
// site n'ont pas cet en-tête, d'où cette route, limitée à une liste fermée.

import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';

const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
};

const ALLOWED = /^(katex\.min\.css|katex\.min\.js|contrib\/auto-render\.min\.js|fonts\/KaTeX_[A-Za-z0-9_-]+\.woff2)$/;

let distDirectory;
function katexDist() {
  distDirectory ??= path.join(path.dirname(createRequire(import.meta.url).resolve('katex/package.json')), 'dist');
  return distDirectory;
}

export async function GET({ params }) {
  if (!ALLOWED.test(params.path)) throw error(404, 'Fichier introuvable');
  let body;
  try {
    body = await readFile(path.join(katexDist(), params.path));
  } catch {
    throw error(404, 'Fichier introuvable');
  }
  return new Response(body, {
    headers: {
      'content-type': TYPES[path.extname(params.path)],
      'access-control-allow-origin': '*',
      'cross-origin-resource-policy': 'cross-origin',
      'cache-control': 'public, max-age=86400',
    },
  });
}
