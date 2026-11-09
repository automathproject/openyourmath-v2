// src/lib/widgets/source.js
// Lecture statique du fichier d'une figure : les noms enregistrés par
// OYMWidgets.define('nom', …) et ses métadonnées (meta: { … }), sans exécuter le
// code. Le contrôle, la base et la recherche s'appuient sur cette lecture : meta
// doit donc être écrit en dur (texte, nombres, listes de textes).

import { parse } from 'acorn';

/** Version du kit (src/lib/widgets/kit.js) ; une figure déclare celle qu'elle attend. */
export const KIT_VERSION = 1;

/** Champs de meta : obligatoires, puis facultatifs. */
const REQUIRED = ['title', 'description', 'author', 'kit'];
const OPTIONAL = ['concepts'];

function isDefineCall(node) {
  const callee = node.callee;
  return node.type === 'CallExpression' && callee?.type === 'MemberExpression' && !callee.computed &&
    callee.object.type === 'Identifier' && callee.object.name === 'OYMWidgets' &&
    callee.property.type === 'Identifier' && callee.property.name === 'define';
}

function* walk(node) {
  if (!node || typeof node.type !== 'string') return;
  yield node;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const child of value) yield* walk(child);
    else if (value && typeof value === 'object') yield* walk(value);
  }
}

function propertyName(property) {
  if (property.type !== 'Property' || property.computed) return null;
  return property.key.type === 'Identifier' ? property.key.name : String(property.key.value);
}

/** Valeur d'un littéral écrit en dur, ou undefined si le nœud n'en est pas un. */
function literalValue(node) {
  if (node.type === 'Literal' && ['string', 'number', 'boolean'].includes(typeof node.value)) return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  if (node.type === 'ArrayExpression') {
    const values = node.elements.map((element) => (element ? literalValue(element) : undefined));
    return values.includes(undefined) ? undefined : values;
  }
  return undefined;
}

function readMeta(node, errors) {
  if (node.type !== 'ObjectExpression') {
    errors.push('meta doit être un objet écrit en dur.');
    return null;
  }
  const meta = {};
  for (const property of node.properties) {
    const key = propertyName(property);
    const value = key == null ? undefined : literalValue(property.value);
    if (key == null || value === undefined) {
      errors.push(`meta${key ? `.${key}` : ''} doit être écrit en dur (texte, nombre ou liste).`);
      continue;
    }
    meta[key] = value;
  }
  return meta;
}

/** Problèmes de forme de meta (le contrôle vérifie en plus l'auteur dans authors.json). */
export function metaProblems(meta) {
  if (!meta) return ['meta manque : { title, description, author, kit }.'];
  const problems = [];
  for (const key of REQUIRED) if (meta[key] === undefined || meta[key] === '') problems.push(`meta.${key} manque.`);
  for (const key of Object.keys(meta)) {
    if (!REQUIRED.includes(key) && !OPTIONAL.includes(key)) problems.push(`meta.${key} est inconnu.`);
  }
  for (const key of ['title', 'description', 'author']) {
    if (meta[key] !== undefined && typeof meta[key] !== 'string') problems.push(`meta.${key} doit être un texte.`);
  }
  // Titre et description servent de texte de recherche et d'attributs : pas de formule.
  for (const key of ['title', 'description']) {
    if (typeof meta[key] === 'string' && /[$\\]/.test(meta[key])) problems.push(`meta.${key} doit être du texte simple, sans formule.`);
  }
  if (meta.kit !== undefined && !(Number.isInteger(meta.kit) && meta.kit >= 1 && meta.kit <= KIT_VERSION)) {
    problems.push(`meta.kit vaut ${JSON.stringify(meta.kit)} : versions disponibles 1 à ${KIT_VERSION}.`);
  }
  if (meta.concepts !== undefined && !(Array.isArray(meta.concepts) && meta.concepts.every((c) => typeof c === 'string' && c))) {
    problems.push('meta.concepts doit être une liste de textes.');
  }
  return problems;
}

/**
 * @param {string} source le fichier de la figure
 * @returns {{ names: string[], meta: Record<string, unknown> | null, errors: string[] }}
 *   names : premiers arguments de chaque OYMWidgets.define ; meta : celui du premier
 *   appel ; errors : code illisible ou meta qui n'est pas écrit en dur.
 */
export function readWidgetSource(source) {
  let program;
  try {
    program = parse(String(source), { ecmaVersion: 'latest', sourceType: 'script' });
  } catch (err) {
    return { names: [], meta: null, errors: [`code illisible : ${err.message}`] };
  }
  const names = [];
  const errors = [];
  let meta = null;
  for (const node of walk(program)) {
    if (!isDefineCall(node)) continue;
    const [nameNode, specNode] = node.arguments;
    names.push(typeof literalValue(nameNode ?? {}) === 'string' ? literalValue(nameNode) : '');
    if (names.length > 1 || specNode?.type !== 'ObjectExpression') continue;
    const metaProperty = specNode.properties.find((property) => propertyName(property) === 'meta');
    if (metaProperty) meta = readMeta(metaProperty.value, errors);
  }
  return { names, meta, errors };
}
