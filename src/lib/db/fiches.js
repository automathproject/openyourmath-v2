// src/lib/db/fiches.js
//
// Lecture des fiches d'exercices. Voir docs/fiches-exercices.md pour le format
// source et le modèle en base.
//
// Une fiche est une liste ordonnée : elle se sert à l'application sous la même
// forme que /exercise/list, à ceci près que chaque entrée porte en plus son
// chemin de sections. C'est ce qui permet de réutiliser la liste existante sans
// la transformer.

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve('data/exercises.sqlite');

// Métadonnées suffisantes pour la liste et son rail ; ni `preview` ni
// `content_json` : le contenu se charge à la demande via /api/exercise/<uuid>,
// ce qui rend supportables les fiches de plusieurs milliers d'exercices.
const ITEM_COLUMNS = `
  e.uuid, e.title, e.chapter, e.subchapter, e.theme, e.level, e.difficulty,
  e.module, e.author, e.organization, e.hasIndication, e.hasSolution
`;

function parseSectionPath(value) {
  try {
    const parsed = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(part => typeof part === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Catalogue des fiches.
 * @param {{organization?: string, author?: string, query?: string, limit?: number, offset?: number}} filters
 */
export async function getFiches(filters = {}) {
  const { organization, author, query, limit = 200, offset = 0 } = filters;
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });

    const clauses = [];
    const params = {};
    if (organization) { clauses.push('organization = @organization'); params.organization = organization; }
    if (author) { clauses.push('author = @author'); params.author = author; }
    if (query && query.trim()) {
      clauses.push('LOWER(title) LIKE @query');
      params.query = `%${query.trim().toLowerCase()}%`;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const rows = db.prepare(`
      SELECT uuid, slug, title, author, organization, created_at,
             exercise_count, missing_count, max_depth
      FROM fiches
      ${where}
      ORDER BY slug
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit, offset });

    const total = db.prepare(`SELECT COUNT(*) AS n FROM fiches ${where}`).get(params).n;
    return { fiches: rows, total };
  } catch (error) {
    console.error('Database error in getFiches:', error);
    throw new Error('Erreur de base de données');
  } finally {
    if (db) db.close();
  }
}

/** Facettes du catalogue : organisations et auteurs, avec leur nombre de fiches. */
export async function getFicheFacets() {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    return {
      organizations: db.prepare(`
        SELECT organization AS value, COUNT(*) AS count
        FROM fiches GROUP BY organization ORDER BY count DESC
      `).all(),
      authors: db.prepare(`
        SELECT author AS value, COUNT(*) AS count
        FROM fiches WHERE author IS NOT NULL AND TRIM(author) != ''
        GROUP BY author ORDER BY count DESC
      `).all()
    };
  } catch (error) {
    console.error('Database error in getFicheFacets:', error);
    throw new Error('Erreur de base de données');
  } finally {
    if (db) db.close();
  }
}

/**
 * Une fiche et ses exercices, dans l'ordre de la source.
 *
 * Accepte l'identifiant éditorial (`f00012`) autant que le nom de fichier
 * (`fic00012`) : les deux circulent dans les sources exo7.
 *
 * Les références sans exercice au corpus sont exclues de `exercises` mais
 * comptées dans `meta.missing` : la page reste utilisable, la lacune reste
 * visible.
 */
export async function getFicheByUuid(identifier) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });

    const fiche = db.prepare(`
      SELECT uuid, slug, title, author, organization, created_at, intro,
             exercise_count, missing_count, max_depth
      FROM fiches WHERE uuid = ? OR slug = ?
    `).get(identifier, identifier);

    if (!fiche) return null;

    const rows = db.prepare(`
      SELECT i.position, i.section_path, i.source_ref, ${ITEM_COLUMNS}
      FROM fiche_items i
      LEFT JOIN exercises e ON e.uuid = i.exercise_uuid
      WHERE i.fiche_uuid = ?
      ORDER BY i.position
    `).all(fiche.uuid);

    const exercises = [];
    const missing = [];
    for (const row of rows) {
      const sectionPath = parseSectionPath(row.section_path);
      if (!row.uuid) {
        missing.push({ position: row.position, sourceRef: row.source_ref, sectionPath });
        continue;
      }
      const { position, section_path: _ignored, source_ref: sourceRef, ...exercise } = row;
      exercises.push({
        ...exercise,
        sectionPath,
        // La liste regroupe par section contiguë ; le dernier segment est le
        // titre qui porte directement l'exercice.
        section: sectionPath.length ? sectionPath[sectionPath.length - 1] : null,
        sourceRef
      });
    }

    return {
      fiche,
      exercises,
      meta: {
        total: rows.length,
        loaded: exercises.length,
        missing: missing.length,
        missingRefs: missing
      }
    };
  } catch (error) {
    console.error('Database error in getFicheByUuid:', error);
    throw new Error('Erreur de base de données');
  } finally {
    if (db) db.close();
  }
}

/**
 * Les fiches où figure un exercice — la relation inverse, que
 * `idx_fiche_items_exercise` rend immédiate.
 */
export async function getFichesForExercise(uuid, limit = 10) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    return db.prepare(`
      SELECT DISTINCT f.uuid, f.slug, f.title, f.author, f.organization, f.exercise_count
      FROM fiche_items i
      JOIN fiches f ON f.uuid = i.fiche_uuid
      WHERE i.exercise_uuid = ?
      ORDER BY f.slug
      LIMIT ?
    `).all(uuid, limit);
  } catch (error) {
    console.error('Database error in getFichesForExercise:', error);
    return [];
  } finally {
    if (db) db.close();
  }
}
