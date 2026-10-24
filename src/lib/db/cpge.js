// src/lib/db/cpge.js
//
// Lecture du référentiel CPGE et des rattachements des exercices (voir
// docs/classification-cpge.md). Les tables sont construites par
// scripts/build-referentiel-cpge.js à partir des programmes officiels et des
// macros \cpge{} des sources.
//
// L'unité de navigation est le programme (un texte officiel) : MPSI et MP2I en
// partagent un, BCPST en a deux (un par année). Un nœud est une section, une
// partie lettrée (« A - », section dont le parent est une section) ou une
// sous-section ; le compte d'un nœud inclut ses descendants.

import Database from 'better-sqlite3';
import path from 'path';

// Comme hybridSearch.js : DATABASE_PATH en production ou pour les tests.
const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve('data/exercises.sqlite');

// Ordre d'affichage : première année, puis seconde, dans l'ordre usuel des filières.
const ORDRE_PROGRAMMES = ['mpsi-mp2i', 'pcsi', 'ptsi', 'bcpst1', 'mp-mpi', 'pc', 'psi', 'pt', 'bcpst2'];
// Filières proposées dans les filtres de recherche.
export const FILIERES = ['MPSI', 'MP2I', 'PCSI', 'PTSI', 'BCPST', 'MP', 'MPI', 'PC', 'PSI', 'PT'];

const ITEM_COLUMNS = `
  e.uuid, e.title, e.chapter, e.subchapter, e.theme, e.level, e.difficulty,
  e.module, e.author, e.organization, e.license_code, e.license_url, e.video_id,
  e.hasIndication, e.hasSolution, e.preview, e.created_at, e.updated_at
`;

// Descendants d'un nœud, lui compris, en suivant parent_id (pas le préfixe de
// l'identifiant : une partie « A - » a un identifiant à part).
const SOUS_ARBRE = `
  WITH RECURSIVE sous(id) AS (
    SELECT ?
    UNION ALL
    SELECT n.id FROM cpge_noeuds n JOIN sous s ON n.parent_id = s.id
  )
`;

function ouvrir() {
  return new Database(DB_PATH, { readonly: true });
}

function tablesPresentes(db) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'exercise_cpge'").get());
}

const ordreProgramme = programme => {
  const i = ORDRE_PROGRAMMES.indexOf(programme);
  return i < 0 ? ORDRE_PROGRAMMES.length : i;
};

/**
 * Clauses de filtre CPGE pour une requête sur `exercises` (paramètres positionnels).
 * - `filiere` : l'exercice est rattaché à un programme de cette filière ;
 * - `cpge` : il est rattaché à ce nœud ou à l'un de ses descendants ;
 * - `prepa` : il a au moins un rattachement.
 * @param {{ filiere?: string, cpge?: string, prepa?: boolean }} filters
 * @param {string} alias alias de la table exercises
 * @returns {{ clauses: string[], params: unknown[] }}
 */
export function cpgeFilterClauses(filters = {}, alias = 'e') {
  const clauses = [];
  const params = [];
  if (filters.cpge) {
    clauses.push(`${alias}.uuid IN (
      ${SOUS_ARBRE}
      SELECT ec.uuid FROM exercise_cpge ec WHERE ec.noeud_id IN (SELECT id FROM sous)
    )`);
    params.push(filters.cpge);
  }
  if (filters.filiere) {
    clauses.push(`${alias}.uuid IN (
      SELECT ec.uuid FROM exercise_cpge ec
      JOIN cpge_noeuds n ON n.id = ec.noeud_id
      JOIN cpge_filieres f ON f.programme = n.programme
      WHERE UPPER(f.filiere) = UPPER(?)
    )`);
    params.push(filters.filiere);
  }
  if (filters.prepa && !filters.cpge && !filters.filiere) {
    clauses.push(`${alias}.uuid IN (SELECT uuid FROM exercise_cpge)`);
  }
  return { clauses, params };
}

/**
 * Programmes, avec leurs filières et le nombre d'exercices rattachés.
 * @returns {Promise<{programme: string, titre: string, annee: number, filieres: string[], exercices: number}[]>}
 */
export async function getCpgeProgrammes() {
  let db;
  try {
    db = ouvrir();
    if (!tablesPresentes(db)) return [];
    const rows = db.prepare(`
      SELECT p.programme, p.titre, p.annee,
             (SELECT GROUP_CONCAT(f.filiere, ',') FROM cpge_filieres f WHERE f.programme = p.programme) AS filieres,
             (SELECT COUNT(DISTINCT ec.uuid) FROM exercise_cpge ec
                JOIN cpge_noeuds n ON n.id = ec.noeud_id WHERE n.programme = p.programme) AS exercices
      FROM cpge_programmes p
    `).all();
    return rows
      .map(r => ({ ...r, filieres: (r.filieres ?? '').split(',').filter(Boolean).sort((a, b) => FILIERES.indexOf(a) - FILIERES.indexOf(b)) }))
      .sort((a, b) => ordreProgramme(a.programme) - ordreProgramme(b.programme));
  } finally {
    db?.close();
  }
}

/**
 * Nombre d'exercices de chaque nœud d'un programme, descendants compris.
 * @param {import('better-sqlite3').Database} db
 * @param {string} programme
 */
function comptesProgramme(db, programme) {
  const rows = db.prepare(`
    WITH RECURSIVE ancetres(noeud_id, ancetre) AS (
      SELECT n.id, n.id FROM cpge_noeuds n WHERE n.programme = ?
      UNION ALL
      SELECT a.noeud_id, p.parent_id FROM ancetres a
      JOIN cpge_noeuds p ON p.id = a.ancetre WHERE p.parent_id IS NOT NULL
    )
    SELECT a.ancetre AS id, COUNT(DISTINCT ec.uuid) AS n
    FROM ancetres a JOIN exercise_cpge ec ON ec.noeud_id = a.noeud_id
    GROUP BY a.ancetre
  `).all(programme);
  return new Map(rows.map(r => [r.id, r.n]));
}

/**
 * Arbre d'un programme : sections (avec leurs parties et sous-sections), dans
 * l'ordre du texte officiel, avec les comptes d'exercices.
 * @param {string} programme
 */
export async function getCpgeArbre(programme) {
  let db;
  try {
    db = ouvrir();
    if (!tablesPresentes(db)) return null;
    const meta = db.prepare('SELECT programme, titre, annee, source_url, bo_url FROM cpge_programmes WHERE programme = ?').get(programme);
    if (!meta) return null;
    const filieres = db.prepare('SELECT filiere FROM cpge_filieres WHERE programme = ?').all(programme).map(r => r.filiere);
    const comptes = comptesProgramme(db, programme);
    const noeuds = db.prepare(`
      SELECT id, type, parent_id, partie, semestre, lettre, titre, ordre
      FROM cpge_noeuds WHERE programme = ? ORDER BY ordre
    `).all(programme).map(n => ({ ...n, exercices: comptes.get(n.id) ?? 0, enfants: [] }));
    const parId = new Map(noeuds.map(n => [n.id, n]));
    const racines = [];
    for (const n of noeuds) {
      const parent = n.parent_id ? parId.get(n.parent_id) : null;
      (parent ? parent.enfants : racines).push(n);
    }
    // Regroupement par grande partie (semestres en première année).
    const parties = [];
    for (const r of racines) {
      const nom = r.partie || 'Programme';
      let p = parties.find(x => x.nom === nom);
      if (!p) parties.push((p = { nom, sections: [] }));
      p.sections.push(r);
    }
    return { ...meta, filieres, exercices: comptes.size ? db.prepare(`
      SELECT COUNT(DISTINCT ec.uuid) n FROM exercise_cpge ec JOIN cpge_noeuds n ON n.id = ec.noeud_id WHERE n.programme = ?
    `).get(programme).n : 0, parties };
  } finally {
    db?.close();
  }
}

/**
 * Un nœud : son texte officiel, ses ancêtres, ses enfants et ses exercices
 * (descendants compris).
 * @param {string} id
 * @param {{ limit?: number, offset?: number }} options
 */
export async function getCpgeNoeud(id, { limit = 100, offset = 0 } = {}) {
  let db;
  try {
    db = ouvrir();
    if (!tablesPresentes(db)) return null;
    const noeud = db.prepare(`
      SELECT id, programme, type, parent_id, partie, semestre, lettre, titre, texte, contenus, ordre
      FROM cpge_noeuds WHERE id = ?
    `).get(id);
    if (!noeud) return null;

    const ancetres = [];
    let parent = noeud.parent_id;
    while (parent) {
      const p = db.prepare('SELECT id, titre, parent_id FROM cpge_noeuds WHERE id = ?').get(parent);
      if (!p) break;
      ancetres.unshift({ id: p.id, titre: p.titre });
      parent = p.parent_id;
    }
    const comptes = comptesProgramme(db, noeud.programme);
    const enfants = db.prepare('SELECT id, type, lettre, titre FROM cpge_noeuds WHERE parent_id = ? ORDER BY ordre')
      .all(id).map(e => ({ ...e, exercices: comptes.get(e.id) ?? 0 }));

    const total = db.prepare(`${SOUS_ARBRE}
      SELECT COUNT(DISTINCT ec.uuid) n FROM exercise_cpge ec WHERE ec.noeud_id IN (SELECT id FROM sous)
    `).get(id).n;
    const exercices = db.prepare(`${SOUS_ARBRE}
      SELECT ${ITEM_COLUMNS} FROM exercises e
      WHERE e.uuid IN (SELECT ec.uuid FROM exercise_cpge ec WHERE ec.noeud_id IN (SELECT id FROM sous))
      ORDER BY e.title COLLATE NOCASE
      LIMIT ? OFFSET ?
    `).all(id, limit, offset);

    let contenus = [];
    try {
      contenus = JSON.parse(noeud.contenus || '[]');
    } catch {
      contenus = [];
    }
    const programme = db.prepare('SELECT programme, titre, annee, source_url FROM cpge_programmes WHERE programme = ?').get(noeud.programme);
    const filieres = db.prepare('SELECT filiere FROM cpge_filieres WHERE programme = ?').all(noeud.programme).map(r => r.filiere);
    return {
      ...noeud,
      contenus,
      programme: { ...programme, filieres },
      ancetres,
      enfants,
      exercices: comptes.get(id) ?? 0,
      liste: { total, exercices, limit, offset }
    };
  } finally {
    db?.close();
  }
}

/**
 * Rattachements d'un exercice, groupés par programme, dans l'ordre des programmes.
 * @param {string} uuid
 * @returns {Promise<{programme: string, titre: string, annee: number, filieres: string[], noeuds: {id: string, titre: string, section: string|null, sectionId: string|null}[]}[]>}
 */
export async function getExerciseCpge(uuid) {
  let db;
  try {
    db = ouvrir();
    if (!tablesPresentes(db)) return [];
    const rows = db.prepare(`
      SELECT n.id, n.titre, n.type, n.programme, n.ordre,
             s.id AS section_id, s.titre AS section_titre,
             p.titre AS programme_titre, p.annee
      FROM exercise_cpge ec
      JOIN cpge_noeuds n ON n.id = ec.noeud_id
      LEFT JOIN cpge_noeuds s ON s.id = n.parent_id
      JOIN cpge_programmes p ON p.programme = n.programme
      WHERE ec.uuid = ?
      ORDER BY n.ordre
    `).all(uuid);
    const filieres = new Map(db.prepare('SELECT filiere, programme FROM cpge_filieres').all()
      .reduce((acc, r) => acc.set(r.programme, [...(acc.get(r.programme) ?? []), r.filiere]), new Map()));
    const parProgramme = new Map();
    for (const r of rows) {
      if (!parProgramme.has(r.programme)) {
        parProgramme.set(r.programme, {
          programme: r.programme,
          titre: r.programme_titre,
          annee: r.annee,
          filieres: (filieres.get(r.programme) ?? []).sort((a, b) => FILIERES.indexOf(a) - FILIERES.indexOf(b)),
          noeuds: []
        });
      }
      parProgramme.get(r.programme).noeuds.push({
        id: r.id,
        titre: r.titre,
        section: r.type === 'sous-section' ? r.section_titre : null,
        sectionId: r.type === 'sous-section' ? r.section_id : null
      });
    }
    return [...parProgramme.values()].sort((a, b) => ordreProgramme(a.programme) - ordreProgramme(b.programme));
  } finally {
    db?.close();
  }
}
