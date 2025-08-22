// src/lib/db/queries.js - Version corrigée
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve('data/exercises.sqlite');

/**
 * Prépare une requête de recherche pour FTS5 avec gestion des préfixes
 */
function prepareSearchQuery(query) {
  if (!query || query.trim() === '') {
    return '';
  }
  
  const cleanQuery = query.trim().toLowerCase();
  
  // Si c'est très court (1-2 caractères), utiliser LIKE plutôt que FTS
  if (cleanQuery.length <= 2) {
    return null; // Signale qu'il faut utiliser LIKE
  }
  
  // Pour FTS5 : ajouter * à la fin pour recherche de préfixe
  return `"${cleanQuery}"*`;
}

/**
 * Recherche d'exercices avec filtres (version améliorée)
 */
export async function searchExercises(query = '', filters = {}, options = {}) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    const { limit = 20, offset = 0 } = options;
    const searchQuery = prepareSearchQuery(query);
    
    let sql, params = [];
    
    // Pour les requêtes très courtes, utiliser LIKE
    if (query.trim() && searchQuery === null) {
      sql = `
        SELECT 
          e.uuid, e.title, e.chapter, e.theme, e.difficulty,
          e.author, e.created_at
        FROM exercises e
        WHERE (
          e.title LIKE ? 
          OR e.chapter LIKE ? 
          OR e.theme LIKE ?
        )
      `;
      
      const likeQuery = `%${query.trim()}%`;
      params.push(likeQuery, likeQuery, likeQuery);
      
    } else if (searchQuery) {
      // Recherche FTS5 avec préfixes
      sql = `
        SELECT 
          e.uuid, e.title, e.chapter, e.theme, e.difficulty,
          e.author, e.created_at,
          bm25(fts_exercises) as rank
        FROM exercises e
        JOIN fts_exercises fts ON e.uuid = fts.uuid
        WHERE fts_exercises MATCH ?
      `;
      params.push(searchQuery);
      
    } else {
      // Pas de recherche textuelle, juste les filtres
      sql = `
        SELECT 
          e.uuid, e.title, e.chapter, e.theme, e.difficulty,
          e.author, e.created_at
        FROM exercises e
        WHERE 1=1
      `;
    }
    
    // Ajouter les filtres
    if (filters.chapter) {
      sql += ' AND e.chapter = ?';
      params.push(filters.chapter);
    }
    
    if (filters.difficulty !== undefined) {
      sql += ' AND e.difficulty = ?';
      params.push(filters.difficulty);
    }
    
    if (filters.author) {
      sql += ' AND e.author = ?';
      params.push(filters.author);
    }
    
    // Ordre
    if (searchQuery) {
      sql += ' ORDER BY rank';
    } else if (query.trim() && searchQuery === null) {
      sql += ' ORDER BY e.title';
    } else {
      sql += ' ORDER BY e.created_at DESC';
    }
    
    // Pagination
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    console.log('Search SQL:', sql);
    console.log('Search params:', params);
    
    const results = db.prepare(sql).all(...params);
    return results;
    
  } catch (error) {
    console.error('Database error in searchExercises:', error);
    throw new Error('Erreur de recherche');
  } finally {
    if (db) db.close();
  }
}

/**
 * Compte le nombre total d'exercices pour une recherche (version améliorée)
 */
export async function getExerciseCount(query = '', filters = {}) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    const searchQuery = prepareSearchQuery(query);
    let sql, params = [];
    
    // Pour les requêtes très courtes, utiliser LIKE
    if (query.trim() && searchQuery === null) {
      sql = `
        SELECT COUNT(*) as count 
        FROM exercises e
        WHERE (
          e.title LIKE ? 
          OR e.chapter LIKE ? 
          OR e.theme LIKE ?
        )
      `;
      
      const likeQuery = `%${query.trim()}%`;
      params.push(likeQuery, likeQuery, likeQuery);
      
    } else if (searchQuery) {
      // Recherche FTS5
      sql = `
        SELECT COUNT(*) as count 
        FROM exercises e
        JOIN fts_exercises fts ON e.uuid = fts.uuid
        WHERE fts_exercises MATCH ?
      `;
      params.push(searchQuery);
      
    } else {
      // Pas de recherche textuelle
      sql = 'SELECT COUNT(*) as count FROM exercises e WHERE 1=1';
    }
    
    // Ajouter les filtres
    if (filters.chapter) {
      sql += ' AND e.chapter = ?';
      params.push(filters.chapter);
    }
    
    if (filters.difficulty !== undefined) {
      sql += ' AND e.difficulty = ?';
      params.push(filters.difficulty);
    }
    
    if (filters.author) {
      sql += ' AND e.author = ?';
      params.push(filters.author);
    }
    
    const result = db.prepare(sql).get(...params);
    return result.count;
    
  } catch (error) {
    console.error('Database error in getExerciseCount:', error);
    return 0;
  } finally {
    if (db) db.close();
  }
}

// Autres fonctions inchangées...

/**
 * Récupère un exercice par son UUID
 */
export async function getExerciseByUuid(uuid) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    const exercise = db.prepare(`
      SELECT 
        uuid, title, chapter, subchapter, theme, difficulty,
        author, organization, video_id, created_at, updated_at,
        content_json
      FROM exercises 
      WHERE uuid = ?
    `).get(uuid);
    
    if (!exercise) {
      return null;
    }
    
    // Parser le contenu JSON
    if (exercise.content_json) {
      try {
        exercise.content = JSON.parse(exercise.content_json);
        delete exercise.content_json;
      } catch (err) {
        console.error('Failed to parse content JSON:', err);
        exercise.content = [];
      }
    }
    
    return exercise;
    
  } catch (error) {
    console.error('Database error in getExerciseByUuid:', error);
    throw new Error('Erreur de base de données');
  } finally {
    if (db) db.close();
  }
}

/**
 * Récupère des exercices similaires
 */
export async function getSimilarExercises(uuid, limit = 5) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    const reference = db.prepare('SELECT chapter, theme, difficulty FROM exercises WHERE uuid = ?').get(uuid);
    
    if (!reference) {
      return [];
    }
    
    const similar = db.prepare(`
      SELECT 
        uuid, title, chapter, theme, difficulty, author
      FROM exercises 
      WHERE uuid != ? 
        AND (
          chapter = ? 
          OR theme = ? 
          OR difficulty = ?
        )
      ORDER BY 
        CASE 
          WHEN chapter = ? AND theme = ? THEN 1
          WHEN chapter = ? THEN 2
          WHEN theme = ? THEN 3
          ELSE 4
        END,
        RANDOM()
      LIMIT ?
    `).all(
      uuid,
      reference.chapter, reference.theme, reference.difficulty,
      reference.chapter, reference.theme,
      reference.chapter, reference.theme,
      limit
    );
    
    return similar;
    
  } catch (error) {
    console.error('Database error in getSimilarExercises:', error);
    return [];
  } finally {
    if (db) db.close();
  }
}