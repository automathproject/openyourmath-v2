// src/lib/katexRender.js
// Rendu KaTeX d'un fragment HTML en une chaîne, sans DOM : le serveur livre des
// formules déjà composées et le navigateur n'a plus besoin de KaTeX pour lire un
// exercice.
//
// Reproduit ce que MathRenderer.svelte fait avec auto-render (mêmes délimiteurs,
// mêmes balises ignorées, mêmes options KaTeX) pour que la page soit identique
// à celle qu'on obtenait en composant après coup.

import katex from 'katex';
import { katexMacros, prepareMathForKatex } from './katexCompat.js';

/** Délimiteurs reconnus, dans l'ordre : « $$ » doit passer avant « $ ». */
export const MATH_DELIMITERS = [
  { left: '$$', right: '$$', display: true },
  { left: '$', right: '$', display: false },
  { left: '\\(', right: '\\)', display: false },
  { left: '\\[', right: '\\]', display: true },
];

/** Dans ces balises, le texte n'est pas de la prose : auto-render les saute. */
const IGNORED_TAGS = new Set(['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option']);

/** Une formule ou, à défaut, une marque que le HTML contient encore du LaTeX. */
export const HAS_MATH_DELIMITER = /\$|\\\(|\\\[/;

// Port de splitAtDelimiters de KaTeX (contrib/auto-render), qui n'est pas
// exporté tel quel : même algorithme, pour trancher les mêmes cas limites.
function findEndOfMath(delimiter, text, startIndex) {
  let index = startIndex;
  let braceLevel = 0;
  while (index < text.length) {
    const character = text[index];
    if (braceLevel <= 0 && text.slice(index, index + delimiter.length) === delimiter) {
      return index;
    } else if (character === '\\') {
      index++;
    } else if (character === '{') {
      braceLevel++;
    } else if (character === '}') {
      braceLevel--;
    }
    index++;
  }
  return -1;
}

const escapeRegex = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
const LEFT_DELIMITER = new RegExp(`(${MATH_DELIMITERS.map((d) => escapeRegex(d.left)).join('|')})`);
const AMS_ENVIRONMENT = /^\\begin{/;

function splitAtDelimiters(text) {
  const data = [];
  while (true) {
    let index = text.search(LEFT_DELIMITER);
    if (index === -1) break;
    if (index > 0) {
      data.push({ type: 'text', data: text.slice(0, index) });
      text = text.slice(index);
    }
    const delimiter = MATH_DELIMITERS.find((d) => text.startsWith(d.left));
    index = findEndOfMath(delimiter.right, text, delimiter.left.length);
    if (index === -1) break;
    const rawData = text.slice(0, index + delimiter.right.length);
    const math = AMS_ENVIRONMENT.test(rawData) ? rawData : text.slice(delimiter.left.length, index);
    data.push({ type: 'math', data: math, rawData, display: delimiter.display });
    text = text.slice(index + delimiter.right.length);
  }
  if (text !== '') data.push({ type: 'text', data: text });
  return data;
}

const NAMED_ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** Ce que le navigateur aurait lu : KaTeX attend la formule, pas son HTML. */
function decodeEntities(s) {
  return s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(lt|gt|amp|quot|apos));/gi, (_, dec, hex, name) => {
    if (name) return NAMED_ENTITIES[name.toLowerCase()];
    const code = dec !== undefined ? Number(dec) : parseInt(hex, 16);
    return String.fromCodePoint(code);
  });
}

/**
 * Compose les formules d'un texte (sans balises).
 * @returns {string|null} null quand le texte n'en contient pas
 */
function renderText(text, macros, options) {
  if (!HAS_MATH_DELIMITER.test(text)) return null;
  const parts = splitAtDelimiters(text);
  if (parts.length === 1 && parts[0].type === 'text') return null;
  return parts
    .map((part) => {
      if (part.type === 'text') return part.data;
      try {
        // auto-render enveloppe chaque formule dans un <span> : on le garde pour
        // que le HTML soit identique et que le CSS existant s'y applique.
        return `<span>${katex.renderToString(prepareMathForKatex(decodeEntities(part.data)), {
          ...options,
          displayMode: part.display,
          macros,
          throwOnError: false,
          strict: false,
        })}</span>`;
      } catch {
        // Formule que KaTeX refuse même sans throwOnError : on garde la source.
        return part.rawData;
      }
    })
    .join('');
}

const TOKEN = /<!--[\s\S]*?-->|<[^>]*>|[^<]+/g;
const TAG_NAME = /^<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9-]*)/;

/**
 * Compose les formules d'un fragment HTML, hors des balises ignorées.
 *
 * @param {string} html
 * @param {{ output?: 'html' | 'mathml' | 'htmlAndMathml' }} [options]
 * @returns {string}
 */
export function renderMathInHtml(html, options = {}) {
  if (!html || !HAS_MATH_DELIMITER.test(html)) return html || '';
  // KaTeX modifie l'objet des macros (\gdef) : une copie par fragment évite que
  // les définitions d'un exercice passent dans le suivant.
  const macros = { ...katexMacros };
  let ignoredTag = null;
  let out = '';
  for (const token of html.match(TOKEN) ?? []) {
    if (token[0] !== '<') {
      const rendered = ignoredTag ? null : renderText(token, macros, options);
      out += rendered ?? token;
      continue;
    }
    out += token;
    const tag = TAG_NAME.exec(token);
    if (!tag) continue;
    const name = tag[2].toLowerCase();
    if (!IGNORED_TAGS.has(name)) continue;
    if (tag[1]) {
      if (ignoredTag === name) ignoredTag = null;
    } else if (!ignoredTag && !token.endsWith('/>')) {
      ignoredTag = name;
    }
  }
  return out;
}

// Un même exercice est demandé plusieurs fois (liste, retour arrière, robots) :
// le composer coûte plus que de le retrouver. La taille est bornée.
const CACHE_LIMIT = 2000;
const cache = new Map();

/** renderMathInHtml avec mémoire : à privilégier côté serveur. */
export function renderMathInHtmlCached(html, options = {}) {
  const key = `${options.output ?? ''}\u0000${html}`;
  let rendered = cache.get(key);
  if (rendered === undefined) {
    rendered = renderMathInHtml(html, options);
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(key, rendered);
  }
  return rendered;
}
