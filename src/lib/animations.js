// src/lib/animations.js
// Animations interactives associées aux exercices.
//
// Une source déclare une animation par \animation{nom}{légende}. Le nom désigne
// content/animations/<source>/<nom>.html, une page autonome que le site sert
// isolée (voir routes/animation/[name]) et que l'exercice ouvre à la demande dans
// une iframe. Comme les extraits Python, les pages viennent d'exobase, rangées
// par source ; l'adresse, elle, ne dépend que du nom, unique toutes sources
// confondues, car elle est imprimée dans les PDF. La légende est du texte
// simple : elle sert d'étiquette et de titre. Le parseur, l'aperçu, l'export
// LaTeX et le contrôle des sources s'appuient sur ce seul fichier pour
// reconnaître la commande.

/** Un nom d'animation : lettres, chiffres, tiret et souligné, comme un nom de fichier sûr. */
export const ANIMATION_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** Adresse publique d'une animation, pour les documents hors ligne (export PDF). */
export const ANIMATION_PUBLIC_BASE_URL = 'https://openyourmath.org/animation/';

/** Adresse de la page qui sert l'animation. */
export function animationUrl(name) {
  return `/animation/${encodeURIComponent(String(name).trim())}`;
}

/** Chemin d'une page d'animation : …/animations/<source>/<nom>.html. */
const PAGE_PATH = /(?:^|\/)animations\/([^/]+)\/([^/]+)\.html$/;

/**
 * Range les pages d'animation par nom. Un nom présent dans deux sources est
 * signalé et n'est servi par aucune : l'adresse /animation/<nom> serait ambiguë.
 *
 * @param {string[]} paths  chemins de la forme …/animations/<source>/<nom>.html
 * @returns {{ pages: Map<string, string>, duplicates: Map<string, string[]> }}
 */
export function indexAnimationPages(paths) {
  const byName = new Map();
  for (const pagePath of paths) {
    const match = PAGE_PATH.exec(String(pagePath).replaceAll('\\', '/'));
    if (!match || !ANIMATION_NAME.test(match[2])) continue;
    byName.set(match[2], [...(byName.get(match[2]) ?? []), pagePath]);
  }
  const pages = new Map();
  const duplicates = new Map();
  for (const [name, found] of byName) {
    if (found.length === 1) pages.set(name, found[0]);
    else duplicates.set(name, found.sort());
  }
  return { pages, duplicates };
}

/** Début d'un appel : « \animation », suivi d'un « { » (espaces permis). */
const CALL = /\\animation\s*\{/g;

/** Lit le groupe entre accolades qui commence à `start` (juste après « { »). */
function readGroup(source, start) {
  let depth = 1;
  let index = start;
  while (index < source.length) {
    const char = source[index];
    if (char === '\\') index++;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return { text: source.slice(start, index), end: index + 1 };
    index++;
  }
  return null;
}

/**
 * Appels \animation{nom}{légende} d'un texte LaTeX, hors commentaires.
 * La légende peut contenir des accolades et des formules.
 *
 * @param {string} latex
 * @returns {{ name: string, caption: string, start: number, end: number }[]}
 */
export function findAnimations(latex) {
  const source = String(latex || '');
  const calls = [];
  CALL.lastIndex = 0;
  let match;
  while ((match = CALL.exec(source)) !== null) {
    const lineStart = source.lastIndexOf('\n', match.index) + 1;
    if (/(?<!\\)%/.test(source.slice(lineStart, match.index))) continue;
    const name = readGroup(source, match.index + match[0].length);
    if (!name) continue;
    let cursor = name.end;
    while (/\s/.test(source[cursor] ?? '')) cursor++;
    if (source[cursor] !== '{') continue;
    const caption = readGroup(source, cursor + 1);
    if (!caption) continue;
    calls.push({ name: name.text.trim(), caption: caption.text.trim(), start: match.index, end: caption.end });
    CALL.lastIndex = caption.end;
  }
  return calls;
}

const escapeAttribute = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Emplacement que le navigateur remplace par le lecteur d'animation. Sans
 * JavaScript, le lien reste utilisable : la page de l'animation fonctionne seule.
 */
export function animationPlaceholderHtml(name, caption) {
  const label = escapeAttribute(caption);
  return (
    `<div class="oym-animation" data-animation="${escapeAttribute(name)}" data-caption="${label}">` +
    `<a href="${animationUrl(name)}">Animation : ${label}</a></div>`
  );
}

/**
 * Remplace chaque \animation par un placeholder isolé en paragraphe, que
 * restoreCodeBlocksFromPlaceholders (scripts/utils/code2html-utils.js) change en
 * emplacement HTML après la conversion pandoc, qui ne connaît pas la commande.
 * Un nom invalide donne un message d'erreur visible plutôt qu'un lien cassé.
 *
 * @param {string} latex
 * @param {() => string} makeId  fournit un identifiant unique de placeholder
 * @returns {{ content: string, replacements: { placeholder: string, html: string }[], names: string[] }}
 */
export function replaceAnimationsWithPlaceholders(latex, makeId) {
  const source = String(latex || '');
  const replacements = [];
  const names = [];
  let content = '';
  let cursor = 0;
  for (const call of findAnimations(source)) {
    const placeholder = `ANIMATIONPLACEHOLDER${makeId()}`;
    const valid = ANIMATION_NAME.test(call.name);
    replacements.push({
      placeholder,
      html: valid
        ? animationPlaceholderHtml(call.name, call.caption)
        : `<div class="code-error">Animation invalide : ${escapeAttribute(call.name)}</div>`,
    });
    if (valid) names.push(call.name);
    content += `${source.slice(cursor, call.start)}\n\n${placeholder}\n\n`;
    cursor = call.end;
  }
  return { content: content + source.slice(cursor), replacements, names };
}
