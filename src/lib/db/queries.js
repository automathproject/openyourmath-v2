// src/lib/db/queries.js - Version corrigée avec recherche insensible à la casse
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve('data/exercises.sqlite');

function prepareSearchQuery(query) {
  if (!query || query.trim() === '') {
    return '';
  }
  const cleanQuery = query.trim().toLowerCase();
  if (cleanQuery.length <= 2) {
    return null; 
  }
  return `"${cleanQuery}"*`;
}

/**
 * Recherche d'exercices avec filtres (version améliorée avec module/niveau)
 */
export async function searchExercises(query = '', filters = {}, options = {}) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    const { limit = 20, offset = 0 } = options;
    const searchQuery = prepareSearchQuery(query);
    
    let sql, params = [];
    
    if (query.trim() && searchQuery === null) {
      sql = `
        SELECT e.uuid, e.title, e.chapter, e.subchapter, e.theme, e.difficulty, e.module, e.author, e.created_at
        FROM exercises e
        WHERE (UPPER(e.title) LIKE UPPER(?) OR UPPER(e.chapter) LIKE UPPER(?) OR UPPER(e.theme) LIKE UPPER(?) OR UPPER(e.module) LIKE UPPER(?))
      `;
      const likeQuery = `%${query.trim()}%`;
      params.push(likeQuery, likeQuery, likeQuery, likeQuery);
    } else if (searchQuery) {
      sql = `
        SELECT e.uuid, e.title, e.chapter, e.subchapter, e.theme, e.difficulty, e.module, e.author, e.created_at, bm25(fts_exercises) as rank
        FROM exercises e JOIN fts_exercises fts ON e.uuid = fts.uuid
        WHERE fts_exercises MATCH ?
      `;
      params.push(searchQuery);
    } else {
      sql = `
        SELECT e.uuid, e.title, e.chapter, e.subchapter, e.theme, e.difficulty, e.module, e.author, e.created_at
        FROM exercises e WHERE 1=1
      `;
    }
    
    // Filtres avec insensibilité à la casse
    if (filters.subchapter) {
      sql += ' AND UPPER(e.subchapter) = UPPER(?)';
      params.push(filters.subchapter);
      
      if (filters.chapter) {
        sql += ' AND UPPER(e.chapter) = UPPER(?)';
        params.push(filters.chapter);
      }
    } else if (filters.chapter) {
      sql += ' AND UPPER(e.chapter) = UPPER(?)';
      params.push(filters.chapter);
    }
    
    if (filters.module) {
      sql += ' AND UPPER(e.module) = UPPER(?)';
      params.push(filters.module);
    }
    
    if (filters.difficulty) {
      sql += ' AND UPPER(e.difficulty) = UPPER(?)';
      params.push(filters.difficulty);
    }
    
    if (filters.author) {
      sql += ' AND UPPER(e.author) = UPPER(?)';
      params.push(filters.author);
    }
    
    // Ordre et Pagination
    if (searchQuery) {
      sql += ' ORDER BY rank';
    } else if (query.trim() && searchQuery === null) {
      sql += ' ORDER BY e.title';
    } else {
      sql += ' ORDER BY e.created_at DESC';
    }
    
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
    
    if (query.trim() && searchQuery === null) {
      sql = `
        SELECT COUNT(*) as count FROM exercises e
        WHERE (UPPER(e.title) LIKE UPPER(?) OR UPPER(e.chapter) LIKE UPPER(?) OR UPPER(e.theme) LIKE UPPER(?) OR UPPER(e.module) LIKE UPPER(?))
      `;
      const likeQuery = `%${query.trim()}%`;
      params.push(likeQuery, likeQuery, likeQuery, likeQuery);
    } else if (searchQuery) {
      sql = `
        SELECT COUNT(*) as count FROM exercises e JOIN fts_exercises fts ON e.uuid = fts.uuid
        WHERE fts_exercises MATCH ?
      `;
      params.push(searchQuery);
    } else {
      sql = 'SELECT COUNT(*) as count FROM exercises e WHERE 1=1';
    }
    
    // Mêmes filtres que dans searchExercises
    if (filters.subchapter) {
      sql += ' AND UPPER(e.subchapter) = UPPER(?)';
      params.push(filters.subchapter);
      
      if (filters.chapter) {
        sql += ' AND UPPER(e.chapter) = UPPER(?)';
        params.push(filters.chapter);
      }
    } else if (filters.chapter) {
      sql += ' AND UPPER(e.chapter) = UPPER(?)';
      params.push(filters.chapter);
    }
    
    if (filters.module) {
      sql += ' AND UPPER(e.module) = UPPER(?)';
      params.push(filters.module);
    }
    
    if (filters.difficulty) {
      sql += ' AND UPPER(e.difficulty) = UPPER(?)';
      params.push(filters.difficulty);
    }
    
    if (filters.author) {
      sql += ' AND UPPER(e.author) = UPPER(?)';
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

export async function getExerciseByUuid(uuid) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    const exercise = db.prepare(`
      SELECT 
        uuid, title, chapter, subchapter, theme, difficulty, module,
        author, organization, video_id, created_at, updated_at,
        content_json
      FROM exercises 
      WHERE uuid = ?
    `).get(uuid);
    
    if (!exercise) {
      return null;
    }
    
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

export async function getSimilarExercises(uuid, limit = 5) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    const reference = db.prepare('SELECT chapter, theme, difficulty, module FROM exercises WHERE uuid = ?').get(uuid);
    
    if (!reference) {
      return [];
    }
    
    const similar = db.prepare(`
      SELECT 
        uuid, title, chapter, theme, difficulty, module, author
      FROM exercises 
      WHERE uuid != ? 
        AND (
          chapter = ? 
          OR theme = ? 
          OR difficulty = ?
          OR module = ?
        )
      ORDER BY 
        CASE 
          WHEN module = ? AND chapter = ? THEN 1
          WHEN chapter = ? AND theme = ? THEN 2
          WHEN module = ? THEN 3
          WHEN chapter = ? THEN 4
          WHEN theme = ? THEN 5
          ELSE 6
        END,
        RANDOM()
      LIMIT ?
    `).all(
      uuid,
      reference.chapter, reference.theme, reference.difficulty, reference.module,
      reference.module, reference.chapter,
      reference.chapter, reference.theme,
      reference.module,
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
 * FONCTION CORRIGÉE : Retourne la structure hiérarchique Niveau > Module > Chapitre > Sous-chapitre
 */
export async function getChapterStructure() {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    // Requête pour obtenir tous les groupements avec comptages
    const query = `
      SELECT 
        difficulty,
        module,
        chapter,
        subchapter,
        COUNT(*) as exerciseCount
      FROM exercises 
      WHERE 
        difficulty IS NOT NULL 
        AND module IS NOT NULL 
        AND chapter IS NOT NULL
      GROUP BY difficulty, module, chapter, subchapter
      ORDER BY 
        CASE 
          WHEN difficulty LIKE 'L%' THEN CAST(SUBSTR(difficulty, 2) AS INTEGER)
          WHEN difficulty LIKE 'M%' THEN 100 + CAST(SUBSTR(difficulty, 2) AS INTEGER)
          ELSE 1000 
        END,
        module,
        chapter,
        subchapter
    `;
    
    const rows = db.prepare(query).all();
    
    // Construire la hiérarchie
    const hierarchy = new Map();
    
    rows.forEach(row => {
      const level = row.difficulty;
      const module = row.module;
      const chapter = row.chapter;
      const subchapter = row.subchapter;
      const count = row.exerciseCount;
      
      // Niveau (difficulty)
      if (!hierarchy.has(level)) {
        hierarchy.set(level, {
          name: level,
          exerciseCount: 0,
          modules: new Map()
        });
      }
      
      const levelObj = hierarchy.get(level);
      levelObj.exerciseCount += count;
      
      // Module dans le niveau
      if (!levelObj.modules.has(module)) {
        levelObj.modules.set(module, {
          name: module,
          exerciseCount: 0,
          chapters: new Map()
        });
      }
      
      const moduleObj = levelObj.modules.get(module);
      moduleObj.exerciseCount += count;
      
      // Chapitre dans le module
      if (!moduleObj.chapters.has(chapter)) {
        moduleObj.chapters.set(chapter, {
          name: chapter,
          exerciseCount: 0,
          subchapters: new Map()
        });
      }
      
      const chapterObj = moduleObj.chapters.get(chapter);
      chapterObj.exerciseCount += count;
      
      // Sous-chapitre dans le chapitre (si existe)
      if (subchapter) {
        if (!chapterObj.subchapters.has(subchapter)) {
          chapterObj.subchapters.set(subchapter, {
            name: subchapter,
            exerciseCount: 0
          });
        }
        chapterObj.subchapters.get(subchapter).exerciseCount += count;
      }
    });
    
    // Convertir en arrays et trier
    const result = Array.from(hierarchy.entries()).map(([levelName, levelData]) => ({
      name: levelName,
      exerciseCount: levelData.exerciseCount,
      modules: Array.from(levelData.modules.entries()).map(([moduleName, moduleData]) => ({
        name: moduleName,
        exerciseCount: moduleData.exerciseCount,
        chapters: Array.from(moduleData.chapters.entries()).map(([chapterName, chapterData]) => ({
          name: chapterName,
          exerciseCount: chapterData.exerciseCount,
          subchapters: Array.from(chapterData.subchapters.entries()).map(([subName, subData]) => ({
            name: subName,
            exerciseCount: subData.exerciseCount
          })).sort((a, b) => a.name.localeCompare(b.name))
        })).sort((a, b) => a.name.localeCompare(b.name))
      })).sort((a, b) => a.name.localeCompare(b.name))
    })).sort((a, b) => {
      // Tri intelligent des niveaux
      const getOrder = (level) => {
        if (level.startsWith('L')) return parseInt(level.substring(1)) || 0;
        if (level.startsWith('M')) return 100 + (parseInt(level.substring(1)) || 0);
        return 1000;
      };
      return getOrder(a.name) - getOrder(b.name);
    });
    
    console.log(`Chapter structure built: ${result.length} levels, ${rows.length} total combinations`);
    return result;
    
  } catch (error) {
    console.error('Error building chapter structure:', error);
    throw error;
  } finally {
    if (db) db.close();
  }
}

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
        
      case 'modules':
        query = `
          SELECT DISTINCT module as value, COUNT(*) as count
          FROM exercises 
          WHERE module IS NOT NULL AND TRIM(module) != ''
          GROUP BY module 
          ORDER BY count DESC, module
          LIMIT ?
        `;
        break;
        
      case 'levels':
        query = `
          SELECT DISTINCT difficulty as value, COUNT(*) as count
          FROM exercises 
          WHERE difficulty IS NOT NULL AND TRIM(difficulty) != ''
          GROUP BY difficulty 
          ORDER BY 
            CASE 
              WHEN difficulty LIKE 'L%' THEN 1
              WHEN difficulty LIKE 'M%' THEN 2
              WHEN difficulty LIKE 'D%' THEN 3
              ELSE 4
            END,
            difficulty
          LIMIT ?
        `;
        break;
        
      default:
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
          UNION ALL
          SELECT 'module' as type, module as value, COUNT(*) as count
          FROM exercises 
          WHERE module IS NOT NULL AND TRIM(module) != ''
          GROUP BY module
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