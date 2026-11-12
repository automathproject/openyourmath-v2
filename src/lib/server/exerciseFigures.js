// src/lib/server/exerciseFigures.js
// Prépare les figures d'un exercice avant de l'envoyer : leurs dimensions sont
// réservées dans la page et leur chargement est différé jusqu'à ce qu'elles
// approchent de l'écran.
//
// Fait à l'envoi plutôt qu'à l'analyse des sources : les figures TikZ ne sont
// compilées qu'après le cache, et une reconstruction du cache ne serait pas
// nécessaire pour que toutes les pages en profitent.

import fs from 'node:fs';
import path from 'node:path';
import { readImageSize } from '../imageSize.js';
import { mapBlockHtml } from '../qcm/blocks.js';

const ARTIFACT_URL = /^\/artifacts\/[A-Za-z0-9_\-./]+$/;
const CACHE_LIMIT = 5000;
const sizes = new Map();

/** Dossiers où chercher /artifacts/… : les sources du site, puis le build servi. */
function staticRoots() {
  return [path.resolve('static'), path.resolve('build/client')];
}

function sizeOfArtifact(url) {
  if (sizes.has(url)) return sizes.get(url);
  let size = null;
  if (ARTIFACT_URL.test(url) && !url.includes('..')) {
    for (const root of staticRoots()) {
      try {
        size = readImageSize(fs.readFileSync(path.join(root, url)), path.extname(url).slice(1));
        break;
      } catch {
        // fichier absent de ce dossier : on essaie le suivant
      }
    }
  }
  if (sizes.size >= CACHE_LIMIT) sizes.delete(sizes.keys().next().value);
  sizes.set(url, size);
  return size;
}

const IMG_TAG = /<img\b[^>]*>/gi;

/** Ajoute width, height, loading et decoding à chaque figure du site qui n'en a pas. */
export function addFigureAttributes(html) {
  if (!html || !html.includes('<img')) return html || '';
  return html.replace(IMG_TAG, (tag) => {
    const src = /\ssrc="([^"]+)"/i.exec(tag)?.[1];
    if (!src || !src.startsWith('/artifacts/')) return tag;
    const extra = [];
    const size = /\s(?:width|height)=/i.test(tag) ? null : sizeOfArtifact(src);
    if (size) extra.push(`width="${size.width}"`, `height="${size.height}"`);
    if (!/\sloading=/i.test(tag)) extra.push('loading="lazy"');
    if (!/\sdecoding=/i.test(tag)) extra.push('decoding="async"');
    return extra.length ? tag.replace(/\s*\/?>$/, ` ${extra.join(' ')}>`) : tag;
  });
}

/** Applique addFigureAttributes au HTML de chaque bloc de l'exercice. */
export function withFigureAttributes(exercise) {
  if (!Array.isArray(exercise?.content)) return exercise;
  return {
    ...exercise,
    content: exercise.content.map((block) =>
      block?.html ? mapBlockHtml(block, addFigureAttributes) : block,
    ),
  };
}
