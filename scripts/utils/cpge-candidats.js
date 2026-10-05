// scripts/utils/cpge-candidats.js
//
// Candidats à l'étiquetage CPGE d'un exercice, à partir de la table de
// correspondance chapitre → nœuds (content/referentials/cpge-correspondances.json)
// et des nœuds du référentiel (collectReferentiel).
//
// Les nœuds de la table sont dépliés jusqu'aux feuilles : une section vaut ses
// sous-sections. Dans une même famille de programmes (1re année MPSI, PCSI,
// PTSI, par exemple), les feuilles de même titre forment un groupe (la
// sous-section « Racines n-ièmes » de MPSI, PCSI et PTSI) : le modèle choisit
// un groupe, et chaque programme du groupe reçoit le rattachement. C'est la
// concordance entre filières du document de conception.
//
// Le titre de section n'entre pas dans la comparaison : « Polynômes et
// fractions rationnelles » (MPSI) et « Polynômes » (PCSI) portent les mêmes
// sous-sections. Une variante de titre (« Anneau des polynômes » / « Ensemble
// des polynômes ») rejoint le groupe le plus proche par ses mots. Un groupe ne
// contient jamais deux feuilles d'un même programme.
//
// Les familles se présentent séparément au modèle : leurs découpages diffèrent
// (BCPST rattache des chapitres entiers là où MPSI a des sous-sections), et
// sans cela le modèle néglige la famille présentée en dernier.
//
// Quand une famille a une table de concordance relue
// (content/referentials/cpge/concordance.json), ses groupes remplacent le
// regroupement par titres, et chaque groupe porte ses écarts : les notions
// exigibles dans une filière du groupe et pas dans une autre.

import fs from 'fs';

const PROGRAMME_ORDER = ['mpsi-mp2i', 'pcsi', 'ptsi', 'bcpst1', 'mp-mpi', 'pc', 'psi', 'pt', 'bcpst2'];

/** Version du regroupement, enregistrée avec chaque résultat d'étiquetage. */
export const REGROUPEMENT_VERSION = 3;

export const FAMILLES = [
  { id: 'tronc-1', libelle: 'MPSI/MP2I, PCSI, PTSI — 1re année', programmes: ['mpsi-mp2i', 'pcsi', 'ptsi'] },
  { id: 'bcpst-1', libelle: 'BCPST — 1re année', programmes: ['bcpst1'] },
  { id: 'tronc-2', libelle: 'MP/MPI, PC, PSI, PT — 2e année', programmes: ['mp-mpi', 'pc', 'psi', 'pt'] },
  { id: 'bcpst-2', libelle: 'BCPST — 2e année', programmes: ['bcpst2'] }
];
const FAMILLE_OF = new Map(FAMILLES.flatMap(f => f.programmes.map(p => [p, f.id])));

// Seuil de similarité (Jaccard sur les mots significatifs) pour rattacher une
// variante de titre à un groupe existant.
const SIMILARITE_MIN = 0.5;
const MOTS_VIDES = new Set(['de', 'des', 'du', 'la', 'le', 'les', 'l', 'd', 'a', 'à', 'au', 'aux', 'en', 'et', 'un', 'une', 'sur', 'par', 'pour', 'dans', 'cas']);

/**
 * Table de concordance : sous-section -> groupe d'équivalents (avec écarts),
 * et familles qu'elle couvre. Fichier absent : aucune concordance.
 */
export function loadConcordance(file) {
  const byNode = new Map();
  const familles = new Set();
  if (!fs.existsSync(file)) return { byNode, familles };
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [famille, f] of Object.entries(data.familles ?? {})) {
    familles.add(famille);
    for (const g of f.groupes ?? []) {
      for (const n of g.noeuds) byNode.set(n, { ...g, famille });
    }
  }
  return { byNode, familles };
}

export function loadCorrespondances(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const table = new Map();
  for (const entry of data.correspondances ?? []) {
    table.set(`${entry.source}|${entry.chapitre}`, entry.noeuds ?? []);
  }
  return table;
}

/** Titre sans lettre de sous-section, préfixe de partie ni numéro de chapitre BCPST. */
function normalizeTitle(titre) {
  return titre
    .replace(/^[a-z]\)\s*/, '')
    .replace(/^[A-Z]\s*[-–]\s*/, '')
    .replace(/^[\p{L} ]+\d+\s*[-–]\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Mots significatifs d'un titre, sans accents ni pluriel en -s. */
function words(titre) {
  return new Set(normalizeTitle(titre)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\$[^$]*\$/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(w => w && !MOTS_VIDES.has(w))
    .map(w => w.replace(/s$/, '')));
}

function similarity(a, b) {
  if (!a.size || !b.size) return 0;
  const inter = [...a].filter(w => b.has(w)).length;
  return inter / (a.size + b.size - inter);
}

/**
 * Index des nœuds : par identifiant et par parent.
 * @param {object[]} nodes nœuds de collectReferentiel()
 */
export function indexNodes(nodes) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const children = new Map();
  for (const node of nodes) {
    if (!node.parent_id) continue;
    if (!children.has(node.parent_id)) children.set(node.parent_id, []);
    children.get(node.parent_id).push(node);
  }
  return { byId, children };
}

/** Feuilles sous un nœud : lui-même s'il n'a pas d'enfant. */
function leavesOf(node, index) {
  const kids = index.children.get(node.id) ?? [];
  if (!kids.length) return [node];
  return kids.flatMap(kid => leavesOf(kid, index));
}

/**
 * Groupes de candidats pour une liste de nœuds de la table.
 * Chaque groupe : { code, titre, section, noeuds: [id…], programmes, contenus }.
 * `contenus` vient du premier programme du groupe, dans l'ordre PROGRAMME_ORDER.
 */
export function buildCandidates(noeudIds, index, { concordance = null } = {}) {
  const unknown = noeudIds.filter(id => !index.byId.has(id));
  if (unknown.length) throw new Error(`nœuds inconnus dans la table de correspondance : ${unknown.join(', ')}`);

  const leaves = new Map();
  for (const id of noeudIds) {
    for (const leaf of leavesOf(index.byId.get(id), index)) leaves.set(leaf.id, leaf);
  }

  const rank = programme => {
    const i = PROGRAMME_ORDER.indexOf(programme);
    return i === -1 ? PROGRAMME_ORDER.length : i;
  };
  const ordered = [...leaves.values()].sort((x, y) => rank(x.programme) - rank(y.programme) || x.ordre - y.ordre);

  const sectionWords = leaf => words(leaf.parent_id ? index.byId.get(leaf.parent_id)?.titre ?? '' : '');
  /**
   * Parmi les groupes de même titre de sous-section, celui dont la section est
   * la plus proche : « Divisibilité et division euclidienne » existe pour les
   * entiers et pour les polynômes.
   */
  const bestExact = (leaf, famille) => {
    const key = normalizeTitle(leaf.titre);
    const matches = groups.filter(g => g.concordance === undefined && g.famille === famille && g.key === key &&
      !g.leaves.some(l => l.programme === leaf.programme));
    if (matches.length <= 1) return matches[0] ?? null;
    const own = sectionWords(leaf);
    return matches.reduce((best, g) => (similarity(own, g.section) > similarity(own, best.section) ? g : best));
  };

  // 0. Familles couvertes par la concordance : ses groupes font autorité.
  const groups = [];
  const pending = [];
  const parConcordance = new Map();
  const titled = [];
  for (const leaf of ordered) {
    const famille = FAMILLE_OF.get(leaf.programme) ?? leaf.programme;
    if (!concordance?.familles.has(famille)) {
      titled.push(leaf);
      continue;
    }
    const c = concordance.byNode.get(leaf.id);
    const key = c ? `concordance:${c.id}` : `seule:${leaf.id}`;
    if (!parConcordance.has(key)) {
      const group = { famille, key, words: words(leaf.titre), section: sectionWords(leaf), leaves: [], concordance: c ?? null };
      parConcordance.set(key, group);
      groups.push(group);
    }
    parConcordance.get(key).leaves.push(leaf);
  }

  // 1. Titre identique dans une même famille, un seul nœud par programme.
  for (const leaf of titled) {
    const famille = FAMILLE_OF.get(leaf.programme) ?? leaf.programme;
    const key = normalizeTitle(leaf.titre);
    if (isFirstOfFamily(leaf, titled)) {
      groups.push({ famille, key, words: words(leaf.titre), section: sectionWords(leaf), leaves: [leaf] });
    } else {
      pending.push(leaf);
    }
  }

  // 2. Variantes de titre : rattachées au groupe le plus proche de la famille
  // qui n'a pas encore ce programme, sinon groupe à part.
  for (const leaf of pending) {
    const famille = FAMILLE_OF.get(leaf.programme) ?? leaf.programme;
    const exact = bestExact(leaf, famille);
    if (exact) {
      exact.leaves.push(leaf);
      continue;
    }
    const own = words(leaf.titre);
    let best = null;
    let bestScore = SIMILARITE_MIN;
    for (const g of groups) {
      if (g.concordance !== undefined || g.famille !== famille || g.leaves.some(l => l.programme === leaf.programme)) continue;
      const score = similarity(own, g.words);
      if (score >= bestScore) {
        best = g;
        bestScore = score;
      }
    }
    if (best) best.leaves.push(leaf);
    else groups.push({ famille, key: normalizeTitle(leaf.titre), words: own, section: sectionWords(leaf), leaves: [leaf] });
  }

  const familleRank = id => {
    const i = FAMILLES.findIndex(f => f.id === id);
    return i === -1 ? FAMILLES.length : i;
  };
  return groups
    .map(group => {
      group.leaves.sort((x, y) => rank(x.programme) - rank(y.programme));
      const [first] = group.leaves;
      const parent = first.parent_id ? index.byId.get(first.parent_id) : null;
      // Écarts réduits aux programmes présents parmi les candidats.
      const present = new Set(group.leaves.map(leaf => leaf.programme));
      const ecarts = (group.concordance?.ecarts ?? [])
        .map(e => ({ ...e, presente: e.presente.filter(p => present.has(p)), absente: e.absente.filter(p => present.has(p)) }))
        .filter(e => e.presente.length && e.absente.length);
      return {
        concordance: group.concordance?.id ?? null,
        ecarts,
        famille: group.famille,
        section: (parent?.titre ?? '').replace(/^[A-Z]\s*[-–]\s*/, ''),
        titre: first.titre.replace(/^[a-z]\)\s*/, ''),
        noeuds: group.leaves.map(leaf => leaf.id),
        programmes: group.leaves.map(leaf => leaf.programme),
        contenus: first.contenus,
        texte: first.texte,
        _order: familleRank(group.famille) * 1e6 + rank(first.programme) * 1e4 + first.ordre
      };
    })
    .sort((x, y) => x._order - y._order)
    .map(({ _order, ...group }, i) => ({ code: `G${i + 1}`, ...group }));
}

/**
 * Le premier programme d'une famille (dans l'ordre PROGRAMME_ORDER) fonde les
 * groupes ; les autres s'y rattachent, par titre exact ou par proximité.
 */
function isFirstOfFamily(leaf, ordered) {
  const famille = FAMILLE_OF.get(leaf.programme) ?? leaf.programme;
  const first = ordered.find(l => (FAMILLE_OF.get(l.programme) ?? l.programme) === famille);
  return first.programme === leaf.programme;
}

const LABELS = {
  'mpsi-mp2i': 'MPSI/MP2I', pcsi: 'PCSI', ptsi: 'PTSI', bcpst1: 'BCPST1',
  'mp-mpi': 'MP/MPI', pc: 'PC', psi: 'PSI', pt: 'PT', bcpst2: 'BCPST2'
};

/** Texte d'un contenu de programme, allégé pour le prompt. */
function compact(markdown) {
  return markdown.replace(/<br>/g, ' ; ').replace(/\s+/g, ' ').trim();
}

/**
 * Présentation des groupes pour le prompt : code, filières, titre, puis la
 * colonne « contenus » du programme, tronquée à `maxChars` caractères.
 */
/**
 * Sommaire des groupes : une ligne par groupe (code, filières, section ›
 * sous-section, écarts), sans contenus. Pour l'étiquetage direct, où le
 * modèle cherche dans tous les programmes.
 */
export function formatSommaire(groups) {
  let famille = null;
  const lignes = [];
  for (const group of groups) {
    if (group.famille !== famille) {
      famille = group.famille;
      lignes.push('', `## ${FAMILLES.find(f => f.id === famille)?.libelle ?? famille}`);
    }
    const ecarts = group.ecarts?.length
      ? ` — écarts entre filières : ${group.ecarts.map(e => `${e.notion.slice(0, 70)} (${e.presente.map(p => LABELS[p] ?? p).join(', ')} seulement)`).join(' ; ')}`
      : '';
    lignes.push(`${group.code} [${group.programmes.map(p => LABELS[p] ?? p).join(', ')}] ${group.section ? `${group.section} › ` : ''}${group.titre}${ecarts}`);
  }
  return lignes.join('\n').trim();
}

/**
 * Texte officiel complet des groupes : chaque programme du groupe, avec ses
 * contenus et ses commentaires, sous un titre « ### G12 ».
 */
export function formatTexteOfficiel(groups, index) {
  const propre = t => String(t ?? '').replace(/<br>/g, ' ').replace(/\s+/g, ' ').trim();
  return groups.map(group => [
    `### ${group.code} [${group.programmes.map(p => LABELS[p] ?? p).join(', ')}] ${group.section ? `${group.section} › ` : ''}${group.titre}`,
    ...group.noeuds.map(id => {
      const n = index.byId.get(id);
      const rows = (n.contenus ?? []).map(r => `- ${propre(r.contenu)}${r.commentaire ? ` — commentaire : ${propre(r.commentaire)}` : ''}`);
      return [`#### ${LABELS[n.programme] ?? n.programme} — ${n.titre} (${id})`, n.texte ? propre(n.texte) : '', ...rows].filter(Boolean).join('\n');
    }),
    ...(group.ecarts ?? []).map(e => `Écart entre filières : ${e.notion} — au programme de ${e.presente.map(p => LABELS[p] ?? p).join(', ')}, pas de ${e.absente.map(p => LABELS[p] ?? p).join(', ')} (${e.nature}).`)
  ].join('\n')).join('\n\n');
}

export function formatCandidates(groups, { maxChars = 420 } = {}) {
  let famille = null;
  return groups.map(group => {
    const heading = group.famille !== famille
      ? `${famille === null ? '' : '\n'}## ${FAMILLES.find(f => f.id === group.famille)?.libelle ?? group.famille}\n`
      : '';
    famille = group.famille;
    const filieres = group.programmes.map(p => LABELS[p] ?? p).join(', ');
    const head = `${group.code} [${filieres}] ${group.section ? `${group.section} › ` : ''}${group.titre}`;
    let body = group.contenus.map(row => compact(row.contenu)).filter(Boolean).join(' ; ');
    if (!body && group.texte) body = compact(group.texte);
    if (body.length > maxChars) body = `${body.slice(0, maxChars).replace(/\s+\S*$/, '')} …`;
    const ecarts = (group.ecarts ?? []).slice(0, 6).map(e => {
      const notion = e.notion.length > 110 ? `${e.notion.slice(0, 110).replace(/\s+\S*$/, '')} …` : e.notion;
      return `${notion} : ${e.presente.map(p => LABELS[p] ?? p).join(', ')} seulement`;
    });
    const lines = [head, body && `   ${body}`, ecarts.length && `   Écarts entre filières — ${ecarts.join(' ; ')}`].filter(Boolean);
    return `${heading}${lines.join('\n')}`;
  }).join('\n');
}

/**
 * Mentions « hors programme » des candidats et de leurs sections (bandeaux,
 * contenus, commentaires) : les extraits tronqués des candidats les coupent
 * souvent. Les mentions qui ne visent qu'une démonstration sont écartées.
 */
export function horsProgramme(groups, index, { max = 15, maxChars = 170 } = {}) {
  const seen = new Set();
  const out = [];
  const add = (text, label) => {
    for (const sentence of (text ?? '').replace(/<br>/g, '\n').split(/\n|(?<=\.)\s+/)) {
      const clean = sentence.replace(/\s+/g, ' ').trim();
      if (!/hors programme/i.test(clean) || /^(la|leur|sa|les) démonstrations?\b/i.test(clean)) continue;
      const short = clean.length > maxChars ? `${clean.slice(0, maxChars).replace(/\s+\S*$/, '')} …` : clean;
      if (seen.has(`${label}|${short.toLowerCase()}`)) continue;
      seen.add(`${label}|${short.toLowerCase()}`);
      out.push(`[${label}] ${short}`);
    }
  };
  // Une exclusion ne vaut que pour les filières du programme qui la porte.
  for (const group of groups) {
    const node = index.byId.get(group.noeuds[0]);
    const label = group.programmes.map(p => LABELS[p] ?? p).join(', ');
    for (let n = node; n; n = n.parent_id ? index.byId.get(n.parent_id) : null) add(n.texte, label);
    for (const row of node.contenus) {
      add(row.contenu, label);
      add(row.commentaire, label);
    }
  }
  return out.slice(0, max);
}
