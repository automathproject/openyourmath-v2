// scripts/utils/parse-programme-cpge.js
//
// Lit un programme officiel de CPGE converti en Markdown
// (content/referentiels/cpge/programmes/*.md, format décrit dans le README du
// référentiel) et en extrait les nœuds rattachables : les titres qui portent
// un identifiant `{#…}`.
//
// Un nœud est une section (`###`) ou une sous-section lettrée (`####`). Une
// partie « A - », « B - »… est une section dont le parent est la section
// générale qui la précède. Le texte courant et les lignes de tableau situés
// sous un titre, jusqu'au titre suivant, appartiennent à ce nœud.
//
// Fonction pure : aucune lecture de fichier, pour être testée sur des chaînes.

const ID_SUFFIX = /\s*\{#([^}\s]+)\}\s*$/;
const PARTIE_TITLE = /^[A-Z]\s*[-–]\s/;
const LETTRE_TITLE = /^([a-z])\)\s/;

/** Front matter YAML restreint : `clé: valeur` et listes `[a, b]`. */
export function parseFrontMatter(lines) {
  const meta = {};
  for (const line of lines) {
    const match = line.match(/^([a-z_]+):\s*(.*?)\s*(#.*)?$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (raw.startsWith('[') && raw.endsWith(']')) {
      meta[key] = raw.slice(1, -1).split(',').map(v => v.trim()).filter(Boolean);
    } else if (/^\d+$/.test(raw)) {
      meta[key] = Number(raw);
    } else {
      meta[key] = raw;
    }
  }
  return meta;
}

/** Numéro de semestre déduit du titre de la grande partie, ou null. */
export function semestreFromPartie(partie) {
  if (/premier semestre/i.test(partie)) return 1;
  if (/(deuxième|second) semestre/i.test(partie)) return 2;
  return null;
}

function isPreamble(title) {
  return /pr[ée]ambule|objectifs de formation/i.test(title);
}

function splitRow(line) {
  // Le format interdit tout `|` littéral dans une cellule : le découpage est sûr.
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

function isHeaderOrSeparator(cells) {
  return cells.every(cell => /^-+$/.test(cell)) || /^Contenus$/i.test(cells[0]);
}

/**
 * @param {string} markdown contenu du fichier
 * @param {string} [fileName] pour les messages
 * @returns {{ meta: object, nodes: object[], warnings: string[] }}
 */
export function parseProgramme(markdown, fileName = 'programme.md') {
  const lines = markdown.split('\n');
  const warnings = [];

  let body = lines;
  let meta = {};
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end === -1) {
      warnings.push(`${fileName} : front matter non fermé`);
    } else {
      meta = parseFrontMatter(lines.slice(1, end));
      body = lines.slice(end + 1);
    }
  } else {
    warnings.push(`${fileName} : front matter absent`);
  }

  const programme = meta.programme;
  const nodes = [];
  let partie = null;
  let inProgramme = false;
  let section = null; // dernière section (###) à identifiant
  let sectionMere = null; // dernière section générale (### hors partie)
  let current = null; // nœud qui reçoit le texte et les tableaux

  const flushText = node => {
    if (!node) return;
    node.texte = node._texte.join('\n').replace(/\n{3,}/g, '\n\n').trim() || null;
    delete node._texte;
  };

  for (const line of body) {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const raw = heading[2];
      if (level <= 2) {
        flushText(current);
        current = null;
        if (level === 2) {
          partie = raw.trim();
          inProgramme = !isPreamble(partie);
          section = null;
          sectionMere = null;
        }
        continue;
      }
      if (!inProgramme || level > 4) {
        // Titre de préambule ou de niveau inférieur : il reste du texte du nœud
        // courant, s'il y en a un.
        if (current) current._texte.push(line);
        continue;
      }

      flushText(current);
      current = null;
      const idMatch = raw.match(ID_SUFFIX);
      const titre = raw.replace(ID_SUFFIX, '').trim();

      if (level === 3) {
        const estPartie = PARTIE_TITLE.test(titre);
        if (!idMatch) {
          // Rubrique du texte général d'un `##` de programme (BCPST) : pas de nœud.
          if (!estPartie) sectionMere = null;
          section = null;
          continue;
        }
        const node = {
          id: idMatch[1],
          programme,
          type: 'section',
          parent_id: estPartie && sectionMere ? sectionMere.id : null,
          partie,
          semestre: semestreFromPartie(partie),
          lettre: null,
          titre,
          contenus: [],
          _texte: []
        };
        if (estPartie && !sectionMere) {
          warnings.push(`${fileName} : partie « ${titre} » sans section générale qui la précède`);
        }
        nodes.push(node);
        section = node;
        if (!estPartie) sectionMere = node;
        current = node;
        continue;
      }

      // level === 4 : sous-section lettrée
      const lettre = titre.match(LETTRE_TITLE)?.[1] ?? null;
      if (!idMatch) {
        if (lettre) warnings.push(`${fileName} : sous-section « ${titre} » sans identifiant`);
        continue;
      }
      if (!section) {
        warnings.push(`${fileName} : sous-section ${idMatch[1]} hors de toute section`);
      }
      const node = {
        id: idMatch[1],
        programme,
        type: 'sous-section',
        parent_id: section ? section.id : null,
        partie,
        semestre: semestreFromPartie(partie),
        lettre,
        titre,
        contenus: [],
        _texte: []
      };
      nodes.push(node);
      current = node;
      continue;
    }

    if (!current) continue;
    if (line.trim().startsWith('|')) {
      const cells = splitRow(line);
      if (cells.length !== 2) {
        warnings.push(`${fileName} : ligne de tableau à ${cells.length} cellules sous ${current.id}`);
        continue;
      }
      if (isHeaderOrSeparator(cells)) continue;
      current.contenus.push({ contenu: cells[0], commentaire: cells[1] });
    } else {
      current._texte.push(line);
    }
  }
  flushText(current);

  nodes.forEach((node, index) => {
    node.ordre = index;
  });
  return { meta, nodes, warnings };
}
