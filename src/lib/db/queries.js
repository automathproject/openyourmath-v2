// src/lib/db/queries.js - Version complète avec toutes les fonctions nécessaires
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
    
    // Ajouter les filtres - Logique hiérarchique
    if (filters.subchapter) {
      // Si on a un sous-chapitre, on filtre UNIQUEMENT sur celui-ci
      // Le sous-chapitre est suffisamment spécifique
      sql += ' AND e.subchapter = ?';
      params.push(filters.subchapter);
      
      // On peut aussi ajouter le chapitre pour plus de sécurité
      if (filters.chapter) {
        sql += ' AND e.chapter = ?';
        params.push(filters.chapter);
      }
      
      console.log('Filtering by subchapter:', filters.subchapter, 'and chapter:', filters.chapter);
    } else if (filters.chapter) {
      // Si on n'a qu'un chapitre (pas de sous-chapitre), on filtre sur le chapitre
      sql += ' AND e.chapter = ?';
      params.push(filters.chapter);
      
      console.log('Filtering by chapter only:', filters.chapter);
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
    
    console.log('Results count:', results.length);
    console.log('First few results subchapters:', results.slice(0, 3).map(r => ({title: r.title, subchapter: r.subchapter})));
    
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
    
    // Ajouter les filtres - même logique hiérarchique
    if (filters.subchapter) {
      // Si on a un sous-chapitre, on filtre sur celui-ci
      sql += ' AND e.subchapter = ?';
      params.push(filters.subchapter);
      
      if (filters.chapter) {
        sql += ' AND e.chapter = ?';
        params.push(filters.chapter);
      }
    } else if (filters.chapter) {
      // Sinon on filtre sur le chapitre seulement
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

/**
 * Récupère la structure hiérarchique des chapitres et sous-chapitres
 */
export async function getChapterStructure() {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    // Récupérer tous les chapitres avec leurs counts
    const chapters = db.prepare(`
      SELECT 
        chapter,
        subchapter,
        COUNT(*) as exerciseCount
      FROM exercises 
      WHERE chapter IS NOT NULL 
      GROUP BY chapter, subchapter
      ORDER BY chapter, subchapter
    `).all();
    
    // Organiser en structure hiérarchique
    const structure = [];
    const chapterMap = new Map();
    
    for (const row of chapters) {
      if (!chapterMap.has(row.chapter)) {
        chapterMap.set(row.chapter, {
          name: row.chapter,
          exerciseCount: 0,
          subchapters: []
        });
        structure.push(chapterMap.get(row.chapter));
      }
      
      const chapterObj = chapterMap.get(row.chapter);
      chapterObj.exerciseCount += row.exerciseCount;
      
      // Ajouter le sous-chapitre s'il existe
      if (row.subchapter) {
        chapterObj.subchapters.push({
          name: row.subchapter,
          exerciseCount: row.exerciseCount
        });
      }
    }
    
    return structure;
    
  } catch (error) {
    console.error('Database error in getChapterStructure:', error);
    throw new Error('Erreur lors de la récupération de la structure');
  } finally {
    if (db) db.close();
  }
}

/**
 * Récupère des suggestions pour l'autocomplétion
 */
export async function getSuggestions(type = 'all', limit = 10) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    let query = '';
    
    switch (type) {
      case 'chapters':
        query = `
          SELECT DISTINCT chapter as value, COUNT(*) as count
          FROM exercises 
          WHERE chapter IS NOT NULL
          GROUP BY chapter 
          ORDER BY count DESC, chapter
          LIMIT ?
        `;
        break;
        
      case 'themes':
        query = `
          SELECT DISTINCT theme as value, COUNT(*) as count
          FROM exercises 
          WHERE theme IS NOT NULL
          GROUP BY theme 
          ORDER BY count DESC, theme
          LIMIT ?
        `;
        break;
        
      case 'authors':
        query = `
          SELECT DISTINCT author as value, COUNT(*) as count
          FROM exercises 
          WHERE author IS NOT NULL
          GROUP BY author 
          ORDER BY count DESC, author
          LIMIT ?
        `;
        break;
        
      default:
        // Suggestions mixtes
        query = `
          SELECT 'chapter' as type, chapter as value, COUNT(*) as count
          FROM exercises 
          WHERE chapter IS NOT NULL
          GROUP BY chapter 
          
          UNION ALL
          
          SELECT 'theme' as type, theme as value, COUNT(*) as count
          FROM exercises 
          WHERE theme IS NOT NULL
          GROUP BY theme 
          
          ORDER BY count DESC
          LIMIT ?
        `;
        break;
    }
    
    const results = db.prepare(query).all(limit);
    return results;
    
  } catch (error) {
    console.error('Database error in getSuggestions:', error);
    return [];
  } finally {
    if (db) db.close();
  }
}