// scripts/utils/parse-fiche.js
//
// Parse une fiche d'exercices exobase (content/fiches/<source>/*.txt).
//
// Une fiche est une liste thématique : un en-tête, un titre, et une suite de
// références d'exercices groupées sous des titres hiérarchiques. Elle ne porte
// aucun énoncé — seulement des références vers des exercices du corpus.
//
//   \fiche{f00012, bodin, 2007/09/01}
//   \titre{Fonctions continues}
//   \section{Pratique}
//   \insertion{671, 670, 677}
//   \finfiche
//
// Le parser produit une liste d'items à plat, chacun portant le chemin de
// titres qui le contient. Un chemin plutôt qu'un arbre : 98 % des fiches n'ont
// aucune section ou un seul niveau, et un titre peut porter à la fois des
// exercices et des sous-titres — ce qu'un arbre « seules les feuilles portent
// des exercices » ne représenterait pas.

/** Niveaux de titre, du plus englobant au plus fin. */
const HEADINGS = ['part', 'section', 'subsection', 'subsubsection'];
const HEADING_RANK = new Map(HEADINGS.map((name, index) => [name, index]));

/** Macros de mise en page sans portée éditoriale, retirées du texte libre. */
const IGNORED = new Set(['tableofcontents', 'setcounter', 'label', 'newcommand', 'renewcommand']);

/**
 * Lit un groupe `{...}` en équilibrant les accolades, à partir de l'accolade
 * ouvrante en `open`. Indispensable : les titres contiennent du LaTeX
 * (`{\bf ...}`, `$\Rr^3$`). Renvoie null si le groupe n'est jamais refermé.
 */
function readGroup(source, open) {
  if (source[open] !== '{') return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{' && source[i - 1] !== '\\') depth++;
    else if (source[i] === '}' && source[i - 1] !== '\\') {
      depth--;
      if (depth === 0) return { body: source.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

/** `2007/09/01` -> `2007-09-01`. Toute autre forme est rendue telle quelle. */
function normalizeDate(raw) {
  const match = raw.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return { date: raw.trim() || null, ok: false };
  const [, year, month, day] = match;
  return { date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, ok: true };
}

/**
 * Développe le contenu d'une `\insertion{}` en références individuelles.
 * Accepte les listes (`671, 670`) et les plages (`2889-2899`), qu'exo7 emploie
 * pour ses fiches les plus longues.
 */
function expandRefs(body, warn) {
  const refs = [];
  for (const token of body.split(',').map(part => part.trim()).filter(Boolean)) {
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (to < from) {
        warn(`plage décroissante ignorée : ${token}`);
        continue;
      }
      for (let value = from; value <= to; value++) refs.push(String(value));
    } else if (/^\d+$/.test(token)) {
      refs.push(token);
    } else if (/^[a-zA-Z0-9]{3,}$/.test(token)) {
      refs.push(token); // fiche locale : la référence est déjà un uuid
    } else {
      warn(`référence illisible ignorée : « ${token} »`);
    }
  }
  return refs;
}

/** Normalise un fragment de texte libre : espaces compactés, accolades orphelines retirées. */
function cleanText(raw) {
  const text = raw.replace(/%[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  return text.replace(/^[}\s]+/, '').replace(/[{\s]+$/, '').trim();
}

/**
 * Parse une fiche.
 *
 * @param {string} source contenu du fichier
 * @param {string} [name] nom du fichier, pour les avertissements
 * @returns {{id: string|null, title: string, author: string|null, date: string|null,
 *            intro: string, items: Array<{position: number, path: string[], ref: string}>,
 *            notes: Array<{path: string[], text: string}>, maxDepth: number, warnings: string[]}}
 */
export function parseFiche(source, name = 'fiche') {
  const warnings = [];
  const warn = message => warnings.push(`${name}: ${message}`);

  let id = null;
  let author = null;
  let date = null;
  let title = '';
  const items = [];
  const notes = [];

  /** Chemin de titres courant, indexé par rang de niveau. */
  const path = [];
  const freeText = [];
  let intro = '';
  let position = 0;
  let cursor = 0;
  let sawEnd = false;

  /** Chemin visible : les niveaux sautés ne portent pas de titre à afficher. */
  function visiblePath() {
    return path.filter(part => part !== null);
  }

  /** Vide le texte libre accumulé, en le rattachant au chemin courant. */
  function flushText() {
    const text = cleanText(freeText.join(' '));
    freeText.length = 0;
    if (!text) return;
    if (path.length === 0 && !intro) intro = text;
    else notes.push({ path: visiblePath(), text });
  }

  while (cursor < source.length) {
    const next = source.indexOf('\\', cursor);
    if (next === -1) {
      freeText.push(source.slice(cursor));
      break;
    }
    freeText.push(source.slice(cursor, next));

    const command = source.slice(next + 1).match(/^[a-zA-Z]+/)?.[0];
    if (!command) {
      // Échappement (`\{`, `\'`, `\\`) : c'est du texte, pas une commande.
      freeText.push(source.slice(next, next + 2));
      cursor = next + 2;
      continue;
    }

    let after = next + 1 + command.length;
    while (source[after] === ' ' || source[after] === '\n') after++;

    if (command === 'finfiche') {
      sawEnd = true;
      cursor = after;
      continue;
    }

    if (IGNORED.has(command)) {
      // Consommer les arguments pour qu'ils ne retombent pas en texte libre.
      let end = after;
      while (source[end] === '{') {
        const group = readGroup(source, end);
        if (!group) break;
        end = group.end;
      }
      cursor = end;
      continue;
    }

    const group = source[after] === '{' ? readGroup(source, after) : null;
    if (!group) {
      // Commande LaTeX ordinaire dans du texte ou un titre : conserver telle quelle.
      freeText.push(source.slice(next, after));
      cursor = after;
      continue;
    }

    if (command === 'fiche') {
      const parts = group.body.split(',');
      if (parts.length !== 3) warn(`en-tête \\fiche à ${parts.length} champ(s) au lieu de 3`);
      id = parts[0]?.trim() || null;
      author = parts[1]?.trim() || null;
      const parsed = normalizeDate(parts[2] ?? '');
      date = parsed.date;
      if (parsed.date && !parsed.ok) warn(`date non reconnue : « ${parsed.date} »`);
      freeText.length = 0; // rien avant l'en-tête n'est du contenu
    } else if (command === 'titre') {
      title = cleanText(group.body);
      freeText.length = 0;
    } else if (HEADING_RANK.has(command)) {
      flushText();
      const rank = HEADING_RANK.get(command);
      // Un titre remplace celui de son niveau et tout ce qui était plus fin.
      path.length = Math.min(path.length, rank);
      while (path.length < rank) path.push(null); // niveau sauté (section sans part)
      path.push(cleanText(group.body));
    } else if (command === 'insertion') {
      flushText();
      for (const ref of expandRefs(group.body, warn)) {
        items.push({ position: position++, path: visiblePath(), ref });
      }
    } else {
      // Commande de mise en forme (\texttt, \emph…) : garder le texte source.
      freeText.push(source.slice(next, group.end));
      cursor = group.end;
      continue;
    }

    cursor = group.end;
  }

  flushText();

  if (!id) warn('en-tête \\fiche absent ou illisible');
  if (!title) warn('titre absent');
  if (!items.length) warn('aucune référence d’exercice');
  if (!sawEnd) warn('\\finfiche absent');

  const maxDepth = items.reduce((max, item) => Math.max(max, item.path.length), 0);
  return { id, title, author, date, intro, items, notes, maxDepth, warnings };
}

export { HEADINGS };
